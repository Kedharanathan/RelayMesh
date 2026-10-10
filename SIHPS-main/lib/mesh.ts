/* ==========================================================================
   Mesh simulation model.
   --------------------------------------------------------------------------
   Framework free on purpose: the hero and the system-overview section are the
   same running simulation, handed from one layout to the other on scroll. The
   React layer owns nothing but the toggles.

   Every rule modelled here is a rule the real firmware implements:
     - each robot broadcasts its own state on a timer, to nobody in particular
     - a receiver merges the sender's Lamport clock with max(own, recv) + 1
     - a peer that has not been heard from within the timeout is suspected
     - a robot that suspects any peer drops to HOLD, which is the safe default

   The fleet also runs a real duty cycle, because a mesh where nothing happens
   proves nothing. Robots travel to named aisles, work there, drain their
   battery doing it, and divert to the dock when it gets low. Below the
   brownout floor the radio sags before the motors do, the robot drops off the
   mesh, and its neighbours hold. It charges, comes back, and the floor
   resumes. That whole story runs unattended, on a loop.

   TIME: movement is at a plausible AMR pace, 1.4 m/s across an 18 x 12 m
   floor. Battery is deliberately NOT at real scale; a real pack lasts hours.
   It is accelerated so a full discharge and recharge is watchable, and the UI
   says so rather than implying these are measured numbers.
   ========================================================================== */

export const FLOOR_W = 18.0; // metres, matches the position field in the packet
export const FLOOR_H = 12.0;

export const BROADCAST_INTERVAL = 1.35; // seconds
export const BROADCAST_JITTER = 0.3;
export const STALE_TIMEOUT = 2.6; // two missed intervals plus margin
export const RANGE = 0.8; // normalised field units

export const SPEED_MPS = 1.4;
/** A flat robot is dragged in by hand, well below its own driving speed. */
export const TOW_MPS = 0.55;
/** Chassis-to-chassis clearance, in metres. Below this two robots are
 *  drawn on top of each other, which on a real floor is a collision. */
export const CLEARANCE_M = 1.3;

/** Battery rates, in percent per second of simulated time. Accelerated. */
export const DRAIN_TRAVEL = 0.75;
export const DRAIN_WORK = 0.3;
/* Standing still is not free. A held robot still powers its compute, its
   radio and its brake solenoids, which is why a long HOLD is a real cost and
   not just a pause: hold a low robot long enough and it will not reach the
   dock. That outcome is reachable from the controls on this page. */
export const DRAIN_IDLE = 0.35;
export const CHARGE_RATE = 3.6;

export const BATT_DIVERT = 25; // head for the dock
export const BATT_BROWNOUT = 12; // radio starts sagging
export const BATT_RADIO_OK = 22; // radio is dependable again
export const BATT_RESUME = 88; // leave the dock

/** How long a flat robot sits before a human notices and tows it. */
export const RECOVERY_DELAY = 9;

export type RobotState = "NOMINAL" | "HOLD" | "OFFLINE";
export type TaskState = "TRAVEL" | "WORK" | "CHARGE" | "WAIT" | "TOW" | "DOWN";

export type Waypoint = {
  id: string;
  x: number;
  y: number;
  kind: "aisle" | "dock" | "stage";
  /** How many robots the location physically holds. */
  slots: number;
};

export const WAYPOINTS: Waypoint[] = [
  { id: "A-14", x: 0.15, y: 0.2, kind: "aisle", slots: 1 },
  { id: "B-03", x: 0.76, y: 0.17, kind: "aisle", slots: 1 },
  { id: "C-11", x: 0.18, y: 0.72, kind: "aisle", slots: 1 },
  { id: "D-07", x: 0.6, y: 0.6, kind: "aisle", slots: 1 },
  { id: "E-02", x: 0.88, y: 0.46, kind: "aisle", slots: 1 },
  // A robot with nowhere to go has to stand somewhere, and "wherever it
  // happened to stop" means standing in a live aisle. Staging is that
  // somewhere, and it is reserved by slot like everything else.
  { id: "STAGE", x: 0.46, y: 0.05, kind: "stage", slots: 3 },
  { id: "DOCK", x: 0.46, y: 0.93, kind: "dock", slots: 2 },
];

const DOCK = WAYPOINTS[WAYPOINTS.length - 1];
const STAGE = WAYPOINTS.find((w) => w.kind === "stage")!;
const AISLES = WAYPOINTS.filter((w) => w.kind === "aisle");

export function waypoint(id: string): Waypoint {
  return WAYPOINTS.find((w) => w.id === id) ?? DOCK;
}

/** Where a robot actually parks. Multi-slot locations fan out, so two
 *  chargers are two chargers rather than one robot drawn twice. */
export function stopPos(w: Waypoint, bay: number): { x: number; y: number } {
  if (w.slots <= 1) return { x: w.x, y: w.y };
  const spread = 0.05;
  const offset = (bay - (w.slots - 1) / 2) * spread * 2;
  return { x: w.x + offset, y: w.y };
}

export type LogEvent = {
  seq: number;
  t: number;
  robot: string;
  text: string;
  tone: "info" | "accent" | "hold" | "stop";
};

export type Robot = {
  id: string;
  clock: number;

  /** position in normalised field space */
  nx: number;
  ny: number;
  /** resolved to pixels each frame by the renderer */
  px: number;
  py: number;
  heading: number;
  speed: number;

  battery: number;
  task: TaskState;
  target: string;
  /** which slot of `target` this robot holds, -1 when it holds none */
  bay: number;
  workLeft: number;
  tasksDone: number;

  /** id of the robot this one is giving way to this frame, if any */
  yieldTo: string | null;
  /** the pack reached zero: motors down, waiting on a human */
  dead: boolean;
  recoverLeft: number;

  /** visitor pulled the radio */
  manualOffline: boolean;
  /** the battery pulled the radio */
  brownout: boolean;
  /** why the radio is down, so the log does not report it twice */
  offlineCause: "none" | "manual" | "brownout" | "flat";
  brownoutLeft: number;
  nextBrownoutCheck: number;

  online: boolean;
  nextBroadcast: number;
  /** peer id -> sim time we last received from them */
  lastHeard: Record<string, number>;
  state: RobotState;

  /** transient render cues, seconds remaining */
  recvFlash: number;
  sendFlash: number;
};

export type Pulse = { from: string; age: number; life: number };
export type Packet = {
  from: string;
  to: string;
  age: number;
  life: number;
  clock: number;
};

export type MeshSim = {
  t: number;
  robots: Robot[];
  pulses: Pulse[];
  packets: Packet[];
  brokerOn: boolean;
  cloudOn: boolean;
  delivered: number;
  brokerFlash: number;
  cloudFlash: number;
  events: LogEvent[];
  seq: number;
  /** waypoint id -> ids holding a slot there, in slot order. Two robots are
   *  never sent to the same place, which is the point of the whole system. */
  claims: Record<string, string[]>;
};

/* Batteries are staggered on purpose, and R-03 is staged to lose.
   It starts at six percent in the corner furthest from the dock, which is
   about a percent short of the trip. So the whole failure ladder plays out
   unattended inside the first minute, in the order the hardware actually
   fails it: radio sags first, then the motors stop, then a human has to walk
   out and fetch it. Nothing here is on a timer pretending to be physics. */
const ROSTER: {
  id: string;
  x: number;
  y: number;
  battery: number;
  target: string;
  /** when the pack is first sagging enough to check the radio */
  brownoutAt: number;
}[] = [
  { id: "R-01", x: 0.22, y: 0.34, battery: 86, target: "A-14", brownoutAt: 6 },
  { id: "R-02", x: 0.64, y: 0.26, battery: 61, target: "B-03", brownoutAt: 8 },
  { id: "R-03", x: 0.92, y: 0.08, battery: 6, target: "C-11", brownoutAt: 4 },
  { id: "R-04", x: 0.82, y: 0.58, battery: 94, target: "E-02", brownoutAt: 12 },
  { id: "R-05", x: 0.12, y: 0.5, battery: 43, target: "D-07", brownoutAt: 14 },
  // Six robots, five aisles. R-06 starts with nowhere free to go, which is
  // exactly the case the reservation has to handle rather than paper over.
  { id: "R-06", x: 0.66, y: 0.84, battery: 72, target: "D-07", brownoutAt: 16 },
];

export const MAX_ROBOTS = ROSTER.length;

/** Ids in roster order. The UI reads this rather than the live sim, because
 *  the sim is swapped in an effect and would be one render stale. */
export const ROSTER_IDS = ROSTER.map((r) => r.id);

/* -------------------------------------------------------------------------
   Slot reservation.

   The floor is a set of locations with a physical capacity, and a robot may
   only drive to one it holds a slot in. Conflicts are resolved by lowest id,
   the same total order the mutual-exclusion section uses, so the outcome does
   not depend on frame timing.
   ------------------------------------------------------------------------- */

function heldBy(sim: MeshSim, id: string): string | null {
  for (const w of WAYPOINTS) {
    if ((sim.claims[w.id] ?? []).includes(id)) return w.id;
  }
  return null;
}

function releaseSlot(sim: MeshSim, r: Robot) {
  const at = heldBy(sim, r.id);
  if (!at) {
    r.bay = -1;
    return;
  }
  sim.claims[at] = sim.claims[at].filter((x) => x !== r.id);
  r.bay = -1;
}

/** Take a slot at `id`, or return false if the location is full. */
function takeSlot(sim: MeshSim, r: Robot, id: string): boolean {
  const w = waypoint(id);
  const held = (sim.claims[w.id] ??= []);
  if (held.includes(r.id)) {
    r.bay = held.indexOf(r.id);
    return true;
  }
  if (held.length >= w.slots) return false;
  releaseSlot(sim, r);
  held.push(r.id);
  r.bay = held.indexOf(r.id);
  return true;
}

/** Nearest location with a free slot, out of `pool`. */
function nearestFree(sim: MeshSim, r: Robot, pool: Waypoint[]): Waypoint | null {
  let best: Waypoint | null = null;
  let bestD = Infinity;
  for (const w of pool) {
    const held = sim.claims[w.id] ?? [];
    if (held.length >= w.slots && !held.includes(r.id)) continue;
    const d = Math.hypot((w.x - r.nx) * FLOOR_W, (w.y - r.ny) * FLOOR_H);
    if (d < bestD) {
      best = w;
      bestD = d;
    }
  }
  return best;
}

/** Withdraw to a reserved staging slot. Falling back to "stop where you are"
 *  is what put two robots in one square metre, so it is the last resort. */
function standby(sim: MeshSim, r: Robot) {
  if (r.task === "WAIT") return;
  r.task = "WAIT";
  r.target = takeSlot(sim, r, STAGE.id) ? STAGE.id : "";
  if (!r.target) releaseSlot(sim, r);
}

/** Send a robot to the nearest free aisle, or to staging if every aisle is
 *  taken. There is deliberately no fallback to the aisle it just left: with
 *  more robots than aisles that produced a robot re-picking its own bay on
 *  the same frame it departed. */
function dispatch(sim: MeshSim, r: Robot, avoid: string): boolean {
  const target = nearestFree(
    sim,
    r,
    AISLES.filter((w) => w.id !== avoid),
  );
  if (!target || !takeSlot(sim, r, target.id)) {
    standby(sim, r);
    return false;
  }
  r.target = target.id;
  r.task = "TRAVEL";
  return true;
}

export function createSim(count = 3): MeshSim {
  const robots: Robot[] = ROSTER.slice(0, count).map((r, i) => ({
    id: r.id,
    clock: 0,
    nx: r.x,
    ny: r.y,
    px: 0,
    py: 0,
    heading: 0,
    speed: 0,
    battery: r.battery,
    task: "TRAVEL",
    target: r.target,
    bay: -1,
    workLeft: 0,
    tasksDone: 0,
    yieldTo: null,
    dead: false,
    recoverLeft: 0,
    manualOffline: false,
    brownout: false,
    offlineCause: "none",
    brownoutLeft: 0,
    nextBrownoutCheck: r.brownoutAt,
    online: true,
    // stagger the first transmission so the mesh does not start in lockstep
    nextBroadcast: 0.25 + i * (BROADCAST_INTERVAL / Math.max(count, 1)),
    lastHeard: {},
    state: "NOMINAL",
    recvFlash: 0,
    sendFlash: 0,
  }));

  // Everyone starts having just heard everyone: the fleet boots converged.
  robots.forEach((a) => {
    robots.forEach((b) => {
      if (a.id !== b.id) a.lastHeard[b.id] = 0;
    });
  });

  const sim: MeshSim = {
    t: 0,
    robots,
    pulses: [],
    packets: [],
    brokerOn: true,
    cloudOn: true,
    delivered: 0,
    brokerFlash: 0,
    cloudFlash: 0,
    events: [],
    seq: 1,
    claims: {},
  };

  // Book the opening assignments through the same reservation the running
  // fleet uses, so the roster cannot start two robots on one aisle.
  for (const r of sim.robots) {
    if (!takeSlot(sim, r, r.target)) dispatch(sim, r, "");
  }

  return sim;
}

export function setRobotCount(sim: MeshSim, count: number): MeshSim {
  const next = createSim(count);
  // Carry over what the visitor has already changed, so resizing the fleet is
  // not a hidden reset of their toggles.
  next.brokerOn = sim.brokerOn;
  next.cloudOn = sim.cloudOn;
  next.t = sim.t;
  next.delivered = sim.delivered;
  next.events = sim.events;
  next.seq = sim.seq;
  next.claims = {};
  next.robots.forEach((r) => {
    const prev = sim.robots.find((p) => p.id === r.id);
    if (prev) {
      r.clock = prev.clock;
      r.battery = prev.battery;
      r.manualOffline = prev.manualOffline;
      r.nx = prev.nx;
      r.ny = prev.ny;
      r.task = prev.task;
      r.target = prev.target;
      r.tasksDone = prev.tasksDone;
      r.dead = prev.dead;
      r.recoverLeft = prev.recoverLeft;
      r.workLeft = prev.workLeft;
    }
    next.robots.forEach((o) => {
      if (o.id !== r.id) r.lastHeard[o.id] = sim.t;
    });
    r.nextBroadcast = sim.t + Math.random() * BROADCAST_INTERVAL;
  });

  // Rebuild the reservation from the surviving robots. Anyone whose slot is
  // gone is re-dispatched rather than left pointing at a place it does not
  // hold, which is how a resize used to smuggle in a double booking.
  next.robots.forEach((r) => {
    r.bay = -1;
    if (r.task === "WAIT" || !r.target) return;
    if (!takeSlot(next, r, r.target)) dispatch(next, r, "");
  });
  return next;
}

function log(
  sim: MeshSim,
  robot: string,
  text: string,
  tone: LogEvent["tone"] = "info",
) {
  sim.events.push({ seq: sim.seq++, t: sim.t, robot, text, tone });
  if (sim.events.length > 80) sim.events.splice(0, sim.events.length - 80);
}

function normDist(a: Robot, b: Robot) {
  return Math.hypot(a.nx - b.nx, a.ny - b.ny);
}

/** Real distance. The field is 18 x 12, so normalised distance is anisotropic
 *  and useless for anything physical. */
function metreDist(a: Robot, b: Robot) {
  return Math.hypot((a.nx - b.nx) * FLOOR_W, (a.ny - b.ny) * FLOOR_H);
}

export function inRange(a: Robot, b: Robot) {
  return normDist(a, b) <= RANGE;
}

/** Head for a charger, or stand still if both bays are taken. Standing still
 *  while low is a real risk, and the fleet is allowed to lose that bet. */
function divert(sim: MeshSim, r: Robot) {
  if (takeSlot(sim, r, DOCK.id)) {
    r.target = DOCK.id;
    r.task = "TRAVEL";
    log(
      sim,
      r.id,
      `BATTERY ${Math.round(r.battery)}%, diverting to DOCK`,
      "hold",
    );
    return;
  }
  if (r.task === "WAIT") return; // already waiting, do not log it twice
  standby(sim, r);
  log(
    sim,
    r.id,
    `BATTERY ${Math.round(r.battery)}%, both bays taken, waiting`,
    "stop",
  );
}

/** Advance the simulation. Pure state, no drawing. */
export function stepSim(sim: MeshSim, dt: number) {
  sim.t += dt;
  const t = sim.t;

  /* --- separation -------------------------------------------------------
     Reservation keeps two robots off one waypoint; this keeps them off each
     other in transit. Right of way goes to the lower id, the same total
     order the mutual-exclusion section uses, so the yield is decided the
     same way every run and can never be mutual. */
  for (const r of sim.robots) {
    const was = r.yieldTo;
    r.yieldTo = null;
    if ((r.task === "TRAVEL" || r.task === "WAIT") && r.state !== "HOLD") {
      for (const o of sim.robots) {
        if (o.id >= r.id) continue;
        if (metreDist(r, o) < CLEARANCE_M) {
          r.yieldTo = o.id;
          break;
        }
      }
    }
    if (r.yieldTo && r.yieldTo !== was) {
      log(sim, r.id, `YIELDS to ${r.yieldTo}, right of way by id`, "info");
    }
  }

  for (const r of sim.robots) {
    r.recvFlash = Math.max(0, r.recvFlash - dt);
    r.sendFlash = Math.max(0, r.sendFlash - dt);

    /* --- radio availability ------------------------------------------ */
    // Below the brownout floor the transmit current sags the pack far enough
    // to drop the link before it stops the motors. The radio goes first.
    if (r.dead) {
      // A flat pack is not a brownout. Nothing recovers on its own.
    } else if (r.brownout) {
      r.brownoutLeft -= dt;
      if (r.brownoutLeft <= 0 || r.battery > BATT_RADIO_OK) {
        r.brownout = false;
        r.nextBrownoutCheck = t + 9 + Math.random() * 6;
        log(sim, r.id, `RADIO UP, battery ${Math.round(r.battery)}%`, "accent");
      }
    } else if (r.battery < BATT_BROWNOUT && t > r.nextBrownoutCheck) {
      r.brownout = true;
      r.brownoutLeft = 5 + Math.random() * 3;
      log(
        sim,
        r.id,
        `RADIO BROWNOUT at ${Math.round(r.battery)}%, off the mesh`,
        "stop",
      );
    }

    /* --- flat pack ----------------------------------------------------- */
    // The battery floor is not cosmetic. At zero the motors are down, the
    // radio is down, and nothing the fleet can do brings it back: a human
    // has to come and get it. Its slot is released immediately, because it
    // is never going to arrive and no one else should be blocked waiting.
    if (!r.dead && r.battery <= 0 && r.task !== "CHARGE" && r.task !== "TOW") {
      r.dead = true;
      r.recoverLeft = RECOVERY_DELAY;
      r.task = "DOWN";
      r.target = "";
      r.speed = 0;
      releaseSlot(sim, r);
      log(sim, r.id, "BATTERY 0%, MOTORS DOWN, awaiting recovery", "stop");
    }

    r.online = !r.manualOffline && !r.brownout && !r.dead;

    if (r.dead && r.task === "DOWN") {
      r.recoverLeft -= dt;
      if (r.recoverLeft <= 0 && takeSlot(sim, r, DOCK.id)) {
        r.task = "TOW";
        r.target = DOCK.id;
        log(sim, r.id, "RECOVERY crew towing to DOCK", "hold");
      }
    }

    /* --- motion --------------------------------------------------------
       HOLD is the whole safety claim: a robot that cannot account for a peer
       stops. It applies here, to the wheels, not just to a status chip. A
       tow is the exception, because the wheels are not driving it. */
    const held = r.state === "HOLD";
    const driving =
      !held && !r.yieldTo && (r.state !== "OFFLINE" || r.target === DOCK.id);
    const wp = waypoint(r.target);
    const stop = r.target ? stopPos(wp, Math.max(0, r.bay)) : null;
    r.speed = 0;

    /** Close on the reserved slot. Returns true on arrival. */
    const advance = (mps: number, drain: number) => {
      if (!stop) return false;
      const dxm = (stop.x - r.nx) * FLOOR_W;
      const dym = (stop.y - r.ny) * FLOOR_H;
      const distM = Math.hypot(dxm, dym);
      if (distM < 0.2) {
        r.nx = stop.x;
        r.ny = stop.y;
        return true;
      }
      /* Steer, do not just aim. Right of way by id settles who gives way in
         a head-on; this is what keeps a robot from driving through one that
         is parked and picking, which id order says nothing about. Reserved
         slots are further apart than the clearance, so nothing repels a
         robot off the destination it holds. */
      let ux = dxm / distM;
      let uy = dym / distM;
      for (const o of sim.robots) {
        if (o.id === r.id) continue;
        const ox = (r.nx - o.nx) * FLOOR_W;
        const oy = (r.ny - o.ny) * FLOOR_H;
        const d = Math.hypot(ox, oy);
        if (d >= CLEARANCE_M || d < 1e-4) continue;
        const push = ((CLEARANCE_M - d) / CLEARANCE_M) * 2.4;
        ux += (ox / d) * push;
        uy += (oy / d) * push;
      }
      const un = Math.hypot(ux, uy) || 1;
      ux /= un;
      uy /= un;

      const stepM = Math.min(distM, mps * dt);
      r.nx += ux * (stepM / FLOOR_W);
      r.ny += uy * (stepM / FLOOR_H);
      r.heading = Math.atan2(uy / FLOOR_H, ux / FLOOR_W);
      r.speed = mps;
      r.battery = Math.max(0, r.battery - drain * dt);
      return false;
    };

    switch (r.task) {
      case "TOW": {
        if (advance(TOW_MPS, 0)) {
          r.task = "CHARGE";
          log(sim, r.id, "ON CHARGE after recovery", "accent");
        }
        break;
      }

      case "TRAVEL": {
        if (!driving) {
          r.battery = Math.max(0, r.battery - DRAIN_IDLE * dt);
          break;
        }
        if (advance(SPEED_MPS, DRAIN_TRAVEL)) {
          if (wp.kind === "dock") {
            r.task = "CHARGE";
            log(sim, r.id, `DOCKED in bay ${r.bay + 1}, charging`, "accent");
          } else {
            r.task = "WORK";
            r.workLeft = 3.5 + Math.random() * 3;
            log(sim, r.id, `ARRIVED ${wp.id}, picking`, "info");
          }
        } else if (r.target !== DOCK.id && r.battery < BATT_DIVERT) {
          // Turn round the moment it crosses the threshold rather than
          // finishing the trip and stranding itself out on the floor.
          divert(sim, r);
        }
        break;
      }

      case "WORK": {
        if (held) {
          r.battery = Math.max(0, r.battery - DRAIN_IDLE * dt);
          break;
        }
        r.workLeft -= dt;
        r.battery = Math.max(0, r.battery - DRAIN_WORK * dt);
        if (r.workLeft <= 0) {
          r.tasksDone += 1;
          if (r.battery < BATT_DIVERT) divert(sim, r);
          else {
            const sent = dispatch(sim, r, wp.id);
            log(
              sim,
              r.id,
              sent ? `DEPART for ${r.target}` : "no free aisle, waiting",
              "info",
            );
          }
        }
        break;
      }

      case "CHARGE": {
        r.battery = Math.min(100, r.battery + CHARGE_RATE * dt);
        if (r.dead && r.battery > BATT_RADIO_OK) {
          r.dead = false;
          log(
            sim,
            r.id,
            `RECOVERED, radio up at ${Math.round(r.battery)}%`,
            "accent",
          );
        }
        if (!r.dead && r.battery >= BATT_RESUME) {
          const sent = dispatch(sim, r, DOCK.id);
          log(
            sim,
            r.id,
            sent
              ? `CHARGED ${Math.round(r.battery)}%, resuming for ${r.target}`
              : `CHARGED ${Math.round(r.battery)}%, no free aisle`,
            "accent",
          );
        }
        break;
      }

      case "WAIT": {
        // Drive clear of the working floor first, then wait there. Standing
        // in an aisle it does not hold is the one thing it must not do.
        if (r.target === STAGE.id && driving) {
          if (!advance(SPEED_MPS, DRAIN_TRAVEL)) break;
        }
        r.battery = Math.max(0, r.battery - DRAIN_IDLE * dt);
        if (r.battery < BATT_DIVERT) divert(sim, r);
        else if (dispatch(sim, r, "")) {
          log(sim, r.id, `aisle freed, DEPART for ${r.target}`, "info");
        }
        break;
      }

      case "DOWN":
      default:
        break;
    }
  }

  /* --- broadcast ---------------------------------------------------- */
  for (const r of sim.robots) {
    if (!r.online) continue;
    if (t < r.nextBroadcast) continue;

    r.nextBroadcast =
      t + BROADCAST_INTERVAL + (Math.random() - 0.5) * 2 * BROADCAST_JITTER;
    // A send is an event, so the sender's clock ticks first.
    r.clock += 1;
    r.sendFlash = 0.32;
    sim.pulses.push({ from: r.id, age: 0, life: 1.5 });

    for (const other of sim.robots) {
      if (other.id === r.id) continue;
      if (!inRange(r, other)) continue;
      const d = Math.hypot(r.px - other.px, r.py - other.py);
      sim.packets.push({
        from: r.id,
        to: other.id,
        age: 0,
        life: Math.min(0.9, 0.34 + d / 1500),
        clock: r.clock,
      });
    }

    if (sim.brokerOn) sim.brokerFlash = 0.45;
    if (sim.brokerOn && sim.cloudOn) sim.cloudFlash = 0.7;
  }

  /* --- delivery ------------------------------------------------------ */
  for (let i = sim.packets.length - 1; i >= 0; i--) {
    const p = sim.packets[i];
    p.age += dt;
    if (p.age < p.life) continue;

    const rx = sim.robots.find((r) => r.id === p.to);
    // A receiver with its radio down hears nothing, so the frame is lost.
    if (rx && rx.online) {
      // The rule, verbatim: C(i) <- max(C(i), C(received)) + 1
      rx.clock = Math.max(rx.clock, p.clock) + 1;
      rx.lastHeard[p.from] = t;
      rx.recvFlash = 0.3;
      sim.delivered += 1;
    }
    sim.packets.splice(i, 1);
  }

  /* --- pulses --------------------------------------------------------- */
  for (let i = sim.pulses.length - 1; i >= 0; i--) {
    sim.pulses[i].age += dt;
    if (sim.pulses[i].age >= sim.pulses[i].life) sim.pulses.splice(i, 1);
  }

  sim.brokerFlash = Math.max(0, sim.brokerFlash - dt);
  sim.cloudFlash = Math.max(0, sim.cloudFlash - dt);

  /* --- failure detection ---------------------------------------------- */
  // A robot that cannot account for every peer it knows about stops moving.
  // This is the whole default-safe claim, in a dozen lines.
  for (const r of sim.robots) {
    const was = r.state;

    if (!r.online) {
      r.state = "OFFLINE";
    } else {
      const lost: string[] = [];
      for (const other of sim.robots) {
        if (other.id === r.id) continue;
        if (!inRange(r, other)) {
          // Out of range is not overdue. Hold the clock so the peer is not
          // suspected the instant it comes back within earshot.
          r.lastHeard[other.id] = t;
          continue;
        }
        const heard = r.lastHeard[other.id] ?? 0;
        if (t - heard > STALE_TIMEOUT) lost.push(other.id);
      }
      r.state = lost.length ? "HOLD" : "NOMINAL";
      if (was !== "HOLD" && r.state === "HOLD") {
        log(sim, r.id, `SUSPECTS ${lost.join(", ")}, HOLD`, "stop");
      }
    }

    if (was === "HOLD" && r.state === "NOMINAL") {
      log(sim, r.id, "peers accounted for, RESUME", "accent");
    }
    if (was !== "OFFLINE" && r.state === "OFFLINE") {
      r.offlineCause = r.manualOffline
        ? "manual"
        : r.dead
          ? "flat"
          : "brownout";
      if (r.offlineCause === "manual") {
        log(sim, r.id, "RADIO CUT by operator", "stop");
      }
    }
    if (was === "OFFLINE" && r.state !== "OFFLINE") {
      // A brownout or a recovery already logged its own return line.
      if (r.offlineCause === "manual") {
        log(sim, r.id, "RADIO RESTORED by operator", "accent");
      }
      r.offlineCause = "none";
    }
  }
}

/** The frame a robot actually puts on the wire. */
export type MeshPacketView = {
  id: string;
  position: [number, number];
  velocity: number;
  battery: number;
  task: string;
  clock: number;
};

/** One short string covering every state the wheels can be in. Shared by the
 *  packet inspector and the canvas so they can never disagree. */
export function taskLabel(r: Robot): string {
  if (r.dead) return r.task === "TOW" ? "TOW" : "MOTORS DOWN";
  if (r.state === "HOLD") return "HOLD";
  if (r.yieldTo) return `YIELD ${r.yieldTo}`;
  if (r.task === "CHARGE") return "CHARGE";
  if (r.task === "WAIT") return "WAIT";
  if (r.task === "WORK") return `PICK ${r.target}`;
  return `${r.task} ${r.target}`;
}

export function packetView(r: Robot): MeshPacketView {
  return {
    id: r.id,
    position: [
      Math.round(r.nx * FLOOR_W * 10) / 10,
      Math.round(r.ny * FLOOR_H * 10) / 10,
    ],
    velocity: Math.round(r.speed * 100) / 100,
    battery: Math.round(r.battery),
    task: taskLabel(r),
    clock: r.clock,
  };
}

export function suspectedBy(sim: MeshSim, r: Robot): string[] {
  const out: string[] = [];
  for (const other of sim.robots) {
    if (other.id === r.id || !other.online) continue;
    if (!inRange(other, r)) continue;
    if (sim.t - (other.lastHeard[r.id] ?? 0) > STALE_TIMEOUT) out.push(other.id);
  }
  return out;
}

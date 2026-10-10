import {
  BATT_BROWNOUT,
  BATT_DIVERT,
  RANGE,
  STALE_TIMEOUT,
  WAYPOINTS,
  inRange,
  stopPos,
  taskLabel,
  waypoint,
  type MeshSim,
  type Robot,
} from "./mesh";
import type { Palette } from "./hooks";

export type Rect = { x: number; y: number; w: number; h: number };

export type DrawOpts = {
  field: Rect;
  /** 0 = full bleed hero, 1 = docked into the overview frame */
  dock: number;
  selected: string | null;
  hovered: string | null;
  narrow: boolean;
  showInfra: boolean;
  /** Whole-mesh opacity. The hero is the 3D scene alone; the mesh fades in
   *  as the instrument takes over. */
  alpha?: number;
};

/* -------------------------------------------------------------------------
   Colour helper. Canvas cannot read CSS variables, and the token values
   arrive as either #rrggbb or rgb(r g b / a), so both need handling.
   ------------------------------------------------------------------------- */
export function withAlpha(color: string, a: number): string {
  const s = color.trim();
  if (s.startsWith("#")) {
    let hex = s.slice(1);
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map((c) => c + c)
        .join("");
    }
    const n = parseInt(hex.slice(0, 6), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
  }
  const nums = s.match(/-?[\d.]+/g);
  if (nums && nums.length >= 3) {
    const base = nums.length >= 4 ? parseFloat(nums[3]) : 1;
    return `rgba(${nums[0]}, ${nums[1]}, ${nums[2]}, ${a * base})`;
  }
  return s;
}

function rrect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, w, h, rad);
    return;
  }
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

/** Mesh lane occupies the whole field in the hero, 76% once docked. */
export function meshLaneHeight(field: Rect, dock: number, showInfra: boolean) {
  const shrink = showInfra ? 0.24 * dock : 0;
  return field.h * (1 - shrink);
}

export function resolveNodePixels(sim: MeshSim, field: Rect, laneH: number) {
  for (const r of sim.robots) {
    r.px = field.x + r.nx * field.w;
    r.py = field.y + r.ny * laneH;
  }
}

export function hitTest(
  sim: MeshSim,
  x: number,
  y: number,
  size: number,
): Robot | null {
  let best: Robot | null = null;
  let bestD = Infinity;
  for (const r of sim.robots) {
    const d = Math.hypot(r.px - x, r.py - y);
    if (d < size * 1.35 && d < bestD) {
      best = r;
      bestD = d;
    }
  }
  return best;
}

export function nodeSize(field: Rect, laneH: number, narrow: boolean) {
  const base = Math.min(field.w, laneH) * 0.088;
  return Math.max(narrow ? 20 : 26, Math.min(base, 44));
}

/* =========================================================================
   Main draw
   ========================================================================= */
export function drawMesh(
  ctx: CanvasRenderingContext2D,
  sim: MeshSim,
  pal: Palette,
  opts: DrawOpts,
  cssW: number,
  cssH: number,
) {
  const { field, dock, selected, hovered, narrow, showInfra } = opts;
  const alpha = opts.alpha ?? 1;

  ctx.clearRect(0, 0, cssW, cssH);
  if (alpha <= 0.001) return;
  ctx.globalAlpha = alpha;

  const laneH = meshLaneHeight(field, dock, showInfra);
  resolveNodePixels(sim, field, laneH);
  const s = nodeSize(field, laneH, narrow);
  const mono = pal.mono;

  /* --- field plate -------------------------------------------------- */
  if (dock > 0.02) {
    ctx.save();
    rrect(ctx, field.x, field.y, field.w, field.h, 14);
    ctx.fillStyle = withAlpha(pal.surface, dock * 0.9);
    ctx.fill();
    ctx.strokeStyle = withAlpha(pal.lineStrong, dock);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  /* --- floor grid, clipped to the field ------------------------------ */
  ctx.save();
  rrect(ctx, field.x, field.y, field.w, field.h, 14);
  ctx.clip();
  ctx.strokeStyle = withAlpha(pal.grid, 0.55 + 0.45 * dock);
  ctx.lineWidth = 1;
  const step = 32;
  const gx0 = field.x + ((field.w % step) / 2);
  for (let x = gx0; x < field.x + field.w; x += step) {
    ctx.beginPath();
    ctx.moveTo(Math.round(x) + 0.5, field.y);
    ctx.lineTo(Math.round(x) + 0.5, field.y + field.h);
    ctx.stroke();
  }
  for (let y = field.y; y < field.y + field.h; y += step) {
    ctx.beginPath();
    ctx.moveTo(field.x, Math.round(y) + 0.5);
    ctx.lineTo(field.x + field.w, Math.round(y) + 0.5);
    ctx.stroke();
  }
  ctx.restore();

  /* --- corner ticks: the instrument frame motif ----------------------- */
  if (dock > 0.25) {
    const a = (dock - 0.25) / 0.75;
    const len = 12;
    ctx.strokeStyle = withAlpha(pal.accent, a * 0.85);
    ctx.lineWidth = 1.5;
    const corners: [number, number, number, number][] = [
      [field.x, field.y, 1, 1],
      [field.x + field.w, field.y, -1, 1],
      [field.x, field.y + field.h, 1, -1],
      [field.x + field.w, field.y + field.h, -1, -1],
    ];
    for (const [cx, cy, sx, sy] of corners) {
      ctx.beginPath();
      ctx.moveTo(cx + sx * 14, cy + sy * 1);
      ctx.lineTo(cx + sx * (14 + len), cy + sy * 1);
      ctx.moveTo(cx + sx * 1, cy + sy * 14);
      ctx.lineTo(cx + sx * 1, cy + sy * (14 + len));
      ctx.stroke();
    }
  }

  /* --- infrastructure lane ------------------------------------------- */
  if (showInfra && dock > 0.45) {
    drawInfra(ctx, sim, pal, field, laneH, dock, narrow, mono, alpha);
  }

  /* --- waypoints: the floor the fleet is actually working ------------- */
  if (dock > 0.3) {
    const wa = Math.min(1, (dock - 0.3) / 0.4);
    ctx.save();
    ctx.font = `400 ${narrow ? 8 : 8.5}px ${mono}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (const w of WAYPOINTS) {
      const x = field.x + w.x * field.w;
      const y = field.y + w.y * laneH;
      const isDock = w.kind === "dock";
      ctx.strokeStyle = withAlpha(isDock ? pal.accent : pal.dim, wa * 0.7);
      ctx.lineWidth = 1;
      const k = isDock ? 6 : 4;
      ctx.beginPath();
      ctx.moveTo(x - k, y);
      ctx.lineTo(x + k, y);
      ctx.moveTo(x, y - k);
      ctx.lineTo(x, y + k);
      ctx.stroke();
      if (isDock) {
        // One ring per bay: the capacity is visible, so a queue at the dock
        // reads as a queue rather than as a bug.
        for (let b = 0; b < w.slots; b++) {
          const p = stopPos(w, b);
          ctx.beginPath();
          ctx.arc(field.x + p.x * field.w, field.y + p.y * laneH, 9, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
      ctx.fillStyle = withAlpha(isDock ? pal.accent : pal.dim, wa * 0.85);
      ctx.fillText(w.id, x, y + (isDock ? 13 : 8));
    }

    /* Where each robot is headed, drawn to the slot it actually reserved,
       not to the waypoint centre: two robots never share a destination. */
    ctx.setLineDash([2, 5]);
    for (const r of sim.robots) {
      const towing = r.task === "TOW";
      if (!towing && (r.task !== "TRAVEL" || r.state === "HOLD")) continue;
      if (!r.target) continue;
      const p = stopPos(waypoint(r.target), Math.max(0, r.bay));
      ctx.beginPath();
      ctx.moveTo(r.px, r.py);
      ctx.lineTo(field.x + p.x * field.w, field.y + p.y * laneH);
      ctx.strokeStyle = withAlpha(towing ? pal.hold : pal.accent, wa * 0.28);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  /* --- links ---------------------------------------------------------- */
  ctx.save();
  for (let i = 0; i < sim.robots.length; i++) {
    for (let j = i + 1; j < sim.robots.length; j++) {
      const a = sim.robots[i];
      const b = sim.robots[j];
      if (!inRange(a, b)) continue;

      const aHearsB = sim.t - (a.lastHeard[b.id] ?? 0) <= STALE_TIMEOUT;
      const bHearsA = sim.t - (b.lastHeard[a.id] ?? 0) <= STALE_TIMEOUT;
      const healthy = a.online && b.online && aHearsB && bHearsA;

      ctx.beginPath();
      ctx.moveTo(a.px, a.py);
      ctx.lineTo(b.px, b.py);
      if (healthy) {
        ctx.setLineDash([]);
        ctx.strokeStyle = withAlpha(pal.accent, 0.1 + 0.2 * dock);
        ctx.lineWidth = 1;
      } else {
        // A link nobody is hearing on is drawn as what it is: broken.
        ctx.setLineDash([3, 6]);
        ctx.strokeStyle = withAlpha(pal.stop, 0.32);
        ctx.lineWidth = 1;
      }
      ctx.stroke();
    }
  }
  ctx.setLineDash([]);
  ctx.restore();

  /* --- broadcast pulses ------------------------------------------------ */
  for (const p of sim.pulses) {
    const r = sim.robots.find((x) => x.id === p.from);
    if (!r) continue;
    const prog = easeOut(Math.min(1, p.age / p.life));
    const alpha = (1 - prog) * 0.5;
    if (alpha <= 0.01) continue;
    ctx.beginPath();
    // Ellipse, not a circle: range is measured in normalised field units, so
    // in pixels the reachable set really is this shape.
    ctx.ellipse(
      r.px,
      r.py,
      Math.max(4, RANGE * field.w * prog),
      Math.max(4, RANGE * laneH * prog),
      0,
      0,
      Math.PI * 2,
    );
    ctx.strokeStyle = withAlpha(pal.accent, alpha);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* --- packets in flight ----------------------------------------------- */
  for (const p of sim.packets) {
    const from = sim.robots.find((x) => x.id === p.from);
    const to = sim.robots.find((x) => x.id === p.to);
    if (!from || !to) continue;
    const k = Math.min(1, p.age / p.life);
    const x = from.px + (to.px - from.px) * k;
    const y = from.py + (to.py - from.py) * k;

    const tk = Math.max(0, k - 0.12);
    ctx.beginPath();
    ctx.moveTo(from.px + (to.px - from.px) * tk, from.py + (to.py - from.py) * tk);
    ctx.lineTo(x, y);
    ctx.strokeStyle = withAlpha(pal.accent, 0.5);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = pal.accent;
    const q = 3.4;
    ctx.fillRect(-q / 2, -q / 2, q, q);
    ctx.restore();
  }

  /* --- robots ---------------------------------------------------------- */
  for (const r of sim.robots) {
    drawRobot(ctx, r, pal, s, {
      dock,
      selected: selected === r.id,
      hovered: hovered === r.id,
      mono,
      narrow,
    });
  }

  ctx.globalAlpha = 1;
}

function drawRobot(
  ctx: CanvasRenderingContext2D,
  r: Robot,
  pal: Palette,
  s: number,
  o: {
    dock: number;
    selected: boolean;
    hovered: boolean;
    mono: string;
    narrow: boolean;
  },
) {
  const half = s / 2;
  const stateColor = r.dead
    ? pal.stop
    : r.state === "OFFLINE"
      ? pal.dim
      : r.state === "HOLD"
        ? pal.stop
        : r.yieldTo
          ? pal.hold
          : pal.accent;

  ctx.save();

  /* selection brackets */
  if (o.selected) {
    const g = half + 9;
    const len = 7;
    ctx.strokeStyle = pal.accent;
    ctx.lineWidth = 1.5;
    for (const [sx, sy] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ] as [number, number][]) {
      ctx.beginPath();
      ctx.moveTo(r.px + sx * g, r.py + sy * g - sy * len);
      ctx.lineTo(r.px + sx * g, r.py + sy * g);
      ctx.lineTo(r.px + sx * g - sx * len, r.py + sy * g);
      ctx.stroke();
    }
  } else if (o.hovered) {
    rrect(ctx, r.px - half - 6, r.py - half - 6, s + 12, s + 12, 8);
    ctx.strokeStyle = withAlpha(pal.accent, 0.45);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* transmit flash */
  if (r.sendFlash > 0) {
    rrect(ctx, r.px - half - 3, r.py - half - 3, s + 6, s + 6, 7);
    ctx.fillStyle = withAlpha(pal.accent, r.sendFlash * 0.35);
    ctx.fill();
  }

  /* heading tick, only while actually moving */
  if (r.speed > 0.01) {
    ctx.beginPath();
    ctx.moveTo(r.px + Math.cos(r.heading) * half, r.py + Math.sin(r.heading) * half);
    ctx.lineTo(
      r.px + Math.cos(r.heading) * (half + 8),
      r.py + Math.sin(r.heading) * (half + 8),
    );
    ctx.strokeStyle = withAlpha(stateColor, 0.7);
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  /* chassis */
  rrect(ctx, r.px - half, r.py - half, s, s, 5);
  ctx.fillStyle = withAlpha(pal.surface, 0.55 + 0.45 * o.dock);
  ctx.fill();
  if (r.state === "OFFLINE") ctx.setLineDash([3, 3]);
  ctx.strokeStyle = withAlpha(stateColor, r.state === "OFFLINE" ? 0.55 : 0.95);
  ctx.lineWidth = 1.25;
  ctx.stroke();
  ctx.setLineDash([]);

  /* A flat robot is struck through: it is not merely quiet, it is stopped
     where it stands until someone walks out and collects it. */
  if (r.dead) {
    ctx.beginPath();
    ctx.moveTo(r.px - half, r.py - half);
    ctx.lineTo(r.px + half, r.py + half);
    ctx.moveTo(r.px + half, r.py - half);
    ctx.lineTo(r.px - half, r.py + half);
    ctx.strokeStyle = withAlpha(pal.stop, 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* core: the mark motif, filled while the radio is up */
  const c = s * 0.3;
  rrect(ctx, r.px - c / 2, r.py - c / 2, c, c, 1.5);
  if (r.online) {
    ctx.fillStyle = withAlpha(stateColor, r.recvFlash > 0 ? 1 : 0.8);
    ctx.fill();
  } else {
    ctx.strokeStyle = withAlpha(pal.dim, 0.8);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  /* id */
  ctx.font = `500 ${o.narrow ? 9.5 : 10.5}px ${o.mono}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillStyle = withAlpha(pal.text, 0.55 + 0.45 * o.dock);
  ctx.fillText(r.id, r.px, r.py + half + 7);

  /* battery: the thing that drives the whole duty cycle, so it is on the
     chassis rather than buried in a panel */
  {
    const bw = o.narrow ? 20 : 26;
    const bh = 3;
    const bx = r.px - bw / 2;
    const by = r.py + half + (o.narrow ? 18 : 20);
    const lvl = Math.max(0, Math.min(100, r.battery)) / 100;
    const battColor =
      r.battery < BATT_BROWNOUT
        ? pal.stop
        : r.battery < BATT_DIVERT
          ? pal.hold
          : pal.accent;
    ctx.fillStyle = withAlpha(pal.lineStrong, 0.9);
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = withAlpha(battColor, 0.95);
    ctx.fillRect(bx, by, Math.max(1, bw * lvl), bh);
    if (r.task === "CHARGE") {
      ctx.fillStyle = withAlpha(pal.accent, 0.95);
      ctx.fillRect(bx + bw + 3, by - 1, 2, bh + 2);
    }
  }

  /* state tag: one line, always the same line, sourced from the same helper
     the packet inspector reads so the two can never contradict each other */
  {
    const ty = r.py + half + (o.narrow ? 24 : 27);
    if (r.dead || r.state !== "NOMINAL" || r.yieldTo) {
      ctx.font = `500 ${o.narrow ? 8.5 : 9.5}px ${o.mono}`;
      ctx.fillStyle = r.dead
        ? pal.stop
        : r.state === "OFFLINE"
          ? pal.dim
          : r.yieldTo
            ? pal.hold
            : pal.stop;
      const text =
        r.dead && r.task === "TOW"
          ? "TOW"
          : r.dead
            ? "MOTORS DOWN"
            : r.state === "OFFLINE"
              ? "NO RADIO"
              : r.state === "HOLD"
                ? "HOLD"
                : "YIELD";
      ctx.fillText(text, r.px, ty);
    } else if (o.dock > 0.5) {
      ctx.font = `400 ${o.narrow ? 8 : 8.5}px ${o.mono}`;
      ctx.fillStyle = withAlpha(pal.dim, 0.9);
      ctx.fillText(
        r.task === "CHARGE" ? `${Math.round(r.battery)}%` : taskLabel(r),
        r.px,
        ty,
      );
    }
  }

  /* Lamport counter, riding on the chassis corner */
  ctx.font = `500 ${o.narrow ? 9 : 10}px ${o.mono}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.fillStyle = withAlpha(pal.accent, r.online ? 0.95 : 0.4);
  ctx.fillText(`C${r.clock}`, r.px + half + 5, r.py - half + 9);

  ctx.restore();
}

/* =========================================================================
   Infrastructure lane. Both boxes are passive readers, and the drawing says
   so: every arrow has exactly one head, pointing away from the mesh.
   ========================================================================= */
function drawInfra(
  ctx: CanvasRenderingContext2D,
  sim: MeshSim,
  pal: Palette,
  field: Rect,
  laneH: number,
  dock: number,
  narrow: boolean,
  mono: string,
  alpha: number,
) {
  const a = Math.min(1, (dock - 0.45) / 0.4) * alpha;
  const laneY = field.y + laneH;
  const laneBottom = field.y + field.h;
  const cy = (laneY + laneBottom) / 2 + 4;

  ctx.save();
  ctx.globalAlpha = a;

  /* lane divider */
  ctx.beginPath();
  ctx.setLineDash([2, 5]);
  ctx.moveTo(field.x + 14, Math.round(laneY) + 0.5);
  ctx.lineTo(field.x + field.w - 14, Math.round(laneY) + 0.5);
  ctx.strokeStyle = withAlpha(pal.lineStrong, 0.8);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);

  const boxW = narrow ? 104 : 150;
  const boxH = narrow ? 34 : 40;
  const gap = narrow ? 16 : 40;
  const totalW = boxW * 2 + gap;
  const startX = field.x + (field.w - totalW) / 2;

  const brokerX = startX;
  const cloudX = startX + boxW + gap;

  /* mesh -> broker: one way, and only while the broker is listening */
  const centroidX = field.x + field.w / 2;
  const meshY = field.y + laneH - 22;
  drawDashedArrow(
    ctx,
    centroidX,
    meshY,
    brokerX + boxW / 2,
    cy - boxH / 2,
    sim.brokerOn ? withAlpha(pal.accent, 0.3 + sim.brokerFlash * 0.9) : withAlpha(pal.dim, 0.28),
  );

  /* broker -> cloud: one way again */
  drawDashedArrow(
    ctx,
    brokerX + boxW,
    cy,
    cloudX,
    cy,
    sim.brokerOn && sim.cloudOn
      ? withAlpha(pal.accent, 0.3 + sim.cloudFlash * 0.6)
      : withAlpha(pal.dim, 0.28),
  );

  drawInfraBox(
    ctx,
    pal,
    brokerX,
    cy - boxH / 2,
    boxW,
    boxH,
    "LOCAL BROKER",
    narrow ? "MQTT" : "MQTT :1883",
    sim.brokerOn,
    mono,
    narrow,
  );
  drawInfraBox(
    ctx,
    pal,
    cloudX,
    cy - boxH / 2,
    boxW,
    boxH,
    "CLOUD",
    "OPTIONAL",
    sim.cloudOn && sim.brokerOn,
    mono,
    narrow,
  );

  ctx.restore();
}

function drawInfraBox(
  ctx: CanvasRenderingContext2D,
  pal: Palette,
  x: number,
  y: number,
  w: number,
  h: number,
  title: string,
  sub: string,
  on: boolean,
  mono: string,
  narrow: boolean,
) {
  rrect(ctx, x, y, w, h, 5);
  ctx.fillStyle = withAlpha(pal.surface, on ? 1 : 0.5);
  ctx.fill();
  ctx.setLineDash(on ? [] : [3, 3]);
  ctx.strokeStyle = on ? withAlpha(pal.lineStrong, 1) : withAlpha(pal.dim, 0.45);
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `500 ${narrow ? 8.5 : 9.5}px ${mono}`;
  ctx.fillStyle = on ? withAlpha(pal.text, 0.9) : withAlpha(pal.dim, 0.75);
  ctx.fillText(title, x + w / 2, y + h / 2 - 6);
  ctx.font = `400 ${narrow ? 8 : 9}px ${mono}`;
  ctx.fillStyle = on ? withAlpha(pal.dim, 1) : withAlpha(pal.dim, 0.55);
  ctx.fillText(on ? sub : "DISABLED", x + w / 2, y + h / 2 + 7);
}

function drawDashedArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
) {
  ctx.save();
  ctx.setLineDash([4, 4]);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.setLineDash([]);

  const ang = Math.atan2(y2 - y1, x2 - x1);
  const head = 5;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - head * Math.cos(ang - Math.PI / 7),
    y2 - head * Math.sin(ang - Math.PI / 7),
  );
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - head * Math.cos(ang + Math.PI / 7),
    y2 - head * Math.sin(ang + Math.PI / 7),
  );
  ctx.stroke();
  ctx.restore();
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMotionValueEvent, useScroll } from "motion/react";
import { ArrowDown, Minus, Plus, SkipForward } from "@phosphor-icons/react";
import {
  createSim,
  packetView,
  setRobotCount,
  stepSim,
  suspectedBy,
  BATT_BROWNOUT,
  BATT_DIVERT,
  MAX_ROBOTS,
  ROSTER_IDS,
  type LogEvent,
  type MeshPacketView,
  type MeshSim,
} from "@/lib/mesh";
import { drawMesh, hitTest, meshLaneHeight, nodeSize, type Rect } from "@/lib/meshDraw";
import {
  useCanvasSize,
  usePaletteRef,
  useReducedMotion,
} from "@/lib/hooks";
import { Figure, SpecPanel } from "@/components/site/Panel";
import { SplineScene } from "@/components/sim/SplineScene";
import type { SplineApp } from "@/lib/spline";
import { SPEC_MESH } from "@/lib/specs";

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const STAT_CHIPS = [
  { k: "Lamport clocks", v: "1978" },
  { k: "Ricart-Agrawala", v: "1981" },
  { k: "Contract Net", v: "1980" },
  { k: "Cloud dependency", v: "none" },
];

type Hud = {
  pkt: MeshPacketView | null;
  suspects: string[];
  delivered: number;
  holding: number;
  offline: number;
  tasksDone: number;
  charging: boolean;
  events: LogEvent[];
};

export function MeshStage() {
  const reduced = useReducedMotion();

  const pinRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const uiRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const splineRef = useRef<HTMLDivElement>(null);
  const splineAppRef = useRef<SplineApp | null>(null);

  const simRef = useRef<MeshSim>(createSim(3));
  const dockRef = useRef(0);
  const dockRectRef = useRef<Rect | null>(null);
  const hoveredRef = useRef<string | null>(null);
  const selectedRef = useRef<string | null>("R-01");
  const layerStateRef = useRef({ hero: true, ui: false, spline: true, canvas: false });

  const paletteRef = usePaletteRef();

  const [count, setCount] = useState(3);
  const [selected, setSelected] = useState<string | null>("R-01");
  const [radios, setRadios] = useState<Record<string, boolean>>({});
  const [brokerOn, setBrokerOn] = useState(true);
  const [cloudOn, setCloudOn] = useState(true);
  const [narrow, setNarrow] = useState(false);
  const [stageVisible, setStageVisible] = useState(true);
  const [hud, setHud] = useState<Hud>({
    pkt: null,
    suspects: [],
    delivered: 0,
    holding: 0,
    offline: 0,
    tasksDone: 0,
    charging: false,
    events: [],
  });

  selectedRef.current = selected;

  /* --- keep the sim in step with the controls ------------------------- */
  useEffect(() => {
    simRef.current = setRobotCount(simRef.current, count);
    setSelected((s) =>
      s && simRef.current.robots.some((r) => r.id === s) ? s : "R-01",
    );
  }, [count]);

  useEffect(() => {
    simRef.current.robots.forEach((r) => {
      const wasOffline = r.manualOffline;
      r.manualOffline = radios[r.id] === false;
      // Coming back up, a robot must not be instantly trusted by its peers:
      // they only clear the suspicion once a real frame arrives.
      if (wasOffline && !r.manualOffline) {
        r.nextBroadcast = simRef.current.t + 0.15;
      }
    });
  }, [radios]);

  useEffect(() => {
    simRef.current.brokerOn = brokerOn;
    simRef.current.cloudOn = cloudOn && brokerOn;
  }, [brokerOn, cloudOn]);

  /* The stage is pinned near the top of a long page. Once it is scrolled
     past there is no reason to keep a canvas running on a laptop battery. */
  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([e]) => setStageVisible(e.isIntersecting),
      { rootMargin: "120px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  /* --- viewport class ------------------------------------------------- */
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  /* --- field geometry -------------------------------------------------- */
  const measureDock = useCallback(() => {
    const c = canvasRef.current;
    const slot = slotRef.current;
    if (!c || !slot) return;
    const cr = c.getBoundingClientRect();
    const sr = slot.getBoundingClientRect();
    if (sr.width < 40 || sr.height < 40) return;
    dockRectRef.current = {
      x: sr.left - cr.left,
      y: sr.top - cr.top,
      w: sr.width,
      h: sr.height,
    };
  }, []);

  const sizeRef = useCanvasSize(canvasRef, measureDock);

  useEffect(() => {
    measureDock();
    const ro = new ResizeObserver(measureDock);
    if (slotRef.current) ro.observe(slotRef.current);
    return () => ro.disconnect();
  }, [measureDock, narrow]);

  const heroField = useCallback((w: number, h: number): Rect => {
    if (w < 1024) {
      // Copy sits in the upper half, the mesh runs underneath it.
      return { x: 10, y: h * 0.44, w: w - 20, h: h * 0.5 };
    }
    return { x: w * 0.27, y: h * 0.09, w: w * 0.68, h: h * 0.8 };
  }, []);

  const currentField = useCallback(
    (w: number, h: number, dock: number): Rect => {
      const a = heroField(w, h);
      const b = dockRectRef.current ?? a;
      const t = smooth(dock);
      return {
        x: lerp(a.x, b.x, t),
        y: lerp(a.y, b.y, t),
        w: lerp(a.w, b.w, t),
        h: lerp(a.h, b.h, t),
      };
    },
    [heroField],
  );

  /* --- scroll driven handoff -------------------------------------------
     The dock value is the handoff from the opening statement to the
     instrument that backs it up, so it is scrubbed rather than triggered.

     This reads scroll through Motion rather than GSAP ScrollTrigger. It is
     the only scroll-scrubbed value on the page, Motion is already in the
     bundle for the nav and the clock diagram, and running two animation
     libraries against the same frames buys nothing but 160 KB. */
  const { scrollYProgress } = useScroll({
    target: pinRef,
    offset: ["start start", "end end"],
  });

  useMotionValueEvent(scrollYProgress, "change", (v) => {
    if (reduced) return;
    dockRef.current = clamp01((v - 0.05) / 0.34);
  });

  useEffect(() => {
    if (!reduced) return;
    dockRef.current = 1;
    if (heroRef.current) heroRef.current.style.display = "none";
    if (scrimRef.current) scrimRef.current.style.opacity = "0";
    if (uiRef.current) uiRef.current.style.opacity = "1";
    // The instrument is already docked, so the backdrop has no moment to fill.
    if (splineRef.current) splineRef.current.style.display = "none";
  }, [reduced]);

  /* --- render loop ------------------------------------------------------ */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !stageVisible) return;
    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let hudAcc = 0;
    let running = true;

    const frame = (now: number) => {
      if (!running) return;
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;

      const { w, h, dpr } = sizeRef.current;
      if (w > 0) {
        if (!reduced) stepSim(simRef.current, dt);

        const dock = dockRef.current;
        const field = currentField(w, h, dock);
        // The opening frame is the 3D scene alone. The mesh is the second act.
        const meshAlpha = reduced ? 1 : clamp01((dock - 0.12) / 0.42);

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawMesh(
          ctx,
          simRef.current,
          paletteRef.current,
          {
            field,
            dock,
            selected: selectedRef.current,
            hovered: hoveredRef.current,
            narrow: w < 1024,
            showInfra: true,
            alpha: meshAlpha,
          },
          w,
          h,
        );

        syncLayers(dock);

        hudAcc += dt;
        if (hudAcc > 0.12) {
          hudAcc = 0;
          pushHud();
        }
      }
      raf = requestAnimationFrame(frame);
    };

    const syncLayers = (dock: number) => {
      if (reduced) return;
      const heroOut = clamp01(dock / 0.5);
      const uiIn = clamp01((dock - 0.42) / 0.38);

      const hero = heroRef.current;
      const ui = uiRef.current;
      const scrim = scrimRef.current;
      if (hero) {
        hero.style.opacity = String(1 - heroOut);
        hero.style.transform = `translate3d(0, ${-30 * heroOut}px, 0)`;
      }
      if (scrim) scrim.style.opacity = String(1 - heroOut * 0.92);

      // The 3D backdrop belongs to the opening statement. Once the mesh docks
      // into its instrument frame, the frame needs a clean ground, so the
      // scene fades out and then stops rendering entirely.
      const spline = splineRef.current;
      if (spline) spline.style.opacity = String(1 - clamp01((dock - 0.22) / 0.48));
      // The mesh canvas covers the whole stage. While the scene owns the
      // opening frame it must not intercept the drag meant for the robot.
      const canvasLive = dock > 0.5;
      if (layerStateRef.current.canvas !== canvasLive) {
        layerStateRef.current.canvas = canvasLive;
        const c = canvasRef.current;
        if (c) c.style.pointerEvents = canvasLive ? "auto" : "none";
      }

      const splineLive = dock < 0.72;
      if (layerStateRef.current.spline !== splineLive) {
        layerStateRef.current.spline = splineLive;
        const app = splineAppRef.current;
        if (app) {
          if (splineLive && app.isStopped) app.play();
          else if (!splineLive && !app.isStopped) app.stop();
        }
      }
      if (ui) {
        ui.style.opacity = String(uiIn);
        ui.style.transform = `translate3d(0, ${16 * (1 - uiIn)}px, 0)`;
      }

      // Never leave an invisible layer focusable.
      const heroLive = heroOut < 0.5;
      const uiLive = uiIn > 0.5;
      if (layerStateRef.current.hero !== heroLive && hero) {
        layerStateRef.current.hero = heroLive;
        // pointer-events stays none on the layer itself; inert is what makes
        // the copy inactive once it has faded.
        hero.toggleAttribute("inert", !heroLive);
      }
      if (layerStateRef.current.ui !== uiLive && ui) {
        layerStateRef.current.ui = uiLive;
        ui.style.pointerEvents = uiLive ? "auto" : "none";
        ui.toggleAttribute("inert", !uiLive);
      }
    };

    const pushHud = () => {
      const sim = simRef.current;
      const sel = sim.robots.find((r) => r.id === selectedRef.current);
      setHud({
        pkt: sel ? packetView(sel) : null,
        suspects: sel ? suspectedBy(sim, sel) : [],
        delivered: sim.delivered,
        holding: sim.robots.filter((r) => r.state === "HOLD").length,
        offline: sim.robots.filter((r) => !r.online).length,
        tasksDone: sim.robots.reduce((n, r) => n + r.tasksDone, 0),
        charging: sel?.task === "CHARGE",
        events: sim.events.slice(-14),
      });
    };

    const onVis = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    raf = requestAnimationFrame(frame);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [currentField, paletteRef, reduced, sizeRef, stageVisible]);

  /* Reduced motion: one broadcast round per press, drawn instantly. */
  const stepOnce = useCallback(() => {
    for (let i = 0; i < 30; i++) stepSim(simRef.current, 1 / 30);
  }, []);

  /* --- canvas pointer --------------------------------------------------- */
  const pickAt = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      const { w, h } = sizeRef.current;
      const field = currentField(w, h, dockRef.current);
      const laneH = meshLaneHeight(field, dockRef.current, true);
      const size = nodeSize(field, laneH, w < 1024);
      return hitTest(
        simRef.current,
        clientX - rect.left,
        clientY - rect.top,
        size,
      );
    },
    [currentField, sizeRef],
  );

  const onCanvasMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (e.pointerType === "touch") return;
      const hit = pickAt(e.clientX, e.clientY);
      hoveredRef.current = hit?.id ?? null;
      const el = canvasRef.current;
      if (el) el.style.cursor = hit ? "pointer" : "default";
    },
    [pickAt],
  );

  const onCanvasDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const hit = pickAt(e.clientX, e.clientY);
      if (hit) setSelected(hit.id);
    },
    [pickAt],
  );

  // From the roster, not from simRef: the sim is replaced in an effect, so
  // reading it during render returns the previous fleet.
  const robotIds = useMemo(() => ROSTER_IDS.slice(0, count), [count]);

  const toggleRadio = useCallback((id: string) => {
    setRadios((r) => ({ ...r, [id]: r[id] === false }));
  }, []);

  return (
    <>
      {reduced && <HeroStatic />}

      <section
        id="overview"
        aria-label="Live fleet mesh"
        ref={pinRef}
        className="relative"
        style={
          reduced
            ? undefined
            : { height: "260vh", scrollMarginTop: "calc(-95vh + var(--nav-h))" }
        }
      >
        <div
          ref={stageRef}
          className={
            reduced
              ? "rail relative h-[720px] max-h-[86vh]"
              : "sticky top-0 h-[100dvh] w-full overflow-hidden"
          }
        >
          {/* The opening image: the machine itself, draggable. */}
          <div ref={splineRef} className="absolute inset-0">
            <SplineScene
              className="h-full w-full"
              eager
              transparent
              interactive
              blockWheel
              showProgress={false}
              onApp={(app) => (splineAppRef.current = app)}
            />
          </div>

          <canvas
            ref={canvasRef}
            className="absolute inset-0 h-full w-full touch-pan-y"
            style={{ pointerEvents: "none" }}
            onPointerMove={onCanvasMove}
            onPointerDown={onCanvasDown}
            onPointerLeave={() => (hoveredRef.current = null)}
            aria-hidden="true"
          />

          {!reduced && (
            <div
              ref={scrimRef}
              className="hero-scrim pointer-events-none absolute inset-0"
              aria-hidden="true"
            />
          )}

          {!reduced && <HeroOverlay ref={heroRef} />}

          {/* ------------------ overview instrument ------------------ */}
          <div
            ref={uiRef}
            className="absolute inset-0 flex flex-col gap-3 px-4 pb-4 md:px-6 lg:pb-6"
            inert={reduced ? undefined : true}
            style={{
              paddingTop: "calc(var(--nav-h) + 24px)",
              opacity: reduced ? 1 : 0,
              pointerEvents: reduced ? "auto" : "none",
            }}
          >
            <header className="flex shrink-0 flex-wrap items-end gap-x-6 gap-y-2">
              <div className="min-w-0">
                <h2 className="text-h2">Every robot is a peer</h2>
                <p className="mt-1 max-w-[54ch] text-sm text-muted">
                  Each one broadcasts its own state on a timer. Nobody is in
                  charge, and nothing downstream can command a robot.
                </p>
              </div>
              <div className="ml-auto flex flex-wrap items-center gap-2">
                <span className="chip" data-state={hud.offline ? "stop" : "live"}>
                  <span
                    className={`led ${hud.offline ? "" : "led--pulse"}`}
                    aria-hidden="true"
                  />
                  {hud.offline ? `${hud.offline} radio down` : "All radios up"}
                </span>
                {hud.holding > 0 && (
                  <span className="chip" data-state="hold">
                    {hud.holding} holding
                  </span>
                )}
                <span className="chip">
                  {hud.tasksDone} picks
                </span>
                <span className="chip">
                  {hud.delivered.toLocaleString("en-US")} frames
                </span>
              </div>
            </header>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[240px_1fr_292px]">
              {/* controls */}
              <div className="order-2 flex min-h-0 flex-col gap-3 lg:order-1">
                <ControlCard title="Fleet">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-muted">Robots on floor</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="ctl"
                        style={{ padding: "6px" }}
                        onClick={() => setCount((c) => Math.max(3, c - 1))}
                        disabled={count <= 3}
                        aria-label="Remove a robot from the fleet"
                      >
                        <Minus size={13} weight="bold" aria-hidden="true" />
                      </button>
                      <span
                        className="tok w-6 text-center"
                        style={{ color: "var(--accent)" }}
                      >
                        {count}
                      </span>
                      <button
                        type="button"
                        className="ctl"
                        style={{ padding: "6px" }}
                        onClick={() =>
                          setCount((c) => Math.min(MAX_ROBOTS, c + 1))
                        }
                        disabled={count >= MAX_ROBOTS}
                        aria-label="Add a robot to the fleet"
                      >
                        <Plus size={13} weight="bold" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <ul className="mt-2.5 flex list-none gap-1.5 overflow-x-auto p-0 lg:flex-col lg:overflow-visible">
                    {robotIds.map((id) => (
                      <li key={id} className="shrink-0 lg:w-full">
                        <RobotRow
                          id={id}
                          selected={selected === id}
                          online={radios[id] !== false}
                          onSelect={() => setSelected(id)}
                          onToggleRadio={() => toggleRadio(id)}
                        />
                      </li>
                    ))}
                  </ul>
                </ControlCard>

                <ControlCard title="Downstream">
                  <div className="flex flex-col gap-1.5">
                    <Latch
                      on={brokerOn}
                      onChange={() => setBrokerOn((b) => !b)}
                      label="Local broker"
                    />
                    <Latch
                      on={cloudOn && brokerOn}
                      disabled={!brokerOn}
                      onChange={() => setCloudOn((c) => !c)}
                      label="Cloud uplink"
                    />
                  </div>
                  <p className="mt-2 text-sm text-dim">
                    Both are readers. Switching them off changes nothing on the
                    floor, which is the point.
                  </p>
                </ControlCard>

                {reduced && (
                  <button type="button" className="ctl ctl-primary" onClick={stepOnce}>
                    <SkipForward size={13} weight="fill" aria-hidden="true" />
                    Advance one second
                  </button>
                )}
              </div>

              {/* the canvas shows through this slot */}
              <div
                ref={slotRef}
                className="order-1 min-h-[220px] flex-1 lg:order-2"
                aria-hidden="true"
              />

              {/* inspector */}
              <div className="order-3 flex min-h-0 flex-col gap-3">
                <Inspector
                  pkt={hud.pkt}
                  suspects={hud.suspects}
                  online={selected ? radios[selected] !== false : true}
                  tasksDone={hud.tasksDone}
                  charging={hud.charging}
                />
                <FleetLog events={hud.events} />
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="rail pb-24 pt-6 md:pt-10">
        <Figure
          caption={
            <>
              The fleet runs unattended: robots travel to named aisles, pick,
              and divert to the dock as they drain. Watch R-03. It starts below
              the divert threshold, and somewhere under twelve percent its radio
              browns out before its motors do. Its neighbours stop hearing it
              within one timeout window and hold position, taking that decision
              on each robot from the absence of a frame, with no controller
              consulted. It charges, rejoins, and the floor resumes. You can
              force the same thing at any time by cutting a radio yourself.
            </>
          }
        >
          <span className="sr-only">
            Interactive diagram of a robot mesh. Controls are listed above.
          </span>
        </Figure>
        <SpecPanel spec={SPEC_MESH} />
      </div>
    </>
  );
}

/* ==========================================================================
   Hero
   ========================================================================== */

function HeroCopy({ headingId }: { headingId?: string }) {
  return (
    <>
      <h1
        id={headingId}
        className="pointer-events-auto max-w-[19ch] text-display"
        style={{ lineHeight: 1.05, fontWeight: 600 }}
      >
        Software decides where to go.{" "}
        <span className="text-muted">
          Hardware decides whether it&rsquo;s safe to move.
        </span>
      </h1>

      <p className="pointer-events-auto mt-5 max-w-[52ch] text-lead text-muted">
        A warehouse robot fleet that coordinates peer to peer over UDP
        broadcast, and cuts its own motors in hardware when the software is the
        thing that failed.
      </p>

      <ul className="pointer-events-auto mt-7 flex list-none flex-wrap gap-1.5 p-0">
        {STAT_CHIPS.map((c) => (
          <li key={c.k}>
            <span className="chip">
              {c.k}
              <span style={{ color: "var(--accent)" }}>{c.v}</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}

const HeroOverlay = function HeroOverlay({
  ref,
}: {
  ref: React.Ref<HTMLDivElement>;
}) {
  return (
    <div
      ref={ref}
      id="hero"
      className="pointer-events-none absolute inset-0 flex flex-col justify-center px-4 md:px-6"
      style={{ paddingTop: "var(--nav-h)" }}
    >
      <div className="mx-auto w-full max-w-[var(--rail)]">
        <HeroCopy headingId="hero-title" />

        <a
          href="#overview"
          className="group pointer-events-auto mt-11 inline-flex items-center gap-3 rounded-sm border border-line-strong bg-surface px-3.5 py-2.5 transition-colors duration-200 hover:border-[var(--accent-line)]"
        >
          <span
            className="tok"
            style={{ color: "var(--text-muted)" }}
          >
            Next: the mesh, running
          </span>
          <span
            className="flex h-6 w-6 items-center justify-center rounded-sm bg-accent-wash text-accent transition-transform duration-300 group-hover:translate-y-0.5"
            style={{ transitionTimingFunction: "var(--ease-snap)" }}
          >
            <ArrowDown size={13} weight="bold" aria-hidden="true" />
          </span>
        </a>
      </div>
    </div>
  );
};

/** Reduced motion: the hero becomes an ordinary block above the instrument. */
function HeroStatic() {
  return (
    <section
      id="hero"
      className="rail flex min-h-[70dvh] flex-col justify-center"
      style={{ paddingTop: "calc(var(--nav-h) + 48px)", paddingBottom: "48px" }}
    >
      <HeroCopy headingId="hero-title" />
    </section>
  );
}

/* ==========================================================================
   Instrument sub-components
   ========================================================================== */

function ControlCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-md border border-line p-3 backdrop-blur-md"
      style={{ background: "color-mix(in srgb, var(--surface) 86%, transparent)" }}
    >
      <h3 className="label mb-2.5">{title}</h3>
      {children}
    </section>
  );
}

function RobotRow({
  id,
  selected,
  online,
  onSelect,
  onToggleRadio,
}: {
  id: string;
  selected: boolean;
  online: boolean;
  onSelect: () => void;
  onToggleRadio: () => void;
}) {
  return (
    <div
      className="flex items-center gap-1 rounded-sm border px-1 py-1 transition-colors duration-150"
      style={{
        borderColor: selected ? "var(--accent-line)" : "var(--line)",
        background: selected ? "var(--accent-wash)" : "transparent",
      }}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="tok flex-1 rounded-sm px-1.5 py-1 text-left transition-colors duration-150 hover:text-accent"
        style={{ color: selected ? "var(--accent)" : "var(--text)" }}
      >
        {id}
      </button>
      <button
        type="button"
        onClick={onToggleRadio}
        aria-pressed={!online}
        className="ctl ctl-danger"
        data-on={!online}
        style={{ padding: "4px 7px", letterSpacing: "0.06em" }}
        title={online ? `Cut the Wi-Fi radio on ${id}` : `Restore the Wi-Fi radio on ${id}`}
      >
        {online ? "Radio" : "Cut"}
      </button>
    </div>
  );
}

function Latch({
  on,
  label,
  onChange,
  disabled,
  tone,
}: {
  on: boolean;
  label: string;
  onChange: () => void;
  disabled?: boolean;
  tone?: "stop";
}) {
  return (
    <button
      type="button"
      className="latch"
      aria-pressed={on}
      data-tone={tone}
      onClick={onChange}
      disabled={disabled}
      style={disabled ? { opacity: 0.45, cursor: "not-allowed" } : undefined}
    >
      <span className="latch__slot" aria-hidden="true">
        <span className="latch__throw" />
      </span>
      <span className="latch__text">{label}</span>
      <span
        className="tok ml-auto"
        style={{ color: on ? "var(--accent)" : "var(--text-dim)" }}
      >
        {on ? "ON" : "OFF"}
      </span>
    </button>
  );
}

function Inspector({
  pkt,
  suspects,
  online,
  tasksDone,
  charging,
}: {
  pkt: MeshPacketView | null;
  suspects: string[];
  online: boolean;
  tasksDone: number;
  charging: boolean;
}) {
  return (
    <section
      className="flex flex-none flex-col rounded-md border border-line p-3 backdrop-blur-md"
      style={{ background: "color-mix(in srgb, var(--surface) 86%, transparent)" }}
    >
      <h3 className="label mb-2.5">
        Outgoing frame {pkt ? <span style={{ color: "var(--accent)" }}>{pkt.id}</span> : null}
      </h3>

      {!pkt ? (
        <p className="text-sm text-dim">
          Select a robot to read the frame it puts on the wire.
        </p>
      ) : !online ? (
        <div className="rounded-sm border border-dashed border-line-strong px-3 py-4">
          <p className="tok" style={{ color: "var(--stop)" }}>
            NO CARRIER
          </p>
          <p className="mt-1.5 text-sm text-muted">
            The radio is cut, so {pkt.id} transmits nothing. Its peers will
            suspect it once the timeout expires.
          </p>
        </div>
      ) : (
        <pre className="tok m-0 overflow-x-auto leading-[1.85]" translate="no">
          <Row k="id" v={`"${pkt.id}"`} />
          <Row k="position" v={`[${pkt.position[0].toFixed(1)}, ${pkt.position[1].toFixed(1)}]`} unit="m" />
          <Row k="velocity" v={pkt.velocity.toFixed(2)} unit="m/s" />
          <Row k="battery" v={String(pkt.battery)} unit="%" />
          <Row k="task" v={`"${pkt.task}"`} />
          <Row k="clock" v={String(pkt.clock)} accent />
        </pre>
      )}

      <div className="mt-auto border-t border-line pt-2.5">
        <p className="label mb-1.5">Suspected by</p>
        {suspects.length === 0 ? (
          <p className="tok" style={{ color: "var(--text-dim)" }}>
            nobody
          </p>
        ) : (
          <p className="tok" style={{ color: "var(--stop)" }}>
            {suspects.join(", ")}
          </p>
        )}
        <p className="mt-2 text-sm text-dim">
          38 bytes, sent to the broadcast address. No connection, no
          acknowledgement, no retry.
        </p>
      </div>
    </section>
  );
}

function Row({
  k,
  v,
  unit,
  accent,
}: {
  k: string;
  v: string;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex gap-2 whitespace-nowrap">
      <span style={{ color: "var(--text-dim)" }}>{k.padEnd(9, " ")}</span>
      <span style={{ color: accent ? "var(--accent)" : "var(--text)" }}>{v}</span>
      {unit && <span style={{ color: "var(--text-dim)" }}>{unit}</span>}
    </div>
  );
}

function BatteryGauge({ value, charging }: { value: number; charging: boolean }) {
  const tone =
    value < BATT_BROWNOUT
      ? "var(--stop)"
      : value < BATT_DIVERT
        ? "var(--hold)"
        : "var(--accent)";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="label">Battery</span>
        <span className="tok" style={{ color: tone }}>
          {value}%{charging ? " charging" : ""}
        </span>
      </div>
      <div
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-[1px]"
        style={{ background: "var(--line-strong)" }}
      >
        <div
          className="h-full origin-left"
          style={{
            background: tone,
            transform: `scaleX(${Math.max(0, Math.min(100, value)) / 100})`,
            transition: "transform 200ms linear",
          }}
        />
      </div>
      {/* Say it plainly rather than implying these are measured numbers. */}
      <p className="mt-1.5 text-sm text-dim">
        {value < BATT_BROWNOUT
          ? "Below the brownout floor: the radio sags before the motors do."
          : value < BATT_DIVERT
            ? "Below the divert threshold, so it is heading for the dock."
            : "Drain is accelerated so a full charge cycle is watchable."}
      </p>
    </div>
  );
}

/**
 * What actually happened, in order. The mesh looks alive without this, but it
 * does not look like it is DOING anything, and a judge cannot check a claim
 * against a picture that never explains itself.
 */
function FleetLog({ events }: { events: LogEvent[] }) {
  const endRef = useRef<HTMLDivElement>(null);
  const lastSeq = events.length ? events[events.length - 1].seq : 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [lastSeq]);

  return (
    <section
      className="flex min-h-0 flex-1 flex-col rounded-md border border-line p-3 backdrop-blur-md"
      style={{ background: "color-mix(in srgb, var(--surface) 86%, transparent)" }}
    >
      <h3 className="label mb-2">Fleet log</h3>
      <div className="log min-h-0 flex-1 overflow-y-auto">
        {events.length === 0 ? (
          <p className="text-sm text-dim">Waiting for the first frame.</p>
        ) : (
          events.map((e) => (
            <div key={e.seq} className="log__row">
              <span style={{ color: "var(--text-dim)" }}>
                {e.t.toFixed(1).padStart(5, " ")}
              </span>
              <span
                style={{
                  color:
                    e.tone === "stop"
                      ? "var(--stop)"
                      : e.tone === "hold"
                        ? "var(--hold)"
                        : e.tone === "accent"
                          ? "var(--accent)"
                          : "var(--text-muted)",
                }}
              >
                <span style={{ color: "var(--text)" }}>{e.robot}</span>{" "}
                {e.text}
              </span>
            </div>
          ))
        )}
        <div ref={endRef} />
      </div>
    </section>
  );
}

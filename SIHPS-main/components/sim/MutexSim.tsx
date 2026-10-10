"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowClockwise, Minus, Plus } from "@phosphor-icons/react";
import { useInView, useReducedMotion } from "@/lib/hooks";
import { Figure, Panel, PanelBar, SpecPanel } from "@/components/site/Panel";
import { SPEC_MUTEX } from "@/lib/specs";

/* ==========================================================================
   Scoped Ricart-Agrawala Spatial Mutual Exclusion.

   - Request format: (Lamport timestamp Ti, robot id)
   - Scope bounded by conflict envelope R_conflict (O(k) where k ≪ N)
   - Contention resolved between approaching nodes; out-of-scope nodes send 0 msgs
   ========================================================================== */

type Phase = "RELEASED" | "WANTED" | "HELD";
type InScopeRid = "R-01" | "R-02";
type OutOfScopeRid = "R-03" | "R-04";

const OTHER: Record<InScopeRid, InScopeRid> = { "R-01": "R-02", "R-02": "R-01" };

type Robot = {
  id: InScopeRid;
  phase: Phase;
  ts: number;
  replies: Set<InScopeRid>;
  deferred: Set<InScopeRid>;
  /** 0..1 along its own corridor */
  pos: number;
};

type Msg = {
  key: number;
  from: InScopeRid;
  to: InScopeRid;
  kind: "REQUEST" | "REPLY";
  ts: number;
  at: number;
  deferredNote?: string;
};

type LogLine = { key: number; t: string; text: string; tone?: "accent" | "hold" };

const HOLD_AT: Record<InScopeRid, number> = { "R-01": 0.38, "R-02": 0.327 };
const FLIGHT = 0.7;
const SPEED = 0.42;

/* Plan view geometry */
const VB = { w: 500, h: 300 };
const CORR = { x0: 208, x1: 274, y0: 118, y1: 184 };
const CENTER = { x: 241, y: 151 };
const ENVELOPE_R = { rx: 165, ry: 115 };

function pathPoint(id: InScopeRid, p: number) {
  if (id === "R-01") return { x: 26 + p * (456 - 26), y: 151 };
  return { x: 241, y: 20 + p * (280 - 20) };
}

const OUT_OF_SCOPE_ROBOTS: { id: OutOfScopeRid; x: number; y: number; label: string }[] = [
  { id: "R-03", x: 430, y: 50, label: "Aisle 4" },
  { id: "R-04", x: 65, y: 255, label: "Dock B" },
];

export function MutexSim() {
  const reduced = useReducedMotion();
  const [wrapRef, inView] = useInView<HTMLDivElement>("300px");

  const [ts, setTs] = useState<Record<InScopeRid, number>>({ "R-01": 7, "R-02": 5 });
  const [view, setView] = useState<{
    robots: Record<InScopeRid, { phase: Phase; ts: number; pos: number; waiting: number }>;
    msgs: Msg[];
    occupied: InScopeRid | null;
  }>({
    robots: {
      "R-01": { phase: "RELEASED", ts: 0, pos: 0, waiting: 0 },
      "R-02": { phase: "RELEASED", ts: 0, pos: 0, waiting: 0 },
    },
    msgs: [],
    occupied: null,
  });
  const [log, setLog] = useState<LogLine[]>([]);

  const sim = useRef({
    t: 0,
    robots: {
      "R-01": {
        id: "R-01" as InScopeRid,
        phase: "RELEASED" as Phase,
        ts: 0,
        replies: new Set<InScopeRid>(),
        deferred: new Set<InScopeRid>(),
        pos: 0,
      },
      "R-02": {
        id: "R-02" as InScopeRid,
        phase: "RELEASED" as Phase,
        ts: 0,
        replies: new Set<InScopeRid>(),
        deferred: new Set<InScopeRid>(),
        pos: 0,
      },
    } as Record<InScopeRid, Robot>,
    msgs: [] as Msg[],
    key: 1,
  });

  const pushLog = useCallback((text: string, tone?: LogLine["tone"]) => {
    const t = sim.current.t.toFixed(1).padStart(4, " ");
    setLog((l) => [
      ...l.slice(-40),
      { key: sim.current.key++, t: `t=${t}`, text, tone },
    ]);
  }, []);

  const emit = useCallback(
    (from: InScopeRid, to: InScopeRid, kind: Msg["kind"], stamp: number) => {
      sim.current.msgs.push({
        key: sim.current.key++,
        from,
        to,
        kind,
        ts: stamp,
        at: 0,
      });
    },
    [],
  );

  const request = useCallback(
    (id: InScopeRid) => {
      const r = sim.current.robots[id];
      if (r.phase !== "RELEASED") return;
      r.pos = 0;
      r.phase = "WANTED";
      r.ts = ts[id];
      r.replies = new Set();
      pushLog(`${id}  REQUEST(${r.ts}, ${id}) -> {${OTHER[id]}}`, "accent");
      emit(id, OTHER[id], "REQUEST", r.ts);
    },
    [emit, pushLog, ts],
  );

  const requestBoth = useCallback(() => {
    request("R-01");
    request("R-02");
  }, [request]);

  const reset = useCallback(() => {
    const s = sim.current;
    s.t = 0;
    s.msgs = [];
    (["R-01", "R-02"] as InScopeRid[]).forEach((id) => {
      s.robots[id] = {
        id,
        phase: "RELEASED",
        ts: 0,
        replies: new Set(),
        deferred: new Set(),
        pos: 0,
      };
    });
    setLog([]);
  }, []);

  /* --- the algorithm, one tick at a time ----------------------------- */
  const step = useCallback(
    (dt: number) => {
      const s = sim.current;
      s.t += dt;

      /* deliver messages */
      for (let i = s.msgs.length - 1; i >= 0; i--) {
        const m = s.msgs[i];
        m.at += dt;
        if (m.at < FLIGHT) continue;
        s.msgs.splice(i, 1);

        const me = s.robots[m.to];
        if (m.kind === "REQUEST") {
          const iAmAhead =
            me.phase === "HELD" ||
            (me.phase === "WANTED" &&
              (me.ts < m.ts || (me.ts === m.ts && me.id < m.from)));

          if (iAmAhead) {
            me.deferred.add(m.from);
            pushLog(
              `${me.id}  DEFER ${m.from}: (${me.ts}, ${me.id}) < (${m.ts}, ${m.from})`,
              "hold",
            );
          } else {
            pushLog(`${me.id}  REPLY -> ${m.from}`);
            emit(me.id, m.from, "REPLY", me.ts);
          }
        } else {
          me.replies.add(m.from);
          if (me.phase === "WANTED" && me.replies.size >= 1) {
            me.phase = "HELD";
            pushLog(`${me.id}  ENTER D-07, replies in`, "accent");
          }
        }
      }

      /* motion + release */
      (["R-01", "R-02"] as InScopeRid[]).forEach((id) => {
        const r = s.robots[id];
        const target =
          r.phase === "HELD" ? 1 : r.phase === "WANTED" ? HOLD_AT[id] : r.pos;
        const d = target - r.pos;
        const move = Math.sign(d) * Math.min(Math.abs(d), SPEED * dt);
        r.pos += move;

        if (r.phase === "HELD" && r.pos >= 0.999) {
          r.phase = "RELEASED";
          r.pos = 1;
          pushLog(`${id}  RELEASE D-07, sending deferred`, "accent");
          r.deferred.forEach((peer) => {
            pushLog(`${id}  REPLY -> ${peer} (deferred)`);
            emit(id, peer, "REPLY", r.ts);
          });
          r.deferred.clear();
          r.replies.clear();
          r.ts = 0;
        }
      });
    },
    [emit, pushLog],
  );

  /* --- driver --------------------------------------------------------- */
  useEffect(() => {
    if (!inView || reduced) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      step(dt);
      const s = sim.current;
      setView({
        robots: {
          "R-01": {
            phase: s.robots["R-01"].phase,
            ts: s.robots["R-01"].ts,
            pos: s.robots["R-01"].pos,
            waiting: s.robots["R-01"].deferred.size,
          },
          "R-02": {
            phase: s.robots["R-02"].phase,
            ts: s.robots["R-02"].ts,
            pos: s.robots["R-02"].pos,
            waiting: s.robots["R-02"].deferred.size,
          },
        },
        msgs: [...s.msgs],
        occupied:
          s.robots["R-01"].phase === "HELD"
            ? "R-01"
            : s.robots["R-02"].phase === "HELD"
              ? "R-02"
              : null,
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduced, step]);

  const settle = useCallback(() => {
    for (let i = 0; i < 600; i++) step(1 / 30);
    const s = sim.current;
    setView({
      robots: {
        "R-01": { ...s.robots["R-01"], waiting: s.robots["R-01"].deferred.size },
        "R-02": { ...s.robots["R-02"], waiting: s.robots["R-02"].deferred.size },
      },
      msgs: [],
      occupied: null,
    });
  }, [step]);

  const bump = (id: InScopeRid, d: number) =>
    setTs((t) => ({ ...t, [id]: Math.max(1, Math.min(99, t[id] + d)) }));

  const busy =
    view.robots["R-01"].phase !== "RELEASED" ||
    view.robots["R-02"].phase !== "RELEASED";

  return (
    <div ref={wrapRef}>
      <Figure
        className="reveal"
        caption={
          <>
            <strong>Scoped Ricart-Agrawala:</strong> Negotiation is strictly bounded to robots within the conflict envelope (k=2). Unaffected fleet nodes (R-03, R-04) exchange zero messages. Requests are ordered by Lamport timestamp <code>(T_i, Node_ID)</code> with deterministic tie-breaking.
          </>
        }
      >
        <Panel>
          <PanelBar title="Intersection D-07 (Spatial Scope)">
            <span
              className="chip"
              data-state={view.occupied ? "stop" : "live"}
              aria-live="polite"
            >
              {view.occupied ? `${view.occupied} in zone` : "Zone clear"}
            </span>
            <span className="chip hidden sm:inline-flex" style={{ color: "var(--accent)" }}>
              Scope: k=2 (R_conflict)
            </span>
            <button type="button" className="ctl" onClick={reset}>
              <ArrowClockwise size={12} weight="bold" aria-hidden="true" />
              Reset
            </button>
          </PanelBar>

          <div className="grid lg:grid-cols-[1fr_290px]">
            <div className="p-3">
              <svg
                viewBox={`0 0 ${VB.w} ${VB.h}`}
                className="h-auto w-full"
                role="img"
                aria-label={`Plan view of intersection D-07. R-01 is ${view.robots["R-01"].phase}, R-02 is ${view.robots["R-02"].phase}. R-03 and R-04 are out of scope.`}
              >
                {/* conflict envelope */}
                <ellipse
                  cx={CENTER.x}
                  cy={CENTER.y}
                  rx={ENVELOPE_R.rx}
                  ry={ENVELOPE_R.ry}
                  fill="var(--accent-wash)"
                  stroke="var(--accent-line)"
                  strokeWidth="1.25"
                  strokeDasharray="4 4"
                />
                <text
                  x={CENTER.x + ENVELOPE_R.rx - 8}
                  y={CENTER.y - ENVELOPE_R.ry + 15}
                  textAnchor="end"
                  fill="var(--accent)"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 8.5, letterSpacing: "0.06em" }}
                >
                  CONFLICT ENVELOPE R_conflict (k=2)
                </text>

                {/* corridors */}
                <rect
                  x="16"
                  y={CORR.y0}
                  width={VB.w - 32}
                  height={CORR.y1 - CORR.y0}
                  fill="var(--surface-2)"
                />
                <rect
                  x={CORR.x0}
                  y="12"
                  width={CORR.x1 - CORR.x0}
                  height={VB.h - 24}
                  fill="var(--surface-2)"
                />
                {[
                  [16, CORR.y0, VB.w - 16, CORR.y0],
                  [16, CORR.y1, VB.w - 16, CORR.y1],
                  [CORR.x0, 12, CORR.x0, VB.h - 12],
                  [CORR.x1, 12, CORR.x1, VB.h - 12],
                ].map(([a, b, c, d], i) => (
                  <line
                    key={i}
                    x1={a}
                    y1={b}
                    x2={c}
                    y2={d}
                    stroke="var(--line)"
                    strokeWidth="1"
                  />
                ))}

                {/* critical zone */}
                <rect
                  x={CORR.x0}
                  y={CORR.y0}
                  width={CORR.x1 - CORR.x0}
                  height={CORR.y1 - CORR.y0}
                  fill={view.occupied ? "var(--stop-wash)" : "var(--accent-wash)"}
                  stroke={view.occupied ? "var(--stop)" : "var(--accent-line)"}
                  strokeWidth="1.25"
                />
                <text
                  x={(CORR.x0 + CORR.x1) / 2}
                  y={CORR.y0 - 8}
                  textAnchor="middle"
                  fill="var(--text-dim)"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 8.5 }}
                >
                  CRITICAL ZONE D-07
                </text>

                {/* hold lines */}
                {(["R-01", "R-02"] as InScopeRid[]).map((id) => {
                  const p = pathPoint(id, HOLD_AT[id]);
                  return id === "R-01" ? (
                    <line
                      key={id}
                      x1={p.x + 12}
                      y1={CORR.y0 + 4}
                      x2={p.x + 12}
                      y2={CORR.y1 - 4}
                      stroke="var(--line-strong)"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                  ) : (
                    <line
                      key={id}
                      x1={CORR.x0 + 4}
                      y1={p.y + 12}
                      x2={CORR.x1 - 4}
                      y2={p.y + 12}
                      stroke="var(--line-strong)"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                  );
                })}

                {/* out of scope robots */}
                {OUT_OF_SCOPE_ROBOTS.map((o) => (
                  <g key={o.id} opacity="0.6">
                    <rect
                      x={o.x - 11}
                      y={o.y - 11}
                      width="22"
                      height="22"
                      rx="4"
                      fill="var(--surface)"
                      stroke="var(--text-dim)"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    <circle cx={o.x} cy={o.y} r="2.5" fill="var(--text-dim)" />
                    <text
                      x={o.x}
                      y={o.y + 20}
                      textAnchor="middle"
                      fill="var(--text-dim)"
                      style={{ fontFamily: "var(--font-mono)", fontSize: 8 }}
                    >
                      {o.id}
                    </text>
                    <text
                      x={o.x}
                      y={o.y + 30}
                      textAnchor="middle"
                      fill="var(--text-dim)"
                      style={{ fontFamily: "var(--font-mono)", fontSize: 7 }}
                    >
                      OUT OF SCOPE
                    </text>
                  </g>
                ))}

                {/* messages in flight */}
                {view.msgs.map((m) => {
                  const a = pathPoint(m.from, view.robots[m.from].pos);
                  const b = pathPoint(m.to, view.robots[m.to].pos);
                  const k = Math.min(1, m.at / FLIGHT);
                  const x = a.x + (b.x - a.x) * k;
                  const y = a.y + (b.y - a.y) * k;
                  return (
                    <g key={m.key}>
                      <line
                        x1={a.x}
                        y1={a.y}
                        x2={b.x}
                        y2={b.y}
                        stroke="var(--line-strong)"
                        strokeWidth="1"
                        strokeDasharray="2 4"
                      />
                      <rect
                        x={x - 26}
                        y={y - 9}
                        width="52"
                        height="18"
                        rx="3"
                        fill={
                          m.kind === "REQUEST" ? "var(--accent)" : "var(--surface)"
                        }
                        stroke="var(--accent)"
                        strokeWidth="1"
                      />
                      <text
                        x={x}
                        y={y + 4}
                        textAnchor="middle"
                        fill={
                          m.kind === "REQUEST" ? "var(--bg)" : "var(--accent)"
                        }
                        style={{ fontFamily: "var(--font-mono)", fontSize: 8.5 }}
                      >
                        {m.kind === "REQUEST" ? `REQ ${m.ts}` : "REPLY"}
                      </text>
                    </g>
                  );
                })}

                {/* in-scope robots */}
                {(["R-01", "R-02"] as InScopeRid[]).map((id) => {
                  const st = view.robots[id];
                  const p = pathPoint(id, st.pos);
                  const color =
                    st.phase === "HELD"
                      ? "var(--accent)"
                      : st.phase === "WANTED"
                        ? "var(--hold)"
                        : "var(--text-dim)";
                  return (
                    <g key={id}>
                      <rect
                        x={p.x - 11}
                        y={p.y - 11}
                        width="22"
                        height="22"
                        rx="4"
                        fill="var(--surface)"
                        stroke={color}
                        strokeWidth="1.5"
                      />
                      <rect
                        x={p.x - 3.5}
                        y={p.y - 3.5}
                        width="7"
                        height="7"
                        rx="1.5"
                        fill={color}
                      />
                      <text
                        x={p.x}
                        y={p.y + 24}
                        textAnchor="middle"
                        fill="var(--text)"
                        style={{ fontFamily: "var(--font-mono)", fontSize: 9 }}
                      >
                        {id}
                      </text>
                      {st.phase !== "RELEASED" && (
                        <text
                          x={p.x}
                          y={p.y - 16}
                          textAnchor="middle"
                          fill={color}
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 8,
                          }}
                        >
                          {st.phase} (T={st.ts})
                        </text>
                      )}
                    </g>
                  );
                })}
              </svg>

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {(["R-01", "R-02"] as InScopeRid[]).map((id) => (
                  <div
                    key={id}
                    className="rounded-sm border border-line bg-surface-2 p-2.5"
                  >
                    <div className="flex items-center gap-2">
                      <span className="tok" style={{ color: "var(--text)" }}>
                        {id}
                      </span>
                      <span
                        className="chip ml-auto"
                        data-state={
                          view.robots[id].phase === "HELD"
                            ? "live"
                            : view.robots[id].phase === "WANTED"
                              ? "hold"
                              : undefined
                        }
                      >
                        {view.robots[id].phase}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="label text-micro">Lamport Counter (T_{id.slice(-1)})</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="ctl"
                          style={{ padding: "4px 6px" }}
                          onClick={() => bump(id, -1)}
                          disabled={busy}
                          aria-label={`Decrease ${id} timestamp`}
                        >
                          <Minus size={10} weight="bold" aria-hidden="true" />
                        </button>
                        <span
                          className="tok w-5 text-center text-micro"
                          style={{ color: "var(--accent)" }}
                        >
                          {ts[id]}
                        </span>
                        <button
                          type="button"
                          className="ctl"
                          style={{ padding: "4px 6px" }}
                          onClick={() => bump(id, 1)}
                          disabled={busy}
                          aria-label={`Increase ${id} timestamp`}
                        >
                          <Plus size={10} weight="bold" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="ctl mt-2 w-full text-micro"
                      onClick={() => request(id)}
                      disabled={view.robots[id].phase !== "RELEASED"}
                    >
                      Request zone
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  className="ctl ctl-primary"
                  onClick={requestBoth}
                  disabled={busy}
                >
                  Both request at once
                </button>
                {reduced && (
                  <button type="button" className="ctl" onClick={settle}>
                    Resolve now
                  </button>
                )}
              </div>
            </div>

            {/* wire log */}
            <div className="flex max-h-[420px] flex-col border-t border-line p-3 lg:max-h-none lg:border-l lg:border-t-0">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="label">Scoped Wire Log</h3>
                <span className="label text-micro" style={{ color: "var(--accent)" }}>
                  2(k-1) msgs
                </span>
              </div>
              <div className="log flex-1 overflow-y-auto">
                {log.length === 0 ? (
                  <p className="text-sm text-dim">
                    Intersection idle. Request the zone from either robot, or click &ldquo;Both request at once&rdquo; to test tie-breaking.
                  </p>
                ) : (
                  log.map((l, i) => (
                    <div
                      key={l.key}
                      className={`log__row ${i === log.length - 1 ? "log__row--new" : ""}`}
                    >
                      <span style={{ color: "var(--text-dim)" }}>{l.t}</span>
                      <span
                        style={{
                          color:
                            l.tone === "accent"
                              ? "var(--accent)"
                              : l.tone === "hold"
                                ? "var(--hold)"
                                : "var(--text-muted)",
                        }}
                      >
                        {l.text}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </Panel>
      </Figure>

      <div className="reveal">
        <SpecPanel spec={SPEC_MUTEX} />
      </div>
    </div>
  );
}

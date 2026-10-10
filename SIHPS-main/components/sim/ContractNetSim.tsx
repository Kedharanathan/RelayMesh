"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowClockwise, Play } from "@phosphor-icons/react";
import { useInView, useReducedMotion } from "@/lib/hooks";
import { Figure, Panel, PanelBar, SpecPanel } from "@/components/site/Panel";
import { SPEC_CNP } from "@/lib/specs";

/* ==========================================================================
   Contract Net with Deterministic SHA-256 Election & 3-to-1 Fault Funnel.

   1. Fault Detection: Three triggers funnel into re-auction engine.
   2. Deterministic SHA-256 Election: argmin SHA-256(Task_ID || Robot_ID) (0 msgs).
   3. Protocol Rounds: Announce -> Bid -> Award -> Execute.
   4. Cost Scoring: Cost = 1.0*d + 0.5*(1 - bat/100) + 0.3*queue.
   ========================================================================== */

type Stage = "idle" | "fault" | "announce" | "bid" | "award" | "execute" | "done";
type FaultType = "heartbeat" | "blocked" | "retry";

const FAULT_INFO: Record<FaultType, { name: string; desc: string }> = {
  heartbeat: {
    name: "Heartbeat Loss",
    desc: "Missed 3x UDP broadcast heartbeats (T_timeout > 300ms).",
  },
  blocked: {
    name: "Blocked Aisle",
    desc: "Front ToF obstacle held path > 15s without clearing.",
  },
  retry: {
    name: "Retry Exhaustion",
    desc: "3x unacknowledged frame retries to next waypoint.",
  },
};

const STAGE_MS: Record<Stage, number> = {
  idle: 0,
  fault: 900,
  announce: 1200,
  bid: 1600,
  award: 1200,
  execute: 1500,
  done: 0,
};

const ORDER: Stage[] = ["fault", "announce", "bid", "award", "execute", "done"];

const STAGE_COPY: { key: Stage; name: string; line: string }[] = [
  {
    key: "announce",
    name: "1. Elect & Announce",
    line: "Witnesses hash-elect R-01 (SHA-256 #3a7f, 0 msgs). Task broadcasted.",
  },
  {
    key: "bid",
    name: "2. Multi-Bid",
    line: "Peers calculate cost = 1.0·d + 0.5·(1-bat) + 0.3·q.",
  },
  {
    key: "award",
    name: "3. Award",
    line: "Lowest cost bid wins contract. Losers resume tasks.",
  },
  {
    key: "execute",
    name: "4. Handover",
    line: "Task transferred. Winning robot assumes package transit.",
  },
];

type Bidder = {
  id: string;
  x: number;
  y: number;
  distance: number;
  battery: number;
  queue: number;
  inRange: boolean;
  hash: string;
};

const INITIAL: Bidder[] = [
  { id: "R-03", x: 330, y: 74, distance: 6.2, battery: 31, queue: 1, inRange: true, hash: "8e1b" },
  { id: "R-04", x: 372, y: 154, distance: 9.8, battery: 92, queue: 3, inRange: true, hash: "b42c" },
  { id: "R-05", x: 330, y: 242, distance: 4.1, battery: 55, queue: 0, inRange: true, hash: "f910" },
  { id: "R-06", x: 500, y: 284, distance: 2.4, battery: 88, queue: 0, inRange: false, hash: "c38a" },
];

const MANAGER_HASH = "3a7f";
const MANAGER = { id: "R-01", x: 150, y: 154, hash: MANAGER_HASH };
const FAILED = { id: "R-02", x: 56, y: 56 };
const VB = { w: 550, h: 320 };

function bidCost(b: Bidder) {
  return 1.0 * b.distance + 0.5 * (1 - b.battery / 100) + 0.3 * b.queue;
}

export function ContractNetSim() {
  const reduced = useReducedMotion();
  const [wrapRef, inView] = useInView<HTMLDivElement>("300px");

  const [faultType, setFaultType] = useState<FaultType>("heartbeat");
  const [bidders, setBidders] = useState<Bidder[]>(INITIAL);
  const [stage, setStage] = useState<Stage>("idle");
  const [, repaint] = useState(0);

  const clock = useRef({ stage: "idle" as Stage, t: 0 });

  const inRange = useMemo(() => bidders.filter((b) => b.inRange), [bidders]);
  const winner = useMemo(() => {
    if (!inRange.length) return null;
    return inRange.reduce((a, b) => (bidCost(b) < bidCost(a) ? b : a));
  }, [inRange]);
  const globalBest = useMemo(
    () => bidders.reduce((a, b) => (bidCost(b) < bidCost(a) ? b : a)),
    [bidders],
  );

  const run = useCallback(() => {
    if (reduced) {
      clock.current = { stage: "done", t: 0 };
      setStage("done");
      return;
    }
    clock.current = { stage: "fault", t: 0 };
    setStage("fault");
  }, [reduced]);

  const reset = useCallback(() => {
    clock.current = { stage: "idle", t: 0 };
    setStage("idle");
  }, []);

  useEffect(() => {
    if (!inView || reduced) return;
    if (stage === "idle" || stage === "done") return;

    let raf = 0;
    let last = performance.now();
    const tickFn = (now: number) => {
      const dt = Math.min(now - last, 60);
      last = now;
      const c = clock.current;
      c.t += dt;
      if (c.t >= STAGE_MS[c.stage] + 280) {
        const next = ORDER[ORDER.indexOf(c.stage) + 1] ?? "done";
        c.stage = next;
        c.t = 0;
        setStage(next);
      }
      repaint((n) => n + 1);
      raf = requestAnimationFrame(tickFn);
    };
    raf = requestAnimationFrame(tickFn);
    return () => cancelAnimationFrame(raf);
  }, [inView, reduced, stage]);

  const t = clock.current.t;
  const stageIdx = ORDER.indexOf(stage);

  const bidArrived = (i: number) =>
    stage === "award" ||
    stage === "execute" ||
    stage === "done" ||
    (stage === "bid" && t > i * 190 + 620);

  const chipHolder =
    stage === "execute"
      ? lerpPoint(FAILED, winner ?? MANAGER, Math.min(1, t / STAGE_MS.execute))
      : stage === "done"
        ? (winner ?? MANAGER)
        : FAILED;

  return (
    <div ref={wrapRef}>
      <Figure
        className="reveal"
        caption={
          <>
            <strong>Unified Fault Funnel &amp; SHA-256 Election:</strong> When R-02 faults, witness nodes compute <code>SHA256(Task_ID || Robot_ID)</code> deterministically electing R-01 with 0 network voting rounds. Bids score distance, battery reserve, and queue length (<code>Cost = 1.0·d + 0.5·(1-bat/100) + 0.3·queue</code>).
          </>
        }
      >
        <Panel>
          <PanelBar title="Contract Net Protocol (Deterministic Handover)">
            <span
              className="chip"
              data-state={stage === "idle" ? undefined : stage === "fault" ? "stop" : "live"}
              aria-live="polite"
            >
              {stage === "idle"
                ? "R-02 nominal"
                : stage === "fault"
                  ? `Fault: ${FAULT_INFO[faultType].name}`
                  : stage === "done"
                    ? `Awarded to ${winner?.id ?? "nobody"}`
                    : STAGE_COPY.find((s) => s.key === stage)?.name}
            </span>
            <button
              type="button"
              className="ctl ctl-primary"
              onClick={run}
              disabled={stage !== "idle" && stage !== "done"}
            >
              <Play size={12} weight="fill" aria-hidden="true" />
              Fail R-02
            </button>
            <button type="button" className="ctl" onClick={reset}>
              <ArrowClockwise size={12} weight="bold" aria-hidden="true" />
              Reset
            </button>
          </PanelBar>

          {/* Fault Trigger Selector */}
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-2 px-3 py-1.5">
            <span className="label text-micro">Fault Trigger:</span>
            {(["heartbeat", "blocked", "retry"] as FaultType[]).map((ft) => (
              <button
                key={ft}
                type="button"
                className={`ctl text-micro ${faultType === ft ? "ctl-primary" : ""}`}
                style={{ padding: "3px 8px" }}
                onClick={() => setFaultType(ft)}
                disabled={stage !== "idle" && stage !== "done"}
              >
                {FAULT_INFO[ft].name}
              </button>
            ))}
          </div>

          <div className="grid lg:grid-cols-[1fr_310px]">
            <div className="p-3">
              <svg
                viewBox={`0 0 ${VB.w} ${VB.h}`}
                className="h-auto w-full"
                role="img"
                aria-label={`Contract Net scene. Stage: ${stage}. ${winner ? `Best bid so far is ${winner.id} at ${bidCost(winner).toFixed(2)}.` : ""}`}
              >
                {/* broadcast range of the manager */}
                <ellipse
                  cx={MANAGER.x}
                  cy={MANAGER.y}
                  rx="245"
                  ry="115"
                  fill="none"
                  stroke="var(--line-strong)"
                  strokeWidth="1"
                  strokeDasharray="4 5"
                />
                <text
                  x={MANAGER.x + 245}
                  y={MANAGER.y - 120}
                  textAnchor="end"
                  fill="var(--text-dim)"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 8.5 }}
                >
                  BROADCAST RANGE
                </text>

                {/* announce pulses */}
                {stage === "announce" &&
                  inRange.map((b, i) => {
                    const k = clampProg((t - i * 90) / 780);
                    if (k <= 0) return null;
                    return (
                      <MsgDot
                        key={b.id}
                        a={MANAGER}
                        b={b}
                        k={k}
                        label="ANNOUNCE"
                        filled
                      />
                    );
                  })}

                {/* bids returning */}
                {stage === "bid" &&
                  inRange.map((b, i) => {
                    const k = clampProg((t - i * 190) / 780);
                    if (k <= 0) return null;
                    return (
                      <MsgDot
                        key={b.id}
                        a={b}
                        b={MANAGER}
                        k={k}
                        label={bidCost(b).toFixed(2)}
                      />
                    );
                  })}

                {/* award */}
                {stage === "award" && winner && (
                  <MsgDot
                    a={MANAGER}
                    b={winner}
                    k={clampProg(t / 820)}
                    label="AWARD"
                    filled
                  />
                )}

                {/* failed robot */}
                <RobotGlyph
                  x={FAILED.x}
                  y={FAILED.y}
                  id={FAILED.id}
                  tone={stage === "idle" ? "idle" : "dead"}
                  sub={stage === "idle" ? undefined : "FAULT: DROP"}
                />

                {/* manager */}
                <RobotGlyph
                  x={MANAGER.x}
                  y={MANAGER.y}
                  id={MANAGER.id}
                  tone={stage === "idle" ? "idle" : "manager"}
                  sub={
                    stage === "idle"
                      ? undefined
                      : `MGR (#${MANAGER.hash})`
                  }
                />

                {/* bidders */}
                {bidders.map((b) => (
                  <RobotGlyph
                    key={b.id}
                    x={b.x}
                    y={b.y}
                    id={b.id}
                    tone={
                      !b.inRange
                        ? "out"
                        : winner && b.id === winner.id && stageIdx >= 3
                          ? "winner"
                          : "idle"
                    }
                    sub={
                      !b.inRange
                        ? "OUT OF RANGE"
                        : bidArrived(inRange.indexOf(b))
                          ? `BID ${bidCost(b).toFixed(2)}`
                          : `#${b.hash}`
                    }
                  />
                ))}

                {/* the task itself, changing hands */}
                {stage !== "idle" && (
                  <g
                    transform={`translate(${chipHolder.x}, ${chipHolder.y - 32})`}
                  >
                    <rect
                      x="-38"
                      y="-9"
                      width="76"
                      height="18"
                      rx="3"
                      fill="var(--hold-wash)"
                      stroke="var(--hold)"
                      strokeWidth="1"
                    />
                    <text
                      x="0"
                      y="4"
                      textAnchor="middle"
                      fill="var(--hold)"
                      style={{ fontFamily: "var(--font-mono)", fontSize: 8.5 }}
                    >
                      TASK: MOVE D-07
                    </text>
                  </g>
                )}
              </svg>

              {/* 4-column stage rail */}
              <ol className="m-0 mt-3 grid list-none gap-px p-0 sm:grid-cols-2 lg:grid-cols-4">
                {STAGE_COPY.map((s, i) => {
                  const done = stage === "done" || stageIdx > i + 1;
                  const now = stage === s.key;
                  return (
                    <li
                      key={s.key}
                      className="border-t-2 pt-2 transition-colors duration-300"
                      style={{
                        borderColor: now
                          ? "var(--accent)"
                          : done
                            ? "var(--accent-line)"
                            : "var(--line)",
                      }}
                    >
                      <span
                        className="tok block text-micro"
                        style={{
                          color: now || done ? "var(--accent)" : "var(--text-dim)",
                        }}
                      >
                        {s.name}
                      </span>
                      <span className="mt-0.5 block text-micro text-muted">
                        {s.line}
                      </span>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* bid sheet */}
            <div className="border-t border-line p-3 lg:border-l lg:border-t-0">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="label">Multi-Parameter Bid Sheet</h3>
                <span className="label text-micro" style={{ color: "var(--accent)" }}>
                  SHA-256 Hash
                </span>
              </div>
              <ul className="m-0 list-none space-y-2 p-0">
                {bidders.map((b) => {
                  const isWinner =
                    winner?.id === b.id && (stage === "done" || stageIdx >= 3);
                  return (
                    <li
                      key={b.id}
                      className="rounded-sm border p-2 transition-colors duration-300"
                      style={{
                        borderColor: isWinner
                          ? "var(--accent)"
                          : "var(--line)",
                        background: isWinner
                          ? "var(--accent-wash)"
                          : b.inRange
                            ? "transparent"
                            : "var(--bg-sunken)",
                      }}
                    >
                      <div className="flex items-baseline gap-2">
                        <span
                          className="tok"
                          style={{
                            color: b.inRange ? "var(--text)" : "var(--text-dim)",
                          }}
                        >
                          {b.id}
                        </span>
                        <span className="label text-micro" style={{ color: "var(--text-dim)" }}>
                          #{b.hash}
                        </span>
                        <span
                          className="tok ml-auto"
                          style={{
                            color: isWinner
                              ? "var(--accent)"
                              : b.inRange
                                ? "var(--text-muted)"
                                : "var(--text-dim)",
                          }}
                        >
                          {bidCost(b).toFixed(2)}
                        </span>
                      </div>

                      <div className="mt-1 grid grid-cols-3 gap-2">
                        <SliderRow
                          label="Dist"
                          unit="m"
                          min={1}
                          max={14}
                          step={0.1}
                          value={b.distance}
                          disabled={stage !== "idle" && stage !== "done"}
                          onChange={(v) =>
                            setBidders((list) =>
                              list.map((x) =>
                                x.id === b.id ? { ...x, distance: v } : x,
                              ),
                            )
                          }
                          format={(v) => v.toFixed(1)}
                          name={`${b.id} distance`}
                        />
                        <SliderRow
                          label="Battery"
                          unit="%"
                          min={5}
                          max={100}
                          step={1}
                          value={b.battery}
                          disabled={stage !== "idle" && stage !== "done"}
                          onChange={(v) =>
                            setBidders((list) =>
                              list.map((x) =>
                                x.id === b.id ? { ...x, battery: v } : x,
                              ),
                            )
                          }
                          format={(v) => String(Math.round(v))}
                          name={`${b.id} battery`}
                        />
                        <SliderRow
                          label="Queue"
                          unit="tk"
                          min={0}
                          max={5}
                          step={1}
                          value={b.queue}
                          disabled={stage !== "idle" && stage !== "done"}
                          onChange={(v) =>
                            setBidders((list) =>
                              list.map((x) =>
                                x.id === b.id ? { ...x, queue: v } : x,
                              ),
                            )
                          }
                          format={(v) => String(v)}
                          name={`${b.id} queue`}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>

              <p className="mt-2 text-micro text-dim">
                bid = 1.0·dist + 0.5·(1 - bat/100) + 0.3·queue. Lower wins.
              </p>

              {(stage === "done" || stageIdx >= 3) &&
                winner &&
                globalBest.id !== winner.id && (
                  <p className="mt-2 rounded-sm border border-line bg-bg-sunken p-2 text-micro text-muted">
                    Best AMR on floor is{" "}
                    <span className="tok" style={{ color: "var(--hold)" }}>
                      {globalBest.id} at {bidCost(globalBest).toFixed(2)}
                    </span>
                    , but out of range. Fleet settles for {bidCost(winner).toFixed(2)}.
                  </p>
                )}
            </div>
          </div>
        </Panel>
      </Figure>

      <div className="reveal">
        <SpecPanel spec={SPEC_CNP} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function clampProg(v: number) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function lerpPoint(
  a: { x: number; y: number },
  b: { x: number; y: number },
  k: number,
) {
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
}

function MsgDot({
  a,
  b,
  k,
  label,
  filled,
}: {
  a: { x: number; y: number };
  b: { x: number; y: number };
  k: number;
  label: string;
  filled?: boolean;
}) {
  const p = lerpPoint(a, b, k);
  const w = label.length * 5.5 + 14;
  return (
    <g>
      <line
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke="var(--accent-line)"
        strokeWidth="1"
        strokeDasharray="3 4"
      />
      <rect
        x={p.x - w / 2}
        y={p.y - 8}
        width={w}
        height={16}
        rx="3"
        fill={filled ? "var(--accent)" : "var(--surface)"}
        stroke="var(--accent)"
        strokeWidth="1"
      />
      <text
        x={p.x}
        y={p.y + 3.5}
        textAnchor="middle"
        fill={filled ? "var(--bg)" : "var(--accent)"}
        style={{ fontFamily: "var(--font-mono)", fontSize: 8 }}
      >
        {label}
      </text>
    </g>
  );
}

function RobotGlyph({
  x,
  y,
  id,
  tone,
  sub,
}: {
  x: number;
  y: number;
  id: string;
  tone: "idle" | "manager" | "winner" | "dead" | "out";
  sub?: string;
}) {
  const color =
    tone === "dead"
      ? "var(--stop)"
      : tone === "winner" || tone === "manager"
        ? "var(--accent)"
        : "var(--text-dim)";
  const dashed = tone === "dead" || tone === "out";

  return (
    <g>
      {tone === "winner" && (
        <rect
          x={x - 20}
          y={y - 20}
          width="40"
          height="40"
          rx="6"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1"
          opacity="0.5"
        />
      )}
      <rect
        x={x - 13}
        y={y - 13}
        width="26"
        height="26"
        rx="4"
        fill="var(--surface)"
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray={dashed ? "3 3" : undefined}
      />
      <rect
        x={x - 4}
        y={y - 4}
        width="8"
        height="8"
        rx="1.5"
        fill={tone === "out" || tone === "dead" ? "none" : color}
        stroke={color}
        strokeWidth="1"
      />
      <text
        x={x}
        y={y + 24}
        textAnchor="middle"
        fill="var(--text)"
        style={{ fontFamily: "var(--font-mono)", fontSize: 9 }}
      >
        {id}
      </text>
      {sub && (
        <text
          x={x}
          y={y + 34}
          textAnchor="middle"
          fill={color}
          style={{ fontFamily: "var(--font-mono)", fontSize: 7.5 }}
        >
          {sub}
        </text>
      )}
    </g>
  );
}

function SliderRow({
  label,
  unit,
  min,
  max,
  step,
  value,
  onChange,
  format,
  disabled,
  name,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  disabled?: boolean;
  name: string;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between">
        <span className="label text-micro">{label}</span>
        <span className="tok text-micro" style={{ color: "var(--text-muted)", fontSize: "10px" }}>
          {format(value)}{unit}
        </span>
      </span>
      <input
        type="range"
        className="slider mt-0.5"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        aria-label={name}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

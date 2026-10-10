"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowClockwise, Play } from "@phosphor-icons/react";
import { useReducedMotion } from "@/lib/hooks";
import { Figure, Panel, PanelBar, SpecPanel } from "@/components/site/Panel";
import { SPEC_LAMPORT } from "@/lib/specs";

const NODES = ["R-01", "R-02", "R-03"] as const;
type NodeId = (typeof NODES)[number];

const LANE_X: Record<NodeId, number> = { "R-01": 90, "R-02": 300, "R-03": 510 };
const VIEW_W = 600;
const TOP = 58;
const ROW = 46;
const VISIBLE_ROWS = 8;

type EventMark = {
  key: number;
  node: NodeId;
  row: number;
  clock: number;
  kind: "send" | "recv";
  /** the arithmetic, kept so the receiver can show its working */
  formula?: string;
};

type Flight = {
  key: number;
  from: NodeId;
  to: NodeId;
  row: number;
  clock: number;
};

/* The scripted walkthrough. Ends on a genuinely concurrent pair, because
   that is the part of the algorithm people get wrong. */
const SCRIPT: [NodeId, NodeId][] = [
  ["R-01", "R-02"],
  ["R-03", "R-01"],
  ["R-02", "R-03"],
  ["R-01", "R-03"],
];

export function LamportSim() {
  const reduced = useReducedMotion();

  const [clocks, setClocks] = useState<Record<NodeId, number>>({
    "R-01": 0,
    "R-02": 0,
    "R-03": 0,
  });
  const [marks, setMarks] = useState<EventMark[]>([]);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [row, setRow] = useState(0);
  const [running, setRunning] = useState(false);

  const keyRef = useRef(1);
  const clocksRef = useRef(clocks);
  clocksRef.current = clocks;
  const rowRef = useRef(0);
  rowRef.current = row;
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t));
    },
    [],
  );

  const flightMs = reduced ? 0 : 820;

  const send = useCallback(
    (from: NodeId, to: NodeId) => {
      if (from === to) return;

      const sendRow = rowRef.current;
      const recvRow = sendRow + 1;
      rowRef.current = sendRow + 2;
      setRow(sendRow + 2);

      // A send is an event: the sender's own clock ticks before transmitting.
      const sentClock = clocksRef.current[from] + 1;
      clocksRef.current = { ...clocksRef.current, [from]: sentClock };
      setClocks(clocksRef.current);

      const k = keyRef.current++;
      setMarks((m) => [
        ...m,
        { key: k, node: from, row: sendRow, clock: sentClock, kind: "send" },
      ]);
      setFlights((f) => [
        ...f,
        { key: k, from, to, row: sendRow, clock: sentClock },
      ]);

      const deliver = () => {
        const own = clocksRef.current[to];
        // C(i) <- max(C(i), C(received)) + 1
        const next = Math.max(own, sentClock) + 1;
        clocksRef.current = { ...clocksRef.current, [to]: next };
        setClocks(clocksRef.current);
        setFlights((f) => f.filter((x) => x.key !== k));
        setMarks((m) => [
          ...m,
          {
            key: keyRef.current++,
            node: to,
            row: recvRow,
            clock: next,
            kind: "recv",
            formula: `max(${own}, ${sentClock}) + 1`,
          },
        ]);
      };

      if (reduced) deliver();
      else timers.current.push(window.setTimeout(deliver, flightMs));
    },
    [flightMs, reduced],
  );

  const reset = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    clocksRef.current = { "R-01": 0, "R-02": 0, "R-03": 0 };
    rowRef.current = 0;
    setClocks(clocksRef.current);
    setMarks([]);
    setFlights([]);
    setRow(0);
    setRunning(false);
  }, []);

  const runScript = useCallback(() => {
    reset();
    setRunning(true);
    const gap = reduced ? 420 : flightMs + 620;
    SCRIPT.forEach(([from, to], i) => {
      timers.current.push(
        window.setTimeout(() => {
          send(from, to);
          if (i === SCRIPT.length - 1) {
            timers.current.push(
              window.setTimeout(() => setRunning(false), gap),
            );
          }
        }, 260 + i * gap),
      );
    });
  }, [flightMs, reduced, reset, send]);

  /* Scroll the diagram once events run past the visible window. */
  const shift = Math.max(0, row - VISIBLE_ROWS) * ROW;
  const viewH = TOP + VISIBLE_ROWS * ROW + 26;

  return (
    <>
      {/* The rule, stated before the toy. */}
      <div className="reveal overflow-x-auto rounded-md border border-line bg-surface-2 px-5 py-5 md:px-7 md:py-6">
        <code
          className="block whitespace-nowrap text-formula"
          translate="no"
          style={{
            fontFamily: "var(--font-mono)",
            letterSpacing: "-0.01em",
            color: "var(--text)",
          }}
        >
          C(i) <span style={{ color: "var(--accent)" }}>&#8592;</span> max
          <span style={{ color: "var(--text-dim)" }}>(</span>C(i),
          C(received)
          <span style={{ color: "var(--text-dim)" }}>)</span> + 1
        </code>
        <p className="mt-3 max-w-[62ch] text-sm text-muted">
          Applied on receipt of every frame. A send increments the sender&rsquo;s
          own counter first, so a message can never arrive carrying a value the
          receiver could have produced on its own.
        </p>
      </div>

      <Figure
        className="reveal mt-8"
        caption={
          <>
            Every arrow slopes downward, and every receipt lands on a strictly
            larger number than the send it answers. That is the guarantee, drawn:
            follow any chain of arrows and the counters only ever increase.
          </>
        }
      >
        <Panel>
          <PanelBar title="Sequence diagram">
            <button
              type="button"
              className="ctl ctl-primary"
              onClick={runScript}
              disabled={running}
            >
              <Play size={12} weight="fill" aria-hidden="true" />
              {running ? "Running" : "Scripted example"}
            </button>
            <button type="button" className="ctl" onClick={reset}>
              <ArrowClockwise size={12} weight="bold" aria-hidden="true" />
              Reset
            </button>
          </PanelBar>

          <div className="grid gap-0 lg:grid-cols-[1fr_248px]">
            <div className="overflow-x-auto p-3">
              <svg
                viewBox={`0 0 ${VIEW_W} ${viewH}`}
                className="h-auto w-full min-w-[520px]"
                role="img"
                aria-label={`Lamport clock sequence diagram. Current counters: ${NODES.map(
                  (n) => `${n} at ${clocks[n]}`,
                ).join(", ")}.`}
              >
                {/* lifelines */}
                {NODES.map((n) => (
                  <g key={n}>
                    <line
                      x1={LANE_X[n]}
                      y1={TOP - 22}
                      x2={LANE_X[n]}
                      y2={viewH - 12}
                      stroke="var(--line-strong)"
                      strokeWidth="1"
                      strokeDasharray="2 5"
                    />
                    <rect
                      x={LANE_X[n] - 42}
                      y={10}
                      width="84"
                      height="30"
                      rx="5"
                      fill="var(--surface-2)"
                      stroke="var(--line-strong)"
                    />
                    <text
                      x={LANE_X[n] - 30}
                      y={29}
                      fill="var(--text)"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 11,
                      }}
                    >
                      {n}
                    </text>
                    <text
                      x={LANE_X[n] + 32}
                      y={29}
                      textAnchor="end"
                      fill="var(--accent)"
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {clocks[n]}
                    </text>
                  </g>
                ))}

                <g transform={`translate(0, ${-shift})`}>
                  {/* delivered arrows */}
                  {marks
                    .filter((m) => m.kind === "recv")
                    .map((m) => {
                      const s = marks.find(
                        (x) => x.kind === "send" && x.row === m.row - 1,
                      );
                      if (!s) return null;
                      return (
                        <Arrow
                          key={`a${m.key}`}
                          x1={LANE_X[s.node]}
                          y1={TOP + s.row * ROW}
                          x2={LANE_X[m.node]}
                          y2={TOP + m.row * ROW}
                          label={String(s.clock)}
                        />
                      );
                    })}

                  {/* in flight */}
                  <AnimatePresence>
                    {flights.map((f) => {
                      const x1 = LANE_X[f.from];
                      const y1 = TOP + f.row * ROW;
                      const x2 = LANE_X[f.to];
                      const y2 = TOP + (f.row + 1) * ROW;
                      return (
                        <g key={`f${f.key}`}>
                          <line
                            x1={x1}
                            y1={y1}
                            x2={x2}
                            y2={y2}
                            stroke="var(--accent-line)"
                            strokeWidth="1"
                            strokeDasharray="3 4"
                          />
                          <motion.g
                            initial={{ x: x1, y: y1 }}
                            animate={{ x: x2, y: y2 }}
                            exit={{ opacity: 0 }}
                            transition={{
                              duration: flightMs / 1000,
                              ease: [0.4, 0, 0.2, 1],
                            }}
                          >
                            <rect
                              x={-11}
                              y={-8}
                              width="22"
                              height="16"
                              rx="3"
                              fill="var(--accent)"
                            />
                            <text
                              x={0}
                              y={4}
                              textAnchor="middle"
                              fill="var(--bg)"
                              style={{
                                fontFamily: "var(--font-mono)",
                                fontSize: 10,
                              }}
                            >
                              {f.clock}
                            </text>
                          </motion.g>
                        </g>
                      );
                    })}
                  </AnimatePresence>

                  {/* event dots */}
                  {marks.map((m) => (
                    <g key={m.key}>
                      <circle
                        cx={LANE_X[m.node]}
                        cy={TOP + m.row * ROW}
                        r="4.5"
                        fill={
                          m.kind === "recv" ? "var(--accent)" : "var(--surface)"
                        }
                        stroke="var(--accent)"
                        strokeWidth="1.5"
                      />
                      <text
                        x={LANE_X[m.node] + (m.node === "R-03" ? -12 : 12)}
                        y={TOP + m.row * ROW + 4}
                        textAnchor={m.node === "R-03" ? "end" : "start"}
                        fill="var(--text)"
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: 11,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {m.clock}
                      </text>
                      {m.formula && (
                        <text
                          x={LANE_X[m.node] + (m.node === "R-03" ? -34 : 34)}
                          y={TOP + m.row * ROW + 4}
                          textAnchor={m.node === "R-03" ? "end" : "start"}
                          fill="var(--text-dim)"
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: 10,
                          }}
                        >
                          {m.formula}
                        </text>
                      )}
                    </g>
                  ))}
                </g>
              </svg>
            </div>

            {/* send matrix */}
            <div className="border-t border-line p-3 lg:border-l lg:border-t-0">
              <h3 className="label mb-2.5">Send a frame</h3>
              <ul className="m-0 grid list-none grid-cols-2 gap-1.5 p-0 lg:grid-cols-1">
                {NODES.flatMap((from) =>
                  NODES.filter((to) => to !== from).map((to) => (
                    <li key={`${from}${to}`}>
                      <button
                        type="button"
                        className="ctl w-full"
                        style={{ justifyContent: "flex-start" }}
                        onClick={() => send(from, to)}
                        disabled={running}
                      >
                        {from}
                        <span
                          aria-hidden="true"
                          style={{ color: "var(--accent)" }}
                        >
                          &#8594;
                        </span>
                        {to}
                      </button>
                    </li>
                  )),
                )}
              </ul>
              <p className="mt-3 text-sm text-dim">
                {row === 0
                  ? "Counters start at zero. Send anything and watch the receiver jump past the sender rather than to it."
                  : `${marks.length} events recorded. The counters are not clocks: nothing here measures time.`}
              </p>
            </div>
          </div>
        </Panel>
      </Figure>

      <div className="reveal">
        <SpecPanel spec={SPEC_LAMPORT} />
      </div>
    </>
  );
}

function Arrow({
  x1,
  y1,
  x2,
  y2,
  label,
}: {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  label: string;
}) {
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const back = 6;
  const hx = x2 - Math.cos(ang) * back;
  const hy = y2 - Math.sin(ang) * back;
  const h = 7;
  return (
    <g>
      <line
        x1={x1}
        y1={y1}
        x2={hx}
        y2={hy}
        stroke="var(--accent-line)"
        strokeWidth="1.25"
      />
      <polygon
        points={`${hx},${hy} ${hx - h * Math.cos(ang - 0.42)},${hy - h * Math.sin(ang - 0.42)} ${hx - h * Math.cos(ang + 0.42)},${hy - h * Math.sin(ang + 0.42)}`}
        fill="var(--accent)"
      />
      <text
        x={(x1 + x2) / 2}
        y={(y1 + y2) / 2 - 6}
        textAnchor="middle"
        fill="var(--text-dim)"
        style={{ fontFamily: "var(--font-mono)", fontSize: 9.5 }}
      >
        {label}
      </text>
    </g>
  );
}

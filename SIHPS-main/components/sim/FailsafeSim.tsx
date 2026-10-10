"use client";

import { useId, useState } from "react";
import { Figure, Panel, PanelBar, SpecPanel } from "@/components/site/Panel";
import { SPEC_FAILSAFE } from "@/lib/specs";

/* ==========================================================================
   Asymmetric Hardware Fail-Safe Interlock (IEC 60204-1 Stop Category 0).

   Hardware Architecture:
     - Sensor -> PC817 Optocoupler (galvanic isolation)
     - Hardware Logic: 74HC08 Quad 2-Input AND Gate
     - Motor Driver: TB6612FNG Dual H-Bridge Driver
     - Asymmetric Logic:
         * PWM_forward_out = PWM_forward_pi AND NOT Obstacle (74HC08)
         * PWM_reverse_out = PWM_reverse_pi (bypasses gate for recovery)
   ========================================================================== */

const LAST_DUTY = 0.62;

export function FailsafeSim() {
  const [crashed, setCrashed] = useState(false);
  const [obstacle, setObstacle] = useState(false);
  const [direction, setDirection] = useState<"forward" | "reverse">("forward");
  const hatchId = useId();

  const rawPiPwm = LAST_DUTY;
  const enableLineHigh = !obstacle;
  
  // Forward PWM is gated by 74HC08; Reverse PWM bypasses the gate
  const fwdGatedPwm = obstacle ? 0 : rawPiPwm;
  const revBypassedPwm = rawPiPwm;
  
  const effectivePwm = direction === "forward" ? fwdGatedPwm : revBypassedPwm;
  const motorRunning = direction === "forward" ? (enableLineHigh && fwdGatedPwm > 0) : (revBypassedPwm > 0);

  const verdict = crashed
    ? obstacle
      ? direction === "forward"
        ? {
            tone: "live" as const,
            head: "Forward drive cut by 74HC08 gate in hardware (< 20ns).",
            body: "The Pi is dead and holding its last forward PWM. The PC817 optocoupler pulled the 74HC08 input LOW, de-energising the motor driver in hardware with zero software execution.",
          }
        : {
            tone: "live" as const,
            head: "Reverse channel active for standoff recovery.",
            body: "Asymmetric safety: PWM_REV bypasses the 74HC08 obstacle gate. Even with an obstacle ahead, reverse motion remains electrically functional for software recovery.",
          }
      : {
          tone: "stop" as const,
          head: "Software crashed, obstacle clear: PWM peripheral holds last duty.",
          body: "A dead OS process leaves the PWM peripheral holding duty 0.62. This failure mode is exactly why the 74HC08 hardware gate exists: trigger an obstacle to see hardware take over.",
        }
    : obstacle
      ? direction === "forward"
        ? {
            tone: "live" as const,
            head: "Forward drive stopped at both software and hardware layers.",
            body: "The control loop commanded 0.00 and the 74HC08 AND gate locked LOW. Redundant double-protection in nominal operation.",
          }
        : {
            tone: "live" as const,
            head: "Reversing away from obstacle (asymmetric bypass active).",
            body: "The robot safely backs away from the obstacle because the reverse channel is not inhibited by the forward obstacle sensor.",
          }
      : {
          tone: "live" as const,
          head: "Nominal locomotion (50 Hz control loop).",
          body: "Pi coordination loop is commanding duty 0.62, PC817 optocoupler reports clear, and 74HC08 passes PWM directly to TB6612FNG driver.",
        };

  return (
    <>
      <Figure
        className="reveal"
        caption={
          <>
            <strong>Asymmetric Hardware Safety:</strong> The 74HC08 AND gate evaluates <code>PWM_fwd_out = PWM_fwd_pi AND NOT Obstacle</code> in hardware. When an obstacle enters the 0.4m stopping zone, forward drive cuts in &lt;20ns regardless of Pi CPU health, while reverse PWM bypasses the gate for safe standoff resolution.
          </>
        }
      >
        <Panel>
          <PanelBar title="Hardware Interlock (74HC08 / TB6612FNG / PC817)">
            <span
              className="chip"
              data-state={obstacle ? "stop" : "live"}
              aria-live="polite"
            >
              <span className="led" aria-hidden="true" />
              74HC08 {obstacle ? "LOW (CUT)" : "HIGH (PASS)"}
            </span>
            <span className="chip" data-state={motorRunning ? "live" : undefined}>
              TB6612 {motorRunning ? `${direction.toUpperCase()} ${effectivePwm.toFixed(2)}` : "0.00 STOP"}
            </span>
          </PanelBar>

          <div className="overflow-x-auto p-3">
            <svg
              viewBox="0 0 1020 390"
              className="h-auto w-full min-w-[820px]"
              role="img"
              aria-label={`Schematic of asymmetric 74HC08 failsafe path. Software path is ${crashed ? "in fault" : "running"}. Direction is ${direction}. Obstacle is ${obstacle ? "present" : "clear"}. Motor is ${motorRunning ? "running" : "stopped"}.`}
            >
              <defs>
                <pattern
                  id={hatchId}
                  width="6"
                  height="6"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(45)"
                >
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="6"
                    stroke="var(--stop)"
                    strokeWidth="2"
                  />
                </pattern>
              </defs>

              {/* lane labels */}
              <text
                x="340"
                y="26"
                fill="var(--text-dim)"
                style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em" }}
              >
                SOFTWARE PATH (PI 4)
              </text>
              <text
                x="340"
                y="374"
                fill="var(--text-dim)"
                style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em" }}
              >
                HARDWARE INTERLOCK (PC817 OPTO + 74HC08 AND)
              </text>

              {/* obstacle */}
              {obstacle && (
                <g>
                  <rect
                    x="20"
                    y="166"
                    width="70"
                    height="50"
                    rx="3"
                    fill={`url(#${hatchId})`}
                    opacity="0.32"
                  />
                  <rect
                    x="20"
                    y="166"
                    width="70"
                    height="50"
                    rx="3"
                    fill="none"
                    stroke="var(--stop)"
                    strokeWidth="1.25"
                  />
                  <text
                    x="55"
                    y="157"
                    textAnchor="middle"
                    fill="var(--stop)"
                    style={{ fontFamily: "var(--font-mono)", fontSize: 9 }}
                  >
                    OBSTACLE 0.4m
                  </text>
                </g>
              )}

              {/* sensor cone */}
              {[10, 18, 26].map((r, i) => (
                <path
                  key={r}
                  d={`M 126 ${191 - r} A ${r} ${r} 0 0 0 126 ${191 + r}`}
                  fill="none"
                  stroke={obstacle ? "var(--stop)" : "var(--accent)"}
                  strokeWidth="1"
                  opacity={0.55 - i * 0.12}
                />
              ))}

              <Block x={128} y={160} w={105} h={62} title="TOF SENSOR" sub="0.4m threshold" tone="ok" />

              {/* branch node */}
              <circle cx="260" cy="191" r="3.5" fill="var(--accent)" />
              <Wire d="M 233 191 H 260" live />

              {/* ---------------- software path ---------------- */}
              <Wire d="M 260 191 V 70 H 300" live={!crashed} dead={crashed} />
              <Block
                x={300}
                y={40}
                w={160}
                h={62}
                title={crashed ? "PI 4 (FAULT)" : "PI 4 (NOMINAL)"}
                sub={crashed ? "Loop wedged" : "50 Hz loop"}
                tone={crashed ? "fault" : "ok"}
              />

              {/* Forward PWM wire -> 74HC08 input */}
              <Wire d="M 460 60 H 590 V 275 H 620" live={direction === "forward" && !crashed} dead={crashed} />
              <text
                x="525"
                y="52"
                fill={direction === "forward" ? "var(--accent)" : "var(--text-dim)"}
                style={{ fontFamily: "var(--font-mono)", fontSize: 8.5 }}
              >
                PWM_FWD (gated)
              </text>

              {/* Reverse PWM wire -> bypasses gate directly to TB6612 REV pin */}
              <Wire d="M 460 82 H 760 V 166 H 790" live={direction === "reverse"} dead={crashed} />
              <text
                x="555"
                y="96"
                fill={direction === "reverse" ? "var(--accent)" : "var(--text-dim)"}
                style={{ fontFamily: "var(--font-mono)", fontSize: 8.5 }}
              >
                PWM_REV (bypass)
              </text>

              {/* ---------------- hardware path: PC817 + 74HC08 ---------------- */}
              <Wire d="M 260 191 V 315 H 300" live />
              
              <Block
                x={300}
                y={284}
                w={130}
                h={62}
                title="PC817 OPTO"
                sub="Galvanic isolation"
                tone="ok"
              />

              <Wire d="M 430 315 H 620" live={!obstacle} cut={obstacle} />
              <text
                x="525"
                y="307"
                fill={!obstacle ? "var(--accent)" : "var(--stop)"}
                style={{ fontFamily: "var(--font-mono)", fontSize: 8.5 }}
              >
                ENABLE ({!obstacle ? "HIGH" : "LOW"})
              </text>

              {/* 74HC08 AND Gate */}
              <Block
                x={620}
                y={260}
                w={135}
                h={72}
                title="74HC08 AND"
                sub={obstacle ? "OUTPUT: LOW" : "OUTPUT: PASS"}
                tone={obstacle ? "fault" : "ok"}
              />

              {/* 74HC08 output to TB6612 FWD pin */}
              <Wire
                d="M 755 296 H 772 V 222 H 790"
                live={direction === "forward" && !obstacle && fwdGatedPwm > 0}
                cut={obstacle}
              />

              {/* ---------------- TB6612FNG driver + motor ---------------- */}
              <Block
                x={790}
                y={140}
                w={130}
                h={110}
                title="TB6612FNG"
                sub={motorRunning ? `${direction === "forward" ? "FWD" : "REV"} ENERGISED` : "DE-ENERGISED"}
                tone={motorRunning ? "ok" : "held"}
              />
              <text
                x="798"
                y="164"
                fill="var(--text-dim)"
                style={{ fontFamily: "var(--font-mono)", fontSize: 8 }}
              >
                REV
              </text>
              <text
                x="798"
                y="222"
                fill="var(--text-dim)"
                style={{ fontFamily: "var(--font-mono)", fontSize: 8 }}
              >
                FWD
              </text>

              <Wire d="M 920 195 H 946" live={motorRunning} cut={!motorRunning} />

              {/* Motor & rotating shaft */}
              <g>
                <circle
                  cx="976"
                  cy="195"
                  r="32"
                  fill="var(--surface-2)"
                  stroke={motorRunning ? "var(--accent)" : "var(--text-dim)"}
                  strokeWidth="1.5"
                />
                <g
                  className={`shaft ${motorRunning ? (direction === "reverse" ? "shaft--reverse" : "shaft--run") : ""}`}
                  style={{ transformBox: "view-box", transformOrigin: "976px 195px" }}
                >
                  <line
                    x1="976"
                    y1="195"
                    x2="976"
                    y2="171"
                    stroke={motorRunning ? "var(--accent)" : "var(--text-dim)"}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle
                    cx="976"
                    cy="195"
                    r="4"
                    fill={motorRunning ? "var(--accent)" : "var(--text-dim)"}
                  />
                </g>
                <text
                  x="976"
                  y="246"
                  textAnchor="middle"
                  fill="var(--text)"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 9 }}
                >
                  MOTOR
                </text>
                {motorRunning && (
                  <text
                    x="976"
                    y="258"
                    textAnchor="middle"
                    fill="var(--accent)"
                    style={{ fontFamily: "var(--font-mono)", fontSize: 8 }}
                  >
                    {direction === "reverse" ? "↺ REVERSE" : "↻ FORWARD"}
                  </text>
                )}
              </g>
            </svg>
          </div>

          {/* controls + verdict */}
          <div className="grid gap-3 border-t border-line p-3 lg:grid-cols-[300px_1fr]">
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                className="latch"
                data-tone="stop"
                aria-pressed={crashed}
                onClick={() => setCrashed((c) => !c)}
              >
                <span className="latch__slot" aria-hidden="true">
                  <span className="latch__throw" />
                </span>
                <span className="latch__text">Crash Pi software</span>
              </button>

              <button
                type="button"
                className="latch"
                data-tone="stop"
                aria-pressed={obstacle}
                onClick={() => setObstacle((o) => !o)}
              >
                <span className="latch__slot" aria-hidden="true">
                  <span className="latch__throw" />
                </span>
                <span className="latch__text">Obstacle in path (&lt; 0.4m)</span>
              </button>

              {/* Asymmetric Direction Selector */}
              <div className="mt-1 flex items-center justify-between rounded-sm border border-line bg-surface-2 p-2">
                <span className="label text-micro">Drive Command:</span>
                <div className="flex gap-1">
                  <button
                    type="button"
                    className={`ctl text-micro ${direction === "forward" ? "ctl-primary" : ""}`}
                    style={{ padding: "3px 8px" }}
                    onClick={() => setDirection("forward")}
                  >
                    Forward (Gated)
                  </button>
                  <button
                    type="button"
                    className={`ctl text-micro ${direction === "reverse" ? "ctl-primary" : ""}`}
                    style={{ padding: "3px 8px" }}
                    onClick={() => setDirection("reverse")}
                  >
                    Reverse (Bypassed)
                  </button>
                </div>
              </div>

              <dl className="mt-1.5 grid grid-cols-3 gap-2">
                <Readout
                  term="Pi Software"
                  value={crashed ? "FAULT" : "50 Hz OK"}
                  tone={crashed ? "stop" : "ok"}
                />
                <Readout
                  term="74HC08 Gate"
                  value={obstacle ? "CUT (LOW)" : "PASS (HIGH)"}
                  tone={obstacle ? "stop" : "ok"}
                />
                <Readout
                  term="Motor Drive"
                  value={motorRunning ? `${direction === "forward" ? "FWD" : "REV"} ${effectivePwm.toFixed(2)}` : "0.00 STOP"}
                  tone={motorRunning ? "ok" : "stop"}
                />
              </dl>
            </div>

            <div
              className="rounded-sm border p-3.5"
              style={{
                borderColor:
                  verdict.tone === "stop" ? "var(--stop)" : "var(--accent-line)",
                background:
                  verdict.tone === "stop"
                    ? "var(--stop-wash)"
                    : "var(--accent-wash)",
              }}
            >
              <p
                className="text-h3"
                style={{
                  color:
                    verdict.tone === "stop" ? "var(--stop)" : "var(--accent)",
                  fontWeight: 500,
                }}
                aria-live="polite"
              >
                {verdict.head}
              </p>
              <p className="mt-1.5 max-w-[62ch] text-sm text-muted">
                {verdict.body}
              </p>
            </div>
          </div>
        </Panel>
      </Figure>

      <div className="reveal">
        <SpecPanel spec={SPEC_FAILSAFE} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */

function Wire({
  d,
  live,
  dead,
  cut,
}: {
  d: string;
  live?: boolean;
  dead?: boolean;
  cut?: boolean;
}) {
  const stroke = cut ? "var(--stop)" : dead ? "var(--text-dim)" : "var(--accent)";
  return (
    <>
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        opacity={dead ? 0.34 : cut ? 0.6 : 0.4}
        className={dead || cut ? "wire-dead" : undefined}
      />
      {live && !dead && !cut && (
        <path
          d={d}
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          className="wire-flow"
        />
      )}
    </>
  );
}

function Block({
  x,
  y,
  w,
  h,
  title,
  sub,
  tone,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub: string;
  tone: "ok" | "fault" | "held";
}) {
  const color =
    tone === "fault"
      ? "var(--stop)"
      : tone === "held"
        ? "var(--hold)"
        : "var(--accent)";
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="6"
        fill="var(--surface)"
        stroke={color}
        strokeWidth="1.5"
        strokeDasharray={tone === "fault" ? "4 4" : undefined}
      />
      <text
        x={x + w / 2}
        y={y + h / 2 - 4}
        textAnchor="middle"
        fill="var(--text)"
        style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}
      >
        {title}
      </text>
      <text
        x={x + w / 2}
        y={y + h / 2 + 11}
        textAnchor="middle"
        fill={tone === "ok" ? "var(--text-dim)" : color}
        style={{ fontFamily: "var(--font-mono)", fontSize: 8 }}
      >
        {sub}
      </text>
    </g>
  );
}

function Readout({
  term,
  value,
  tone,
}: {
  term: string;
  value: string;
  tone: "ok" | "stop";
}) {
  return (
    <div className="rounded-sm border border-line bg-surface-2 px-2 py-1.5">
      <dt className="label text-micro">{term}</dt>
      <dd
        className="tok m-0 mt-0.5 text-micro"
        style={{ color: tone === "stop" ? "var(--stop)" : "var(--accent)" }}
      >
        {value}
      </dd>
    </div>
  );
}

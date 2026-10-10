"use client";

import { useState } from "react";
import { Section } from "@/components/site/Section";
import { Figure, Panel, PanelBar, SpecPanel } from "@/components/site/Panel";
import { MiniMesh } from "@/components/sim/MiniMesh";
import { SPEC_CLOUD } from "@/lib/specs";

export function CloudSection() {
  const [online, setOnline] = useState(true);
  const [frames, setFrames] = useState(0);
  const [framesAtCut, setFramesAtCut] = useState<number | null>(null);

  const toggle = () => {
    setOnline((o) => {
      if (o) setFramesAtCut(frames);
      else setFramesAtCut(null);
      return !o;
    });
  };

  const since = framesAtCut === null ? 0 : Math.max(0, frames - framesAtCut);

  return (
    <Section
      id="cloud"
      title="The cloud layer is a reader, not a controller"
      lead="A local broker republishes the frames the robots already send each other. The dashboard reads that. An uplink can forward it. Nothing in this direction of the arrow can make a robot move."
    >
      <Figure
        className="reveal"
        caption={
          <>
            The counter on the left is real: it is the frame count from a mesh
            running in this page. Cut the uplink and it keeps climbing at the
            same rate, because nothing on the floor was ever waiting on the
            other side of that link.
          </>
        }
      >
        <Panel>
          <PanelBar title="Uplink">
            <span className="chip" data-state={online ? "live" : "stop"}>
              <span
                className={`led ${online ? "led--pulse" : ""}`}
                aria-hidden="true"
              />
              {online ? "Uplink up" : "Uplink down"}
            </span>
            <button
              type="button"
              className="ctl ctl-danger"
              data-on={!online}
              onClick={toggle}
            >
              {online ? "Disconnect internet" : "Reconnect"}
            </button>
          </PanelBar>

          <div className="grid md:grid-cols-2">
            <div className="relative border-b border-line p-3 md:border-b-0 md:border-r">
              <h3 className="label mb-2">Fleet, on the floor</h3>
              <MiniMesh className="h-[220px] w-full" onFrames={setFrames} />
              <dl className="mt-2 flex flex-wrap items-baseline gap-x-5 gap-y-1">
                <div className="flex items-baseline gap-2">
                  <dt className="label">Frames</dt>
                  <dd
                    className="tok m-0"
                    style={{ color: "var(--accent)" }}
                  >
                    {frames.toLocaleString("en-US")}
                  </dd>
                </div>
                {!online && (
                  <div className="flex items-baseline gap-2">
                    <dt className="label">Since the cut</dt>
                    <dd className="tok m-0" style={{ color: "var(--accent)" }}>
                      {since.toLocaleString("en-US")}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="p-3">
              <h3 className="label mb-2">Path off the floor</h3>
              <svg
                viewBox="0 0 380 220"
                className="h-auto w-full"
                role="img"
                aria-label={`Uplink chain. Broker and dashboard are local and running. The internet link is ${online ? "up" : "cut"}.`}
              >
                <UpBox x={40} y={16} w={140} h={44} title="ROBOT MESH" sub="UDP broadcast" on />
                <UpArrow d="M 110 60 V 92" on />
                <UpBox x={40} y={92} w={140} h={44} title="LOCAL BROKER" sub="MQTT :1883" on />
                <UpArrow d="M 110 136 V 168" on />
                <UpBox x={40} y={168} w={140} h={44} title="DASHBOARD" sub="local, logging" on />

                <UpArrow d="M 180 114 H 250" on={online} horizontal />
                {!online && (
                  <g stroke="var(--stop)" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="207" y1="104" x2="223" y2="124" />
                    <line x1="223" y1="104" x2="207" y2="124" />
                  </g>
                )}
                <text
                  x="215"
                  y="96"
                  textAnchor="middle"
                  fill={online ? "var(--text-dim)" : "var(--stop)"}
                  style={{ fontFamily: "var(--font-mono)", fontSize: 9 }}
                >
                  {online ? "INTERNET" : "NO ROUTE"}
                </text>
                <UpBox
                  x={250}
                  y={92}
                  w={110}
                  h={44}
                  title="CLOUD"
                  sub={online ? "receiving" : "stale"}
                  on={online}
                />
              </svg>

              <p className="mt-2 text-sm text-muted">
                Every arrow on this diagram has one head. There is no return
                path to draw.
              </p>
            </div>
          </div>
        </Panel>
      </Figure>

      {/* four claims, four different visual treatments */}
      <div className="reveal mt-6 grid gap-3 md:grid-cols-12">
        <CloudCard
          className="md:col-span-7"
          title="One broker, on the floor"
          body="A Mosquitto instance on the same Wi-Fi segment as the robots. It subscribes to nothing the robots depend on, and if it dies the fleet does not notice."
          art={<FanOut />}
        />
        <CloudCard
          className="md:col-span-5"
          title="No second protocol"
          body="The broker forwards the same broadcast frames. Robots learned one wire format, not two."
          art={<OneStream />}
          tint
        />
        <CloudCard
          className="md:col-span-5"
          title="Dashboard and logging"
          body="Live fleet view and an append-only log, both local, both fed from that single stream."
          art={<Spark />}
        />
        <CloudCard
          className="md:col-span-7"
          title="Uplink is optional and one way"
          body="If there is internet, telemetry goes out at QoS 0. If there is not, the publish is dropped and nothing blocks. This is the only part of the system that ever touches a network we do not own."
          art={<OneWay />}
          tint
        />
      </div>

      <div className="reveal">
        <SpecPanel spec={SPEC_CLOUD} />
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------ */

function CloudCard({
  title,
  body,
  art,
  className = "",
  tint,
}: {
  title: string;
  body: string;
  art: React.ReactNode;
  className?: string;
  tint?: boolean;
}) {
  return (
    <article
      className={`flex flex-col justify-between gap-5 overflow-hidden rounded-md border border-line p-5 ${className}`}
      style={{
        background: tint
          ? "linear-gradient(160deg, var(--accent-wash), var(--surface) 62%)"
          : "var(--surface)",
      }}
    >
      <div>
        <h3 className="text-h3" style={{ fontWeight: 500 }}>
          {title}
        </h3>
        <p className="mt-2 max-w-[46ch] text-sm text-muted">{body}</p>
      </div>
      <div className="h-14 w-full" aria-hidden="true">
        {art}
      </div>
    </article>
  );
}

function UpBox({
  x,
  y,
  w,
  h,
  title,
  sub,
  on,
}: {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub: string;
  on: boolean;
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx="5"
        fill="var(--surface)"
        stroke={on ? "var(--accent)" : "var(--text-dim)"}
        strokeWidth="1.25"
        strokeDasharray={on ? undefined : "3 3"}
      />
      <text
        x={x + w / 2}
        y={y + 20}
        textAnchor="middle"
        fill={on ? "var(--text)" : "var(--text-dim)"}
        style={{ fontFamily: "var(--font-mono)", fontSize: 10 }}
      >
        {title}
      </text>
      <text
        x={x + w / 2}
        y={y + 33}
        textAnchor="middle"
        fill="var(--text-dim)"
        style={{ fontFamily: "var(--font-mono)", fontSize: 8.5 }}
      >
        {sub}
      </text>
    </g>
  );
}

function UpArrow({
  d,
  on,
  horizontal,
}: {
  d: string;
  on: boolean;
  horizontal?: boolean;
}) {
  const color = on ? "var(--accent)" : "var(--text-dim)";
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth="1.25"
        strokeDasharray="4 4"
        opacity={on ? 1 : 0.4}
        className={on ? "wire-flow" : undefined}
      />
      {on &&
        (horizontal ? (
          <polygon points="250,114 242,110 242,118" fill={color} />
        ) : (
          <polygon
            points={`110,${d.includes("168") ? 168 : 92} 106,${d.includes("168") ? 160 : 84} 114,${d.includes("168") ? 160 : 84}`}
            fill={color}
          />
        ))}
    </g>
  );
}

function FanOut() {
  return (
    <svg viewBox="0 0 200 56" aria-hidden="true" className="h-full w-full" preserveAspectRatio="xMinYMid meet">
      <rect x="0" y="20" width="30" height="16" rx="3" fill="var(--accent)" />
      {[6, 28, 50].map((y, i) => (
        <g key={y}>
          <path
            d={`M 30 28 C 60 28, 60 ${y + 6}, 92 ${y + 6}`}
            fill="none"
            stroke="var(--accent-line)"
            strokeWidth="1"
          />
          <rect
            x="92"
            y={y}
            width="26"
            height="12"
            rx="2"
            fill="none"
            stroke="var(--accent-line)"
            strokeWidth="1"
            opacity={1 - i * 0.2}
          />
        </g>
      ))}
    </svg>
  );
}

function OneStream() {
  return (
    <svg viewBox="0 0 200 56" aria-hidden="true" className="h-full w-full" preserveAspectRatio="xMinYMid meet">
      <line
        x1="0"
        y1="28"
        x2="200"
        y2="28"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeDasharray="5 6"
        className="wire-flow"
      />
      {[40, 100, 160].map((x) => (
        <rect key={x} x={x - 5} y="23" width="10" height="10" rx="2" fill="var(--accent)" />
      ))}
      <rect x="20" y="4" width="52" height="13" rx="2" fill="none" stroke="var(--line-strong)" />
      <rect x="128" y="39" width="52" height="13" rx="2" fill="none" stroke="var(--line-strong)" />
    </svg>
  );
}

function Spark() {
  const pts = [4, 18, 11, 26, 20, 34, 27, 44, 31, 38, 46, 40, 52];
  const d = pts
    .map((v, i) => `${i === 0 ? "M" : "L"} ${(i / (pts.length - 1)) * 200} ${52 - v}`)
    .join(" ");
  return (
    <svg viewBox="0 0 200 56" aria-hidden="true" className="h-full w-full" preserveAspectRatio="none">
      <path d={`${d} L 200 56 L 0 56 Z`} fill="var(--accent-wash)" />
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
    </svg>
  );
}

function OneWay() {
  return (
    <svg viewBox="0 0 200 56" aria-hidden="true" className="h-full w-full" preserveAspectRatio="xMinYMid meet">
      <rect x="0" y="18" width="46" height="20" rx="3" fill="none" stroke="var(--accent)" strokeWidth="1.25" />
      <line
        x1="46"
        y1="28"
        x2="140"
        y2="28"
        stroke="var(--accent)"
        strokeWidth="1.25"
        strokeDasharray="4 4"
        className="wire-flow"
      />
      <polygon points="146,28 136,23 136,33" fill="var(--accent)" />
      <rect x="150" y="18" width="46" height="20" rx="3" fill="none" stroke="var(--line-strong)" strokeWidth="1.25" strokeDasharray="3 3" />
      <line x1="46" y1="46" x2="140" y2="46" stroke="var(--text-dim)" strokeWidth="1" opacity="0.35" />
      <g stroke="var(--text-dim)" strokeWidth="1.5" opacity="0.5" strokeLinecap="round">
        <line x1="88" y1="41" x2="98" y2="51" />
        <line x1="98" y1="41" x2="88" y2="51" />
      </g>
    </svg>
  );
}

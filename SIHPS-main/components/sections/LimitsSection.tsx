"use client";

import { Section } from "@/components/site/Section";

const LIMITS: { head: string; problem: string; fix: string; status: string }[] = [
  {
    head: "Sustained packet loss",
    problem:
      "Under heavy loss, robots stop hearing each other inside the timeout and drop to hold. The floor slows down and, in the worst case, stops.",
    fix: "That is a throughput and availability cost, not a broken safety guarantee. The system degrades toward stopped, which is the direction we chose.",
    status: "By design",
  },
  {
    head: "Message count grows with contention",
    problem:
      "Ricart-Agrawala costs 2(N-1) messages per entry to a zone. Thirty robots contending for one aisle is a lot of air time on a shared segment.",
    fix: "Token-ring arbitration per zone, or partitioning the floor so contention stays local. Both are known techniques; neither is built here.",
    status: "Scales badly",
  },
  {
    head: "Ultrasonic sensors are a stand-in",
    problem:
      "Wide beam, poor with soft or angled surfaces, and not rated for machine safety. They are what the budget bought.",
    fix: "Production swaps to a certified safety-rated LiDAR or light curtain. The interlock circuit around it does not change, which is the point of putting the logic in hardware.",
    status: "Hackathon part",
  },
  {
    head: "No ground truth for position",
    problem:
      "Positions come from wheel odometry and drift with every turn and slip. The number in the broadcast frame is a robot’s belief, not a measurement.",
    fix: "Floor markers, QR or AprilTag, read on the way past for re-localisation. Designed, not implemented.",
    status: "Future work",
  },
  {
    head: "Contract Net is not globally optimal",
    problem:
      "The manager awards the best bid it received. A better-placed robot outside broadcast range never bids, so the fleet can settle for worse.",
    fix: "Acceptable at demo scale, where the floor is smaller than one broadcast radius. Beyond that it needs multi-hop announcement or a zone hierarchy.",
    status: "Accepted",
  },
  {
    head: "Frames are not authenticated",
    problem:
      "Anything on the same segment can forge a frame today, including a fake position or a fake bid. There is no signature to check.",
    fix: "HMAC-SHA256 over the payload with a pre-shared fleet key, 32 bytes added to a 38 byte frame. The next thing we would build, and the reason this is not on a real floor.",
    status: "Not built",
  },
];

export function LimitsSection() {
  return (
    <Section
      id="limits"
      title="Where this breaks"
      lead="Six of them, with what we would do about each. A system whose authors cannot tell you its failure modes has not been thought about hard enough."
    >
      <ol className="m-0 grid list-none gap-x-10 gap-y-9 p-0 md:grid-cols-2">
        {LIMITS.map((l, i) => (
          <li
            key={l.head}
            className="reveal border-t border-line pt-4"
            style={{ ["--reveal-delay" as string]: `${(i % 2) * 70}ms` }}
          >
            <div className="flex items-baseline gap-3">
              <span className="tok" style={{ color: "var(--accent)" }}>
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="text-h3" style={{ fontWeight: 500 }}>
                {l.head}
              </h3>
              <span className="chip ml-auto shrink-0">{l.status}</span>
            </div>
            <p className="mt-2.5 text-sm text-muted">{l.problem}</p>
            <p
              className="mt-2.5 border-l-2 pl-3 text-sm"
              style={{
                borderColor: "var(--accent-line)",
                color: "var(--text-muted)",
              }}
            >
              {l.fix}
            </p>
          </li>
        ))}
      </ol>
    </Section>
  );
}

"use client";

import { Section } from "@/components/site/Section";

const ROWS: { problem: string; naive: string; used: string }[] = [
  {
    problem: "Ordering events across robots with no shared clock",
    naive:
      "Stamp every event with the robot’s own system clock and sort by it.",
    used: "Lamport logical clocks, 1978. Four bytes riding on a frame we already send, and clock drift between the Pis stops mattering.",
  },
  {
    problem: "Two robots want the same intersection",
    naive: "Elect a traffic controller and route every crossing through it.",
    used: "Ricart-Agrawala, 1981. Two message rounds between the robots that actually want the zone, with published proofs of no deadlock and no starvation.",
  },
  {
    problem: "A robot drops out holding a task",
    naive: "A supervisor notices and re-plans the whole fleet assignment.",
    used: "Contract Net, 1980. Four rounds, priced by the bidders themselves, and any surviving robot can run the auction.",
  },
  {
    problem: "Something is in the way",
    naive: "An emergency-stop branch near the top of the control loop.",
    used: "A comparator driving the motor driver’s ENABLE pin. The processor is not in the path, so the stop does not share the software’s failure modes.",
  },
  {
    problem: "The radio link partitions",
    naive: "Keep executing the last plan and hope the link comes back.",
    used: "Suspicion resolves to hold. A wrong suspicion costs throughput; the alternative costs a collision.",
  },
];

const FOOTPRINT = [
  {
    head: "The radio is the one already fitted",
    body: "UDP broadcast over the Pi’s built-in Wi-Fi. No mesh radio, no LoRa module, no second network to provision.",
  },
  {
    head: "Raspberry Pi 4, not a Jetson",
    body: "Coordination here is integer arithmetic and message passing. There is no model to run, so there is nothing to accelerate.",
  },
  {
    head: "A few hundred rupees of safety hardware",
    body: "The distance sensor and the comparator are the entire bill of materials for the stop path, per robot.",
  },
  {
    head: "A few hundred lines per algorithm",
    body: "Short enough to read in one sitting, and each one arrives with a correctness proof we did not have to write.",
  },
];

export function ProvenSection() {
  return (
    <Section
      id="proven"
      title="Five problems that were solved before we were born"
      lead="Each of these has an obvious in-house answer that works on a whiteboard. The published algorithm is not cleverer, it is just already proven, and the proof is the part we could not have produced in a hackathon."
      tone="sunken"
    >
      <div className="reveal overflow-x-auto">
        <table className="ctable">
          <caption className="sr-only">
            Comparison of the obvious approach and the published algorithm used,
            for five coordination problems.
          </caption>
          <thead>
            <tr>
              <th scope="col" style={{ width: "24%" }}>
                Problem
              </th>
              <th scope="col" style={{ width: "30%" }}>
                The obvious build
              </th>
              <th scope="col" style={{ width: "46%" }}>
                What runs instead
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.problem}>
                <td data-col="Problem">
                  <span style={{ color: "var(--text)" }}>{r.problem}</span>
                </td>
                <td data-col="The obvious build">{r.naive}</td>
                <td data-col="What runs instead">
                  <span style={{ color: "var(--text)" }}>{r.used}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="reveal mt-12 grid list-none gap-x-8 gap-y-7 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {FOOTPRINT.map((f) => (
          <li key={f.head} className="border-t border-line pt-4">
            <h3 className="text-h3" style={{ fontWeight: 500 }}>
              {f.head}
            </h3>
            <p className="mt-2 text-sm text-muted">{f.body}</p>
          </li>
        ))}
      </ul>
    </Section>
  );
}

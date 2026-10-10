import type { Spec } from "@/components/site/Panel";

/**
 * File-level detail for every interactive section. Same shape, same panel,
 * same position on the page, so a technical reader learns the layout once.
 */

export const SPEC_MESH: Spec = {
  algorithm: "Timeout failure detection over UDP broadcast",
  year: "1996",
  authors: "Chandra, Toueg",
  paper:
    "Unreliable Failure Detectors for Reliable Distributed Systems. Journal of the ACM 43(2). Class of eventually perfect detectors.",
  guarantees: [
    {
      claim: "Strong completeness",
      detail:
        "Every robot that stops transmitting is eventually suspected by every robot still running. Nothing is left waiting on a peer that will never answer.",
    },
    {
      claim: "No accuracy guarantee",
      detail:
        "A jammed radio is indistinguishable from a dead robot, so a live peer can be wrongly suspected. Because suspicion resolves to hold position, a false suspicion costs throughput and never safety.",
    },
  ],
  complexity: [
    { metric: "Frames per interval", value: "N" },
    { metric: "State per robot", value: "O(N)" },
    { metric: "Detection latency", value: "< timeout + T" },
    { metric: "Payload", value: "38 bytes" },
  ],
  why: "One broadcast frame on a shared Wi-Fi segment reaches every robot in range, so full state exchange costs N frames per interval rather than N squared unicasts, and adding a robot changes nobody's configuration.",
  insteadOf:
    "a TCP mesh, which needs N squared connections and head-of-line blocks on a lossy radio, or an MQTT hub, which puts a broker in the path of every safety-relevant message.",
};

export const SPEC_LAMPORT: Spec = {
  algorithm: "Lamport logical clocks",
  year: "1978",
  authors: "Leslie Lamport",
  paper:
    "Time, Clocks, and the Ordering of Events in a Distributed System. Communications of the ACM 21(7).",
  guarantees: [
    {
      claim: "a → b implies C(a) < C(b)",
      detail:
        "If event a could have caused event b, a carries the strictly smaller timestamp. This is the clock condition, and it holds with no synchronised wall clock anywhere in the system.",
    },
    {
      claim: "Total order from (C, id)",
      detail:
        "Breaking ties on robot id gives a single ordering that every robot computes identically from the same messages. Ricart-Agrawala in the next section depends on exactly this.",
    },
    {
      claim: "The converse does not hold",
      detail:
        "C(a) < C(b) does not prove a caused b. Logical clocks order events, they do not detect concurrency. We never ask them to.",
    },
  ],
  complexity: [
    { metric: "State per robot", value: "1 integer" },
    { metric: "Message overhead", value: "4 bytes" },
    { metric: "Extra messages", value: "0" },
    { metric: "Update cost", value: "O(1)" },
  ],
  why: "The counter rides along in the broadcast the robot was already sending, so ordering costs four bytes and no round trips. Clock drift between Raspberry Pis stops mattering entirely.",
  insteadOf:
    "wall-clock timestamps from each Pi, which drift apart and silently reorder events that had a real cause. Vector clocks would also detect concurrency, at O(N) bytes on every broadcast, for a property the coordination logic never queries.",
};

export const SPEC_MUTEX: Spec = {
  algorithm: "Scoped Ricart-Agrawala spatial mutual exclusion",
  year: "1981 / Scoped 2026",
  authors: "Ricart, Agrawala",
  paper:
    "An Optimal Algorithm for Mutual Exclusion in Computer Networks. Communications of the ACM 24(1) with spatial conflict envelope bounding.",
  guarantees: [
    {
      claim: "Spatial scoping O(k) vs O(N)",
      detail:
        "Messages are bounded to robots within the conflict envelope (R_conflict). Unaffected fleet robots outside the zone send zero messages and incur zero overhead.",
    },
    {
      claim: "Mutual exclusion & no starvation",
      detail:
        "At most one robot enters critical zone D-07 at a time. Requests ordered by Lamport timestamp (T_i, Node_ID). Ties break deterministically on robot ID.",
    },
    {
      claim: "No central coordinator",
      detail:
        "Arbitration occurs entirely peer-to-peer between contending nodes. No traffic controller or master scheduler can fail or deadlock the intersection.",
    },
  ],
  complexity: [
    { metric: "Messages per entry", value: "2(k-1), k ≪ N" },
    { metric: "Conflict envelope", value: "R_conflict" },
    { metric: "State per robot", value: "O(k) bits" },
    { metric: "Coordinators", value: "0" },
  ],
  why: "Bounding arbitration to the conflict envelope ensures network scaling to large warehouse fleets while preserving mathematical deadlock freedom and starvation freedom.",
  insteadOf:
    "global Ricart-Agrawala requiring 2(N-1) messages across the whole building, or a central lock server which is a single point of failure.",
};

export const SPEC_CNP: Spec = {
  algorithm: "Contract Net Protocol with deterministic SHA-256 election",
  year: "1980 / 2026",
  authors: "Reid G. Smith",
  paper:
    "The Contract Net Protocol: High-Level Communication and Control in a Distributed Problem Solver. IEEE Transactions on Computers C-29(12).",
  guarantees: [
    {
      claim: "Deterministic manager election",
      detail:
        "Witness nodes compute argmin SHA256(Task_ID || Robot_ID) to select the auctioneer with zero network voting overhead, eliminating split-brain auction hazards.",
    },
    {
      claim: "Multi-parameter bid scoring",
      detail:
        "Bids evaluate cost = 1.0·dist + 0.5·(1 - bat/100) + 0.3·queue. The robot with the lowest total execution penalty wins the contract.",
    },
    {
      claim: "Unified 3-to-1 fault funnel",
      detail:
        "Blocked aisles, heartbeat loss, and retry exhaustion all funnel into the same deterministic re-auction engine, guaranteeing task completion.",
    },
  ],
  complexity: [
    { metric: "Messages per task", value: "k + 2" },
    { metric: "Rounds", value: "4" },
    { metric: "Election overhead", value: "0 msgs (SHA-256)" },
    { metric: "Global map needed", value: "none" },
  ],
  why: "Decentralized task reallocation ensures no orphaned packages even when carrying robots suffer complete system crashes, hardware lockups, or radio dropouts.",
  insteadOf:
    "a central warehouse dispatcher recomputing all assignments, or complex multi-round distributed leader consensus protocols like Raft.",
};

export const SPEC_FAILSAFE: Spec = {
  algorithm: "Stop category 0 with asymmetric hardware gating",
  year: "IEC 60204-1 (ed. 6.0)",
  authors: "IEC 60204-1 / 74HC08 Logic Interlock",
  paper:
    "Safety of machinery. Electrical equipment of machines, Part 1: General requirements. Stop categories, clause 9.2.2.",
  guarantees: [
    {
      claim: "Zero-software cut-off",
      detail:
        "PC817 optocouplers and a 74HC08 Quad AND gate disconnect TB6612FNG motor drive in sub-millisecond hardware time if obstacle distance < 0.4m, regardless of Pi CPU state.",
    },
    {
      claim: "Asymmetric safety channel",
      detail:
        "Forward PWM is gated by hardware (PWM_fwd AND NOT Obstacle), while Reverse PWM directly bypasses the gate, permitting software recovery without overriding safety.",
    },
    {
      claim: "Fail-to-safe de-energisation",
      detail:
        "ENABLE is active-high. Disconnected sensor lines, power dropouts, or software freezes de-energise the H-bridge safely to a dead stop.",
    },
  ],
  complexity: [
    { metric: "Gating IC", value: "74HC08 Quad AND" },
    { metric: "Motor driver", value: "TB6612FNG H-Bridge" },
    { metric: "Isolation", value: "PC817 Optocoupler" },
    { metric: "Hardware latency", value: "< 20 ns" },
  ],
  why: "Physical hardware interlocks guarantee safety compliance that certified inspectors can verify without having to audit non-deterministic software code.",
  insteadOf:
    "pure software emergency-stop loops on a Linux OS, which fail to protect against kernel panics, priority inversions, or frozen PWM registers.",
};

export const SPEC_CLOUD: Spec = {
  algorithm: "MQTT 5.0 telemetry uplink, QoS 0",
  year: "2019",
  authors: "OASIS",
  paper: "MQTT Version 5.0. OASIS Standard.",
  guarantees: [
    {
      claim: "Observation only",
      detail:
        "Robots publish and never subscribe. There is no topic a dashboard or a cloud service can write to that changes what a robot does.",
    },
    {
      claim: "At most once, never blocking",
      detail:
        "QoS 0 means the publisher does not wait for an acknowledgement and does not retry. A broker that stops answering cannot apply back pressure to the robot.",
    },
  ],
  complexity: [
    { metric: "Sockets on safety path", value: "0" },
    { metric: "Extra protocols on robot", value: "0" },
    { metric: "Broker outage impact", value: "none" },
    { metric: "Direction", value: "one way" },
  ],
  why: "The broker re-publishes the same broadcast frames the robots already send to each other, so the dashboard is a second reader of an existing stream rather than a new dependency.",
  insteadOf:
    "a cloud round trip inside the control loop, which converts an internet outage into a fleet stop and a latency spike into a collision.",
};

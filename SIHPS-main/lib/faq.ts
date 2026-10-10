/** Shared by the FAQ section and the FAQPage structured data in page.tsx. */
export const FAQ: { q: string; a: string }[] = [
  {
    q: "Why not just use ROS 2?",
    a: "ROS 2 would give us DDS discovery, a message bus and tooling for free, and on a bigger team it would be the right call. Two things pushed us off it here. First, the safety claim: with ROS 2 the stop decision still runs as a node on the same processor, and a wedged executor is a wedged stop. Second, the coordination we needed is three small algorithms with published proofs, and running them directly over UDP kept the whole message path small enough to read end to end. Nothing here is hostile to ROS 2; the interlock would sit underneath it unchanged.",
  },
  {
    q: "Why UDP broadcast rather than TCP or MQTT between robots?",
    a: "State updates are only useful while they are fresh. TCP would retransmit a position that is already wrong, and head-of-line blocking on a lossy radio means one dropped frame delays every frame behind it. Broadcast also makes the cost of state exchange N frames per interval instead of N squared connections, and adding a robot needs no configuration anywhere. MQTT between robots would put a broker in the path of every safety-relevant message, which is the dependency we were trying to remove.",
  },
  {
    q: "What happens if two robots request the same zone with the same timestamp?",
    a: "The request is the pair (timestamp, robot id), compared lexicographically, so an equal timestamp is broken by the id. Both robots run the same comparison on the same two values and reach the same answer independently, with no extra round trip. You can trigger exactly this in the mutual exclusion section by setting both timestamps to the same number and pressing the both-at-once control.",
  },
  {
    q: "Does the hardware interlock mean the software can be sloppy?",
    a: "No, and it is worth being precise about what it buys. The interlock removes one specific class of failure: it makes stopping independent of whether our process is alive and scheduled. It does nothing about a robot that plans a bad route, mis-reads its own position, or deadlocks the fleet through a logic error. It is a floor under the worst case, not a substitute for the coordination being correct.",
  },
  {
    q: "What actually runs on each robot?",
    a: "A Raspberry Pi 4 running one process: a broadcast transmitter on a timer, a receiver that merges Lamport clocks and tracks when each peer was last heard, the Ricart-Agrawala state machine for contested zones, the Contract Net roles for task handover, and a 50 Hz control loop driving PWM. Alongside it, and electrically separate from it, a distance sensor feeding a comparator that drives the motor driver's ENABLE pin.",
  },
  {
    q: "What would you need before this went on a real warehouse floor?",
    a: "Four things, in order. Message authentication, because an unsigned broadcast fleet is trivially spoofable. A safety-rated sensor and a certified interlock circuit rather than our hobby-grade parts. Re-localisation against floor markers, because odometry drift makes the position field increasingly fictional. And zone partitioning, because Ricart-Agrawala's message count does not survive a large fleet contending for the same aisles. Sections seven and eight say the same thing in more detail.",
  },
];

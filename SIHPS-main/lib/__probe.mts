import { createSim, setRobotCount, stepSim, WAYPOINTS, waypoint, stopPos, type MeshSim } from "./mesh.ts";

function overlaps(sim: MeshSim) {
  const bad: string[] = [];
  // two robots holding the same slot of the same waypoint
  for (const w of WAYPOINTS) {
    const held = sim.claims[w.id] ?? [];
    if (held.length > w.slots) bad.push(`OVERBOOK ${w.id}: ${held.join(",")}`);
  }
  // two robots physically on top of each other
  for (let i = 0; i < sim.robots.length; i++)
    for (let j = i + 1; j < sim.robots.length; j++) {
      const a = sim.robots[i], b = sim.robots[j];
      const d = Math.hypot((a.nx - b.nx) * 18, (a.ny - b.ny) * 12);
      if (d < 0.6) bad.push(`t=${sim.t.toFixed(1)} OVERLAP ${a.id}/${b.id} ${d.toFixed(2)}m`);
    }
  return bad;
}

let sim = createSim(6);
const dt = 1 / 60;
const problems = new Set<string>();
let printed = 0;
for (let i = 0; i < 60 * 240; i++) {
  stepSim(sim, dt);
  if (Math.abs(sim.t - 40) < dt / 2) {
    sim.robots.find((r) => r.id === "R-02")!.manualOffline = true;
  }
  if (Math.abs(sim.t - 95) < dt / 2) {
    sim.robots.find((r) => r.id === "R-02")!.manualOffline = false;
  }
  for (const p of overlaps(sim)) problems.add(p.replace(/^t=[\d.]+ /, ""));
}
for (const e of sim.events.slice(-46)) {
  console.log(`t=${e.t.toFixed(1).padStart(6)}  ${e.robot}  ${e.text}`);
}
console.log("--- geometry violations:", problems.size);
[...problems].slice(0, 10).forEach((p) => console.log("   ", p));
console.log("--- final:", sim.robots.map((r) => `${r.id} ${r.task}${r.dead ? "*" : ""} ${Math.round(r.battery)}% @${r.target || "-"}`).join(" | "));

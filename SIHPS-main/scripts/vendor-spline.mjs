/**
 * Copies the Spline standalone WebGL runtime out of node_modules into
 * public/spline, so the 3D section loads entirely from this origin.
 *
 * Runs automatically as `prebuild`. public/spline is generated, not committed.
 *
 * Why standalone rather than importing @splinetool/runtime directly: the
 * published package contains `new URL("../libs/draco/...", import.meta.url)`
 * references to files it does not ship, which any static bundler refuses to
 * resolve. The standalone build is meant to be loaded by the browser as-is.
 *
 * Why WebGL rather than WebGPU: this has to run on whatever laptop a judge
 * opens it on, and WebGL is the one that is always there.
 */
import { mkdir, readdir, copyFile, stat, rm } from "node:fs/promises";
import path from "node:path";

const SRC = path.resolve("node_modules/@splinetool/runtime/build");
const DEST = path.resolve("public/spline");
const ENTRY = "runtime.standalone.webgl.js";

/** Pre-compressed twins and the runtime variants we are not shipping. */
function skip(name) {
  if (name.endsWith(".br") || name.endsWith(".gz")) return true;
  if (name === "runtime.js" || name === "runtime.cjs") return true;
  if (name.startsWith("runtime.standalone.") && name !== ENTRY) return true;
  if (name.startsWith("runtime-")) return true;
  return false;
}

try {
  await stat(path.join(SRC, ENTRY));
} catch {
  console.error(
    `Spline runtime not found at ${SRC}.\nRun \`npm install\` first.`,
  );
  process.exit(1);
}

await rm(DEST, { recursive: true, force: true });
await mkdir(DEST, { recursive: true });

let copied = 0;
let bytes = 0;
for (const name of await readdir(SRC)) {
  if (skip(name)) continue;
  const from = path.join(SRC, name);
  const info = await stat(from);
  if (!info.isFile()) continue;
  // The entry is renamed so the import path in the component stays stable
  // if we ever switch which variant we ship.
  const to = path.join(DEST, name === ENTRY ? "runtime.js" : name);
  await copyFile(from, to);
  copied += 1;
  bytes += info.size;
}

console.log(
  `vendored ${copied} Spline files into public/spline (${(bytes / 1024 / 1024).toFixed(1)} MB)`,
);

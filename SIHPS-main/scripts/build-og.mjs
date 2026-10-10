/**
 * Renders scripts/og-markup.tsx to app/opengraph-image.png.
 *
 *   npm run og
 *
 * Run it after changing the OG artwork or the headline. The committed PNG is
 * what actually ships; this script exists so that file is reproducible rather
 * than a mystery binary.
 */
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createElement } from "react";
import { ImageResponse } from "next/og";
import { OgMarkup, size } from "./og-markup.tsx";

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.resolve(here, "..", "app", "opengraph-image.png");

const response = new ImageResponse(createElement(OgMarkup), size);
const bytes = Buffer.from(await response.arrayBuffer());
await writeFile(out, bytes);

console.log(`wrote ${path.relative(process.cwd(), out)} (${bytes.length} bytes)`);

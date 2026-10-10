/**
 * Static export audit.
 *
 *   npm run build && npm run check:links
 *
 * Walks ./out and checks the things that silently rot on a static site:
 * broken internal links, anchors pointing at ids that do not exist, images
 * without alt text, links with no accessible name, and missing title,
 * description or canonical tags. Exits non-zero so it can gate a deploy.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve(process.cwd(), "out");

const problems = [];
const notes = [];
const externals = new Set();

function fail(file, msg) {
  problems.push(`${file}: ${msg}`);
}

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.name.endsWith(".html")) out.push(full);
  }
  return out;
}

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

/** Resolve a site-absolute or relative href to a file inside ./out. */
async function resolvesInOut(href, fromFile) {
  const clean = href.split("#")[0].split("?")[0];
  if (clean === "") return true;

  const base = clean.startsWith("/")
    ? path.join(OUT, clean)
    : path.resolve(path.dirname(fromFile), clean);

  if (await exists(base)) {
    const s = await stat(base);
    if (s.isFile()) return true;
    if (s.isDirectory()) return exists(path.join(base, "index.html"));
  }
  // trailingSlash: true means /privacy/ lives at /privacy/index.html
  if (await exists(`${base}.html`)) return true;
  if (await exists(path.join(base, "index.html"))) return true;
  return false;
}

const files = await walk(OUT);
if (!files.length) {
  console.error("No HTML found in ./out. Run `npm run build` first.");
  process.exit(1);
}

for (const file of files) {
  const rel = path.relative(OUT, file).replace(/\\/g, "/");
  const html = await readFile(file, "utf8");

  /* ---- head tags -------------------------------------------------- */
  if (!/<title>[^<]{5,}<\/title>/i.test(html)) fail(rel, "missing or empty <title>");
  if (!/<meta name="description" content="[^"]{20,}"/i.test(html))
    fail(rel, "missing meta description");

  const isNotFound = rel.startsWith("404") || rel.includes("_not-found");
  if (!isNotFound && !/<link rel="canonical"/i.test(html))
    fail(rel, "missing canonical link");

  const h1s = html.match(/<h1[\s>]/gi) ?? [];
  if (h1s.length === 0) fail(rel, "no <h1>");
  if (h1s.length > 1) fail(rel, `${h1s.length} <h1> elements, expected 1`);

  if (!/<html[^>]+lang="/i.test(html)) fail(rel, "<html> has no lang attribute");

  /* ---- images ------------------------------------------------------ */
  for (const [, tag] of html.matchAll(/(<img\b[^>]*>)/gi)) {
    if (!/\balt=/i.test(tag)) fail(rel, `<img> without alt: ${tag.slice(0, 90)}`);
  }

  /* ---- svg needs a role or must be hidden -------------------------- */
  for (const [, tag] of html.matchAll(/(<svg\b[^>]*>)/gi)) {
    const labelled = /aria-hidden="true"|role="img"|aria-label=/i.test(tag);
    if (!labelled) fail(rel, `<svg> is neither aria-hidden nor labelled: ${tag.slice(0, 90)}`);
  }
  for (const [, tag] of html.matchAll(/(<svg\b[^>]*role="img"[^>]*>)/gi)) {
    if (!/aria-label=/i.test(tag))
      fail(rel, `<svg role="img"> without aria-label: ${tag.slice(0, 90)}`);
  }

  /* ---- ids on the page, for anchor resolution ---------------------- */
  const ids = new Set(
    [...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]),
  );

  /* ---- links -------------------------------------------------------- */
  for (const [, tag, inner] of html.matchAll(
    /<a\b([^>]*)>([\s\S]*?)<\/a>/gi,
  )) {
    const hrefMatch = tag.match(/\shref="([^"]*)"/);
    if (!hrefMatch) {
      fail(rel, `<a> without href: ${tag.slice(0, 80)}`);
      continue;
    }
    const href = hrefMatch[1];

    const text = inner.replace(/<[^>]*>/g, "").replace(/&[a-z]+;/gi, " ").trim();
    const hasName =
      text.length > 0 ||
      /aria-label="[^"]+"/i.test(tag) ||
      /aria-labelledby=/i.test(tag);
    if (!hasName) fail(rel, `link with no accessible name: href=${href}`);

    if (/^(https?:)?\/\//i.test(href)) {
      externals.add(href);
      continue;
    }
    if (/^(mailto:|tel:)/i.test(href)) continue;

    if (href.startsWith("#")) {
      const id = decodeURIComponent(href.slice(1));
      if (id && !ids.has(id)) fail(rel, `anchor #${id} has no matching id`);
      continue;
    }

    if (!(await resolvesInOut(href, file))) {
      fail(rel, `broken link: ${href}`);
    }

    // Cross page anchors: verify the target id exists in the target document.
    const [pathPart, hash] = href.split("#");
    if (hash) {
      const target = pathPart.startsWith("/")
        ? path.join(OUT, pathPart, "index.html")
        : path.resolve(path.dirname(file), pathPart, "index.html");
      if (await exists(target)) {
        const targetHtml = await readFile(target, "utf8");
        if (!new RegExp(`\\sid="${hash.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(targetHtml)) {
          fail(rel, `cross-page anchor ${href} has no matching id in target`);
        }
      }
    }
  }
}

/* ---- sitemap and robots consistency -------------------------------- */
const sitemapPath = path.join(OUT, "sitemap.xml");
if (await exists(sitemapPath)) {
  const xml = await readFile(sitemapPath, "utf8");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  for (const loc of locs) {
    const p = new URL(loc).pathname;
    if (!(await resolvesInOut(p, path.join(OUT, "index.html"))))
      fail("sitemap.xml", `lists a URL with no exported page: ${p}`);
  }
  notes.push(`sitemap lists ${locs.length} URLs, all exported`);
} else {
  fail("out/", "no sitemap.xml");
}

if (!(await exists(path.join(OUT, "robots.txt")))) fail("out/", "no robots.txt");
if (!(await exists(path.join(OUT, "404.html")))) fail("out/", "no 404.html");
if (!(await exists(path.join(OUT, "opengraph-image.png"))))
  fail("out/", "no opengraph-image.png");

/* ---- report --------------------------------------------------------- */
console.log(`Checked ${files.length} HTML files in ./out`);
notes.forEach((n) => console.log(`  note: ${n}`));
if (externals.size) {
  console.log(`  ${externals.size} external link(s):`);
  externals.forEach((e) => console.log(`    ${e}`));
} else {
  console.log("  note: no external links, nothing offsite to break");
}

if (problems.length) {
  console.error(`\n${problems.length} problem(s):`);
  problems.forEach((p) => console.error(`  ${p}`));
  process.exit(1);
}
console.log("\nAll checks passed.");

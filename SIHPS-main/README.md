# RelayMesh

The marketing and technical-reference site for RelayMesh: decentralized,
hardware-fail-safe coordination for warehouse robot fleets.

One long scroll-driven page with six live simulators, built to be opened on a
judge's own laptop, walked through during a pitch, and left behind as a
reference afterwards.

```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # static export into ./out
npm run serve          # serve ./out on http://localhost:4173
```

## It runs with no internet

This is a hard requirement, not a nice-to-have: the live demo has no network.
Everything the page needs is inside `./out`.

- Fonts (IBM Plex Sans and Mono) are compiled in by `next/font` and served
  from the same origin. No Google Fonts request.
- The Spline 3D scene and its WebGL runtime are vendored into `public/`. See
  [Spline](#spline) below.
- No analytics, no tag manager, no embeds, no CDN.
- `npm run check:links` asserts there are zero external links.

After `npm run build`, `./out` can be served by anything, or opened through
`npm run serve`. Nothing in it phones home.

## Layout

```
app/                    routes, tokens, metadata, robots, sitemap, icons
  globals.css           the design token system (colour, type, shape, motion)
components/
  site/                 Nav, Panel, Section, Footer, Logo, Legal shells
  sim/                  the six simulators
  sections/             the non-simulator sections
lib/
  mesh.ts               the mesh simulation model (framework free)
  meshDraw.ts           its canvas renderer
  hooks.ts              motion, theme, canvas palette, reveal, viewport
  specs.ts              the file-level spec panel content
  faq.ts                FAQ, shared with the FAQPage structured data
styles/instrument.css   hand-written diagram and hardware CSS
scripts/                OG image, Spline vendoring, static export audit
```

## The design system

One accent colour, one motif, one shape scale. All of it lives in
`app/globals.css` and nothing outside that file invents a value.

- **Ground** is a cool near-black (`#0a0c10`), never pure black. Full light
  and dark themes, switched on `data-theme` on `<html>` and seeded before
  first paint so there is no flash.
- **Accent** is a single oscilloscope-trace teal. Red and amber appear only as
  machine state (stop, deferred) and are never brand colour or decoration.
- **Type** is IBM Plex Sans and IBM Plex Mono. Mono is load bearing: it marks
  a system token. Protocol names, message types, timestamps and data values
  are mono, prose is not.
- **Motif** is the broadcast pulse from the logo mark: a filled node, two arcs,
  two receivers. It reappears as the pulse rings in the mesh canvas and the
  node glyph in every diagram.
- **Shape** is locked. Stage 20px, inner core 14px, card 12px, control 6px.
- **Motion** is mechanical. Things click into place. No bounce, no elastic.

## Simulators

Each one implements the real rule rather than miming it.

| Section | What it runs |
| --- | --- |
| Mesh (hero and overview) | Broadcast on a timer, Lamport merge on receipt, timeout suspicion, hold on suspicion |
| Clocks | `C(i) <- max(C(i), C(received)) + 1`, applied per delivery |
| Mutual exclusion | Ricart-Agrawala with `(timestamp, id)` ordering and real deferred replies |
| Task handover | Contract Net across four rounds, with an out-of-range robot that never bids |
| Fail-safe | The four-cell truth table of crashed software against ENABLE |
| Cloud | The same mesh model, running while the uplink is cut |

The hero and the overview are **one running simulation**, handed from
full-bleed to docked as you scroll. There is no second canvas and no cut. The
scrub is read through Motion's `useScroll`; the canvas re-renders itself with
an interpolated field rect, so nothing animates layout.

## Accessibility

- Every interactive element is keyboard operable and has a visible
  `:focus-visible` ring. Canvas node selection is mirrored by real buttons in
  the control rail, so nothing is mouse-only.
- Every simulator has a reduced-motion path that renders the settled state and
  exposes a step or resolve control, rather than hiding the content.
- The nav carries a **pause control for all page motion**. The hero mesh is
  autoplaying motion lasting more than five seconds, which WCAG 2.2.2 requires
  a mechanism to stop; `prefers-reduced-motion` alone does not provide one. It
  is seeded from the OS preference and stored in `localStorage`.
- Every diagram has a caption stating the claim it proves, plus an
  `aria-label` describing its current state. Decorative SVG is `aria-hidden`.
- Discrete outcomes (zone occupancy, award stage, ENABLE line) are
  `aria-live="polite"`. Continuous telemetry deliberately is not.
- Layers faded out during the scroll handoff are also `inert`, so keyboard
  focus never lands on something invisible.

`npm run check:links` enforces the mechanical parts of this: alt text, SVG
labelling, accessible link names, one `<h1>` per page, `lang`, canonical tags,
titles, descriptions, and every internal link and anchor.

## Spline

`public/scene.splinecode` is committed. `scripts/vendor-spline.mjs` runs as
`predev` and `prebuild` and copies the standalone WebGL runtime out of
`node_modules` into `public/spline/`, which is generated and gitignored.

The scene appears **twice**, from a single shared loader in `lib/spline.ts`:

- **Behind the hero headline**, as an ambient backdrop with the live protocol
  mesh drawn over it. It is created with `interactive: false`, so the runtime
  never attaches orbit or wheel handlers and cannot swallow the scroll of a
  scroll-driven page. It fades out and then `stop()`s as the mesh docks into
  its instrument frame, because the docked frame needs a clean ground.
- **In its own section at 86vh**, interactive, where dragging is the point.

`lib/spline.ts` memoises the runtime module and the scene `ArrayBuffer` at
module scope, so the second instance costs a WebGL context and nothing else.

Three things make it load in about half the time the first version did:

1. The runtime import and the scene fetch run **concurrently**. The first
   version imported the runtime and then let `app.load()` go and fetch the
   scene, so the wait was the sum rather than the larger of the two.
2. The scene is fetched once as an `ArrayBuffer` and handed to
   `app.start(buffer)`, so `load()` never re-fetches it.
3. `<link rel="modulepreload">` on the home page starts the 2.2 MB runtime at
   HTML parse rather than at hydration.

Over the wire that is ~576 KB brotli for the runtime plus 1.34 MB for the
scene, which is already-compressed msgpack and will not shrink further.

Two things that are easy to get wrong here:

- **`wasmPath` must be set.** Left unset, the runtime fetches its wasm from
  Spline's CDN, which quietly reintroduces the network dependency this whole
  setup exists to remove. It points at `public/spline/`.
- **`@splinetool/runtime` cannot be bundled.** It contains
  `new URL("../libs/draco/...", import.meta.url)` references to files the
  package does not ship, which Turbopack refuses to resolve. The standalone
  build is meant to be loaded by the browser directly, which is why the import
  specifier is a runtime value carrying `turbopackIgnore`.

The loading state is a real byte counter read from `Content-Length`, not an
indeterminate spinner. If the scene fails, the section degrades to an honest
message and logs the reason under `[RelayMesh]`.

## Before deploying

Set the canonical origin, which drives canonical tags, the sitemap and the
social-share URLs:

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.example npm run build
```

The fallback in `lib/site.ts` is a reserved `.example` domain on purpose, so
an unconfigured deploy is obvious rather than quietly wrong.

Regenerate the social-share image after changing its artwork or the headline:

```bash
npm run og      # scripts/og-markup.tsx -> app/opengraph-image.png
```

## Launch checklist

| Item | State |
| --- | --- |
| Privacy policy | `/privacy`, describes what is actually stored (one theme key) |
| Terms page | `/terms`, including the not-safety-certified disclaimer |
| Clear CTA | Hero links into the running mesh; one intent, used once |
| FAQ | Six questions, native `<details>`, also emitted as FAQPage JSON-LD |
| robots.txt | `app/robots.ts` |
| sitemap.xml | `app/sitemap.ts`, verified against exported pages by the audit |
| Custom 404 | `app/not-found.tsx`, lists every section anchor |
| Alt text | No `<img>` on the site; SVG is labelled or hidden, enforced by the audit |
| Analytics | **Not installed.** See below |
| Meta titles | Per route, with a template |
| Meta descriptions | Per route |
| Social share | OG and Twitter tags, real 1200x630 PNG |
| Favicon | `app/icon.svg` |
| Canonical URIs | Per route, from `NEXT_PUBLIC_SITE_URL` |
| Cookie consent | **Not applicable.** See below |
| Mobile | Every simulator degrades to a functional layout, none are hidden |
| Accessibility | See above |
| Forms | There are none, so there is nothing to test |
| Broken links | `npm run check:links`, currently zero |
| Performance | 824 KB initial JS uncompressed, ~252 KB gzipped |

### Analytics is deliberately absent

Adding a third-party analytics script would break the offline requirement and
send visitor data to a company that is not you. It also needs an account this
project does not have. If you want it, the single place to add it is
`app/layout.tsx`, and both the privacy page and the "no external links" claim
in the audit will need updating to stay true.

### Cookie consent is deliberately absent

The site sets no cookies. The only stored values are two `localStorage` keys
for theme and motion preference, which are strictly functional, never
transmitted, and exempt from consent requirements. A banner asking permission
to store nothing would be theatre, and it would be the first thing a judge
had to dismiss.

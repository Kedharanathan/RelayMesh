"use client";

/* ==========================================================================
   Shared Spline loader.

   Two things on this page render the same scene: the hero backdrop and the
   large interactive stage further down. Both go through here, so the 2.2 MB
   runtime and the 1.3 MB scene are fetched exactly once for the session and
   the second instance costs nothing but a WebGL context.

   The runtime and the scene are fetched CONCURRENTLY. Doing it sequentially
   (import the runtime, then let app.load() go and fetch the scene) meant
   waiting for the sum rather than the larger of the two.
   ========================================================================== */

export type SplineApp = {
  start: (
    buffer: ArrayBuffer,
    opts?: { interactive?: boolean },
  ) => void;
  dispose: () => void;
  stop: () => void;
  play: () => void;
  setBackgroundColor: (color: string) => void;
  setSize?: (w: number, h: number) => void;
  readonly isStopped: boolean;
};

type SplineModule = {
  Application: new (
    canvas: HTMLCanvasElement,
    opts?: {
      renderMode?: "auto" | "manual" | "continuous";
      wasmPath?: string;
      renderer?: "webgl" | "webgpu";
    },
  ) => SplineApp;
};

/** Byte totals are read from Content-Length; they are never invented. */
export type LoadProgress = { loaded: number; total: number };

function base(path: string) {
  return new URL(path, document.baseURI).href;
}

export function wasmPath() {
  return base("./spline/");
}

let runtimePromise: Promise<SplineModule> | null = null;
let scenePromise: Promise<ArrayBuffer> | null = null;

/** Progress subscribers, so several mounted scenes share one download. */
const listeners = new Set<(p: LoadProgress) => void>();
let sceneLoaded = 0;
let sceneTotal = 0;

function publish() {
  const p = { loaded: sceneLoaded, total: sceneTotal };
  listeners.forEach((fn) => fn(p));
}

export function onSceneProgress(fn: (p: LoadProgress) => void): () => void {
  listeners.add(fn);
  if (sceneTotal) fn({ loaded: sceneLoaded, total: sceneTotal });
  // Returns void, not Set.delete's boolean: this is used as an effect cleanup.
  return () => {
    listeners.delete(fn);
  };
}

export function loadRuntime(): Promise<SplineModule> {
  if (!runtimePromise) {
    // Left alone by the bundler: a browser-side load of a vendored ES module.
    // The specifier is a runtime value, resolved against the page.
    runtimePromise = import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ base(
        "./spline/runtime.js",
      )
    ).then((m) => m as SplineModule);
  }
  return runtimePromise;
}

export function loadScene(): Promise<ArrayBuffer> {
  if (!scenePromise) {
    scenePromise = (async () => {
      const res = await fetch(base("./scene.splinecode"));
      if (!res.ok) throw new Error(`scene ${res.status}`);

      const len = Number(res.headers.get("content-length") ?? 0);
      // No Content-Length (or no stream support): skip the bar, keep the load.
      if (!len || !res.body) return res.arrayBuffer();

      sceneTotal = len;
      sceneLoaded = 0;
      publish();

      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        sceneLoaded += value.byteLength;
        publish();
      }

      const out = new Uint8Array(sceneLoaded);
      let at = 0;
      for (const c of chunks) {
        out.set(c, at);
        at += c.byteLength;
      }
      return out.buffer;
    })();
  }
  return scenePromise;
}

/** Warm both caches without mounting anything. */
export function prefetchSpline() {
  void loadRuntime().catch(() => {});
  void loadScene().catch(() => {});
}

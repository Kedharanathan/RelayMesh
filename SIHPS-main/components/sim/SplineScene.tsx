"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "@/lib/hooks";
import {
  loadRuntime,
  loadScene,
  onSceneProgress,
  wasmPath,
  type SplineApp,
} from "@/lib/spline";

/**
 * Spline scene, self-hosted.
 *
 * The scene and its WebGL runtime are vendored into /public rather than
 * loaded from prod.spline.design, because this site has to run on a laptop
 * with no internet during the live demo. Hotlinking would leave an empty
 * panel on stage and would make the privacy page untrue.
 *
 * The hero instance is interactive AND passes blockWheel: dragging the scene
 * works, while the wheel is stopped before Spline's zoom handler sees it, so
 * the page still scrolls. Those two props always travel together on any
 * scene that fills the viewport.
 */

type Status = "idle" | "loading" | "ready" | "error";

export function SplineScene({
  className = "",
  interactive = true,
  /** Start loading on mount instead of waiting for the viewport. */
  eager = false,
  /** Punch the scene background out so the page shows through. */
  transparent = false,
  /** Suspend rendering: off-screen, or motion switched off. */
  paused = false,
  /**
   * Let wheel events reach the page instead of the scene. Required wherever
   * an interactive scene fills the viewport: Spline binds wheel to zoom, and
   * on a scroll-driven page that traps the reader.
   */
  blockWheel = false,
  onApp,
  showProgress = true,
}: {
  className?: string;
  interactive?: boolean;
  eager?: boolean;
  transparent?: boolean;
  paused?: boolean;
  blockWheel?: boolean;
  onApp?: (app: SplineApp | null) => void;
  showProgress?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wrapRef, inView] = useInView<HTMLDivElement>("600px");
  const reduced = useReducedMotion();

  const [status, setStatus] = useState<Status>("idle");
  const [pct, setPct] = useState(0);

  const appRef = useRef<SplineApp | null>(null);
  const startedRef = useRef(false);
  const onAppRef = useRef(onApp);
  onAppRef.current = onApp;

  /* Real bytes off the wire, shared across every mounted scene. */
  useEffect(
    () =>
      onSceneProgress(({ loaded, total }) => {
        if (total > 0) setPct(Math.min(100, Math.round((loaded / total) * 100)));
      }),
    [],
  );

  /* One-shot load. `status` is deliberately NOT a dependency: setting it
     would re-run this effect and tear down the in-flight load. */
  useEffect(() => {
    if (startedRef.current) return;
    if (!eager && !inView) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    startedRef.current = true;
    setStatus("loading");

    (async () => {
      try {
        // Concurrent, not sequential: the wait is the larger of the two.
        const [mod, buffer] = await Promise.all([loadRuntime(), loadScene()]);
        if (!canvasRef.current) return;

        const app = new mod.Application(canvas, {
          renderMode: "auto",
          // Without this the runtime pulls its wasm from Spline's CDN, which
          // would quietly reintroduce a network dependency.
          wasmPath: wasmPath(),
          renderer: "webgl",
        });

        // start() takes the buffer we already have, so the scene is not
        // fetched a second time.
        app.start(buffer, { interactive });
        if (transparent) app.setBackgroundColor("transparent");

        if (!canvasRef.current) {
          app.dispose();
          return;
        }
        appRef.current = app;
        onAppRef.current?.(app);
        setStatus("ready");
      } catch (err) {
        console.error("[RelayMesh] Spline scene failed to load:", err);
        if (canvasRef.current) setStatus("error");
      }
    })();
  }, [eager, inView, interactive, transparent]);

  /* Capture phase on the wrapper, so the canvas listener never sees it.
     stopPropagation only: preventDefault would stop the page scrolling too. */
  useEffect(() => {
    if (!blockWheel) return;
    const node = wrapRef.current;
    if (!node) return;
    const swallow = (e: WheelEvent) => e.stopPropagation();
    node.addEventListener("wheel", swallow, { capture: true, passive: true });
    return () =>
      node.removeEventListener("wheel", swallow, { capture: true });
  }, [blockWheel, wrapRef]);

  useEffect(
    () => () => {
      onAppRef.current?.(null);
      appRef.current?.dispose();
      appRef.current = null;
    },
    [],
  );

  /* Suspend when off-screen or when page motion is switched off. A WebGL
     scene is the most expensive thing here; it obeys the same nav control
     as everything else. */
  useEffect(() => {
    const app = appRef.current;
    if (!app || status !== "ready") return;
    const shouldRun = !paused && !reduced && inView;
    if (shouldRun && app.isStopped) app.play();
    else if (!shouldRun && !app.isStopped) app.stop();
  }, [paused, reduced, inView, status]);

  return (
    <div
      ref={wrapRef}
      className={`relative overflow-hidden ${className}`}
      style={transparent ? undefined : { background: "var(--bg-sunken)" }}
    >
      <canvas
        ref={canvasRef}
        className="block h-full w-full"
        style={{
          opacity: status === "ready" ? 1 : 0,
          transition: "opacity 700ms var(--ease-out)",
          // A non-interactive backdrop must never eat a scroll or a drag.
          pointerEvents: interactive ? "auto" : "none",
          // pan-y keeps a touch scroll working over a draggable scene.
          touchAction: interactive && !blockWheel ? "none" : "pan-y",
        }}
        aria-hidden={!interactive}
        role={interactive ? "img" : undefined}
        aria-label={
          interactive
            ? "Interactive three dimensional scene. Drag to orbit."
            : undefined
        }
      />

      {status !== "ready" && showProgress && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center p-6">
          {status === "error" ? (
            <p className="max-w-[36ch] text-center text-sm text-muted">
              <span className="label block" style={{ color: "var(--stop)" }}>
                3D view unavailable
              </span>
              <span className="mt-2 block">
                Every claim on this page is demonstrated in the diagrams. This
                view is the one thing here that is decoration.
              </span>
            </p>
          ) : (
            <div className="w-full max-w-[220px]">
              <div className="flex items-baseline justify-between">
                <span className="label">Loading scene</span>
                <span className="tok" style={{ color: "var(--accent)" }}>
                  {pct}%
                </span>
              </div>
              {/* Real bytes, not a fake indeterminate crawl. */}
              <div
                className="mt-2 h-px w-full overflow-hidden"
                style={{ background: "var(--line-strong)" }}
              >
                <div
                  className="h-full origin-left"
                  style={{
                    background: "var(--accent)",
                    transform: `scaleX(${pct / 100})`,
                    transition: "transform 220ms linear",
                  }}
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

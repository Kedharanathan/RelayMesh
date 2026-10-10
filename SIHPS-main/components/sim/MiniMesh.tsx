"use client";

import { useEffect, useRef } from "react";
import { createSim, stepSim } from "@/lib/mesh";
import { drawMesh } from "@/lib/meshDraw";
import { useCanvasSize, useInView, usePaletteRef, useReducedMotion } from "@/lib/hooks";

/**
 * The same simulation as the hero, at desk size. It is here to be watched
 * while the uplink beside it is switched off, so it deliberately shares the
 * model rather than faking a second one.
 */
export function MiniMesh({
  onFrames,
  className = "",
}: {
  onFrames?: (n: number) => void;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [wrapRef, inView] = useInView<HTMLDivElement>("220px");
  const paletteRef = usePaletteRef();
  const simRef = useRef(createSim(3));
  const reduced = useReducedMotion();
  const sizeRef = useCanvasSize(canvasRef);
  const cbRef = useRef(onFrames);
  cbRef.current = onFrames;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !inView) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let last = performance.now();
    let acc = 0;

    const draw = () => {
      const { w, h, dpr } = sizeRef.current;
      if (w < 2) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawMesh(
        ctx,
        simRef.current,
        paletteRef.current,
        {
          field: { x: 8, y: 8, w: w - 16, h: h - 16 },
          dock: 1,
          selected: null,
          hovered: null,
          narrow: w < 420,
          showInfra: false,
        },
        w,
        h,
      );
    };

    if (reduced) {
      // Settle into a representative frame and leave it there.
      for (let i = 0; i < 90; i++) stepSim(simRef.current, 1 / 30);
      draw();
      cbRef.current?.(simRef.current.delivered);
      return;
    }

    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      stepSim(simRef.current, dt);
      draw();
      acc += dt;
      if (acc > 0.2) {
        acc = 0;
        cbRef.current?.(simRef.current.delivered);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, paletteRef, reduced, sizeRef]);

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        aria-hidden="true"
      />
    </div>
  );
}

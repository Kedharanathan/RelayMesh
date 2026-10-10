"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* -------------------------------------------------------------------------
   Motion.

   Single source of truth is data-motion on <html>, seeded before first paint
   by the boot script in layout.tsx: it starts at "off" when the OS asks for
   reduced motion, and the visitor can override it either way from the nav.

   The nav control is not a nicety. The mesh in the hero is autoplaying motion
   that runs well past five seconds, so WCAG 2.2.2 requires a mechanism to
   pause it, and prefers-reduced-motion alone does not provide one.

   Every simulator branches on this: rather than hiding the visual, it renders
   the settled frame and exposes a step control, so the content stays reachable.
   ------------------------------------------------------------------------- */
export type MotionPref = "on" | "off";

function readMotion(): MotionPref {
  return document.documentElement.getAttribute("data-motion") === "off"
    ? "off"
    : "on";
}

/** Subscribes to data-motion. Returns true when motion should be suppressed. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const apply = () => setReduced(readMotion() === "off");
    apply();
    const mo = new MutationObserver(apply);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-motion"],
    });
    return () => mo.disconnect();
  }, []);

  return reduced;
}

export function useMotionPref(): [MotionPref, (m: MotionPref) => void] {
  const [pref, setPrefState] = useState<MotionPref>("on");

  useEffect(() => {
    setPrefState(readMotion());

    // Follow the OS if the visitor has never expressed a preference here.
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onSystem = () => {
      let stored: string | null = null;
      try {
        stored = localStorage.getItem("rm-motion");
      } catch {
        /* storage unavailable: treat as no stored preference */
      }
      if (stored === "on" || stored === "off") return;
      const next: MotionPref = mq.matches ? "off" : "on";
      document.documentElement.setAttribute("data-motion", next);
      setPrefState(next);
    };
    mq.addEventListener("change", onSystem);
    return () => mq.removeEventListener("change", onSystem);
  }, []);

  const setPref = useCallback((m: MotionPref) => {
    document.documentElement.setAttribute("data-motion", m);
    try {
      localStorage.setItem("rm-motion", m);
    } catch {
      /* private mode: the choice still applies for this session */
    }
    setPrefState(m);
  }, []);

  return [pref, setPref];
}

/* -------------------------------------------------------------------------
   Theme. Single source of truth is the data-theme attribute on <html>, set
   before first paint by the boot script in layout.tsx.
   ------------------------------------------------------------------------- */
export type Theme = "light" | "dark";

export function useTheme(): [Theme, (t: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setThemeState(current === "light" ? "light" : "dark");
  }, []);

  const setTheme = useCallback((t: Theme) => {
    document.documentElement.setAttribute("data-theme", t);
    try {
      localStorage.setItem("rm-theme", t);
    } catch {
      /* private mode: the in-memory theme still applies for this session */
    }
    setThemeState(t);
  }, []);

  return [theme, setTheme];
}

/* -------------------------------------------------------------------------
   Canvas palette. Canvas cannot read CSS variables, so resolve them once and
   again whenever the theme attribute flips.
   ------------------------------------------------------------------------- */
export type Palette = {
  bg: string;
  surface: string;
  line: string;
  lineStrong: string;
  text: string;
  muted: string;
  dim: string;
  accent: string;
  stop: string;
  hold: string;
  grid: string;
  /** resolved font stacks, since canvas cannot accept var() in ctx.font */
  mono: string;
  sans: string;
};

const VAR_MAP: Record<keyof Palette, string> = {
  bg: "--bg",
  surface: "--surface",
  line: "--line",
  lineStrong: "--line-strong",
  text: "--text",
  muted: "--text-muted",
  dim: "--text-dim",
  accent: "--accent",
  stop: "--stop",
  hold: "--hold",
  grid: "--grid-ink",
  mono: "--font-plex-mono",
  sans: "--font-plex-sans",
};

const FALLBACK: Palette = {
  bg: "#0a0c10",
  surface: "#101419",
  line: "rgba(255,255,255,0.09)",
  lineStrong: "rgba(255,255,255,0.18)",
  text: "#e8edf2",
  muted: "#9ba6b2",
  dim: "#78838f",
  accent: "#3ddbd9",
  stop: "#ff8389",
  hold: "#f1c21b",
  grid: "rgba(255,255,255,0.05)",
  mono: "ui-monospace, monospace",
  sans: "system-ui, sans-serif",
};

function readPalette(): Palette {
  const cs = getComputedStyle(document.documentElement);
  const out = {} as Palette;
  (Object.keys(VAR_MAP) as (keyof Palette)[]).forEach((k) => {
    const v = cs.getPropertyValue(VAR_MAP[k]).trim();
    out[k] = v || FALLBACK[k];
  });
  // next/font emits a bare family list; canvas needs a generic on the end.
  out.mono = `${out.mono}, ui-monospace, monospace`;
  out.sans = `${out.sans}, system-ui, sans-serif`;
  return out;
}

/**
 * Returns a ref holding the live palette. A ref rather than state so the
 * render loop can read it every frame without re-rendering React.
 */
export function usePaletteRef() {
  const ref = useRef<Palette>(FALLBACK);
  const [, force] = useState(0);

  useEffect(() => {
    const sync = () => {
      ref.current = readPalette();
      force((n) => n + 1);
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => mo.disconnect();
  }, []);

  return ref;
}

/* -------------------------------------------------------------------------
   Reveal on entry. IntersectionObserver only, never a scroll listener.
   ------------------------------------------------------------------------- */
export function useReveal<T extends HTMLElement>(threshold = 0.18) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (readMotion() === "off") {
      node.setAttribute("data-shown", "true");
      node
        .querySelectorAll<HTMLElement>(".reveal")
        .forEach((el) => el.setAttribute("data-shown", "true"));
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            (e.target as HTMLElement).setAttribute("data-shown", "true");
            io.unobserve(e.target);
          }
        });
      },
      { threshold, rootMargin: "0px 0px -8% 0px" },
    );

    io.observe(node);
    node.querySelectorAll<HTMLElement>(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [threshold]);

  return ref;
}

/* -------------------------------------------------------------------------
   requestAnimationFrame driver with delta time, paused when off-screen or
   when the tab is hidden. Keeps six simulators from burning a laptop battery.
   ------------------------------------------------------------------------- */
export function useRafLoop(
  cb: (dtSeconds: number, elapsedSeconds: number) => void,
  active = true,
) {
  const cbRef = useRef(cb);
  cbRef.current = cb;

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    let last = performance.now();
    let elapsed = 0;
    let running = true;

    const tick = (now: number) => {
      if (!running) return;
      // Clamp: a backgrounded tab or a stalled frame must not fast-forward
      // the simulation by seconds when it resumes.
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;
      elapsed += dt;
      cbRef.current(dt, elapsed);
      raf = requestAnimationFrame(tick);
    };

    const onVisibility = () => {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!running) {
        running = true;
        last = performance.now();
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [active]);
}

/* Pauses work while an element is outside the viewport. */
export function useInView<T extends HTMLElement>(margin = "200px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver(
      ([e]) => setInView(e.isIntersecting),
      { rootMargin: margin },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [margin]);

  return [ref, inView] as const;
}

/* Canvas sizing with devicePixelRatio, driven by ResizeObserver. */
export function useCanvasSize(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  onResize?: (w: number, h: number) => void,
) {
  const sizeRef = useRef({ w: 0, h: 0, dpr: 1 });
  const cbRef = useRef(onResize);
  cbRef.current = onResize;

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!canvas || !parent) return;

    const apply = () => {
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      sizeRef.current = { w, h, dpr };
      cbRef.current?.(w, h);
    };

    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(parent);
    return () => ro.disconnect();
  }, [canvasRef]);

  return sizeRef;
}

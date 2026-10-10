"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useScroll, useSpring, AnimatePresence } from "motion/react";
import { Sun, Moon, X, List, Pause, Play } from "@phosphor-icons/react";
import { Logotype } from "./Logo";
import { useMotionPref, useReducedMotion, useTheme } from "@/lib/hooks";
import { SECTIONS, PRIMARY_SECTIONS } from "@/lib/sections";

/**
 * Floating instrument bar. 12px radius rather than a pill: the shape system on
 * this site reads as equipment, and a full-round nav would be the only
 * capsule on the page.
 */
export function Nav() {
  const [theme, setTheme] = useTheme();
  const [motionPref, setMotionPref] = useMotionPref();
  const [indexOpen, setIndexOpen] = useState(false);
  const [active, setActive] = useState<string>("overview");
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 180,
    damping: 34,
    restDelta: 0.001,
  });

  /* Scroll spy. IntersectionObserver, never a scroll handler. */
  useEffect(() => {
    const targets = SECTIONS.map((s) => document.getElementById(s.id)).filter(
      (n): n is HTMLElement => Boolean(n),
    );
    if (!targets.length) return;

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: [0, 0.05, 0.2] },
    );

    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  /* Esc closes the index, and the body must not scroll behind it. */
  useEffect(() => {
    if (!indexOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIndexOpen(false);
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [indexOpen]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return (
    <>
      {/* Reading progress across a very long single page. */}
      <motion.div
        aria-hidden="true"
        className="fixed left-0 top-0 z-[45] h-[2px] w-full origin-left bg-accent"
        style={{ scaleX: reduced ? 0 : progress }}
      />

      <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-4">
        <nav
          aria-label="Section navigation"
          className="pointer-events-auto flex h-[var(--nav-h)] w-full max-w-[var(--rail)] items-center gap-3 rounded-md border border-line px-3 backdrop-blur-xl"
          style={{
            background: "color-mix(in srgb, var(--surface) 78%, transparent)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <a
            href="#top"
            className="flex shrink-0 items-center rounded-sm px-1 py-1 transition-opacity duration-150 hover:opacity-70"
            aria-label="RelayMesh, back to top"
          >
            <Logotype />
          </a>

          <div className="mx-auto hidden items-center gap-1 lg:flex">
            {PRIMARY_SECTIONS.map((s) => {
              const on = active === s.id;
              return (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  aria-current={on ? "true" : undefined}
                  className="relative rounded-sm px-3 py-2 transition-colors duration-150"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--fs-micro)",
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: on ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {s.label}
                  {on && (
                    <motion.span
                      layoutId={reduced ? undefined : "nav-active"}
                      className="absolute inset-x-2 -bottom-px h-px bg-accent"
                      transition={{ duration: 0.28, ease: [0.2, 0.9, 0.1, 1] }}
                    />
                  )}
                </a>
              );
            })}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2 lg:ml-0">
            <button
              type="button"
              onClick={toggleTheme}
              className="ctl"
              style={{ padding: "8px" }}
              aria-label={
                theme === "dark" ? "Switch to light theme" : "Switch to dark theme"
              }
            >
              {theme === "dark" ? (
                <Sun size={15} weight="light" aria-hidden="true" />
              ) : (
                <Moon size={15} weight="light" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setMotionPref(motionPref === "on" ? "off" : "on")}
              className="ctl"
              style={{ padding: "8px" }}
              aria-pressed={motionPref === "off"}
              aria-label={
                motionPref === "on"
                  ? "Pause animation across the page"
                  : "Resume animation across the page"
              }
            >
              {motionPref === "on" ? (
                <Pause size={15} weight="light" aria-hidden="true" />
              ) : (
                <Play size={15} weight="light" aria-hidden="true" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setIndexOpen(true)}
              className="ctl"
              aria-expanded={indexOpen}
              aria-haspopup="dialog"
              aria-label="Open the section index"
            >
              <List size={15} weight="light" aria-hidden="true" />
              <span className="hidden sm:inline" aria-hidden="true">
                Index
              </span>
            </button>
          </div>
        </nav>
      </header>

      <AnimatePresence>
        {indexOpen && (
          <SectionIndex
            active={active}
            reduced={reduced}
            onClose={() => setIndexOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

function SectionIndex({
  active,
  reduced,
  onClose,
}: {
  active: string;
  reduced: boolean;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.querySelector<HTMLElement>("a,button")?.focus();
  }, []);

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label="Section index"
      ref={panelRef}
      initial={reduced ? { opacity: 1 } : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduced ? { opacity: 1 } : { opacity: 0 }}
      transition={{ duration: 0.22 }}
      className="fixed inset-0 z-50 overflow-y-auto overscroll-contain backdrop-blur-2xl"
      style={{ background: "color-mix(in srgb, var(--bg) 88%, transparent)" }}
    >
      <div className="rail flex min-h-[100dvh] flex-col py-5">
        <div className="flex h-[var(--nav-h)] items-center">
          <Logotype />
          <button
            type="button"
            onClick={onClose}
            className="ctl ml-auto"
            style={{ padding: "8px" }}
            aria-label="Close section index"
          >
            <X size={15} weight="light" aria-hidden="true" />
          </button>
        </div>

        <ul className="my-auto grid gap-px py-8 md:grid-cols-2 md:gap-x-10">
          {SECTIONS.map((s, i) => (
            <motion.li
              key={s.id}
              initial={reduced ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.42,
                delay: reduced ? 0 : 0.03 * i,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <a
                href={`#${s.id}`}
                onClick={onClose}
                className="group flex items-baseline gap-4 border-t border-line py-4 transition-colors duration-150 hover:border-[var(--accent-line)]"
              >
                <span
                  className="tok shrink-0"
                  style={{
                    color:
                      active === s.id ? "var(--accent)" : "var(--text-dim)",
                  }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="min-w-0">
                  <span
                    className="block text-h3 transition-colors duration-150 group-hover:text-accent"
                    style={{
                      color: active === s.id ? "var(--accent)" : "var(--text)",
                      fontWeight: 500,
                    }}
                  >
                    {s.label}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">
                    {s.note}
                  </span>
                </span>
              </a>
            </motion.li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}

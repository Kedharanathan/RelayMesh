"use client";

import type { ReactNode } from "react";
import { useReveal } from "@/lib/hooks";

/**
 * One section shell for the whole page: same rhythm, same rail, same reveal.
 * No eyebrow label anywhere on this site - a section's place in the walkthrough
 * already says what it is.
 */
export function Section({
  id,
  title,
  lead,
  children,
  wide = false,
  tone = "base",
}: {
  id: string;
  title: string;
  lead?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  /** "sunken" separates the heavier sections without inverting the theme */
  tone?: "base" | "sunken";
}) {
  const ref = useReveal<HTMLElement>();

  return (
    <section
      id={id}
      ref={ref}
      className="relative py-24 md:py-36"
      style={
        tone === "sunken"
          ? { background: "var(--bg-sunken)" }
          : undefined
      }
      aria-labelledby={`${id}-title`}
    >
      <div className={wide ? "mx-auto w-full max-w-[1440px] px-5 md:px-8" : "rail"}>
        <header className="reveal max-w-[62ch]">
          <h2 id={`${id}-title`} className="text-h2">
            {title}
          </h2>
          {lead && <p className="mt-4 text-lead text-muted">{lead}</p>}
        </header>
        <div className="mt-10 md:mt-14">{children}</div>
      </div>
    </section>
  );
}

/** Hairline rule with a tick, the lifeline motif used as a section break. */
export function Lifeline() {
  return (
    <div className="rail" aria-hidden="true">
      <div className="relative h-px w-full bg-line">
        <span className="absolute left-0 top-1/2 h-2.5 w-px -translate-y-1/2 bg-accent" />
      </div>
    </div>
  );
}

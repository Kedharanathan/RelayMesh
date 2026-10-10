"use client";

import { useId, useState, type ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react";

/* --------------------------------------------------------------------------
   Panel - the double-bezel enclosure. Outer machined tray, inner plate, with
   concentric radii. Every simulator on the site sits in one of these, so the
   six sections read as one instrument rather than six pages.
   -------------------------------------------------------------------------- */
export function Panel({
  children,
  className = "",
  bodyClassName = "",
}: {
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={`bezel ${className}`}>
      <div className={`bezel-core ${bodyClassName}`}>{children}</div>
    </div>
  );
}

/** Header strip inside a Panel. Carries the instrument's own label and status. */
export function PanelBar({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface-2 px-3 py-2.5">
      <span className="label">{title}</span>
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Figure - a diagram plus the claim it proves. Not a label: a sentence a
   reader can check the diagram against.
   -------------------------------------------------------------------------- */
export function Figure({
  caption,
  children,
  className = "",
}: {
  caption: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={`m-0 ${className}`}>
      {children}
      <figcaption className="mx-auto mt-3.5 max-w-[68ch] px-1 text-sm text-muted">
        {caption}
      </figcaption>
    </figure>
  );
}

/* --------------------------------------------------------------------------
   SpecPanel - the file-level detail, in the same component and the same
   position under every interactive section.
   -------------------------------------------------------------------------- */
export type Spec = {
  algorithm: string;
  year: string;
  authors: string;
  paper: string;
  guarantees: { claim: string; detail: string }[];
  complexity: { metric: string; value: string }[];
  why: string;
  insteadOf: string;
};

export function SpecPanel({ spec }: { spec: Spec }) {
  const [open, setOpen] = useState(false);
  const id = useId();

  return (
    <section
      aria-label={`${spec.algorithm} specification`}
      className="mt-5 overflow-hidden rounded-md border border-line bg-surface-2"
    >
      <h3 className="m-0">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={id}
          className="group flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left transition-colors duration-150 hover:bg-surface-3"
        >
          <span className="label" style={{ color: "var(--accent)" }}>
            Spec
          </span>
          <span
            className="tok"
            style={{ color: "var(--text)", fontWeight: 500 }}
          >
            {spec.algorithm}
          </span>
          <span className="tok" style={{ color: "var(--text-dim)" }}>
            {spec.authors} &middot; {spec.year}
          </span>
          <span className="ml-auto flex items-center gap-2 text-dim">
            <span className="label hidden sm:inline">
              {open ? "Hide" : "Read"}
            </span>
            <CaretDown
              size={14}
              weight="light"
              aria-hidden="true"
              className="transition-transform duration-300"
              style={{
                transform: open ? "rotate(180deg)" : "none",
                transitionTimingFunction: "var(--ease-snap)",
              }}
            />
          </span>
        </button>
      </h3>

      <div className="disclose" data-open={open} id={id}>
        <div>
          <dl className="grid gap-x-8 gap-y-6 border-t border-line px-4 py-5 md:grid-cols-2 xl:grid-cols-4">
            <SpecBlock term="Guarantee">
              <ul className="m-0 list-none space-y-2.5 p-0">
                {spec.guarantees.map((g) => (
                  <li key={g.claim}>
                    <span
                      className="tok block"
                      style={{ color: "var(--text)" }}
                    >
                      {g.claim}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {g.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </SpecBlock>

            <SpecBlock term="Complexity">
              <ul className="m-0 list-none space-y-2 p-0">
                {spec.complexity.map((c) => (
                  <li key={c.metric} className="flex items-baseline gap-3">
                    <span className="text-sm text-muted">{c.metric}</span>
                    <span
                      className="tok ml-auto shrink-0"
                      style={{ color: "var(--accent)" }}
                    >
                      {c.value}
                    </span>
                  </li>
                ))}
              </ul>
            </SpecBlock>

            <SpecBlock term="Origin">
              <p className="text-sm text-muted">
                <span style={{ color: "var(--text)" }}>{spec.authors}</span>,{" "}
                {spec.year}.
              </p>
              <p className="mt-1.5 text-sm italic text-muted">{spec.paper}</p>
            </SpecBlock>

            <SpecBlock term="Why this one">
              <p className="text-sm text-muted">{spec.why}</p>
              <p className="mt-2 text-sm text-dim">
                <span className="label">Instead of </span>
                {spec.insteadOf}
              </p>
            </SpecBlock>
          </dl>
        </div>
      </div>
    </section>
  );
}

function SpecBlock({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div>
      <dt className="label mb-2.5 border-b border-line pb-2">{term}</dt>
      <dd className="m-0">{children}</dd>
    </div>
  );
}

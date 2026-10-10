import type { Metadata } from "next";
import Link from "next/link";
import { Logotype } from "@/components/site/Logo";
import { SECTIONS } from "@/lib/sections";

export const metadata: Metadata = {
  title: "Page not found",
  description:
    "That address does not exist on this site. RelayMesh is a single page; every section is an anchor on it.",
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <main id="main" tabIndex={-1} className="rail flex min-h-[100dvh] flex-col justify-center py-24">
      <Link href="/" className="mb-14 inline-flex w-fit rounded-sm">
        <Logotype markSize={24} />
      </Link>

      <p className="tok" style={{ color: "var(--stop)" }}>
        404
      </p>
      <h1 className="mt-3 max-w-[20ch] text-h2">
        No route to that address.
      </h1>
      <p className="mt-4 max-w-[54ch] text-lead text-muted">
        RelayMesh is one page. Every section below is an anchor on it, so
        nothing is more than one jump away.
      </p>

      <nav aria-label="Sections" className="mt-10">
        <ul className="m-0 grid list-none gap-x-10 p-0 md:grid-cols-2">
          {SECTIONS.map((s, i) => (
            <li key={s.id}>
              <Link
                href={`/#${s.id}`}
                className="group flex items-baseline gap-4 border-t border-line py-3.5 transition-colors duration-150 hover:border-[var(--accent-line)]"
              >
                <span className="tok shrink-0" style={{ color: "var(--text-dim)" }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className="block text-h3 transition-colors duration-150 group-hover:text-accent">
                    {s.label}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">{s.note}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Link href="/" className="ctl ctl-primary mt-10 w-fit">
        Back to the top of the page
      </Link>
    </main>
  );
}

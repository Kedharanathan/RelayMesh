import Link from "next/link";
import { Logotype } from "./Logo";
import { SITE_TAGLINE, STACK } from "@/lib/site";

export function Footer() {
  return (
    <footer className="border-t border-line py-14" style={{ background: "var(--bg-sunken)" }}>
      <div className="rail">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-[42ch]">
            <Logotype markSize={24} />
            <p className="mt-3 text-sm text-muted">{SITE_TAGLINE}</p>
            <p className="mt-1.5 text-sm text-dim">
              Built for the Smart India Hackathon. Everything on this page runs
              in your browser, with no network calls after load.
            </p>
          </div>

          <div>
            <h2 className="label mb-3">Stack</h2>
            <ul className="flex max-w-[34ch] list-none flex-wrap gap-1.5 p-0">
              {STACK.map((s) => (
                <li key={s}>
                  <span className="chip">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-5">
          <p className="tok" style={{ color: "var(--text-dim)" }}>
            RelayMesh
          </p>
          <nav aria-label="Site information" className="flex flex-wrap gap-x-5 gap-y-1">
            <FooterLink href="/privacy/">Privacy</FooterLink>
            <FooterLink href="/terms/">Terms</FooterLink>
            <FooterLink href="/#faq">Questions</FooterLink>
          </nav>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="tok rounded-sm transition-colors duration-150 hover:text-accent"
      style={{ color: "var(--text-dim)" }}
    >
      {children}
    </Link>
  );
}

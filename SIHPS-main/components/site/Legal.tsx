import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { Logotype } from "./Logo";
import { Footer } from "./Footer";

export function LegalShell({
  title,
  standfirst,
  updated,
  children,
}: {
  title: string;
  standfirst: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="rail flex items-center gap-4 py-6">
        <Link href="/" className="rounded-sm">
          <Logotype markSize={24} />
        </Link>
        <Link href="/" className="ctl ml-auto">
          <ArrowLeft size={13} weight="bold" aria-hidden="true" />
          Back
        </Link>
      </header>

      <main id="main" tabIndex={-1} className="rail pb-24 pt-10 md:pt-16">
        <h1 className="max-w-[20ch] text-h2">{title}</h1>
        <p className="mt-4 max-w-[62ch] text-lead text-muted">{standfirst}</p>
        <p className="label mt-5">Last updated {updated}</p>
        <div className="mt-12 max-w-[68ch] border-t border-line pt-2">
          {children}
        </div>
      </main>

      <Footer />
    </>
  );
}

export function Clause({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-line py-7 last:border-b-0">
      <h2 className="text-h3" style={{ fontWeight: 500 }}>
        {heading}
      </h2>
      <div className="mt-3 space-y-3 text-sm text-muted">{children}</div>
    </section>
  );
}

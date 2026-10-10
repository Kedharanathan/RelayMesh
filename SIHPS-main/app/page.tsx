import type { Metadata } from "next";
import { Nav } from "@/components/site/Nav";
import { Footer } from "@/components/site/Footer";
import { Section } from "@/components/site/Section";
import { MeshStage } from "@/components/sim/MeshStage";
import { LamportSim } from "@/components/sim/LamportSim";
import { MutexSim } from "@/components/sim/MutexSim";
import { ContractNetSim } from "@/components/sim/ContractNetSim";
import { FailsafeSim } from "@/components/sim/FailsafeSim";
import { CloudSection } from "@/components/sections/CloudSection";
import { ProvenSection } from "@/components/sections/ProvenSection";
import { LimitsSection } from "@/components/sections/LimitsSection";
import { FaqSection } from "@/components/sections/FaqSection";
import { FAQ } from "@/lib/faq";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: `${SITE_URL}/`,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      inLanguage: "en",
    },
    {
      "@type": "FAQPage",
      "@id": `${SITE_URL}/#faq`,
      mainEntity: FAQ.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};

export default function Home() {
  return (
    <>
      {/* The hero backdrop needs this module as early as possible. Starting it
          at HTML parse rather than at hydration is the single biggest win on
          time-to-first-frame for the 3D scene. Home page only: the legal
          pages have no scene. */}
      <link rel="modulepreload" href="./spline/runtime.js" />

      <span id="top" />
      <Nav />

      <main id="main" tabIndex={-1} className="w-full max-w-full overflow-x-clip">
        {/* Hero and the live mesh share one running simulation. */}
        <MeshStage />

        <Section
          id="clocks"
          title="Ordering events without agreeing on the time"
          lead="Two robots cannot agree what 14:32:07.412 means, and it does not matter. What the fleet needs is to know which event could have caused which, and that is a counting problem rather than a timekeeping one."
          tone="sunken"
        >
          <LamportSim />
        </Section>

        <Section
          id="mutex"
          title="One intersection, scoped coordination, no traffic controller"
          lead="The zone has to be entered by one robot at a time, and the decision has to survive any single robot going quiet. Scoped Ricart-Agrawala bounds negotiation strictly to robots within the conflict envelope (O(k) where k ≪ N), resolving entry between the parties who care using Lamport timestamps."
        >
          <MutexSim />
        </Section>

        <Section
          id="tasks"
          title="When the robot holding the task stops answering"
          lead="Its work does not belong to it any more, and no supervisor exists to notice. The fleet auctions the orphaned task among whoever is close enough to hear about it."
          tone="sunken"
        >
          <ContractNetSim />
        </Section>

        <Section
          id="failsafe"
          title="The stop does not run on the computer"
          lead="Everything above this point is software, and software fails. This is the part of the system that is supposed to still be true when the rest of it is not."
          wide
        >
          <FailsafeSim />
        </Section>

        <CloudSection />
        <ProvenSection />
        <LimitsSection />
        <FaqSection />
      </main>

      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }}
      />
    </>
  );
}

import type { Metadata } from "next";
import { Clause, LegalShell } from "@/components/site/Legal";

export const metadata: Metadata = {
  title: "Terms",
  description:
    "RelayMesh is a student hackathon prototype, documented here. It is not a safety-certified product and must not be operated around people.",
  alternates: { canonical: "/terms/" },
};

export default function Terms() {
  return (
    <LegalShell
      title="What this is, and what it is not"
      standfirst="RelayMesh is a student project built for the Smart India Hackathon. This site documents it. Neither is a commercial product, and the distinction matters more than usual here, because the subject is machine safety."
      updated="24 August 2026"
    >
      <Clause heading="Not a safety-certified system">
        <p>
          The hardware interlock described on this site is modelled on stop
          category 0 from IEC 60204-1, and the reasoning behind it is sound. The
          implementation is not certified, not independently assessed, and built
          from hobby-grade parts.
        </p>
        <p>
          Nothing here should be read as a claim that this prototype is fit to
          operate around people, goods or equipment you care about. The
          limitations section names the specific gaps, including an
          uncertified distance sensor and unauthenticated messages between
          robots. Treat both as blocking issues, because they are.
        </p>
      </Clause>

      <Clause heading="No warranty">
        <p>
          The material on this site is provided as is, without warranty of any
          kind, express or implied. The interactive simulations are teaching
          models of the published algorithms. They are faithful to the rules
          they demonstrate, and they are not the firmware.
        </p>
        <p>
          If you build on any of this, the correctness of your build is yours to
          establish. We are not liable for any loss or damage arising from use
          of this material.
        </p>
      </Clause>

      <Clause heading="The algorithms are not ours">
        <p>
          Lamport logical clocks, Ricart-Agrawala mutual exclusion and the
          Contract Net Protocol are published work by their respective authors,
          cited in full in the spec panel under each section. We implemented
          them. We did not invent them, and the whole argument of this project is
          that not inventing them was the right decision.
        </p>
      </Clause>

      <Clause heading="Using this material">
        <p>
          You are welcome to read, quote and cite this site, including in
          academic or evaluation contexts, with attribution to the project. The
          RelayMesh name and mark identify this team&rsquo;s work, so please do
          not use them to label something we did not build.
        </p>
      </Clause>

      <Clause heading="Changes">
        <p>
          This is a hackathon project, so the system and this page will keep
          changing. The date at the top is the last revision. There is no
          notification mechanism, because there is nobody subscribed to notify.
        </p>
      </Clause>
    </LegalShell>
  );
}

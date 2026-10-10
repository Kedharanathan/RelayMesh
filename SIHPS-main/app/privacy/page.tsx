import type { Metadata } from "next";
import { Clause, LegalShell } from "@/components/site/Legal";

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "RelayMesh collects nothing. No analytics, no cookies, no third-party requests. One browser-local key stores your theme preference.",
  alternates: { canonical: "/privacy/" },
};

export default function Privacy() {
  return (
    <LegalShell
      title="This site collects nothing"
      standfirst="That is not a stance, it is a description of the build. There is no server, no form and no analytics, so there is no mechanism here that could collect anything about you."
      updated="24 August 2026"
    >
      <Clause heading="No analytics and no third-party scripts">
        <p>
          There is no analytics package, tag manager, pixel, embedded video,
          social widget or advertising script on this site. Nothing on the page
          makes a network request to another company after it loads.
        </p>
        <p>
          The typefaces are IBM Plex Sans and IBM Plex Mono, compiled into the
          site at build time and served from the same origin as the page. Your
          browser does not contact a font host to render this text.
        </p>
      </Clause>

      <Clause heading="No cookies">
        <p>
          The site sets no cookies of any kind, so there is no consent banner
          here. A banner that asked permission to set nothing would be theatre.
        </p>
      </Clause>

      <Clause heading="One thing is stored in your browser">
        <p>
          When you use the light and dark toggle, the choice is written to your
          browser&rsquo;s local storage under the key{" "}
          <code className="tok" style={{ color: "var(--accent)" }}>
            rm-theme
          </code>
          . It holds one word, either{" "}
          <code className="tok">light</code> or{" "}
          <code className="tok">dark</code>.
        </p>
        <p>
          It never leaves your device, it is not readable by any other site, and
          it exists only so the page does not flash the wrong theme when you
          come back. Clearing site data in your browser removes it. If storage
          is unavailable, for example in a private window, the site follows your
          operating system setting instead and nothing breaks.
        </p>
      </Clause>

      <Clause heading="Your host still keeps server logs">
        <p>
          This is a static site, so whoever serves it, a static host, a CDN, or
          a laptop on a projector, may keep ordinary web server access logs.
          Those typically record an IP address, a timestamp, the file requested
          and a user agent string.
        </p>
        <p>
          Those logs belong to the host, not to this project, and are governed
          by that host&rsquo;s own policy. We do not read them and have no way
          to correlate them with anything else.
        </p>
      </Clause>

      <Clause heading="Robots on the demo floor">
        <p>
          Worth separating the two things called RelayMesh. The system this site
          documents broadcasts robot telemetry, position, velocity, battery and
          task, between machines on a private local network. That is data about
          robots, not people, it never reaches this website, and the optional
          cloud uplink described in the cloud section is not enabled for
          anything connected to this page.
        </p>
      </Clause>

      <Clause heading="Questions">
        <p>
          There is no contact form here, and we are not going to publish an
          address for a scraper to harvest. If you are reading this as part of a
          hackathon evaluation, reach the team through the channel this link
          arrived on.
        </p>
      </Clause>
    </LegalShell>
  );
}

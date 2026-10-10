/**
 * Deployment identity.
 *
 * SITE_URL is the one value that must change when this is published, because
 * canonical URLs, the sitemap and the social-share tags are all built from it.
 * Set NEXT_PUBLIC_SITE_URL at build time, or edit the fallback below. The
 * fallback uses the reserved .example TLD deliberately, so an unconfigured
 * deploy is obvious rather than quietly pointing at somebody else's domain.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://relaymesh.example"
).replace(/\/$/, "");

export const SITE_NAME = "RelayMesh";

export const SITE_TAGLINE =
  "Decentralized, hardware-fail-safe coordination for warehouse robot fleets.";

export const SITE_DESCRIPTION =
  "Software decides where to go. Hardware decides whether it's safe to move. Lamport clocks, Ricart-Agrawala mutual exclusion and Contract Net task allocation over UDP broadcast, with a motor cut-off that bypasses the processor entirely.";

export const STACK = [
  "Raspberry Pi 4",
  "UDP broadcast",
  "Lamport clocks",
  "Ricart-Agrawala",
  "Contract Net",
  "GPIO interlock",
  "MQTT 5.0",
];

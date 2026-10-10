import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import "../styles/instrument.css";
import {
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TAGLINE,
  SITE_URL,
} from "@/lib/site";

/* Self-hosted at build time, so the demo laptop needs no network. */
const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "RelayMesh - decentralized coordination for warehouse robot fleets",
    template: "%s - RelayMesh",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  alternates: { canonical: "/" },
  keywords: [
    "distributed systems",
    "warehouse robotics",
    "Lamport clocks",
    "Ricart-Agrawala",
    "Contract Net Protocol",
    "hardware fail-safe",
    "Smart India Hackathon",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  openGraph: {
    title: "RelayMesh",
    description: SITE_TAGLINE,
    url: "/",
    siteName: SITE_NAME,
    type: "website",
    locale: "en",
  },
  twitter: {
    card: "summary_large_image",
    title: "RelayMesh",
    description: SITE_TAGLINE,
  },
  formatDetection: { telephone: false, address: false, email: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f8" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0c10" },
  ],
  width: "device-width",
  initialScale: 1,
};

/* Runs before first paint: no theme flash, no layout shift, and motion is
   settled before the first frame of any simulation. */
const BOOT = `(function(){var d=document.documentElement;var t="dark",m="on";try{var s=localStorage.getItem("rm-theme");t=s==="light"||s==="dark"?s:(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light");var n=localStorage.getItem("rm-motion");m=n==="on"||n==="off"?n:(window.matchMedia("(prefers-reduced-motion: reduce)").matches?"off":"on");}catch(e){}d.setAttribute("data-theme",t);d.setAttribute("data-motion",m);})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-theme="dark"
      data-motion="on"
      className={`${plexSans.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      </head>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-sm focus:bg-accent focus:px-4 focus:py-2 focus:text-bg"
          style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-micro)" }}
        >
          Skip to content
        </a>
        {children}
        <div className="grain" aria-hidden="true" />
      </body>
    </html>
  );
}

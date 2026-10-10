/**
 * Source of truth for app/opengraph-image.png.
 *
 * This is NOT a route. It lives outside app/ on purpose: Next's dynamic
 * metadata-image route emits a file with no extension under `output: export`,
 * which generic static hosts then serve as application/octet-stream and social
 * scrapers reject. Shipping a real .png through the static metadata convention
 * avoids that entirely.
 *
 * Regenerate with:  npm run og
 */
export const size = { width: 1200, height: 630 };

const BG = "#0a0c10";
const ACCENT = "#3ddbd9";
const TEXT = "#e8edf2";
const MUTED = "#9ba6b2";
const DIM = "#78838f";
const LINE = "rgba(255,255,255,0.12)";

export function OgMarkup() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        background: BG,
        padding: "68px 72px",
        backgroundImage:
          "linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
          <rect x="2.5" y="8.5" width="7" height="7" rx="1.5" fill={ACCENT} />
          <path
            d="M12 6.3 A 7 7 0 0 1 12 17.7"
            stroke={ACCENT}
            strokeWidth="1.7"
            strokeLinecap="round"
            opacity="0.85"
          />
          <path
            d="M15.4 3.9 A 11 11 0 0 1 15.4 20.1"
            stroke={ACCENT}
            strokeWidth="1.7"
            strokeLinecap="round"
            opacity="0.45"
          />
          <rect x="18" y="3.2" width="3.6" height="3.6" rx="0.9" stroke={ACCENT} strokeWidth="1.3" />
          <rect x="18" y="17.2" width="3.6" height="3.6" rx="0.9" stroke={ACCENT} strokeWidth="1.3" />
        </svg>
        <div style={{ display: "flex", fontSize: 30, color: TEXT, letterSpacing: -0.5 }}>
          <span style={{ fontWeight: 700 }}>Relay</span>
          <span style={{ fontWeight: 400 }}>Mesh</span>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", maxWidth: 960 }}>
        <div
          style={{
            display: "flex",
            fontSize: 62,
            lineHeight: 1.12,
            letterSpacing: -1.8,
            color: TEXT,
            fontWeight: 600,
          }}
        >
          Software decides where to go.
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 62,
            lineHeight: 1.12,
            letterSpacing: -1.8,
            color: MUTED,
            fontWeight: 600,
            marginTop: 4,
          }}
        >
          Hardware decides whether it&rsquo;s safe to move.
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          borderTop: `1px solid ${LINE}`,
          paddingTop: 26,
        }}
      >
        {["LAMPORT 1978", "RICART-AGRAWALA 1981", "CONTRACT NET 1980"].map((t) => (
          <div
            key={t}
            style={{
              display: "flex",
              border: `1px solid ${LINE}`,
              borderRadius: 6,
              padding: "9px 14px",
              fontSize: 19,
              color: DIM,
              letterSpacing: 1.4,
            }}
          >
            {t}
          </div>
        ))}
        <div
          style={{
            display: "flex",
            marginLeft: "auto",
            fontSize: 19,
            color: ACCENT,
            letterSpacing: 1.4,
          }}
        >
          ZERO CLOUD DEPENDENCY
        </div>
      </div>
    </div>
  );
}

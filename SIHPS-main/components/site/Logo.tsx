/**
 * RelayMesh mark.
 *
 * Motif: one node relaying. A filled node on the left emits two concentric
 * broadcast arcs; two unfilled nodes on the right are the receivers. The whole
 * identity is built from this one idea - the arcs reappear as the pulse rings
 * in the mesh canvas, and the node square is the chassis glyph in every diagram.
 */
export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      {/* emitter */}
      <rect x="2.5" y="8.5" width="7" height="7" rx="1.5" fill="currentColor" />
      {/* broadcast arcs */}
      <path
        d="M12.0 6.3 A 7 7 0 0 1 12.0 17.7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M15.4 3.9 A 11 11 0 0 1 15.4 20.1"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        opacity="0.45"
      />
      {/* receivers */}
      <rect
        x="18"
        y="3.2"
        width="3.6"
        height="3.6"
        rx="0.9"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <rect
        x="18"
        y="17.2"
        width="3.6"
        height="3.6"
        rx="0.9"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}

/** Wordmark. Weight contrast carries the split, never a second colour. */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-baseline text-ink ${className}`}
      style={{ letterSpacing: "-0.02em", fontSize: "0.9375rem" }}
    >
      <span style={{ fontWeight: 600 }}>Relay</span>
      <span style={{ fontWeight: 400 }}>Mesh</span>
    </span>
  );
}

export function Logotype({ markSize = 22 }: { markSize?: number }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <span className="text-accent">
        <Mark size={markSize} />
      </span>
      <Wordmark />
    </span>
  );
}

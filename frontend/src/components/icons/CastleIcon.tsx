export function CastleIcon({ className }: { className?: string }) {
  // Transparent-bg white castle: invert in light mode → dark castle; leave as-is in dark mode → white castle
  return <img src="/castle-nav.png" className={`invert dark:invert-0 ${className ?? ""}`} alt="" />
}

export function _CastleIconGeometric({ className }: { className?: string }) {
  const bg = "hsl(var(--background))"

  // viewBox 0 0 64 65
  // Left tower  : x=0–15  (3 merlons, gap=1.5, merlon w=4)
  // Center keep : x=18–46 (3 merlons, gap=2,   merlon w=8)
  // Right tower : x=49–64 (3 merlons, gap=1.5, merlon w=4)
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 65"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      {/* ── LEFT TOWER — 3 merlons, 2 crenels (1:1 ratio) ── */}
      <rect x="0"  y="6" width="3" height="4" rx="0.5" />
      <rect x="6"  y="6" width="3" height="4" rx="0.5" />
      <rect x="12" y="6" width="3" height="4" rx="0.5" />
      <rect x="0"  y="10" width="15" height="22" />

      {/* ── CENTER KEEP — 4 merlons, 3 crenels (1:1 ratio) ─ */}
      <rect x="18" y="0" width="4" height="4" rx="0.5" />
      <rect x="26" y="0" width="4" height="4" rx="0.5" />
      <rect x="34" y="0" width="4" height="4" rx="0.5" />
      <rect x="42" y="0" width="4" height="4" rx="0.5" />
      <rect x="18"  y="4" width="28" height="28" />

      {/* ── RIGHT TOWER — 3 merlons, 2 crenels (1:1 ratio) ─ */}
      <rect x="49" y="6" width="3" height="4" rx="0.5" />
      <rect x="55" y="6" width="3" height="4" rx="0.5" />
      <rect x="61" y="6" width="3" height="4" rx="0.5" />
      <rect x="49"  y="10" width="15" height="22" />

      {/* ── FORECOURT WALL ──────────────────────────────── */}
      <rect x="0" y="32" width="64" height="24" />

      {/* ── HOLES ───────────────────────────────────────── */}
      {/* Left tower lancet window — cx=7.5, r=4 */}
      <path fill={bg} d="M3.5 28 L3.5 20 A4 4 0 0 0 11.5 20 L11.5 28 Z" />
      {/* Center keep lancet window — cx=32, r=5 */}
      <path fill={bg} d="M27 24 L27 16 A5 5 0 0 0 37 16 L37 24 Z" />
      {/* Right tower lancet window — cx=56.5, r=4 */}
      <path fill={bg} d="M52.5 28 L52.5 20 A4 4 0 0 0 60.5 20 L60.5 28 Z" />
      {/* Main gate arch — cx=32, r=8 */}
      <path fill={bg} d="M24 56 L24 42 A8 8 0 0 0 40 42 L40 56 Z" />
      {/* Left flank arch — cx=7.5, r=3.5 */}
      <path fill={bg} d="M4 56 L4 44 A3.5 3.5 0 0 0 11 44 L11 56 Z" />
      {/* Right flank arch — cx=56.5, r=3.5 */}
      <path fill={bg} d="M53 56 L53 44 A3.5 3.5 0 0 0 60 44 L60 56 Z" />

      {/* ── MOAT WAVE ────────────────────────────────────── */}
      <path
        d="M0 60 Q8 58 16 60 Q24 62 32 60 Q40 58 48 60 Q56 62 64 60"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  )
}

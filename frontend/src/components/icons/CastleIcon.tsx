export function CastleIcon({ className }: { className?: string }) {
  // Transparent-bg white castle: invert in light mode → dark castle; leave as-is in dark mode → white castle
  return <img src="/castle-nav.png" className={`invert dark:invert-0 ${className ?? ""}`} alt="" />
}

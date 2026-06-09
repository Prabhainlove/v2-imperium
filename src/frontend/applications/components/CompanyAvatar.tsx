/** Deterministic initial avatar. */
const PALETTE = [
  "hsl(220 70% 50%)",
  "hsl(150 60% 40%)",
  "hsl(280 60% 50%)",
  "hsl(20 70% 50%)",
  "hsl(340 60% 50%)",
  "hsl(190 60% 40%)",
  "hsl(50 60% 45%)",
];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function CompanyAvatar({ company, size = 28 }: { company: string; size?: number }) {
  const safe = (company ?? "?").trim() || "?";
  const initial = safe[0]!.toUpperCase();
  const bg = PALETTE[hash(safe) % PALETTE.length];
  return (
    <span
      className="company-avatar"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.45 }}
      aria-hidden
    >
      {initial}
    </span>
  );
}

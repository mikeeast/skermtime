// Skermtime mascot — a friendly little robot. Fixed brand palette so it reads
// well on both light and dark backgrounds. Size it via `className` (h-/w-).
export function Mascot({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 120 150"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Skermtime-robot"
      className={className}
    >
      <ellipse cx="60" cy="141" rx="34" ry="5" fill="#000000" opacity="0.08" />

      {/* antenna */}
      <circle cx="60" cy="13" r="11" fill="#f59e0b" opacity="0.22" />
      <rect x="58" y="13" width="4" height="15" rx="2" fill="#4f46e5" />
      <circle cx="60" cy="12" r="6" fill="#f59e0b" />
      <circle cx="57.7" cy="9.7" r="2" fill="#fde68a" />

      {/* ears */}
      <circle cx="26" cy="53" r="6" fill="#4f46e5" />
      <circle cx="94" cy="53" r="6" fill="#4f46e5" />

      {/* head */}
      <rect x="28" y="26" width="64" height="50" rx="18" fill="#6366f1" />
      <rect x="35" y="31" width="50" height="9" rx="4.5" fill="#818cf8" opacity="0.6" />

      {/* face screen */}
      <rect x="36" y="35" width="48" height="33" rx="12" fill="#0b1220" />
      <circle cx="51" cy="49" r="9" fill="#67e8f9" opacity="0.25" />
      <circle cx="69" cy="49" r="9" fill="#67e8f9" opacity="0.25" />
      <circle cx="51" cy="49" r="5.5" fill="#67e8f9" />
      <circle cx="69" cy="49" r="5.5" fill="#67e8f9" />
      <circle cx="49.2" cy="47.2" r="1.8" fill="#ffffff" />
      <circle cx="67.2" cy="47.2" r="1.8" fill="#ffffff" />
      <path d="M50 59 Q60 65 70 59" stroke="#67e8f9" strokeWidth="2.5" fill="none" strokeLinecap="round" />

      {/* neck */}
      <rect x="54" y="74" width="12" height="7" rx="2" fill="#4f46e5" />

      {/* left arm */}
      <rect x="20" y="84" width="9" height="24" rx="4.5" fill="#4f46e5" />
      <circle cx="24.5" cy="110" r="5.5" fill="#6366f1" />

      {/* right arm, waving */}
      <g transform="rotate(28 87 84)">
        <rect x="83" y="60" width="9" height="26" rx="4.5" fill="#4f46e5" />
        <circle cx="87.5" cy="60" r="5.5" fill="#6366f1" />
      </g>

      {/* body */}
      <rect x="32" y="80" width="56" height="44" rx="16" fill="#6366f1" />
      <rect x="44" y="89" width="32" height="26" rx="9" fill="#eef2ff" />
      <path d="M55 96 L69 102 L55 108 Z" fill="#6366f1" />

      {/* feet */}
      <rect x="42" y="121" width="14" height="9" rx="4" fill="#4f46e5" />
      <rect x="64" y="121" width="14" height="9" rx="4" fill="#4f46e5" />
    </svg>
  );
}

import { clsx } from 'clsx';

/**
 * Hoot – FindIt's white owl mascot (original artwork, drawn in SVG).
 * mood: 'happy' (default) | 'search' (magnifying glass) | 'cheer' (wings up) | 'sleepy'
 */
export default function Owl({ mood = 'happy', size = 120, className, title = 'Hoot the FindIt owl', bob = false }) {
  const look = mood === 'search' ? 4 : 0; // pupils glance toward the magnifier
  const closed = mood === 'cheer' || mood === 'sleepy';

  return (
    <svg
      viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={title}
      className={clsx('owl', bob && 'owl-bob', className)}
    >
      <title>{title}</title>
      <ellipse cx="100" cy="190" rx="50" ry="7" fill="rgba(13,27,42,0.10)" />

      {/* wings (behind the body) */}
      {mood === 'cheer' ? (
        <>
          <path d="M50 108 Q16 92 18 52 Q44 70 66 96 Z" fill="#EEF2F7" stroke="#CBD5E1" strokeWidth="3" strokeLinejoin="round" />
          <path d="M150 108 Q184 92 182 52 Q156 70 134 96 Z" fill="#EEF2F7" stroke="#CBD5E1" strokeWidth="3" strokeLinejoin="round" />
        </>
      ) : (
        <>
          <path d="M44 104 Q26 146 60 176 Q54 140 64 108 Z" fill="#EEF2F7" stroke="#CBD5E1" strokeWidth="3" strokeLinejoin="round" />
          <path d="M156 104 Q174 146 140 176 Q146 140 136 108 Z" fill="#EEF2F7" stroke="#CBD5E1" strokeWidth="3" strokeLinejoin="round" />
        </>
      )}

      {/* ear tufts */}
      <path d="M54 66 L56 22 L88 50 Z" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="3" strokeLinejoin="round" />
      <path d="M146 66 L144 22 L112 50 Z" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="3" strokeLinejoin="round" />

      {/* body */}
      <ellipse cx="100" cy="112" rx="62" ry="72" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="3" />
      <ellipse cx="100" cy="146" rx="36" ry="32" fill="#F4F6FA" />
      {[[86, 134], [114, 134], [100, 148], [86, 162], [114, 162]].map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x - 7} ${y} Q${x} ${y + 7} ${x + 7} ${y}`} fill="none" stroke="#D5DDE8" strokeWidth="2.5" strokeLinecap="round" />
      ))}

      {/* face */}
      <circle cx="74" cy="88" r="27" fill="#F1F4FA" />
      <circle cx="126" cy="88" r="27" fill="#F1F4FA" />
      <ellipse cx="60" cy="114" rx="8" ry="4" fill="#FBCFE8" opacity="0.8" />
      <ellipse cx="140" cy="114" rx="8" ry="4" fill="#FBCFE8" opacity="0.8" />

      {closed ? (
        <g stroke="#0D1B2A" strokeWidth="5" strokeLinecap="round" fill="none">
          {mood === 'cheer' ? (
            <>
              <path d="M60 92 Q74 76 88 92" />
              <path d="M112 92 Q126 76 140 92" />
            </>
          ) : (
            <>
              <path d="M60 88 Q74 98 88 88" />
              <path d="M112 88 Q126 98 140 88" />
            </>
          )}
        </g>
      ) : (
        <g className="owl-eyes">
          <circle cx="74" cy="88" r="19" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="2" />
          <circle cx="126" cy="88" r="19" fill="#FFFFFF" stroke="#E2E8F0" strokeWidth="2" />
          <circle cx={76 + look} cy="89" r="11" fill="#6D5BD0" />
          <circle cx={128 + look} cy="89" r="11" fill="#6D5BD0" />
          <circle cx={77 + look} cy="90" r="5.5" fill="#0D1B2A" />
          <circle cx={129 + look} cy="90" r="5.5" fill="#0D1B2A" />
          <circle cx={73 + look} cy="85" r="3" fill="#FFFFFF" />
          <circle cx={125 + look} cy="85" r="3" fill="#FFFFFF" />
        </g>
      )}

      {/* beak */}
      <path d="M100 100 L90 110 Q100 124 110 110 Z" fill="#F59E0B" stroke="#D97706" strokeWidth="2" strokeLinejoin="round" />

      {/* feet */}
      <ellipse cx="84" cy="183" rx="11" ry="5" fill="#F59E0B" />
      <ellipse cx="116" cy="183" rx="11" ry="5" fill="#F59E0B" />

      {mood === 'search' && (
        <g>
          <line x1="160" y1="152" x2="180" y2="174" stroke="#0D1B2A" strokeWidth="8" strokeLinecap="round" />
          <circle cx="150" cy="140" r="18" fill="rgba(109,91,208,0.18)" stroke="#0D1B2A" strokeWidth="5" />
          <path d="M141 133 Q145 128 151 128" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" />
        </g>
      )}
      {mood === 'sleepy' && (
        <text x="150" y="40" fontSize="22" fontWeight="800" fill="#8FA3B8" fontFamily="Manrope, sans-serif">z</text>
      )}
    </svg>
  );
}

// A FindIt coin – gold disc with an "F".
export function Coin({ size = 20, className }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="11" fill="#F59E0B" />
      <circle cx="12" cy="12" r="8.5" fill="#FBBF24" stroke="#D97706" strokeWidth="1" />
      <path d="M10 7.5h5v1.8h-3v1.7h2.6v1.8H12v3.7h-2z" fill="#92400E" />
    </svg>
  );
}

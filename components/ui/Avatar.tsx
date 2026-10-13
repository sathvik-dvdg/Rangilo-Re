import type { Gender } from '@/lib/types';
import { avatarColors, cn, initials } from '@/lib/utils';

function FemaleAvatar() {
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="fem-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C2566B" />
          <stop offset="100%" stopColor="#752233" />
        </linearGradient>
        <linearGradient id="fem-veil" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E27387" />
          <stop offset="100%" stopColor="#B23A2E" />
        </linearGradient>
      </defs>
      {/* Background circle with festive gold rim */}
      <circle cx="24" cy="24" r="23" fill="url(#fem-bg)" />
      <circle cx="24" cy="24" r="22.5" fill="none" stroke="#D8A23A" strokeWidth="1" strokeOpacity="0.5" />

      {/* Hair Bun / Ghoomar */}
      <circle cx="24" cy="18" r="9" fill="#1A1410" />
      <circle cx="24" cy="11.5" r="4.2" fill="#1A1410" />

      {/* Gajra (Jasmine flower garland pearls around bun) */}
      <circle cx="20.5" cy="11" r="1.1" fill="#F3EADB" />
      <circle cx="22.2" cy="9.5" r="1.1" fill="#F3EADB" />
      <circle cx="24" cy="9" r="1.2" fill="#F3EADB" />
      <circle cx="25.8" cy="9.5" r="1.1" fill="#F3EADB" />
      <circle cx="27.5" cy="11" r="1.1" fill="#F3EADB" />

      {/* Face & Neck */}
      <path d="M19 19c0 4.2 2.2 7 5 7s5-2.8 5-7c0-1.5-.4-2.8-1-3.8h-8c-.6 1-1 2.3-1 3.8Z" fill="#F5CBA7" />
      <path d="M22 25v3.5h4V25z" fill="#E5B995" />

      {/* Hair strands framing forehead */}
      <path d="M17 15c3.5 1 5.5 4 7 4s3.5-3 7-4c-1.5-2.5-4-4-7-4s-5.5 1.5-7 4Z" fill="#1A1410" />

      {/* Traditional Red Bindi & gold dot */}
      <circle cx="24" cy="17.2" r="1.2" fill="#B23A2E" />
      <circle cx="24" cy="15.5" r="0.6" fill="#D8A23A" />

      {/* Gold Jhumkas (Earrings) */}
      <path d="M17.5 21.5l-1 2h2z" fill="#D8A23A" />
      <circle cx="17.5" cy="24" r="0.6" fill="#D8A23A" />
      <path d="M30.5 21.5l-1 2h2z" fill="#D8A23A" />
      <circle cx="30.5" cy="24" r="0.6" fill="#D8A23A" />

      {/* Blouse / Choli & Odhni (Dupatta drape) */}
      <path d="M14 43c0-7 4.5-12 10-12s10 5 10 12Z" fill="#B23A2E" />
      <path d="M14 43c2-7 7-11 12-11 2 0 4 .5 6 1.5-3 2-6 5.5-7 9.5Z" fill="url(#fem-veil)" />
      <path d="M16 43c2-6 6-9.5 10-9.5" fill="none" stroke="#D8A23A" strokeWidth="1.2" strokeLinecap="round" />
      {/* Necklace (Haar) */}
      <path d="M20.5 28.5c1.5 1.8 5.5 1.8 7 0" fill="none" stroke="#D8A23A" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}

function MaleAvatar() {
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="male-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2F4B6E" />
          <stop offset="100%" stopColor="#152438" />
        </linearGradient>
        <linearGradient id="turban-gold" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E9B852" />
          <stop offset="100%" stopColor="#B23A2E" />
        </linearGradient>
      </defs>
      {/* Background circle with festive gold rim */}
      <circle cx="24" cy="24" r="23" fill="url(#male-bg)" />
      <circle cx="24" cy="24" r="22.5" fill="none" stroke="#D8A23A" strokeWidth="1" strokeOpacity="0.5" />

      {/* Face & Neck */}
      <path d="M18.5 19c0 4.8 2.5 8 5.5 8s5.5-3.2 5.5-8v-3h-11v3Z" fill="#F5CBA7" />
      <path d="M21.5 26v4h5v-4z" fill="#E5B995" />

      {/* Ears */}
      <circle cx="18" cy="21" r="1.6" fill="#F5CBA7" />
      <circle cx="30" cy="21" r="1.6" fill="#F5CBA7" />

      {/* Traditional Garba Pagdi / Turban */}
      <path d="M15 15.5c0-4.5 4-8.5 9-8.5s9 4 9 8.5c-2.5-1.5-6-2.5-9-2.5s-6.5 1-9 2.5Z" fill="#B23A2E" />
      {/* Turban Folds / Swirl */}
      <path d="M14 16c2-4 6.5-6.5 12-6 4 .4 7 2.5 8 5.5-2.5-1.8-6.5-3-10-3-4.5 0-8 1.5-10 3.5Z" fill="url(#turban-gold)" />
      <path d="M16 16.5c2.5-2.2 5.5-3.2 9-3.2 3.5 0 6.5 1 8.5 2.8" fill="none" stroke="#D8A23A" strokeWidth="1" />

      {/* Turban Brooch (Kalgi Jewel) */}
      <circle cx="24" cy="9.5" r="1.4" fill="#D8A23A" />
      <circle cx="24" cy="9.5" r="0.7" fill="#B23A2E" />

      {/* Tilak on Forehead */}
      <path d="M23.5 16h1v3h-1z" fill="#B23A2E" />
      <circle cx="24" cy="19.8" r="0.6" fill="#D8A23A" />

      {/* Kedia (Traditional Garba jacket) */}
      <path d="M13 43c0-7.5 4.8-12 11-12s11 4.5 11 12Z" fill="#231B15" />
      {/* Angrakha Cross-Collar Fold */}
      <path d="M20 31l7 12h-6l-4-9Z" fill="#B23A2E" />
      <path d="M18 31l8 12" fill="none" stroke="#D8A23A" strokeWidth="1.2" strokeLinecap="round" />
      {/* Gold embroidery accents */}
      <circle cx="20" cy="38" r="0.9" fill="#D8A23A" />
      <circle cx="28" cy="38" r="0.9" fill="#D8A23A" />
    </svg>
  );
}

function FestiveAvatar() {
  return (
    <svg viewBox="0 0 48 48" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="oth-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6B7A3A" />
          <stop offset="100%" stopColor="#303A16" />
        </linearGradient>
      </defs>
      {/* Background circle with gold rim */}
      <circle cx="24" cy="24" r="23" fill="url(#oth-bg)" />
      <circle cx="24" cy="24" r="22.5" fill="none" stroke="#D8A23A" strokeWidth="1" strokeOpacity="0.5" />

      {/* Crossed Dandiya Sticks */}
      <path d="M13 35l22-22" stroke="#F3EADB" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M13 35l22-22" stroke="#B23A2E" strokeWidth="2.8" strokeDasharray="3 3" strokeLinecap="round" />

      <path d="M35 35L13 13" stroke="#D8A23A" strokeWidth="2.8" strokeLinecap="round" />
      <path d="M35 35L13 13" stroke="#2F4B6E" strokeWidth="2.8" strokeDasharray="3 3" strokeLinecap="round" />

      {/* Center Diya Spark */}
      <circle cx="24" cy="24" r="4.5" fill="#1A1410" />
      <circle cx="24" cy="24" r="3.2" fill="#D8A23A" />
      <circle cx="24" cy="24" r="1.6" fill="#B23A2E" />
    </svg>
  );
}

/**
 * Festive Garba Avatar.
 * Shows a distinctive traditional Male or Female Garba avatar based on gender,
 * with neutral Dandiya/Diya for 'other', and split-tone initials as a fallback.
 */
export function Avatar({
  name,
  gender,
  size = 48,
  online,
  imageUrl,
  className,
}: {
  name: string;
  gender?: Gender;
  size?: number;
  online?: boolean;
  /** A dancer's real photo. Pass it only where they have agreed to share it (ID-001). */
  imageUrl?: string | null;
  className?: string;
}) {
  const [a, b] = avatarColors(name);

  return (
    <div className={cn('relative shrink-0 overflow-visible', className)} style={{ width: size, height: size }}>
      <div className="h-full w-full overflow-hidden rounded-full shadow-sm">
        {imageUrl ? (
          // A plain <img>: the photo is served by Clerk, and no-referrer keeps this page's URL (which holds user ids) out of that request.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-full w-full object-cover" />
        ) : gender === 'female' ? (
          <FemaleAvatar />
        ) : gender === 'male' ? (
          <MaleAvatar />
        ) : gender === 'other' ? (
          <FestiveAvatar />
        ) : (
          <div
            className="flex h-full w-full items-center justify-center font-display font-semibold text-paper"
            style={{ background: `linear-gradient(135deg, ${a} 0 50%, ${b} 50% 100%)`, fontSize: size * 0.36 }}
          >
            {initials(name)}
          </div>
        )}
      </div>

      {online !== undefined && (
        <span
          className={cn(
            'absolute bottom-0 right-0 block rounded-full border-2 border-ink',
            online ? 'bg-[#7FB069]' : 'bg-paper/30',
          )}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}

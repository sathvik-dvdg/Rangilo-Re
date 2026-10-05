import { avatarColors, cn, initials } from '@/lib/utils';

/** Initials on a two-tone split — never a real photo, for privacy. */
export function Avatar({ name, size = 48, online, className }: { name: string; size?: number; online?: boolean; className?: string }) {
  const [a, b] = avatarColors(name);
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <div
        className="flex h-full w-full items-center justify-center rounded-full font-display font-semibold text-paper"
        style={{ background: `linear-gradient(135deg, ${a} 0 50%, ${b} 50% 100%)`, fontSize: size * 0.36 }}
      >
        {initials(name)}
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

import { cn } from '@/lib/utils';
import type { Gender } from '@/lib/types';

const styles: Record<Gender, string> = {
  female: 'bg-gulal/15 text-[#E7A0AC] border-gulal/40',
  male: 'bg-neel/25 text-[#9DB6D6] border-neel-light/40',
  other: 'bg-mehndi/20 text-[#C3CC94] border-mehndi/50',
};

const labels: Record<Gender, string> = { female: 'Female', male: 'Male', other: 'Other' };

export function GenderBadge({ gender, className }: { gender: Gender; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider',
        styles[gender],
        className,
      )}
    >
      {labels[gender]}
    </span>
  );
}

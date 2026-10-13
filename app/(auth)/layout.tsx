import Link from 'next/link';
import { Mark } from '@/components/ui/Mark';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="grain bandhani flex min-h-[100dvh] flex-col items-center justify-center gap-8 px-4 py-12">
      <Link href="/" className="flex h-11 items-center gap-3 font-display text-xl tracking-wide text-haldi">
        <Mark className="h-7 w-7" />
        GarbaConnect
      </Link>
      {children}
    </main>
  );
}

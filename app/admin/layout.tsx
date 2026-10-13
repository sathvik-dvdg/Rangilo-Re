import type { Metadata } from 'next';
import Link from 'next/link';
import { Shield } from 'lucide-react';
import { requireAdmin } from '@/lib/admin';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Admin | GarbaConnect', robots: { index: false, follow: false } };

const NAV = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/users', label: 'Dancers' },
  { href: '/admin/rooms', label: 'Rooms' },
];

/** Admin console shell (ADMIN-001). The pages and actions each check the admin again; this is not the only gate. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();

  return (
    <div className="min-h-[100dvh] bg-ink text-paper">
      <header className="stitch-b bg-ink-2">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-kumkum text-paper">
              <Shield className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h1 className="font-display text-lg text-haldi">GarbaConnect Admin</h1>
              <p className="text-xs text-paper/55">Everything done here is recorded.</p>
            </div>
          </div>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-semibold">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="text-paper/70 transition-colors hover:text-haldi">
                {item.label}
              </Link>
            ))}
            <Link href="/dashboard" className="rounded border border-paper/20 px-3 py-1.5 text-xs text-paper transition-colors hover:border-haldi hover:text-haldi">
              Back to the app →
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}

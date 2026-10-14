import Link from 'next/link';

/** Shared by the Terms, Privacy and Refund pages so the three stay identical in layout. */

export const SUPPORT_EMAIL = 'teamgarbaconnect@gmail.com';
export const LAST_UPDATED = 'October 2026';

export function PolicyPage({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    // pt clears the fixed navbar from the (main) layout.
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-24 sm:px-6 sm:pt-28">
      <Link href="/" className="inline-flex h-11 items-center text-sm text-paper/60 hover:text-haldi">
        ← Back to home
      </Link>

      <p className="mt-6 text-xs font-bold uppercase tracking-[0.25em] text-haldi">{eyebrow}</p>
      <h1 className="mt-4 font-display text-4xl font-semibold leading-tight md:text-5xl">{title}</h1>
      <p className="mt-3 text-sm text-paper/50">Last updated: {LAST_UPDATED}</p>

      <div className="mt-10 space-y-10">{children}</div>
    </main>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold text-haldi">{title}</h2>
      <div className="mt-2 space-y-3 leading-relaxed text-paper/70">{children}</div>
    </section>
  );
}

export function SupportEmail() {
  return (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="break-words text-haldi underline underline-offset-4">
      {SUPPORT_EMAIL}
    </a>
  );
}

/** A link to another policy page, styled like the support email. */
export function PolicyLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-haldi underline underline-offset-4">
      {children}
    </Link>
  );
}

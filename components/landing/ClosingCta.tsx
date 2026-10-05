import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { Mark } from '@/components/ui/Mark';

export function ClosingCta() {
  return (
    <>
      <section className="bg-haldi py-24 text-ink">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-8 px-4 sm:px-6 md:flex-row md:items-end md:justify-between">
          <h2 className="max-w-xl font-display text-4xl font-semibold leading-tight md:text-6xl">The aarti starts at nine. Get your nickname now.</h2>
          <Link href="/sign-up" className={buttonVariants({ size: 'lg', className: 'bg-ink text-paper hover:bg-ink-3' })}>
            Join Navratri
          </Link>
        </div>
      </section>
      <footer className="bg-ink py-10 text-sm text-paper/50">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="flex items-center gap-2 font-display text-paper/80">
            <Mark className="h-5 w-5" /> GarbaConnect
          </p>
          <p>Payments by Razorpay. Be kind on the floor and in the chat.</p>
        </div>
      </footer>
    </>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Refund Policy — GarbaConnect',
  description: 'What the ₹29 payment buys, when it is refunded and how to reach us.',
};

const SUPPORT_EMAIL = 'teamgarbaconnect@gmail.com';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-semibold text-haldi">{title}</h2>
      <div className="mt-2 space-y-3 leading-relaxed text-paper/70">{children}</div>
    </section>
  );
}

function SupportEmail() {
  return (
    <a href={`mailto:${SUPPORT_EMAIL}`} className="break-words text-haldi underline underline-offset-4">
      {SUPPORT_EMAIL}
    </a>
  );
}

export default function RefundPolicyPage() {
  return (
    // pt clears the fixed navbar from the (main) layout.
    <main className="mx-auto max-w-2xl px-4 pb-20 pt-24 sm:px-6 sm:pt-28">
      <Link href="/" className="inline-flex h-11 items-center text-sm text-paper/60 hover:text-haldi">
        ← Back to home
      </Link>

      <p className="mt-6 text-xs font-bold uppercase tracking-[0.25em] text-haldi">Payments</p>
      <h1 className="mt-4 font-display text-4xl font-semibold leading-tight md:text-5xl">Refund Policy</h1>
      <p className="mt-3 text-sm text-paper/50">Last updated: October 2026</p>

      <div className="mt-10 space-y-10">
        <Section title="What you're paying for">
          <p>₹29 is a single payment for two things with one dance partner:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong className="text-paper">Unlimited chat.</strong> The time limit on your chat with them is removed as soon as your payment is
              confirmed.
            </li>
            <li>
              <strong className="text-paper">A request to share contact details.</strong> They are asked whether they agree. Only if they accept do
              you each see the other&apos;s real name and email, so yours is shared with them too.
            </li>
          </ul>
          <p>Nothing is shared without their consent, and paying does not replace it.</p>
        </Section>

        <Section title="No refunds once the chat is unlocked">
          <p>Because this is a digital purchase delivered instantly, we do not offer refunds once the unlimited chat has been unlocked.</p>
          <p>
            That includes when your partner declines to share contact details, or does not answer within 24 hours: you keep the unlimited chat, and
            only the contact details were declined.
          </p>
        </Section>

        <Section title="If you paid and got nothing">
          <p>
            If payment was deducted but the chat did not unlock, email <SupportEmail /> within 48 hours with your payment ID or the date and time of
            payment. We will refund in full.
          </p>
        </Section>

        <Section title="No recurring charges">
          <p>Every payment is one-time. No subscriptions, no automatic charges.</p>
        </Section>

        <Section title="Contact">
          <p>
            <SupportEmail /> — for payment questions or refund requests.
          </p>
        </Section>
      </div>
    </main>
  );
}

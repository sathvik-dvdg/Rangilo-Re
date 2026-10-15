import type { Metadata } from 'next';
import { isBillingEnabled } from '@/lib/billing';
import { PolicyPage, Section, SupportEmail } from '@/components/legal/Policy';

export const metadata: Metadata = {
  title: 'Refund Policy — GarbaConnect',
  description: 'When a payment is refunded and how to reach us.',
};

/** The paid terms are published only in effective Paid Mode (FREE-003); otherwise the page says nothing is charged. */
export default function RefundPolicyPage() {
  if (!isBillingEnabled()) {
    return (
      <PolicyPage eyebrow="Payments" title="Refund Policy">
        <Section title="GarbaConnect is free">
          <p>We do not take any payments at the moment, so there is nothing to refund.</p>
        </Section>

        <Section title="Contact">
          <p>
            <SupportEmail /> — for any questions.
          </p>
        </Section>
      </PolicyPage>
    );
  }
  return (
    <PolicyPage eyebrow="Payments" title="Refund Policy">
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
    </PolicyPage>
  );
}

import type { Metadata } from 'next';
import { isBillingEnabled } from '@/lib/billing';
import { PolicyLink, PolicyPage, Section, SupportEmail } from '@/components/legal/Policy';

export const metadata: Metadata = {
  title: 'Terms of Service — GarbaConnect',
  description: 'The rules for using GarbaConnect: who can use it, how to behave and how to reach us.',
};

/** The Payments and Refunds sections appear only in effective Paid Mode (FREE-003, PRIV-006). */
export default function TermsPage() {
  const billing = isBillingEnabled();
  return (
    <PolicyPage eyebrow="Legal" title="Terms of Service">
      <Section title="Acceptance of these terms">
        <p>
          By creating an account or using GarbaConnect, you agree to these terms. If you do not agree, please do not use the service. If we change
          them, we will update the date at the top of this page.
        </p>
      </Section>

      <Section title="What GarbaConnect is">
        <p>
          GarbaConnect helps people at Navratri garba events find a dance partner. You appear to other dancers under a nickname, can see who is on
          the floor, and can open a private chat with one other dancer at a time.
        </p>
        <p>Your real name and email are never shown to other dancers unless you agree to share them{billing && ' (see Payments below)'}.</p>
      </Section>

      <Section title="Who can use it">
        <ul className="list-disc space-y-2 pl-5">
          <li>You must be 18 or older.</li>
          <li>You must be attending, or planning to attend, a garba event.</li>
          <li>One account per person, used only by you.</li>
        </ul>
      </Section>

      <Section title="How you must behave">
        <ul className="list-disc space-y-2 pl-5">
          <li>No harassment, threats, hate speech, or sexual messages to anyone who has not welcomed them.</li>
          <li>Give your real name and an email you use. Do not pretend to be someone else.</li>
          <li>Do not share another dancer&apos;s name, email or messages without their permission.</li>
          <li>No spam, advertising or selling, and no attempts to get at other people&apos;s data or break the service.</li>
          <li>Take care when you meet: meet at the event, in public.</li>
        </ul>
      </Section>

      {billing && (
        <>
          <Section title="Payments">
            <p>
              When payments are available, ₹29 is a one-time payment for one chat. It removes the time limit on that chat as soon as the payment is
              confirmed, and asks the other dancer whether they agree to share contact details. Only if they accept do you each see the other&apos;s real
              name and email. Paying never replaces their consent.
            </p>
            <p>Payments are processed by Razorpay. There are no subscriptions and no recurring charges.</p>
          </Section>

          <Section title="Refunds">
            <p>
              When a payment can be refunded is set out in our <PolicyLink href="/refund-policy">Refund Policy</PolicyLink>.
            </p>
          </Section>
        </>
      )}

      <Section title="Privacy">
        <p>
          What we collect, who can see it and how to have it deleted is set out in our <PolicyLink href="/privacy">Privacy Policy</PolicyLink>.
        </p>
      </Section>

      <Section title="Suspension and termination">
        <p>
          We may suspend or remove an account, or close a chat, if we believe it breaks these terms or puts anyone at risk, without notice. You can
          stop using GarbaConnect at any time and ask us to delete your account.
        </p>
      </Section>

      <Section title="Limitation of liability">
        <p>
          GarbaConnect is provided as it is, without guarantees that it will always be available or free of errors. We do not verify who users are,
          and we are not responsible for what other users say or do, in the app or when you meet them.
        </p>
        <p>
          To the extent the law allows, we are not liable for indirect or consequential loss, and our total liability to you is limited to the amount
          you paid us, if any, for the feature concerned.
        </p>
      </Section>

      <Section title="Contact">
        <p>
          <SupportEmail /> — for questions about these terms or to report a user.
        </p>
      </Section>
    </PolicyPage>
  );
}

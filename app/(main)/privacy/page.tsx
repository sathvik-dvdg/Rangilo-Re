import type { Metadata } from 'next';
import { isBillingEnabled } from '@/lib/billing';
import { PolicyLink, PolicyPage, Section, SupportEmail } from '@/components/legal/Policy';

export const metadata: Metadata = {
  title: 'Privacy Policy — GarbaConnect',
  description: 'What GarbaConnect collects, who can see it, who we share it with, and how to have it deleted.',
};

/**
 * Must match what the app actually stores and shows (PRIV-006). If a field is
 * added to onboarding, or a new service receives data, update this page too.
 * Payment data and Razorpay are named only in effective Paid Mode (FREE-003).
 */
export default function PrivacyPage() {
  const billing = isBillingEnabled();
  return (
    <PolicyPage eyebrow="Legal" title="Privacy Policy">
      <Section title="What we collect">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-paper">Your account:</strong> your real name and email, taken from your sign-in account (Clerk) and editable when
            you set up your profile, and a profile photo if you upload one.
          </li>
          <li>
            <strong className="text-paper">Your profile:</strong> your nickname, gender, branch and year, and, if you add them, a vibe tag, a hint
            about your outfit and your Instagram handle.
          </li>
          <li>
            <strong className="text-paper">Your activity:</strong> your chat messages and whether they have been read, when you were last online,
            and whether you are in a chat right now.
          </li>
          <li>
            <strong className="text-paper">Notifications:</strong> if you turn them on, the address your browser gives us for sending them.
          </li>
          <li>
            <strong className="text-paper">Blocks:</strong> who you have blocked. Nobody, including the person you block, is told who blocked them.
          </li>
          <li>
            <strong className="text-paper">Reports:</strong> reports you send about another dancer, with the reason you give. Our team reads them;
            the person you report is not told who reported them.
          </li>
          {billing && (
            <li>
              <strong className="text-paper">Payments:</strong> order IDs, amounts and payment status (see Payment data below).
            </li>
          )}
        </ul>
      </Section>

      <Section title="How we use it">
        <p>
          To show you other dancers and show you to them, to run your chats and notify you of new messages,
          {billing && ' to process payments through Razorpay,'} and to keep the service safe, including investigating reports of misuse.
        </p>
      </Section>

      <Section title="Who can see what">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-paper">Other dancers</strong> see your nickname, gender, branch and year, vibe tag, outfit hint and whether you
            are online. Your messages are seen only by the one person you are chatting with.
          </li>
          <li>
            <strong className="text-paper">Your real name and email</strong> are shared with another dancer only after mutual consent through the
            connect feature: one of you asks, and only if the other accepts do you each see the other&apos;s. Before that, nobody sees them. A name
            and photo you agreed to share earlier, when that option existed, stays visible to the person you shared it with.
          </li>
          <li>
            <strong className="text-paper">Your Instagram handle</strong> is not shown to anyone.
          </li>
          <li>
            <strong className="text-paper">Our administrators</strong> can see real names and emails in order to deal with reports and misconduct.
            Every time they do, it is recorded.
          </li>
        </ul>
      </Section>

      {billing && (
        <Section title="Payment data">
          <p>
            Payments are handled by Razorpay. We never see or store your card, UPI or bank details. We store only the order ID, the payment ID, the
            amount and whether the payment succeeded, and we keep these records even after an account is deleted, as needed for accounting and
            refunds.
          </p>
        </Section>
      )}

      <Section title="How long we keep it">
        <p>
          Your profile and messages are kept while your account is active. If you ask us to delete your account, we remove your profile, your chats
          and their messages.
        </p>
      </Section>

      <Section title="Services we use">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-paper">Vercel</strong>, which hosts the app and counts page visits (which pages are viewed, and the
            country, device type and browser). It uses no cookies and does not identify you.
          </li>
          <li>
            <strong className="text-paper">Clerk</strong>, for sign-in and your account, including your profile photo.
          </li>
          <li>
            <strong className="text-paper">Supabase</strong>, for our database, where your profile{billing ? ', messages and payment records are' : ' and messages are'}{' '}
            stored.
          </li>
          {billing && (
            <li>
              <strong className="text-paper">Razorpay</strong>, for payments.
            </li>
          )}
          <li>
            <strong className="text-paper">Your browser&apos;s push service</strong> (from Google, Mozilla, Apple or Microsoft, depending on your
            browser), if you turn on notifications. A notification carries a nickname and a link, never the text of a message.
          </li>
        </ul>
        <p>We do not sell your data or use it for advertising.</p>
      </Section>

      <Section title="Your rights">
        <p>
          You can see and edit your profile at any time. To have your account and data deleted, or to ask what we hold about you, email{' '}
          <SupportEmail /> from the email on your account.
        </p>
        {billing ? (
          <p>
            For how payments and refunds work, see our <PolicyLink href="/refund-policy">Refund Policy</PolicyLink> and{' '}
            <PolicyLink href="/terms">Terms of Service</PolicyLink>.
          </p>
        ) : (
          <p>
            See also our <PolicyLink href="/terms">Terms of Service</PolicyLink>.
          </p>
        )}
      </Section>

      <Section title="Contact">
        <p>
          <SupportEmail /> — for privacy questions and deletion requests.
        </p>
      </Section>
    </PolicyPage>
  );
}

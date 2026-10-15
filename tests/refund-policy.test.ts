/**
 * The published refund policy (DEC-007, GATE-004) describes the paid product
 * as built (DEC-002 as revised 2026-10-14): ₹29 removes the chat's time limit
 * as soon as payment is confirmed, and asks the partner to share contact
 * details. A decline, or no answer, is NOT refunded: the unlimited chat was
 * delivered. The only refund is for a payment that did not unlock the chat.
 * The page must say that payment never replaces the partner's consent (ID-001).
 *
 * This checks the published text. tests/consent-flow.test.ts and
 * tests/payment-routes.test.ts check that the code does what it says.
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import RefundPolicyPage from '@/app/(main)/refund-policy/page';
import { inMode } from './helpers/billingMode';
import { ClosingCta } from '@/components/landing/ClosingCta';
import { FeaturesReveal } from '@/components/landing/FeaturesReveal';
import { ConnectModal } from '@/components/modals/ConnectModal';
import { PRICE_PAISE } from '@/lib/room';

// The paid terms are published only in effective Paid Mode; tests/legal-pages.test.ts covers Free Mode.
describe('refund policy page (Paid Mode)', () => {
  const html = inMode('paid', () => renderToStaticMarkup(RefundPolicyPage())).replace(/\s+/g, ' ');

  it('states the price the server charges and the two things it pays for', () => {
    expect(html).toContain(`₹${PRICE_PAISE / 100}`);
    expect(html).toMatch(/single payment/);
    expect(html).toMatch(/Unlimited chat\./);
    expect(html).toMatch(/removed as soon as your payment is confirmed/);
    expect(html).toMatch(/A request to share contact details\./);
    expect(html).toMatch(/real name and email/);
    expect(html).not.toMatch(/Gmail/);
  });

  it('says details are shared only if the partner accepts, and that paying does not replace their consent', () => {
    expect(html).toMatch(/Only if they accept do you each see/);
    expect(html).toMatch(/Nothing is shared without their consent, and paying does not replace it/);
    expect(html).toMatch(/yours is shared with them too/);
  });

  it('a decline or no answer is not refunded: the unlimited chat was granted', () => {
    expect(html).toMatch(/do not offer refunds once the unlimited chat has been unlocked/);
    expect(html).toMatch(/That includes when your partner declines to share contact details, or does not answer within 24 hours/);
    expect(html).toMatch(/you keep the unlimited chat, and only the contact details were declined/);
    // Nothing on the page promises money back for a decline.
    expect(html).not.toMatch(/refund the ₹29|you are refunded|we refund/i);
  });

  it('the only refund is for a payment that did not unlock the chat', () => {
    expect(html).toMatch(/If payment was deducted but the chat did not unlock, email/);
    expect(html).toMatch(/within 48 hours with your payment ID or the date and time of payment\. We will refund in full\./);
    expect(html.match(/refund in full/g)).toHaveLength(1);
  });

  it('states that charges are one-time, the support address and the date', () => {
    expect(html).toMatch(/one-time/);
    expect(html).toContain('mailto:teamgarbaconnect@gmail.com');
    expect(html).toContain('Last updated: October 2026');
    expect(html).toContain('href="/"');
  });
});

describe('links to the refund policy', () => {
  it('landing footer, in Paid Mode', () => {
    expect(inMode('paid', () => renderToStaticMarkup(ClosingCta()))).toContain('href="/refund-policy"');
  });

  it('checkout sheet, in a new tab (PAY-016)', () => {
    const html = renderToStaticMarkup(
      createElement(ConnectModal, { open: true, onClose: () => {}, onPay: () => {}, busy: false, error: null, partnerName: 'Arjun' }),
    );
    // The sheet and the policy describe the same product (PAY-016).
    expect(html).toContain('Connect with Arjun');
    expect(html).toMatch(/This chat opens with no time limit as soon as you pay/);
    expect(html).toMatch(/Arjun is asked to share contact details/);
    expect(html).toMatch(/real name and email/);
    expect(html).toMatch(/nothing is shared unless they accept/);
    expect(html).toMatch(/your own real name and email are shared with them too/);
    expect(html).toMatch(/the chat stays open and there is no refund/);
    expect(html).not.toMatch(/you are refunded/);
    expect(html).toMatch(/By paying you agree to our/);
    expect(html).toMatch(/<a[^>]*href="\/refund-policy"[^>]*>Refund Policy<\/a>/);
    expect(html).toMatch(/<a[^>]*target="_blank"[^>]*>Refund Policy<\/a>/);
  });
});

describe('landing features (FREE-003)', () => {
  it('make no paid claim', () => {
    const html = renderToStaticMarkup(createElement(FeaturesReveal));
    expect(html).not.toMatch(/₹|Razorpay|Unlock|\bPa(y|id)\b/i);
  });
});

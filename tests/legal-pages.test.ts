/**
 * GATE-004: Terms of Service and Privacy Policy are published, link to each
 * other and to the Refund Policy, and are linked from the footer and from
 * checkout. The privacy text must match what the app stores and shows
 * (PRIV-006): every field onboarding collects is named, and so is admin access.
 * Payment terms, payment data and Razorpay appear only in effective Paid Mode
 * (FREE-003); in Free Mode the pages make no payment claim.
 * This checks the published text only; it is not a legal review (GATE-008).
 */
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { inMode } from './helpers/billingMode';
import TermsPage from '@/app/(main)/terms/page';
import PrivacyPage from '@/app/(main)/privacy/page';
import RefundPolicyPage from '@/app/(main)/refund-policy/page';
import { ClosingCta } from '@/components/landing/ClosingCta';
import { ConnectModal } from '@/components/modals/ConnectModal';

const render = (el: React.ReactElement) => renderToStaticMarkup(el).replace(/\s+/g, ' ');
const terms = inMode('paid', () => render(TermsPage()));
const privacy = inMode('paid', () => render(PrivacyPage()));
const freeTerms = inMode('free', () => render(TermsPage()));
const freePrivacy = inMode('free', () => render(PrivacyPage()));
const link = (href: string) => new RegExp(`<a[^>]*href="${href}"`);

describe('all three policy pages share one layout', () => {
  it.each([
    ['Terms of Service', 'Terms of Service', terms],
    ['Privacy Policy', 'Privacy Policy', privacy],
    ['Refund Policy', 'Refund Policy', inMode('paid', () => render(RefundPolicyPage()))],
    ['Refund Policy (Free Mode)', 'Refund Policy', inMode('free', () => render(RefundPolicyPage()))],
  ])('%s: title, date, back link and support address', (_page, title, html) => {
    expect(html).toContain(`>${title}</h1>`);
    expect(html).toContain('Last updated: October 2026');
    expect(html).toMatch(link('/'));
    expect(html).toContain('mailto:teamgarbaconnect@gmail.com');
  });
});

describe('Terms of Service', () => {
  it('has every required section', () => {
    for (const heading of [
      'Acceptance of these terms',
      'What GarbaConnect is',
      'Who can use it',
      'How you must behave',
      'Payments',
      'Refunds',
      'Privacy',
      'Suspension and termination',
      'Limitation of liability',
      'Contact',
    ]) {
      expect(terms).toContain(`>${heading}</h2>`);
    }
  });

  it('states the 18+ rule (DEC-005) and the event requirement', () => {
    expect(terms).toMatch(/You must be 18 or older/);
    expect(terms).toMatch(/attending, or planning to attend, a garba event/);
  });

  it('describes the payment as the code delivers it, with consent and no recurring charges', () => {
    expect(terms).toMatch(/₹29 is a one-time payment for one chat/);
    expect(terms).toMatch(/removes the time limit on that chat/);
    expect(terms).toMatch(/Only if they accept do you each see the other&#x27;s real name and email/);
    expect(terms).toMatch(/Paying never replaces their consent/);
    expect(terms).toMatch(/no recurring charges/);
  });

  it('links to the Refund Policy and the Privacy Policy', () => {
    expect(terms).toMatch(link('/refund-policy'));
    expect(terms).toMatch(link('/privacy'));
  });
});

describe('Privacy Policy', () => {
  it('has every required section', () => {
    for (const heading of ['What we collect', 'How we use it', 'Who can see what', 'Payment data', 'How long we keep it', 'Services we use', 'Your rights', 'Contact']) {
      expect(privacy).toContain(`>${heading}</h2>`);
    }
  });

  it('names everything onboarding and the app collect, not just name and email (PRIV-006)', () => {
    for (const field of ['real name', 'email', 'profile photo', 'nickname', 'gender', 'branch and year', 'vibe tag', 'outfit', 'Instagram handle', 'chat messages', 'last online', 'notifications', 'who you have blocked', 'reports you send']) {
      expect(privacy).toContain(field);
    }
  });

  it('says real name and email are shared only after mutual consent, and discloses admin access (DEC-011)', () => {
    expect(privacy).toMatch(/shared with another dancer only after mutual consent through the connect feature/);
    expect(privacy).toMatch(/Our administrators<\/strong> can see real names and emails/);
    expect(privacy).toMatch(/Instagram handle<\/strong> is not shown to anyone/);
  });

  it('names every outside service that receives data, and the limits on payment data', () => {
    for (const service of ['Clerk', 'Supabase', 'Razorpay', 'push service']) expect(privacy).toContain(service);
    expect(privacy).toMatch(/never see or store your card, UPI or bank details/);
    expect(privacy).toMatch(/never the text of a message/);
  });

  it('states retention and how to have data deleted', () => {
    expect(privacy).toMatch(/kept while your account is active/);
    expect(privacy).toMatch(/To have your account and data deleted/);
  });
});

describe('Free Mode: no payment claims on the policy pages (FREE-003, PRIV-006)', () => {
  const PAYMENT = /₹|Razorpay|payment records|Payment data|>Payments<|>Refunds<|Refund Policy/;

  it('Terms has no Payments or Refunds section and says nothing about a time limit', () => {
    expect(freeTerms).not.toMatch(PAYMENT);
    expect(freeTerms).not.toMatch(/two minutes|time limit/);
    expect(freeTerms).toContain('>What GarbaConnect is</h2>');
    expect(freeTerms).toMatch(/never shown to other dancers unless you agree to share them\./);
    expect(freeTerms).toMatch(link('/privacy'));
  });

  it('Privacy names no payment data and no payment provider, and still names every other service', () => {
    expect(freePrivacy).not.toMatch(PAYMENT);
    for (const service of ['Vercel', 'Clerk', 'Supabase', 'push service']) expect(freePrivacy).toContain(service);
    expect(freePrivacy).toMatch(/Vercel<\/strong>, which hosts the app and counts page visits/);
    expect(freePrivacy).toMatch(/It uses no cookies and does not identify you/);
    expect(freePrivacy).toMatch(/where your profile and messages are stored/);
    expect(freePrivacy).toMatch(link('/terms'));
  });

  it('the Refund Policy page says nothing is charged', () => {
    const html = inMode('free', () => render(RefundPolicyPage()));
    expect(html).toMatch(/We do not take any payments at the moment, so there is nothing to refund/);
    expect(html).not.toMatch(/₹|Razorpay|unlimited/i);
  });

  it('the footer links to Terms and Privacy only', () => {
    const footer = inMode('free', () => renderToStaticMarkup(ClosingCta()));
    for (const href of ['/terms', '/privacy']) expect(footer).toMatch(link(href));
    expect(footer).not.toMatch(link('/refund-policy'));
  });
});

describe('links', () => {
  it('the footer links to all three policies in Paid Mode', () => {
    const footer = inMode('paid', () => renderToStaticMarkup(ClosingCta()));
    for (const href of ['/terms', '/privacy', '/refund-policy']) expect(footer).toMatch(link(href));
  });

  it('checkout links to all three, each in a new tab (GATE-004, PAY-016)', () => {
    const sheet = renderToStaticMarkup(
      createElement(ConnectModal, { open: true, onClose: () => {}, onPay: () => {}, busy: false, error: null, partnerName: 'Arjun' }),
    );
    for (const href of ['/terms', '/privacy', '/refund-policy']) {
      expect(sheet).toMatch(new RegExp(`<a[^>]*href="${href}"[^>]*target="_blank"|<a[^>]*target="_blank"[^>]*href="${href}"`));
    }
  });
});

// Vercel Web Analytics is loaded from the site's own domain, and only when the app runs on
// Vercel (where /_vercel/insights exists). The root layout is rendered with Clerk mocked;
// next/script is replaced by a plain <script> so the server markup shows what would load.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/nextjs', () => ({ ClerkProvider: ({ children }: { children: React.ReactNode }) => children }));
vi.mock('@/lib/clerkConfig', () => ({ getClerkConfigProblems: () => [] }));
vi.mock('next/script', () => ({
  default: ({ src, strategy }: { src: string; strategy: string }) => createElement('script', { src, 'data-strategy': strategy }),
}));

import RootLayout from '@/app/layout';

const render = () => renderToStaticMarkup(RootLayout({ children: createElement('main', null, 'page') }));
const SCRIPT = '<script src="/_vercel/insights/script.js" data-strategy="afterInteractive"></script>';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('Vercel Web Analytics', () => {
  it('loads the analytics script from this site on Vercel', () => {
    vi.stubEnv('VERCEL', '1');
    expect(render()).toContain(SCRIPT);
  });

  it('loads nothing elsewhere (local, Docker, any other host)', () => {
    vi.stubEnv('VERCEL', '');
    const html = render();
    expect(html).toContain('page');
    expect(html).not.toContain('_vercel/insights');
  });

  it('never loads anything from a third-party analytics host', () => {
    vi.stubEnv('VERCEL', '1');
    expect(render()).not.toMatch(/https?:\/\/[^"]*(vercel-scripts|google-analytics|googletagmanager)/);
  });
});

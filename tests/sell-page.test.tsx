import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Children, type ReactElement, type ReactNode } from 'react';
import { Breadcrumbs } from '@/components/Breadcrumbs';
import { InfoPage } from '@/components/InfoPage';

const authMock = vi.hoisted(() => vi.fn());
vi.mock('@/auth', () => ({ auth: authMock }));
const nav = vi.hoisted(() => ({ redirect: vi.fn((to: string) => { throw new Error('REDIRECT:' + to); }), notFound: vi.fn() }));
vi.mock('next/navigation', () => nav);
import SellPage from '@/app/sell/page';
import SellerAccessPage from '@/app/seller-access/page';
import { SellerWelcome } from '@/components/SellerWelcome';
import { SellerOnboarding } from '@/components/SellerOnboarding';

/** The page wraps its content in a fragment with breadcrumbs; return the non-breadcrumb child. */
function body(el: ReactElement): ReactElement {
  const kids = Children.toArray((el.props as { children?: ReactNode }).children) as ReactElement[];
  expect(kids[0].type).toBe(Breadcrumbs);
  return kids[1];
}

beforeEach(() => { authMock.mockReset(); delete process.env.DASHBOARD_URL; });

describe('/sell', () => {
  it('signed out renders the welcome page', async () => {
    authMock.mockResolvedValue(null);
    const el = body((await SellPage()) as ReactElement);
    expect(el.type).toBe(SellerWelcome);
  });
  it('sellers and admins go to the dashboard posts', async () => {
    for (const role of ['seller', 'admin']) {
      authMock.mockResolvedValue({ user: { email: 'a@x.co', role, active: true } });
      await expect(SellPage()).rejects.toThrow('REDIRECT:/dashboard/posts');
    }
  });
  it('split host: redirect is absolute', async () => {
    process.env.DASHBOARD_URL = 'https://dashboard.example.com';
    process.env.NEXT_PUBLIC_SITE_URL = 'https://www.example.com';
    authMock.mockResolvedValue({ user: { email: 'a@x.co', role: 'seller', active: true } });
    await expect(SellPage()).rejects.toThrow('REDIRECT:https://dashboard.example.com/dashboard/posts');
  });
  it('roleless active account gets the onboarding form with session details', async () => {
    authMock.mockResolvedValue({ user: { email: 'c@x.co', name: 'Chai', role: 'customer', active: true } });
    const el = body((await SellPage()) as ReactElement) as ReactElement<Record<string, string>>;
    expect(el.type).toBe(SellerOnboarding);
    expect(el.props).toMatchObject({ initialName: 'Chai', initialEmail: 'c@x.co', postsUrl: '/dashboard/posts', postsUrlNew: '/dashboard/posts?new=1' });
  });
  it('deactivated account sees a refusal and never the form', async () => {
    authMock.mockResolvedValue({ user: { email: 'c@x.co', role: 'customer', active: false } });
    const el = body((await SellPage()) as ReactElement) as ReactElement<Record<string, string>>;
    expect(el.type).toBe(InfoPage);
    expect(el.props.title).toContain('deactivated');
    expect(el.type).not.toBe(SellerOnboarding);
  });
});

describe('/seller-access', () => {
  it('seller-access redirects to /sell', () => {
    expect(() => SellerAccessPage()).toThrow(/^REDIRECT:\/sell$/);
  });
});

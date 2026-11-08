import { getServerSession, type NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { asRole, type AppSession } from '@/lib/authz';
import { DEFAULT_CALLBACK, safeCallback } from '@/lib/callback-url';
import { hostConfig, normalizeHost } from '@/lib/hosts';
import { resolveAccess, upsertUserOnSignIn } from '@/lib/roles';

/** Session cookie shared by the public and dashboard hosts. Only when COOKIE_DOMAIN is set and really covers both hosts. */
function sharedCookies(): NextAuthOptions['cookies'] {
  const domain = process.env.COOKIE_DOMAIN?.trim();
  if (!domain) return undefined;
  const bare = domain.replace(/^\./, '').toLowerCase();
  const { dashboardHost, publicOrigin } = hostConfig();
  const covers = (h: string) => normalizeHost(h).split(':')[0] === bare || normalizeHost(h).split(':')[0].endsWith('.' + bare);
  if (dashboardHost && publicOrigin && !(covers(dashboardHost) && covers(new URL(publicOrigin).host))) return undefined;
  const secure = (process.env.NEXTAUTH_URL ?? '').startsWith('https://');
  return { sessionToken: { name: `${secure ? '__Secure-' : ''}next-auth.session-token`, options: { domain, httpOnly: true, sameSite: 'lax', path: '/', secure } } };
}

export const buildAuthOptions = (): NextAuthOptions => ({
  // Getter: read at request time. Never let next-auth derive a dev secret (it is guessable).
  get secret() { return process.env.NEXTAUTH_SECRET; },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  pages: { signIn: '/signin', error: '/signin' },
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 },
  cookies: sharedCookies(),
  callbacks: {
    // After sign-in only go back to this site or the dashboard host (no open redirects).
    async redirect({ url, baseUrl }) {
      const safe = safeCallback(url, [normalizeHost(new URL(baseUrl).host), hostConfig().dashboardHost], normalizeHost);
      if (!safe) return baseUrl + DEFAULT_CALLBACK;
      return safe.startsWith('/') ? baseUrl + safe : safe;
    },
    // Only verified Google emails may sign in, and the user row is created/refreshed here. Deactivated users are refused.
    async signIn({ account, profile }) {
      const p = profile as { email?: string; email_verified?: boolean; name?: string; sub?: string } | undefined;
      if (account?.provider !== 'google' || p?.email_verified !== true || !p.email) return false;
      try {
        return (await upsertUserOnSignIn({ email: p.email, name: p.name, sub: p.sub ?? account.providerAccountId })).active;
      } catch (err) {
        console.error('sign-in user upsert failed', err);
        return false;
      }
    },
    // Re-resolved on every session read, so role changes and deactivation apply on the next request.
    async jwt({ token }) {
      const access = token.email ? await resolveAccess(token.email) : { role: 'customer' as const, active: true };
      token.role = access.role;
      token.active = access.active;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = asRole(token.role);
        session.user.active = token.active !== false;
      }
      return session;
    },
  },
});

export const authOptions: NextAuthOptions = buildAuthOptions();

export async function auth(): Promise<AppSession> {
  if (!process.env.NEXTAUTH_SECRET) throw new Error('NEXTAUTH_SECRET is not set; refusing to verify sessions.');
  return (await getServerSession(authOptions)) as AppSession;
}

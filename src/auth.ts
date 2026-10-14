import { getServerSession, type NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { roleFor, type AppSession } from '@/lib/authz';

export const authOptions: NextAuthOptions = {
  // Getter: read at request time. Never let next-auth derive a dev secret (it is guessable).
  get secret() { return process.env.NEXTAUTH_SECRET; },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 },
  callbacks: {
    // Only verified Google emails may sign in.
    async signIn({ account, profile }) {
      return account?.provider === 'google' && (profile as { email_verified?: boolean } | undefined)?.email_verified === true;
    },
    async jwt({ token }) {
      token.role = token.email ? roleFor(token.email) : 'customer';
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.role = token.role === 'admin' ? 'admin' : 'customer';
      return session;
    },
  },
};

export async function auth(): Promise<AppSession> {
  if (!process.env.NEXTAUTH_SECRET) throw new Error('NEXTAUTH_SECRET is not set; refusing to verify sessions.');
  return (await getServerSession(authOptions)) as AppSession;
}

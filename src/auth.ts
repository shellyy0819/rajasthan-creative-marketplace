import { getServerSession, type NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { roleFor, type AppSession } from '@/lib/authz';

export const authOptions: NextAuthOptions = {
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

export const auth = () => getServerSession(authOptions) as Promise<AppSession>;

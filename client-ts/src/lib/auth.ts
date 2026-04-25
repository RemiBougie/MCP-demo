import GoogleProvider from 'next-auth/providers/google';
import type { NextAuthOptions, Session } from 'next-auth';
import type { JWT } from 'next-auth/jwt';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/signin',
  },
  callbacks: {
    async jwt({ token, account }): Promise<JWT> {
      // On first sign-in, account contains the Google OAuth tokens
      if (account?.access_token) {
        token.accessToken = account.access_token;
      }
      return token;
    },
    async session({ session, token }): Promise<Session> {
      (session as Session & { accessToken?: string }).accessToken =
        token.accessToken as string | undefined;
      return session;
    },
  },
};

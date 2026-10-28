import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { verifyPassword } from './password';
import { credentialVersion } from './auth-version';

// One process / one owner. Do not key on attacker-controlled forwarding headers.
// A proxy-level limiter is still required for distributed/replicated deployments.
let attempts = 0;
let windowStart = 0;
let verifying = false;

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  providers: [CredentialsProvider({
    name: 'Owner password',
    credentials: { password: { label: 'Password', type: 'password' } },
    async authorize(credentials) {
      if (!process.env.NEXTAUTH_SECRET) return null;
      const now = Date.now();
      if (now - windowStart >= 60_000) { windowStart = now; attempts = 0; }
      if (verifying || ++attempts > 10) return null;
      verifying = true;
      try {
        if (!await verifyPassword(credentials?.password, process.env.OWNER_PASSWORD_HASH)) return null;
        return { id: 'owner', name: 'Owner' };
      } finally { verifying = false; }
    },
  })],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.credentialVersion = await credentialVersion();
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.sub ?? '';
      return session;
    },
  },
  pages: { signIn: '/login' },
};

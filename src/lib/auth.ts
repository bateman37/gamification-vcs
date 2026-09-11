import type { NextAuthOptions, Session, User as NextAuthUser } from "next-auth";
import type { JWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { normalizeEmail } from "@/lib/normalize";

/**
 * Autenticacion local minima (`0.6.0` / MVP-1C, ver docs/AUTHENTICATION.md):
 * Auth.js/NextAuth con proveedor de credenciales, sesion JWT firmada con
 * `AUTH_SECRET` y hashing de contrasena con bcrypt. Sin proveedores
 * externos, sin correo transaccional, sin SaaS de pago.
 */

interface AuthorizedUser extends NextAuthUser {
  role: "ADMIN" | "PARTICIPANT";
  personId: string | null;
  mustChangePassword: boolean;
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credenciales",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contrasena", type: "password" },
      },
      async authorize(credentials): Promise<AuthorizedUser | null> {
        if (!credentials?.email || !credentials.password) return null;
        const email = normalizeEmail(credentials.email);
        const user = await prisma.user.findUnique({ where: { email } });
        if (!user || !user.isActive) return null;

        const passwordValid = await compare(credentials.password, user.passwordHash);
        if (!passwordValid) return null;

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          personId: user.personId,
          mustChangePassword: user.mustChangePassword,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }: { token: JWT; user?: NextAuthUser }) {
      if (user) {
        const authorizedUser = user as AuthorizedUser;
        token.userId = authorizedUser.id;
        token.role = authorizedUser.role;
        token.personId = authorizedUser.personId;
        token.mustChangePassword = authorizedUser.mustChangePassword;
      }
      return token;
    },
    async session({ session, token }: { session: Session; token: JWT }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.role = token.role as "ADMIN" | "PARTICIPANT";
        session.user.personId = (token.personId as string | null) ?? null;
        session.user.mustChangePassword = Boolean(token.mustChangePassword);
      }
      return session;
    },
  },
  secret: process.env.AUTH_SECRET,
};

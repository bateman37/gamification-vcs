import type { DefaultSession } from "next-auth";

/** Amplia los tipos de NextAuth con los campos propios de esta aplicacion (ver src/lib/auth.ts). */
declare module "next-auth" {
  interface User {
    role: "ADMIN" | "PARTICIPANT";
    personId: string | null;
    mustChangePassword: boolean;
  }

  interface Session {
    user: {
      id: string;
      role: "ADMIN" | "PARTICIPANT";
      personId: string | null;
      mustChangePassword: boolean;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role: "ADMIN" | "PARTICIPANT";
    personId: string | null;
    mustChangePassword: boolean;
  }
}

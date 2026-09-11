import { getServerSession, type Session } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

/**
 * Helpers de sesion en servidor. El middleware (`src/middleware.ts`) ya
 * protege las rutas por prefijo, pero estas funciones son la segunda capa
 * de defensa dentro de paginas y acciones de servidor: nunca se decide
 * autorizacion en el cliente ni a partir de un `personId` recibido del
 * navegador (ver docs/AUTHENTICATION.md).
 */

export async function getCurrentSession(): Promise<Session | null> {
  return getServerSession(authOptions);
}

export async function requireSession(): Promise<Session> {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/login");
  return session;
}

export async function requireAdminSession(): Promise<Session> {
  const session = await requireSession();
  if (session.user.role !== "ADMIN") redirect("/resultados");
  return session;
}

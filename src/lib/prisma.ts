import { PrismaClient } from "@prisma/client";

/**
 * Cliente Prisma unico compartido por toda la aplicacion. En desarrollo,
 * Next.js recarga los modulos en caliente y crearia un cliente nuevo en
 * cada recarga si no se reutilizase la instancia global.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

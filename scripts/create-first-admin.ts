import { prisma } from "../src/lib/prisma";
import { ensureFirstAdmin } from "../src/server/services/auth.service";

/**
 * Crea el primer administrador a partir de variables de entorno
 * (`ADMIN_EMAIL`, `ADMIN_PASSWORD`), sin secretos en Git ni en logs. No
 * hace nada si ya existe algun administrador (ver docs/AUTHENTICATION.md).
 *
 * Uso (PowerShell, con `.env` ya configurado):
 *   $env:ADMIN_EMAIL = "admin@ejemplo.com"
 *   $env:ADMIN_PASSWORD = "una-contrasena-temporal-segura"
 *   npm run db:create-admin
 */
async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.error("Define ADMIN_EMAIL y ADMIN_PASSWORD como variables de entorno antes de ejecutar este script.");
    process.exitCode = 1;
    return;
  }

  const result = await ensureFirstAdmin(prisma, email, password);
  if (result.created) {
    console.log(`Administrador creado: ${result.email}. Debera cambiar la contrasena en el primer acceso.`);
  } else {
    console.log(`Ya existe un administrador (${result.email}). No se ha creado ninguna cuenta nueva.`);
  }
}

main()
  .catch((error) => {
    console.error("Error al crear el primer administrador:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

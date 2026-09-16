import { prisma } from "../src/lib/prisma";
import { importLegacyBadgesV1 } from "../src/server/services/badge-historical.service";

/**
 * Importa (o repara de forma segura) el historico `legacy-badges-v1`
 * (`1.2.3`, ver docs/BADGES.md): catalogo, 18 destinatarios y 127
 * concesiones, mas la vinculacion automatica. Seguro de repetir: nunca
 * duplica nada, y falla explicitamente sin escribir si el dataset no supera
 * sus controles de integridad.
 *
 * Uso, con `.env` ya configurado y las migraciones aplicadas:
 *   npm run db:import-legacy-badges
 */
async function main(): Promise<void> {
  const summary = await importLegacyBadgesV1(prisma);
  console.log(`Dataset: ${summary.datasetVersion}`);
  console.log(`Destinatarios: ${summary.totalRecipients} (${summary.recipientsCreated} nuevos, ${summary.recipientsExisting} ya existentes)`);
  console.log(`Concesiones: ${summary.totalAwards} (${summary.awardsCreated} nuevas, ${summary.awardsExisting} ya existentes)`);
  console.log(`Vinculacion automatica: ${summary.linked} enlazados en esta ejecucion, ${summary.pending} pendientes de vincular.`);
  if (summary.pending > 0) {
    console.log("Resuelve los destinatarios pendientes desde Badges > Administración histórica.");
  }
}

main()
  .catch((error) => {
    console.error("Error al importar legacy-badges-v1:", error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

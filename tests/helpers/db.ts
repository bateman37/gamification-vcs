import { PrismaClient } from "@prisma/client";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/gamification_vcs_test?schema=public";

export const testDb = new PrismaClient({
  datasources: { db: { url: TEST_DATABASE_URL } },
});

export async function resetDatabase(): Promise<void> {
  // ProductivityImport se borra antes que SplitParticipant: la relacion de
  // ProductivityWeeklyRow con el participante es Restrict a proposito (ver
  // docs/IMPORT_PRODUCTIVITY.md), asi que un participante con filas de
  // productividad no se puede borrar directamente.
  await testDb.productivityImport.deleteMany();
  await testDb.splitParticipant.deleteMany();
  await testDb.splitKpiConfig.deleteMany();
  await testDb.splitWeek.deleteMany();
  await testDb.split.deleteMany();
  await testDb.person.deleteMany();
}

import { PrismaClient } from "@prisma/client";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/gamification_vcs_test?schema=public";

export const testDb = new PrismaClient({
  datasources: { db: { url: TEST_DATABASE_URL } },
});

export async function resetDatabase(): Promise<void> {
  // Las cabeceras de carga se borran antes que SplitParticipant: la
  // relacion de cada fila semanal con el participante es Restrict a
  // proposito (ver docs/IMPORT_PRODUCTIVITY.md), asi que un participante
  // con filas cargadas no se puede borrar directamente.
  await testDb.productivityImport.deleteMany();
  await testDb.escalationImport.deleteMany();
  await testDb.qualityImport.deleteMany();
  await testDb.voiceImport.deleteMany();
  await testDb.stabilityWeeklyEntry.deleteMany();
  await testDb.chronomancyWeeklyEntry.deleteMany();
  await testDb.writerWeeklyEntry.deleteMany();
  await testDb.studentWeeklyEntry.deleteMany();
  await testDb.apprenticeWeeklyEntry.deleteMany();
  // WeekPublication en cascada borra PublishedParticipantWeeklyResult y PublishedKpiResult; debe
  // borrarse antes que SplitParticipant/SplitWeek/Split/Person, a los que esas filas restringen el borrado.
  await testDb.weekPublication.deleteMany();
  await testDb.user.deleteMany();
  await testDb.splitParticipant.deleteMany();
  await testDb.splitKpiConfig.deleteMany();
  await testDb.splitPositionPointRule.deleteMany();
  await testDb.splitWeek.deleteMany();
  await testDb.split.deleteMany();
  await testDb.person.deleteMany();
}

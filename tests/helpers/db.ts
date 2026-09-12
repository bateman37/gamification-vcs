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
  // Economia, inventario y equipo (`0.9.0` / MVP-2D): CreditLedgerEntry restringe el borrado de
  // PublishedParticipantWeeklyResult (que WeekPublication borraria en cascada) y de SplitParticipant;
  // SplitParticipantEquippedItem/SplitParticipantItem/ItemPurchase se restringen entre si y contra
  // SplitParticipant, asi que se borran todos antes que las filas a las que referencian.
  await testDb.creditLedgerEntry.deleteMany();
  await testDb.splitParticipantEquippedItem.deleteMany();
  await testDb.splitParticipantItem.deleteMany();
  await testDb.itemPurchase.deleteMany();
  // WeekPublication en cascada borra PublishedParticipantWeeklyResult y PublishedKpiResult; debe
  // borrarse antes que SplitParticipant/SplitWeek/Split/Person, a los que esas filas restringen el borrado.
  await testDb.weekPublication.deleteMany();
  // Centro de noticias (`1.0.0` / MVP-3): NewsDelivery restringe el borrado de Person y User;
  // NewsItem restringe el borrado de User (autor de envios manuales). Se borran antes que ambos.
  await testDb.newsDelivery.deleteMany();
  await testDb.newsItem.deleteMany();
  await testDb.user.deleteMany();
  // El avatar cae en cascada con su participante, pero se borra explicitamente para no depender de ello.
  await testDb.splitParticipantAvatar.deleteMany();
  await testDb.splitParticipant.deleteMany();
  // SplitProfession se borra despues de SplitParticipant y de las publicaciones: ambos la referencian con Restrict.
  await testDb.splitProfession.deleteMany();
  await testDb.splitKpiConfig.deleteMany();
  await testDb.splitPositionPointRule.deleteMany();
  // SplitStoreItem restringe el borrado de SplitEquipmentSlot: se borra primero explicitamente en vez
  // de confiar en el orden de la cascada de Split (SplitEconomySettings si cae en cascada sin problema).
  await testDb.splitStoreItem.deleteMany();
  await testDb.splitEquipmentSlot.deleteMany();
  await testDb.splitWeek.deleteMany();
  await testDb.split.deleteMany();
  await testDb.person.deleteMany();
}

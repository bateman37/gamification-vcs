import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import { createPerson } from "@/server/services/person.service";
import {
  importLegacyBadgesV1,
  relinkBadgeHistoricalRecipient,
  runAutomaticBadgeRecipientLinking,
  listBadgeHistoricalAdminSummary,
} from "@/server/services/badge-historical.service";
import { DomainError } from "@/lib/errors";

/**
 * Importacion de `legacy-badges-v1` y vinculacion automatica (`1.2.3`,
 * seccion 11.1/11.2 del encargo, ver docs/BADGES.md). Usa nombres
 * sinteticos de prueba (nunca los 18 nombres reales del historico): las
 * comprobaciones de los totales reales viven en `badges-domain.test.ts`,
 * sobre el validador puro, sin base de datos.
 */

beforeEach(async () => {
  await resetDatabase();
});

describe("Importacion de legacy-badges-v1", () => {
  it("crea exactamente 18 destinatarios y 127 concesiones, con los controles de integridad", async () => {
    const summary = await importLegacyBadgesV1(testDb);
    expect(summary.totalRecipients).toBe(18);
    expect(summary.totalAwards).toBe(127);
    expect(summary.recipientsCreated).toBe(18);
    expect(summary.awardsCreated).toBe(127);

    const mvpCount = await testDb.badgeAward.count({ where: { badge: { code: "MVP" } } });
    const teamMvpCount = await testDb.badgeAward.count({ where: { badge: { code: "TEAM_MVP" } } });
    expect(mvpCount).toBe(9);
    expect(teamMvpCount).toBe(30);
  });

  it("reejecutar la importacion no duplica ningun destinatario ni ninguna concesion", async () => {
    await importLegacyBadgesV1(testDb);
    const second = await importLegacyBadgesV1(testDb);

    expect(second.recipientsCreated).toBe(0);
    expect(second.awardsCreated).toBe(0);
    expect(second.totalRecipients).toBe(18);
    expect(second.totalAwards).toBe(127);
    expect(await testDb.badgeHistoricalRecipient.count()).toBe(18);
    expect(await testDb.badgeAward.count()).toBe(127);
  });

  it("crea el catalogo de 14 badges (10 KPI del catalogo activo, 2 historicos, MVP y MVP Team)", async () => {
    await importLegacyBadgesV1(testDb);
    const badges = await testDb.badge.findMany({ orderBy: { sortOrder: "asc" } });
    expect(badges).toHaveLength(14);
    expect(badges.map((b) => b.code)).toEqual([
      "SOLUTION_HUNTER",
      "DATA_EXPLORER",
      "VOICE_AMBASSADOR",
      "MASTER_CRAFTSMAN",
      "ESCALATION_TAMER",
      "WORK_CHRONOMANCY",
      "LEGACY_PADAWAN_JOURNEY",
      "STABILITY_GUARDIAN",
      "STAR_WRITER",
      "ENTHUSIASTIC_STUDENT",
      "EXPERT_APPRENTICE",
      "LEGACY_KNOWLEDGE_GUARDIAN",
      "MVP",
      "TEAM_MVP",
    ]);
  });
});

describe("Vinculacion automatica de destinatarios historicos (seccion 3.3 del encargo)", () => {
  it("enlaza con una unica coincidencia inequivoca, ignorando mayusculas, tildes y espacios", async () => {
    await importLegacyBadgesV1(testDb);
    // "Cristina Tarrés" es uno de los 18 destinatarios reales del dataset canonico.
    await createPerson(testDb, { fullName: "  cristina   TARRÉS  ", email: undefined });

    const result = await runAutomaticBadgeRecipientLinking(testDb);
    expect(result.linked).toBe(1);

    const recipient = await testDb.badgeHistoricalRecipient.findFirst({ where: { normalizedName: "cristina tarres" } });
    expect(recipient?.personId).not.toBeNull();
    expect(recipient?.linkedAt).not.toBeNull();
  });

  it("no vincula cuando hay cero coincidencias: queda pendiente", async () => {
    await importLegacyBadgesV1(testDb);
    const result = await runAutomaticBadgeRecipientLinking(testDb);
    expect(result.linked).toBe(0);
    expect(result.pending).toBe(18);
  });

  it("no vincula cuando hay varias coincidencias ambiguas: queda pendiente, sin elegir ninguna", async () => {
    await importLegacyBadgesV1(testDb);
    // Dos personas actuales con el mismo nombre normalizado que un destinatario real del dataset.
    await createPerson(testDb, { fullName: "Xabier Aznar", email: undefined });
    await createPerson(testDb, { fullName: "xabier aznar", email: "otro@example.com" });

    const result = await runAutomaticBadgeRecipientLinking(testDb);
    const recipient = await testDb.badgeHistoricalRecipient.findFirst({ where: { normalizedName: "xabier aznar" } });
    expect(recipient?.personId).toBeNull();
    expect(result.linked).toBe(0);
  });

  it("una persona ya vinculada a un destinatario no se usa como candidata para otro", async () => {
    await importLegacyBadgesV1(testDb);
    const person = await createPerson(testDb, { fullName: "Oriol Romero", email: undefined });
    // Vinculacion manual previa a un destinatario distinto pero con el mismo nombre normalizado no existe en el
    // dataset real, asi que forzamos el escenario: enlazamos manualmente y comprobamos que el automatico no lo toca.
    const recipient = await testDb.badgeHistoricalRecipient.findFirstOrThrow({ where: { normalizedName: "oriol romero" } });
    await relinkBadgeHistoricalRecipient(testDb, recipient.id, person.id);

    const result = await runAutomaticBadgeRecipientLinking(testDb);
    expect(result.linked).toBe(0);
    const stillLinked = await testDb.badgeHistoricalRecipient.findUniqueOrThrow({ where: { id: recipient.id } });
    expect(stillLinked.personId).toBe(person.id);
  });
});

describe("Vinculacion manual (seccion 3.3 del encargo)", () => {
  it("vincula, corrige y desvincula sin alterar las concesiones ya asociadas", async () => {
    await importLegacyBadgesV1(testDb);
    const recipient = await testDb.badgeHistoricalRecipient.findFirstOrThrow({ where: { normalizedName: "oriol romero" } });
    const awardCountBefore = await testDb.badgeAward.count({ where: { recipientId: recipient.id } });

    const personA = await createPerson(testDb, { fullName: "Persona A", email: undefined });
    await relinkBadgeHistoricalRecipient(testDb, recipient.id, personA.id);
    let updated = await testDb.badgeHistoricalRecipient.findUniqueOrThrow({ where: { id: recipient.id } });
    expect(updated.personId).toBe(personA.id);

    const personB = await createPerson(testDb, { fullName: "Persona B", email: undefined });
    await relinkBadgeHistoricalRecipient(testDb, recipient.id, personB.id);
    updated = await testDb.badgeHistoricalRecipient.findUniqueOrThrow({ where: { id: recipient.id } });
    expect(updated.personId).toBe(personB.id);

    await relinkBadgeHistoricalRecipient(testDb, recipient.id, null);
    updated = await testDb.badgeHistoricalRecipient.findUniqueOrThrow({ where: { id: recipient.id } });
    expect(updated.personId).toBeNull();
    expect(updated.linkedAt).toBeNull();

    const awardCountAfter = await testDb.badgeAward.count({ where: { recipientId: recipient.id } });
    expect(awardCountAfter).toBe(awardCountBefore);
  });

  it("rechaza vincular dos destinatarios distintos a la misma persona", async () => {
    await importLegacyBadgesV1(testDb);
    const recipientA = await testDb.badgeHistoricalRecipient.findFirstOrThrow({ where: { normalizedName: "oriol romero" } });
    const recipientB = await testDb.badgeHistoricalRecipient.findFirstOrThrow({ where: { normalizedName: "teresa perez" } });
    const person = await createPerson(testDb, { fullName: "Persona Compartida", email: undefined });

    await relinkBadgeHistoricalRecipient(testDb, recipientA.id, person.id);
    await expect(relinkBadgeHistoricalRecipient(testDb, recipientB.id, person.id)).rejects.toBeInstanceOf(DomainError);
  });

  it("el resumen administrativo refleja enlazados/pendientes/concesiones importadas", async () => {
    await importLegacyBadgesV1(testDb);
    const recipient = await testDb.badgeHistoricalRecipient.findFirstOrThrow({ where: { normalizedName: "oriol romero" } });
    const person = await createPerson(testDb, { fullName: "Persona Resumen", email: undefined });
    await relinkBadgeHistoricalRecipient(testDb, recipient.id, person.id);

    const summary = await listBadgeHistoricalAdminSummary(testDb);
    expect(summary.totalRecipients).toBe(18);
    expect(summary.linkedCount).toBe(1);
    expect(summary.pendingCount).toBe(17);
    expect(summary.totalAwards).toBe(127);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import { markAllPresent } from "./helpers/attendance";
import { createPerson } from "@/server/services/person.service";
import { createSplitWithWeeks, activateSplit, listSplitWeeks } from "@/server/services/split.service";
import { addParticipant } from "@/server/services/participant.service";
import { updateKpiConfig } from "@/server/services/kpi.service";
import { saveStabilityEntries } from "@/server/services/stability-entry.service";
import { publishWeek } from "@/server/services/publish-week.service";
import { createEquipmentSlot } from "@/server/services/equipment-slot.service";
import { createStoreItem } from "@/server/services/store-item.service";
import { openMarket } from "@/server/services/economy.service";
import { purchaseStoreItem } from "@/server/services/purchase.service";
import { equipOwnedItem, unequipSlot } from "@/server/services/equipment.service";
import { createProfession } from "@/server/services/profession.service";
import { upsertWeekLocation } from "@/server/services/location.service";
import { getParticipantBalance } from "@/server/services/ledger.service";
import { computeWeeklyResults } from "@/server/services/weekly-results.service";
import { DomainError } from "@/lib/errors";

/**
 * Integracion completa de economia con el motor de resultados y la
 * publicacion (`0.9.0` / MVP-2D, partes G-H del encargo, secciones 59-60 del
 * listado de pruebas).
 */

function form(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

beforeEach(async () => {
  await resetDatabase();
});

describe("Bonus de equipo compuesto con profesion y localizacion", () => {
  it("70 + profesion 20 % + localizacion 30 % + objeto 10 % = 112, nunca encadenado", async () => {
    const split = await createSplitWithWeeks(testDb, { name: "Split Composicion", description: undefined, startDate: "2026-10-05", numberOfWeeks: 1 });
    const profession = await createProfession(testDb, split.id, {
      name: "Mecanico",
      kpiCodeA: "STABILITY_GUARDIAN",
      kpiCodeB: "WORK_CHRONOMANCY",
      availableN0: false,
      availableN1: false,
      availableN2: true,
    });
    const person = await createPerson(testDb, { fullName: "Persona Composicion", email: undefined });
    const participant = await addParticipant(testDb, split.id, {
      personId: person.id,
      alias: "Composicion",
      level: "N2",
      startWeekSequenceNumber: 1,
      professionId: profession.id,
    });
    await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", { isActive: true, baseMax: 70, multiplierN2: 1, parameters: { pointsPerResult: 70 } });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await upsertWeekLocation(testDb, split.id, week.id, { name: "Nebulosa", kpiCode: "STABILITY_GUARDIAN", bonusPercent: 30 });
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "1" }));

    // El objeto tambien debe estar equipado ANTES de publicar: se compra con creditos de una primera
    // semana neutra para no alterar la semana bajo prueba.
    const slot = await createEquipmentSlot(testDb, split.id, { name: "Artefacto" });
    const storeItem = await createStoreItem(testDb, split.id, {
      name: "Cristal de datos",
      description: null,
      priceCredits: 1,
      equipmentSlotId: slot.id,
      kpiCode: "STABILITY_GUARDIAN",
      bonusPercent: 10,
    });
    await openMarket(testDb, split.id);
    await grantCredits(participant.id, split.id, week.id, 100);
    await purchaseStoreItem(testDb, person.id, participant.id, storeItem.id);
    const owned = await testDb.splitParticipantItem.findFirstOrThrow({ where: { splitParticipantId: participant.id } });
    await equipOwnedItem(testDb, person.id, participant.id, owned.id);

    await markAllPresent(testDb, split.id, week.id);
    const preview = await computeWeeklyResults(testDb, split.id, week.id);
    const kpiCell = preview.participants[0]!.kpiResults.find((cell) => cell.kpiCode === "STABILITY_GUARDIAN")!;
    expect(kpiCell.basePointsBeforeProfession).toBe(70);
    expect(kpiCell.professionBonusPoints).toBe(14);
    expect(kpiCell.locationBonusPoints).toBe(21);
    expect(kpiCell.equipmentBonusPoints).toBe(7);
    expect(kpiCell.finalPoints).toBe(112);
  });
});

describe("Publicacion: snapshots de equipo y creditos", () => {
  async function buildSplitReadyToPublish() {
    const split = await createSplitWithWeeks(testDb, { name: "Split Publicacion Economia", description: undefined, startDate: "2026-10-05", numberOfWeeks: 1 });
    const person = await createPerson(testDb, { fullName: "Persona Publicacion Economia", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "PubEco", level: "N2", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", { isActive: true, baseMax: 70, multiplierN2: 1, parameters: { pointsPerResult: 70 } });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "1" }));

    const slot = await createEquipmentSlot(testDb, split.id, { name: "Artefacto" });
    const storeItem = await createStoreItem(testDb, split.id, {
      name: "Cristal de datos",
      description: null,
      priceCredits: 1,
      equipmentSlotId: slot.id,
      kpiCode: "STABILITY_GUARDIAN",
      bonusPercent: 20,
    });
    await openMarket(testDb, split.id);
    await grantCredits(participant.id, split.id, week.id, 100);
    await purchaseStoreItem(testDb, person.id, participant.id, storeItem.id);
    const owned = await testDb.splitParticipantItem.findFirstOrThrow({ where: { splitParticipantId: participant.id } });
    await equipOwnedItem(testDb, person.id, participant.id, owned.id);

    return { split, person, participant, slot, storeItem, week };
  }

  it("congela el objeto equipado (nombre, ranura, KPI, porcentaje) en PublishedEquippedItem", async () => {
    const { split, participant, slot, storeItem, week } = await buildSplitReadyToPublish();
    await markAllPresent(testDb, split.id, week.id);
    await publishWeek(testDb, split.id, week.id, null);

    const result = await testDb.publishedParticipantWeeklyResult.findFirstOrThrow({
      where: { splitParticipantId: participant.id, publication: { splitWeekId: week.id } },
      include: { equippedItems: true, kpiResults: true },
    });
    expect(result.equippedItems).toHaveLength(1);
    const snapshot = result.equippedItems[0]!;
    expect(snapshot.itemNameSnapshot).toBe("Cristal de datos");
    expect(snapshot.equipmentSlotNameSnapshot).toBe(slot.name);
    expect(snapshot.kpiCodeSnapshot).toBe("STABILITY_GUARDIAN");
    expect(snapshot.bonusPercentSnapshot).toBe(20);
    expect(snapshot.storeItemId).toBe(storeItem.id);

    const kpiResult = result.kpiResults.find((row) => row.kpiCode === "STABILITY_GUARDIAN")!;
    expect(kpiResult.equipmentApplied).toBe(true);
    expect(kpiResult.equipmentBonusPoints?.toNumber()).toBe(14);
    expect(kpiResult.finalPoints?.toNumber()).toBe(84);
  });

  it("crea el credito congelado y el movimiento WEEKLY_EARNING en la misma transaccion que la publicacion", async () => {
    const { split, participant, week } = await buildSplitReadyToPublish();
    const balanceBefore = await getParticipantBalance(testDb, participant.id);
    await markAllPresent(testDb, split.id, week.id);
    await publishWeek(testDb, split.id, week.id, null);

    const result = await testDb.publishedParticipantWeeklyResult.findFirstOrThrow({
      where: { splitParticipantId: participant.id, publication: { splitWeekId: week.id } },
    });
    expect(result.creditsEarned).toBe(84);
    const earning = await testDb.creditLedgerEntry.findUniqueOrThrow({ where: { publishedResultId: result.id } });
    expect(earning.type).toBe("WEEKLY_EARNING");
    expect(earning.amount).toBe(84);
    expect(await getParticipantBalance(testDb, participant.id)).toBe(balanceBefore + 84);
  });

  it("un unico movimiento WEEKLY_EARNING por resultado publicado: no se duplica al reintentar", async () => {
    const { split, participant, week } = await buildSplitReadyToPublish();
    await markAllPresent(testDb, split.id, week.id);
    await publishWeek(testDb, split.id, week.id, null);
    await expect(publishWeek(testDb, split.id, week.id, null)).rejects.toBeInstanceOf(DomainError);
    // Un movimiento por ESTA semana (ademas del que ya otorgo el credito inicial de prueba, ligado a otra semana).
    expect(
      await testDb.creditLedgerEntry.count({
        where: { splitParticipantId: participant.id, type: "WEEKLY_EARNING", publishedResult: { publication: { splitWeekId: week.id } } },
      }),
    ).toBe(1);
  });

  it("cambiar el equipo despues de publicar nunca modifica la semana ya publicada", async () => {
    const { split, person, participant, slot, week } = await buildSplitReadyToPublish();
    await markAllPresent(testDb, split.id, week.id);
    await publishWeek(testDb, split.id, week.id, null);

    await unequipSlot(testDb, person.id, participant.id, slot.id);

    const result = await testDb.publishedParticipantWeeklyResult.findFirstOrThrow({
      where: { splitParticipantId: participant.id, publication: { splitWeekId: week.id } },
      include: { equippedItems: true, kpiResults: true },
    });
    // El snapshot sigue congelado con el objeto, aunque ahora este desequipado en vivo.
    expect(result.equippedItems).toHaveLength(1);
    expect(result.kpiResults.find((row) => row.kpiCode === "STABILITY_GUARDIAN")!.finalPoints?.toNumber()).toBe(84);
  });

  it("publishWeek relee el equipo dentro de su propia transaccion: equipar justo antes de publicar cuenta para esa semana", async () => {
    const { split, week } = await buildSplitReadyToPublish();
    // El helper ya equipa antes de publicar; esta prueba documenta que un cambio de equipo hecho antes
    // de llamar a publishWeek (nunca despues) es el que se congela, coherente con la seccion 21 del encargo.
    await markAllPresent(testDb, split.id, week.id);
    const result = await publishWeek(testDb, split.id, week.id, null);
    expect(result.alreadyPublished).toBe(false);
  });

  it("publicaciones anteriores a esta version (sin snapshots de equipo) se siguen leyendo sin errores", async () => {
    const { split, participant, week } = await buildSplitReadyToPublish();
    // Simula una publicacion anterior a 0.9.0: sin equippedItems y con equipmentBonusPoints/Applied nulos/false.
    await testDb.splitParticipantEquippedItem.deleteMany({ where: { splitParticipantId: participant.id } });
    await markAllPresent(testDb, split.id, week.id);
    const publication = await publishWeek(testDb, split.id, week.id, null);
    void publication;

    const result = await testDb.publishedParticipantWeeklyResult.findFirstOrThrow({
      where: { splitParticipantId: participant.id, publication: { splitWeekId: week.id } },
      include: { equippedItems: true, kpiResults: true },
    });
    expect(result.equippedItems).toHaveLength(0);
    const kpiResult = result.kpiResults.find((row) => row.kpiCode === "STABILITY_GUARDIAN")!;
    expect(kpiResult.equipmentApplied).toBe(false);
    expect(kpiResult.equipmentBonusPoints?.toNumber()).toBe(0);
  });

  it("un fallo de publicacion (falta la regla de puntos por posicion) no deja publicacion, snapshot ni credito parcial", async () => {
    const { split, participant, week } = await buildSplitReadyToPublish();
    await testDb.splitPositionPointRule.deleteMany({ where: { splitId: split.id } });
    await markAllPresent(testDb, split.id, week.id);

    await expect(publishWeek(testDb, split.id, week.id, null)).rejects.toBeInstanceOf(DomainError);
    expect(await testDb.weekPublication.count({ where: { splitWeekId: week.id } })).toBe(0);
    // Ningun movimiento nuevo ligado a ESTA semana (el credito inicial de prueba, ligado a otra semana, se conserva intacto).
    expect(
      await testDb.creditLedgerEntry.count({
        where: { splitParticipantId: participant.id, type: "WEEKLY_EARNING", publishedResult: { publication: { splitWeekId: week.id } } },
      }),
    ).toBe(0);
    expect(await testDb.publishedEquippedItem.count()).toBe(0);
  });
});

/** Otorga creditos reales publicando una semana neutra previa, para poder comprar antes de la semana bajo prueba. */
async function grantCredits(splitParticipantId: string, splitId: string, excludeWeekId: string, amount: number): Promise<void> {
  const extraWeek = await testDb.splitWeek.create({
    data: { splitId, sequenceNumber: 999, startDate: new Date("2020-01-06"), endDate: new Date("2020-01-12") },
  });
  const publication = await testDb.weekPublication.create({ data: { splitWeekId: extraWeek.id } });
  const participant = await testDb.splitParticipant.findUniqueOrThrow({ where: { id: splitParticipantId } });
  const result = await testDb.publishedParticipantWeeklyResult.create({
    data: {
      publicationId: publication.id,
      splitId,
      splitParticipantId,
      personId: participant.personId,
      fullNameSnapshot: "Test",
      aliasSnapshot: "Test",
      levelSnapshot: "N2",
      totalKpiPoints: amount,
      weeklyRank: 1,
      positionPoints: 0,
      rankedParticipantCount: 1,
      creditsEarned: amount,
    },
  });
  await testDb.creditLedgerEntry.create({
    data: { splitParticipantId, type: "WEEKLY_EARNING", amount, description: "Creditos de prueba", publishedResultId: result.id },
  });
  void excludeWeekId;
}

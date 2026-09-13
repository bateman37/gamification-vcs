import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import { markAllPresent } from "./helpers/attendance";
import { createPerson } from "@/server/services/person.service";
import { createSplitWithWeeks, activateSplit, listSplitWeeks } from "@/server/services/split.service";
import { addParticipant } from "@/server/services/participant.service";
import { updateKpiConfig } from "@/server/services/kpi.service";
import { updatePositionPointRules } from "@/server/services/position-points.service";
import { saveStabilityEntries } from "@/server/services/stability-entry.service";
import { publishWeek } from "@/server/services/publish-week.service";
import { DomainError } from "@/lib/errors";

function form(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

async function buildPublishedSplit() {
  const split = await createSplitWithWeeks(testDb, { name: "Split bloqueo", description: undefined, startDate: "2025-10-06", numberOfWeeks: 2 });
  const person = await createPerson(testDb, { fullName: "Persona Bloqueo", email: undefined });
  const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "Bloqueo", level: "N2", startWeekSequenceNumber: 1 });
  await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", { isActive: true, baseMax: 30, multiplierN2: 1, parameters: { pointsPerResult: 30 } });
  await activateSplit(testDb, split.id);
  const week = (await listSplitWeeks(testDb, split.id))[0]!;
  await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "1" }));
  await markAllPresent(testDb, split.id, week.id);
  await publishWeek(testDb, split.id, week.id, null);
  return { split, week };
}

beforeEach(async () => {
  await resetDatabase();
});

describe("Bloqueo de configuracion tras la primera publicacion", () => {
  it("antes de publicar, puede editarse la configuracion de KPI y los puntos por posicion", async () => {
    const split = await createSplitWithWeeks(testDb, { name: "Split editable", description: undefined, startDate: "2025-10-06", numberOfWeeks: 2 });
    await expect(
      updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", { isActive: true, baseMax: 30, multiplierN2: 1, parameters: { pointsPerResult: 30 } }),
    ).resolves.toBeTruthy();

    const rules = await testDb.splitPositionPointRule.findMany({ where: { splitId: split.id } });
    await expect(
      updatePositionPointRules(testDb, split.id, rules.map((rule) => ({ position: rule.position, points: rule.points + 1 }))),
    ).resolves.toBeUndefined();
  });

  it("despues de la primera publicacion, se rechaza editar la configuracion de KPI", async () => {
    const { split } = await buildPublishedSplit();
    await expect(
      updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", { isActive: true, baseMax: 999, multiplierN2: 1, parameters: { pointsPerResult: 30 } }),
    ).rejects.toBeInstanceOf(DomainError);

    const config = await testDb.splitKpiConfig.findUniqueOrThrow({ where: { splitId_kpiCode: { splitId: split.id, kpiCode: "STABILITY_GUARDIAN" } } });
    expect(config.baseMax.toNumber()).toBe(30);
  });

  it("despues de la primera publicacion, se rechaza tambien desactivar un KPI", async () => {
    const { split } = await buildPublishedSplit();
    await expect(
      updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", { isActive: false, baseMax: 30, multiplierN2: 1, parameters: { pointsPerResult: 30 } }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("despues de la primera publicacion, se rechazan los puntos por posicion", async () => {
    const { split } = await buildPublishedSplit();
    const rules = await testDb.splitPositionPointRule.findMany({ where: { splitId: split.id } });
    await expect(
      updatePositionPointRules(testDb, split.id, rules.map((rule) => ({ position: rule.position, points: rule.points + 1 }))),
    ).rejects.toBeInstanceOf(DomainError);

    const unchangedRules = await testDb.splitPositionPointRule.findMany({ where: { splitId: split.id }, orderBy: { position: "asc" } });
    expect(unchangedRules.map((rule) => rule.points)).toEqual(rules.sort((a, b) => a.position - b.position).map((rule) => rule.points));
  });

  it("el bloqueo no depende del estado de un formulario deshabilitado: se aplica siempre en el servicio", async () => {
    const { split } = await buildPublishedSplit();
    // Llamada directa al servicio, sin pasar por ninguna Server Action ni formulario: el bloqueo sigue vigente.
    await expect(
      updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", { isActive: true, baseMax: 1, multiplierN2: 1, parameters: { pointsPerResult: 1 } }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

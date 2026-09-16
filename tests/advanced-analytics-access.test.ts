import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import { buildNavItems } from "@/components/nav-items";
import { config as middlewareConfig } from "@/middleware";
import { createPerson } from "@/server/services/person.service";
import { activateSplit, createSplitWithWeeks, listSplitWeeks } from "@/server/services/split.service";
import { addParticipant } from "@/server/services/participant.service";
import { updateKpiConfig } from "@/server/services/kpi.service";
import { saveStabilityEntries } from "@/server/services/stability-entry.service";
import { publishWeek } from "@/server/services/publish-week.service";
import { loadParticipantWeekObservations } from "@/server/services/analytics.service";
import { buildPersonDetailWeeks, resolveObservations } from "@/domain/analytics";
import { markAllPresent } from "./helpers/attendance";

function form(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

describe("Acceso al modulo de Analitica avanzada (parte J2 del encargo)", () => {
  it("el administrador ve 'Analítica avanzada' justo debajo de 'Badges', que a su vez esta justo debajo de 'Resultados' (`1.2.3`)", () => {
    const items = buildNavItems({ isAuthenticated: true, isAdmin: true, hasPersonId: false });
    const resultadosIndex = items.findIndex((item) => item.href === "/resultados");
    expect(items[resultadosIndex + 1]).toEqual({ href: "/badges", label: "Badges", icon: "Award" });
    expect(items[resultadosIndex + 2]).toEqual({ href: "/analitica", label: "Analítica avanzada", icon: "BarChart3" });
  });

  it("un participante nunca ve el enlace de Analítica avanzada, aunque este vinculado a una persona", () => {
    const items = buildNavItems({ isAuthenticated: true, isAdmin: false, hasPersonId: true });
    expect(items.some((item) => item.href === "/analitica")).toBe(false);
  });

  it("sin sesion no se muestra ningun enlace, incluido el de Analítica avanzada", () => {
    expect(buildNavItems({ isAuthenticated: false, isAdmin: false, hasPersonId: false })).toEqual([]);
  });

  it("el matcher del middleware protege /analitica en servidor, no solo por el enlace del menu", () => {
    expect(middlewareConfig.matcher).toContain("/analitica/:path*");
  });
});

describe("El motor de lectura no expone datos ajenos al analisis (parte J2)", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("una observacion cargada nunca incluye correo, hash de contrasena ni bytes de avatar", async () => {
    const person = await createPerson(testDb, { fullName: "Persona Privacidad", email: "privacidad@example.com" });
    const split = await createSplitWithWeeks(testDb, { name: "Split Privacidad", description: undefined, startDate: "2026-03-02", numberOfWeeks: 1 });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "AliasPriv", level: "N2", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", { isActive: true, baseMax: 30, multiplierN2: 1, parameters: { pointsPerResult: 30 } });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "1" }));
    await markAllPresent(testDb, split.id, week.id);
    await publishWeek(testDb, split.id, week.id, null);

    const observations = await loadParticipantWeekObservations(testDb, { splitIds: [split.id], startDate: week.startDate, endDate: week.startDate });
    expect(observations).toHaveLength(1);

    const serialized = JSON.stringify(observations);
    expect(serialized).not.toContain("privacidad@example.com");
    expect(serialized.toLowerCase()).not.toContain("passwordhash");
    expect(serialized.toLowerCase()).not.toContain("imagedata");
    // Identidad de analisis explicita (parte A2): personId y nombre real, nunca alias ni faccion.
    expect(observations[0]?.personId).toBe(person.id);
    expect(observations[0]?.personFullName).toBe("Persona Privacidad");
    expect(serialized).not.toContain("AliasPriv");
  });

  it("el detalle de una persona sin observaciones en el alcance no devuelve filas de otra persona", async () => {
    const personA = await createPerson(testDb, { fullName: "Persona A", email: undefined });
    const personB = await createPerson(testDb, { fullName: "Persona B", email: undefined });
    const split = await createSplitWithWeeks(testDb, { name: "Split Detalle", description: undefined, startDate: "2026-03-02", numberOfWeeks: 1 });
    const participantB = await addParticipant(testDb, split.id, { personId: personB.id, alias: "B", level: "N2", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", { isActive: true, baseMax: 30, multiplierN2: 1, parameters: { pointsPerResult: 30 } });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participantB.id}`]: "1" }));
    await markAllPresent(testDb, split.id, week.id);
    await publishWeek(testDb, split.id, week.id, null);

    const observations = await loadParticipantWeekObservations(testDb, { splitIds: [split.id], startDate: week.startDate, endDate: week.startDate });
    const resolved = resolveObservations(observations, { mode: "sin" });

    const detailForA = buildPersonDetailWeeks(
      personA.id,
      resolved.filter((o) => o.personId === personA.id),
      resolved,
    );
    expect(detailForA).toHaveLength(0);
  });
});

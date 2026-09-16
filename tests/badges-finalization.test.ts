import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import { markAllPresent } from "./helpers/attendance";
import { buildNavItems } from "@/components/nav-items";
import { config as middlewareConfig } from "@/middleware";
import { createPerson } from "@/server/services/person.service";
import { createSplitWithWeeks, activateSplit, listSplitWeeks } from "@/server/services/split.service";
import { addParticipant } from "@/server/services/participant.service";
import { updateKpiConfig } from "@/server/services/kpi.service";
import { createFaction } from "@/server/services/faction.service";
import { saveStabilityEntries } from "@/server/services/stability-entry.service";
import { publishWeek } from "@/server/services/publish-week.service";
import { finalizeSplit } from "@/server/services/finalize-split.service";

/**
 * Concesion de badges al finalizar un split (`1.2.3`, seccion 1/7/11.3 del
 * encargo, ver docs/BADGES.md). Nombres sinteticos de prueba, ajenos al
 * dataset historico real.
 */

function form(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

async function createDraftSplit(name: string, numberOfWeeks = 1) {
  return createSplitWithWeeks(testDb, { name, description: undefined, startDate: "2026-03-02", numberOfWeeks });
}

async function activateStabilityKpi(splitId: string) {
  await updateKpiConfig(testDb, splitId, "STABILITY_GUARDIAN", {
    isActive: true,
    baseMax: 1000,
    multiplierN2: 1,
    parameters: { pointsPerResult: 1 },
  });
}

beforeEach(async () => {
  await resetDatabase();
});

describe("Navegacion y proteccion de ruta de Badges", () => {
  it("el administrador ve Badges justo debajo de Resultados, antes de Analítica avanzada", () => {
    const items = buildNavItems({ isAuthenticated: true, isAdmin: true, hasPersonId: false });
    const resultadosIndex = items.findIndex((item) => item.href === "/resultados");
    expect(items[resultadosIndex + 1]).toEqual({ href: "/badges", label: "Badges", icon: "Award" });
    expect(items[resultadosIndex + 2]?.href).toBe("/analitica");
  });

  it("un participante ve Badges entre Resultados y Fichas", () => {
    const items = buildNavItems({ isAuthenticated: true, isAdmin: false, hasPersonId: true });
    expect(items.map((item) => item.href)).toEqual(["/noticias", "/resultados", "/badges", "/fichas"]);
  });

  it("el matcher del middleware protege /badges en servidor, no solo por el enlace del menu", () => {
    expect(middlewareConfig.matcher).toContain("/badges/:path*");
  });
});

describe("Finalizar split: concesion automatica de badges (seccion 1/7 del encargo)", () => {
  it("concede MVP a la persona en el rango 1 de la clasificacion general", async () => {
    const split = await createDraftSplit("Split MVP");
    const winner = await createPerson(testDb, { fullName: "Ganador Uno", email: undefined });
    const loser = await createPerson(testDb, { fullName: "Perdedor Dos", email: undefined });
    const winnerParticipant = await addParticipant(testDb, split.id, { personId: winner.id, alias: "Ganador", level: "N2", startWeekSequenceNumber: 1 });
    const loserParticipant = await addParticipant(testDb, split.id, { personId: loser.id, alias: "Perdedor", level: "N2", startWeekSequenceNumber: 1 });
    await activateStabilityKpi(split.id);
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await saveStabilityEntries(
      testDb,
      split.id,
      week.id,
      form({ [`resultValue__${winnerParticipant.id}`]: "100", [`resultValue__${loserParticipant.id}`]: "10" }),
    );
    await markAllPresent(testDb, split.id, week.id);
    await publishWeek(testDb, split.id, week.id, null);

    await finalizeSplit(testDb, split.id);

    const mvpAwards = await testDb.badgeAward.findMany({ where: { splitId: split.id, badge: { code: "MVP" } } });
    expect(mvpAwards).toHaveLength(1);
    expect(mvpAwards[0]!.personId).toBe(winner.id);
    expect(mvpAwards[0]!.origin).toBe("SPLIT_FINALIZATION");
    expect(mvpAwards[0]!.grantedAt).not.toBeNull();

    const noMvpForLoser = await testDb.badgeAward.count({ where: { splitId: split.id, badge: { code: "MVP" }, personId: loser.id } });
    expect(noMvpForLoser).toBe(0);
  });

  it("concede MVP Team a todos los miembros actuales de la faccion ganadora", async () => {
    const split = await createDraftSplit("Split Facciones");
    const factionA = await createFaction(testDb, split.id, { name: "Alfa", color: "#ff0000" });
    const factionB = await createFaction(testDb, split.id, { name: "Beta", color: "#0000ff" });

    const participantsA = [];
    const participantsB = [];
    for (let i = 0; i < 3; i += 1) {
      const personA = await createPerson(testDb, { fullName: `Persona Alfa ${i}`, email: undefined });
      participantsA.push(
        await addParticipant(testDb, split.id, { personId: personA.id, alias: `Alfa${i}`, level: "N2", startWeekSequenceNumber: 1, factionId: factionA.id }),
      );
      const personB = await createPerson(testDb, { fullName: `Persona Beta ${i}`, email: undefined });
      participantsB.push(
        await addParticipant(testDb, split.id, { personId: personB.id, alias: `Beta${i}`, level: "N2", startWeekSequenceNumber: 1, factionId: factionB.id }),
      );
    }
    await activateStabilityKpi(split.id);
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    const entries: Record<string, string> = {};
    participantsA.forEach((p, i) => (entries[`resultValue__${p.id}`] = String(60 - i * 10))); // 60, 50, 40
    participantsB.forEach((p, i) => (entries[`resultValue__${p.id}`] = String(10 - i))); // 10, 9, 8
    await saveStabilityEntries(testDb, split.id, week.id, form(entries));
    await markAllPresent(testDb, split.id, week.id);
    await publishWeek(testDb, split.id, week.id, null);

    await finalizeSplit(testDb, split.id);

    const teamMvpAwards = await testDb.badgeAward.findMany({ where: { splitId: split.id, badge: { code: "TEAM_MVP" } } });
    expect(teamMvpAwards).toHaveLength(3);
    const awardedPersonIds = teamMvpAwards.map((a) => a.personId).sort();
    const alfaPersonIds = await Promise.all(participantsA.map(async (p) => (await testDb.splitParticipant.findUniqueOrThrow({ where: { id: p.id } })).personId));
    expect(awardedPersonIds).toEqual(alfaPersonIds.sort());
  });

  it("un split sin facciones no concede ningun badge MVP Team", async () => {
    const split = await createDraftSplit("Split Sin Facciones");
    const person = await createPerson(testDb, { fullName: "Sin Faccion", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "SinFaccion", level: "N2", startWeekSequenceNumber: 1 });
    await activateStabilityKpi(split.id);
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "10" }));
    await markAllPresent(testDb, split.id, week.id);
    await publishWeek(testDb, split.id, week.id, null);

    await finalizeSplit(testDb, split.id);

    const teamMvpAwards = await testDb.badgeAward.count({ where: { splitId: split.id, badge: { code: "TEAM_MVP" } } });
    expect(teamMvpAwards).toBe(0);
  });

  it("un empate en un KPI concede el badge de esa categoria a todos los empatados", async () => {
    const split = await createDraftSplit("Split Empate KPI");
    const personA = await createPerson(testDb, { fullName: "Empate A", email: undefined });
    const personB = await createPerson(testDb, { fullName: "Empate B", email: undefined });
    const participantA = await addParticipant(testDb, split.id, { personId: personA.id, alias: "EmpateA", level: "N2", startWeekSequenceNumber: 1 });
    const participantB = await addParticipant(testDb, split.id, { personId: personB.id, alias: "EmpateB", level: "N2", startWeekSequenceNumber: 1 });
    await activateStabilityKpi(split.id);
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await saveStabilityEntries(
      testDb,
      split.id,
      week.id,
      form({ [`resultValue__${participantA.id}`]: "50", [`resultValue__${participantB.id}`]: "50" }),
    );
    await markAllPresent(testDb, split.id, week.id);
    await publishWeek(testDb, split.id, week.id, null);

    await finalizeSplit(testDb, split.id);

    const kpiAwards = await testDb.badgeAward.findMany({ where: { splitId: split.id, badge: { code: "STABILITY_GUARDIAN" } } });
    expect(kpiAwards).toHaveLength(2);
    expect(kpiAwards.map((a) => a.personId).sort()).toEqual([personA.id, personB.id].sort());
    // Un empate general en puntos por posicion tambien concede MVP a ambos.
    const mvpAwards = await testDb.badgeAward.findMany({ where: { splitId: split.id, badge: { code: "MVP" } } });
    expect(mvpAwards).toHaveLength(2);
  });

  it("finalizar dos veces (reintento) nunca duplica badges ni la noticia agregada", async () => {
    const split = await createDraftSplit("Split Reintento");
    const person = await createPerson(testDb, { fullName: "Reintento Uno", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "Reintento", level: "N2", startWeekSequenceNumber: 1 });
    await activateStabilityKpi(split.id);
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "10" }));
    await markAllPresent(testDb, split.id, week.id);
    await publishWeek(testDb, split.id, week.id, null);

    const first = await finalizeSplit(testDb, split.id);
    expect(first.alreadyFinalized).toBe(false);
    const second = await finalizeSplit(testDb, split.id);
    expect(second.alreadyFinalized).toBe(true);

    const mvpAwards = await testDb.badgeAward.count({ where: { splitId: split.id, badge: { code: "MVP" } } });
    expect(mvpAwards).toBe(1);
    const badgeNews = await testDb.newsItem.count({ where: { splitId: split.id, category: "BADGE" } });
    expect(badgeNews).toBe(1);
  });

  it("genera una unica noticia agregada por persona premiada, enlazando a Mi vitrina", async () => {
    const split = await createDraftSplit("Split Noticia");
    const person = await createPerson(testDb, { fullName: "Premiado Uno", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "Premiado", level: "N2", startWeekSequenceNumber: 1 });
    await activateStabilityKpi(split.id);
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "10" }));
    await markAllPresent(testDb, split.id, week.id);
    await publishWeek(testDb, split.id, week.id, null);

    await finalizeSplit(testDb, split.id);

    const deliveries = await testDb.newsDelivery.findMany({
      where: { recipientPersonId: person.id, newsItem: { splitId: split.id, category: "BADGE" } },
      include: { newsItem: true },
    });
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]!.actionPath).toBe("/badges?vista=vitrina");
    expect(deliveries[0]!.newsItem.body).toContain("MVP");
  });
});

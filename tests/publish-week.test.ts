import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import { createPerson } from "@/server/services/person.service";
import { createSplitWithWeeks, activateSplit, listSplitWeeks } from "@/server/services/split.service";
import { addParticipant } from "@/server/services/participant.service";
import { updateKpiConfig } from "@/server/services/kpi.service";
import { saveStabilityEntries } from "@/server/services/stability-entry.service";
import { saveWriterEntries } from "@/server/services/writer-entry.service";
import { publishWeek } from "@/server/services/publish-week.service";
import { DomainError } from "@/lib/errors";

async function createDraftSplit(numberOfWeeks = 2) {
  return createSplitWithWeeks(testDb, {
    name: "Split de publicacion",
    description: undefined,
    startDate: "2025-10-06",
    numberOfWeeks,
  });
}

function form(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

async function buildReadySplit() {
  const split = await createDraftSplit();
  const person = await createPerson(testDb, { fullName: "Persona Publicable", email: undefined });
  const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "Publicable", level: "N2", startWeekSequenceNumber: 1 });
  await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", {
    isActive: true, baseMax: 30, multiplierN2: 1, parameters: { pointsPerResult: 30 },
  });
  await activateSplit(testDb, split.id);
  const week = (await listSplitWeeks(testDb, split.id))[0]!;
  await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "1" }));
  return { split, person, participant, week };
}

beforeEach(async () => {
  await resetDatabase();
});

describe("publishWeek: precondiciones", () => {
  it("rechaza publicar una semana incompleta", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Incompleta", email: undefined });
    await addParticipant(testDb, split.id, { personId: person.id, alias: "Incompleto", level: "N2", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", {
      isActive: true, baseMax: 30, multiplierN2: 1, parameters: { pointsPerResult: 30 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    await expect(publishWeek(testDb, split.id, week.id, null)).rejects.toBeInstanceOf(DomainError);
    expect(await testDb.weekPublication.count()).toBe(0);
  });

  it("rechaza publicar en un split que no esta activo", async () => {
    const { split, week } = await buildReadySplit();
    await testDb.split.update({ where: { id: split.id }, data: { status: "CLOSED" } });
    await expect(publishWeek(testDb, split.id, week.id, null)).rejects.toBeInstanceOf(DomainError);
  });
});

describe("publishWeek: instantanea y bloqueo", () => {
  it("crea la instantanea completa en una transaccion, con nombre/alias/nivel/maximos/ranking congelados", async () => {
    const { split, participant, week } = await buildReadySplit();

    const result = await publishWeek(testDb, split.id, week.id, null);
    expect(result.alreadyPublished).toBe(false);

    const publication = await testDb.weekPublication.findUnique({
      where: { splitWeekId: week.id },
      include: { participantResults: { include: { kpiResults: true } } },
    });
    expect(publication).not.toBeNull();
    expect(publication!.participantResults).toHaveLength(1);
    const participantResult = publication!.participantResults[0]!;
    expect(participantResult.splitParticipantId).toBe(participant.id);
    expect(participantResult.aliasSnapshot).toBe("Publicable");
    expect(participantResult.levelSnapshot).toBe("N2");
    expect(participantResult.weeklyRank).toBe(1);
    expect(participantResult.positionPoints).toBe(15);
    expect(participantResult.kpiResults).toHaveLength(1);
    expect(participantResult.kpiResults[0]).toMatchObject({ kpiCode: "STABILITY_GUARDIAN", outcomeStatus: "COMPUTED" });
    expect(participantResult.kpiResults[0]!.finalPoints?.toNumber()).toBe(30);
  });

  it("una segunda publicacion no duplica datos", async () => {
    const { split, week } = await buildReadySplit();
    await publishWeek(testDb, split.id, week.id, null);
    await expect(publishWeek(testDb, split.id, week.id, null)).rejects.toBeInstanceOf(DomainError);
    expect(await testDb.weekPublication.count({ where: { splitWeekId: week.id } })).toBe(1);
  });

  it("un cambio de configuracion despues de publicar no altera la lectura publicada", async () => {
    const { split, week, participant } = await buildReadySplit();
    await publishWeek(testDb, split.id, week.id, null);

    await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", {
      isActive: true, baseMax: 5, multiplierN2: 1, parameters: { pointsPerResult: 30 },
    });

    const publication = await testDb.weekPublication.findUnique({
      where: { splitWeekId: week.id },
      include: { participantResults: { include: { kpiResults: true } } },
    });
    const kpiResult = publication!.participantResults.find((row) => row.splitParticipantId === participant.id)!.kpiResults[0]!;
    // Sigue reflejando el maximo de 30 vigente al publicar, no el 5 recien configurado.
    expect(kpiResult.baseMax?.toNumber()).toBe(30);
    expect(kpiResult.finalPoints?.toNumber()).toBe(30);
  });

  it("todas las mutaciones manuales y Excel relevantes rechazan una semana publicada", async () => {
    const { split, week, participant } = await buildReadySplit();
    await publishWeek(testDb, split.id, week.id, null);

    await expect(
      saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "2" })),
    ).rejects.toBeInstanceOf(DomainError);

    // Redactor estrella no estaba activo, pero el guardado igualmente debe rechazarse por semana bloqueada antes de llegar a filtrar participantes.
    await updateKpiConfig(testDb, split.id, "STAR_WRITER", {
      isActive: true, baseMax: 60, multiplierN2: 1, parameters: { approvedArticlePoints: 10, negativeArticlePoints: 10, proposalPoints: 5 },
    });
    await expect(
      saveWriterEntries(
        testDb,
        split.id,
        week.id,
        form({ [`deliveredArticles__${participant.id}`]: "1", [`undeliveredArticles__${participant.id}`]: "0", [`proposedArticles__${participant.id}`]: "0" }),
      ),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("no permite anadir un participante con semana inicial en una semana ya publicada, pero si en una semana futura", async () => {
    const { split, week } = await buildReadySplit();
    await publishWeek(testDb, split.id, week.id, null);

    const newPerson = await createPerson(testDb, { fullName: "Persona Nueva", email: undefined });
    await expect(
      addParticipant(testDb, split.id, { personId: newPerson.id, alias: "Nueva", level: "N1", startWeekSequenceNumber: week.sequenceNumber }),
    ).rejects.toBeInstanceOf(DomainError);

    const anotherPerson = await createPerson(testDb, { fullName: "Persona Futura", email: undefined });
    const futureParticipant = await addParticipant(testDb, split.id, {
      personId: anotherPerson.id,
      alias: "Futura",
      level: "N1",
      startWeekSequenceNumber: week.sequenceNumber + 1,
    });
    expect(futureParticipant.startWeekSequenceNumber).toBe(week.sequenceNumber + 1);
  });
});

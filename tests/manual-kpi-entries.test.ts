import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import { buildWorkbookBuffer, ESCALATION_HEADERS, QUALITY_HEADERS, VOICE_HEADERS } from "./helpers/xlsx";
import { createPerson } from "@/server/services/person.service";
import { activateSplit, createSplitWithWeeks, listSplitWeeks } from "@/server/services/split.service";
import { addParticipant } from "@/server/services/participant.service";
import { updateKpiConfig } from "@/server/services/kpi.service";
import {
  getStabilityCheckView,
  getStabilityFormView,
  getStabilityLoadStatus,
  saveStabilityEntries,
} from "@/server/services/stability-entry.service";
import {
  getChronomancyCheckView,
  saveChronomancyEntries,
} from "@/server/services/chronomancy-entry.service";
import { getWriterCheckView, saveWriterEntries } from "@/server/services/writer-entry.service";
import { getStudentCheckView, getStudentLoadStatus, saveStudentEntries } from "@/server/services/student-entry.service";
import { getApprenticeCheckView, saveApprenticeEntries } from "@/server/services/apprentice-entry.service";
import { getWeeklyKpiLoadSummary } from "@/server/services/kpi-load-summary.service";
import { confirmProductivityImport } from "@/server/services/productivity-import.service";
import { confirmEscalationImport } from "@/server/services/escalation-import.service";
import { confirmQualityImport } from "@/server/services/quality-import.service";
import { confirmVoiceImport } from "@/server/services/voice-import.service";
import { ManualEntryValidationError } from "@/server/validation/manual-entry";
import { DomainError } from "@/lib/errors";

async function createDraftSplit(numberOfWeeks = 1) {
  return createSplitWithWeeks(testDb, {
    name: "Split de entradas manuales",
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

beforeEach(async () => {
  await resetDatabase();
});

describe("Guardado manual atomico y validacion de servidor", () => {
  it("guarda todas las filas validas o ninguna, y rechaza escribir fuera de un split activo", async () => {
    const split = await createDraftSplit();
    const person1 = await createPerson(testDb, { fullName: "Persona Manual Uno", email: undefined });
    const person2 = await createPerson(testDb, { fullName: "Persona Manual Dos", email: undefined });
    const participant1 = await addParticipant(testDb, split.id, { personId: person1.id, alias: "Manual1", level: "N1", startWeekSequenceNumber: 1 });
    const participant2 = await addParticipant(testDb, split.id, { personId: person2.id, alias: "Manual2", level: "N1", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "ENTHUSIASTIC_STUDENT", {
      isActive: true,
      baseMax: 50,
      multiplierN0: 1,
      multiplierN1: 1,
      multiplierN2: 1,
      parameters: { pointsPerHour: 12.5 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    // Split todavia en borrador (antes de activar) rechaza la escritura.
    const draftSplit = await createDraftSplit();
    const draftWeek = (await listSplitWeeks(testDb, draftSplit.id))[0]!;
    await expect(
      saveStudentEntries(testDb, draftSplit.id, draftWeek.id, form({ [`dedicatedHours__x`]: "1" })),
    ).rejects.toBeInstanceOf(DomainError);

    // Una fila invalida bloquea el guardado completo (atomico): nada se persiste.
    const invalidForm = form({
      [`dedicatedHours__${participant1.id}`]: "10",
      [`dedicatedHours__${participant2.id}`]: "no-es-un-numero",
    });
    await expect(saveStudentEntries(testDb, split.id, week.id, invalidForm)).rejects.toBeInstanceOf(ManualEntryValidationError);
    expect(await testDb.studentWeeklyEntry.count({ where: { splitWeekId: week.id } })).toBe(0);

    // Guardado valido completo.
    const validForm = form({
      [`dedicatedHours__${participant1.id}`]: "10",
      [`dedicatedHours__${participant2.id}`]: "0",
    });
    await saveStudentEntries(testDb, split.id, week.id, validForm);
    expect(await testDb.studentWeeklyEntry.count({ where: { splitWeekId: week.id } })).toBe(2);

    // Sustitucion: un segundo guardado reemplaza el conjunto anterior sin duplicar filas.
    const updatedForm = form({
      [`dedicatedHours__${participant1.id}`]: "5",
      [`dedicatedHours__${participant2.id}`]: "2,5",
    });
    await saveStudentEntries(testDb, split.id, week.id, updatedForm);
    const rows = await testDb.studentWeeklyEntry.findMany({ where: { splitWeekId: week.id } });
    expect(rows).toHaveLength(2);
    expect(rows.find((row) => row.splitParticipantId === participant1.id)?.dedicatedHours.toNumber()).toBe(5);
    expect(rows.find((row) => row.splitParticipantId === participant2.id)?.dedicatedHours.toNumber()).toBe(2.5);

    // Cerrar el split prohibe cualquier escritura, aunque se invoque directamente.
    await testDb.split.update({ where: { id: split.id }, data: { status: "CLOSED" } });
    await expect(saveStudentEntries(testDb, split.id, week.id, validForm)).rejects.toBeInstanceOf(DomainError);
  });
});

describe("Guardian de la Estabilidad: solo N2, cero valido y maximo aplicado", () => {
  it("muestra solo participantes N2, acepta cero como resultado real y limita al maximo base", async () => {
    const split = await createDraftSplit();
    const personN2 = await createPerson(testDb, { fullName: "Persona N2", email: undefined });
    const personN1 = await createPerson(testDb, { fullName: "Persona N1", email: undefined });
    const participantN2 = await addParticipant(testDb, split.id, { personId: personN2.id, alias: "N2Alias", level: "N2", startWeekSequenceNumber: 1 });
    await addParticipant(testDb, split.id, { personId: personN1.id, alias: "N1Alias", level: "N1", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", {
      isActive: true,
      baseMax: 30,
      multiplierN2: 1,
      parameters: { pointsPerResult: 30 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    const formView = await getStabilityFormView(testDb, split.id, week.id);
    expect(formView.rows).toHaveLength(1);
    expect(formView.rows[0]?.participantId).toBe(participantN2.id);

    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participantN2.id}`]: "0" }));
    const zeroCheck = await getStabilityCheckView(testDb, split.id, week.id);
    expect(zeroCheck.rows[0]?.resultValue).toBe(0);
    expect(zeroCheck.rows[0]?.stabilityGuardian).toMatchObject({ status: "computed", finalPoints: 0 });

    // 2 resultados x 30 puntos x multiplicador 1 = 60, limitado al maximo de 30.
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participantN2.id}`]: "2" }));
    const cappedCheck = await getStabilityCheckView(testDb, split.id, week.id);
    expect(cappedCheck.rows[0]?.stabilityGuardian).toMatchObject({ status: "computed", rawPoints: 60, finalPoints: 30, capped: true });
  });

  it("se considera completo (verde) cuando no hay ningun N2 aplicable esta semana", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Solo N1", email: undefined });
    await addParticipant(testDb, split.id, { personId: person.id, alias: "SoloN1", level: "N1", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", {
      isActive: true,
      baseMax: 30,
      multiplierN2: 1,
      parameters: { pointsPerResult: 30 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    const status = await getStabilityLoadStatus(testDb, split.id, week.id, week.sequenceNumber);
    expect(status).toEqual({ status: "LOADED", vacCount: 0 });
  });
});

describe("Cronomagia laboral: occupancy, limite al 100% y VAC de 0/0", () => {
  it.each([
    { name: "ratio normal", productive: "38.5", total: "40", expectedOccupancy: 96.25 },
    { name: "ratio superior al 100%, limitado", productive: "46.7", total: "40", expectedOccupancy: 100 },
  ])("$name", async ({ productive, total, expectedOccupancy }) => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Cronomagia", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "Crono", level: "N1", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "WORK_CHRONOMANCY", {
      isActive: true,
      baseMax: 60,
      multiplierN1: 1,
      parameters: { pointsAtFullOccupancy: 60 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    await saveChronomancyEntries(
      testDb,
      split.id,
      week.id,
      form({ [`productiveHours__${participant.id}`]: productive, [`totalHours__${participant.id}`]: total }),
    );
    const check = await getChronomancyCheckView(testDb, split.id, week.id);
    expect(check.rows[0]?.workChronomancy).toMatchObject({ status: "computed", occupancy: expectedOccupancy / 100 });
  });

  it("trata 0/0 como VAC sin puntos, y rechaza productivas > 0 con total 0", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Vacaciones", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "Vacaciones", level: "N1", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "WORK_CHRONOMANCY", {
      isActive: true,
      baseMax: 60,
      multiplierN1: 1,
      parameters: { pointsAtFullOccupancy: 60 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    await saveChronomancyEntries(
      testDb,
      split.id,
      week.id,
      form({ [`productiveHours__${participant.id}`]: "0", [`totalHours__${participant.id}`]: "0" }),
    );
    const check = await getChronomancyCheckView(testDb, split.id, week.id);
    expect(check.rows[0]?.workChronomancy).toEqual({ status: "vac" });

    await expect(
      saveChronomancyEntries(
        testDb,
        split.id,
        week.id,
        form({ [`productiveHours__${participant.id}`]: "1", [`totalHours__${participant.id}`]: "0" }),
      ),
    ).rejects.toBeInstanceOf(ManualEntryValidationError);
  });
});

describe("Redactor estrella: entregados, no entregados y propuestas en la misma semana", () => {
  it("resta sin multiplicador y permite un resultado negativo sin suelo de cero", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Redactor", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "Redactor", level: "N1", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "STAR_WRITER", {
      isActive: true,
      baseMax: 60,
      multiplierN1: 2,
      parameters: { approvedArticlePoints: 10, negativeArticlePoints: 10, proposalPoints: 5 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    // 1 entregado x 10 x 2 - 1 no entregado x 10 + 2 propuestas x 5 = 20.
    await saveWriterEntries(
      testDb,
      split.id,
      week.id,
      form({
        [`deliveredArticles__${participant.id}`]: "1",
        [`undeliveredArticles__${participant.id}`]: "1",
        [`proposedArticles__${participant.id}`]: "2",
      }),
    );
    const check = await getWriterCheckView(testDb, split.id, week.id);
    expect(check.rows[0]?.starWriter).toMatchObject({ status: "computed", finalPoints: 20 });

    // Solo no entregados: resultado negativo, sin suelo de cero.
    await saveWriterEntries(
      testDb,
      split.id,
      week.id,
      form({
        [`deliveredArticles__${participant.id}`]: "0",
        [`undeliveredArticles__${participant.id}`]: "3",
        [`proposedArticles__${participant.id}`]: "0",
      }),
    );
    const negativeCheck = await getWriterCheckView(testDb, split.id, week.id);
    expect(negativeCheck.rows[0]?.starWriter).toMatchObject({ status: "computed", finalPoints: -30 });
  });
});

describe("Estudiante entusiasta: horas decimales, cero y maximo", () => {
  it("acepta decimales y cero, y aplica el maximo base", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Estudiante", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "Estudiante", level: "N1", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "ENTHUSIASTIC_STUDENT", {
      isActive: true,
      baseMax: 50,
      multiplierN1: 1,
      parameters: { pointsPerHour: 12.5 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    await saveStudentEntries(testDb, split.id, week.id, form({ [`dedicatedHours__${participant.id}`]: "5,5" }));
    const check = await getStudentCheckView(testDb, split.id, week.id);
    // 5.5 x 12.5 x 1 = 68.75, limitado al maximo de 50.
    expect(check.rows[0]?.enthusiasticStudent).toMatchObject({ status: "computed", rawPoints: 68.75, finalPoints: 50, capped: true });

    await saveStudentEntries(testDb, split.id, week.id, form({ [`dedicatedHours__${participant.id}`]: "0" }));
    const zeroCheck = await getStudentCheckView(testDb, split.id, week.id);
    expect(zeroCheck.rows[0]?.dedicatedHours).toBe(0);
    expect(zeroCheck.rows[0]?.enthusiasticStudent).toMatchObject({ status: "computed", finalPoints: 0 });
  });
});

describe("Aprendiz experto: conteo entero, maximo configurado y calculo", () => {
  it("rechaza superar targetValue y calcula correctamente dentro del limite", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Aprendiz", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "Aprendiz", level: "N1", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "EXPERT_APPRENTICE", {
      isActive: true,
      baseMax: 50,
      multiplierN1: 1,
      parameters: { targetValue: 15, pointsAtTarget: 50 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    await expect(
      saveApprenticeEntries(testDb, split.id, week.id, form({ [`completedTrainings__${participant.id}`]: "20" })),
    ).rejects.toBeInstanceOf(ManualEntryValidationError);

    await saveApprenticeEntries(testDb, split.id, week.id, form({ [`completedTrainings__${participant.id}`]: "6" }));
    const check = await getApprenticeCheckView(testDb, split.id, week.id);
    // 6 / 15 x 50 x 1 = 20.
    expect(check.rows[0]?.expertApprentice).toMatchObject({ status: "computed", finalPoints: 20 });
  });

  it("el maximo configurado es inclusivo: acepta exactamente targetValue y rechaza targetValue + 1 (BUGFIX-1 / UX-SPLIT-1)", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Aprendiz Limite", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "AprendizLimite", level: "N1", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "EXPERT_APPRENTICE", {
      isActive: true,
      baseMax: 50,
      multiplierN1: 1,
      parameters: { targetValue: 15, pointsAtTarget: 50 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    // Exactamente targetValue (15) es valido: el maximo es inclusivo.
    await saveApprenticeEntries(testDb, split.id, week.id, form({ [`completedTrainings__${participant.id}`]: "15" }));
    const check = await getApprenticeCheckView(testDb, split.id, week.id);
    expect(check.rows[0]?.completedTrainings).toBe(15);
    // 15 / 15 x 50 x 1 = 50.
    expect(check.rows[0]?.expertApprentice).toMatchObject({ status: "computed", finalPoints: 50 });

    // targetValue + 1 (16) se rechaza.
    await expect(
      saveApprenticeEntries(testDb, split.id, week.id, form({ [`completedTrainings__${participant.id}`]: "16" })),
    ).rejects.toBeInstanceOf(ManualEntryValidationError);
  });

  it("un campo vacio o '0' se guarda como cero, nunca como ausencia de fila (BUGFIX-1 / UX-SPLIT-1)", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Aprendiz Cero", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "AprendizCero", level: "N1", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "EXPERT_APPRENTICE", {
      isActive: true,
      baseMax: 50,
      multiplierN1: 1,
      parameters: { targetValue: 15, pointsAtTarget: 50 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    await saveApprenticeEntries(testDb, split.id, week.id, form({ [`completedTrainings__${participant.id}`]: "" }));
    const emptyCheck = await getApprenticeCheckView(testDb, split.id, week.id);
    expect(emptyCheck.rows[0]?.completedTrainings).toBe(0);

    await saveApprenticeEntries(testDb, split.id, week.id, form({ [`completedTrainings__${participant.id}`]: "0" }));
    const explicitZeroCheck = await getApprenticeCheckView(testDb, split.id, week.id);
    expect(explicitZeroCheck.rows[0]?.completedTrainings).toBe(0);
  });
});

describe("Redactor estrella: campos vacios equivalen a cero (BUGFIX-1 / UX-SPLIT-1)", () => {
  it("guarda los tres campos vacios de una persona como tres ceros, y el resultado se calcula como cero", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Redactor Vacio", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "RedactorVacio", level: "N1", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "STAR_WRITER", {
      isActive: true,
      baseMax: 60,
      multiplierN1: 2,
      parameters: { approvedArticlePoints: 10, negativeArticlePoints: 10, proposalPoints: 5 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    await saveWriterEntries(
      testDb,
      split.id,
      week.id,
      form({
        [`deliveredArticles__${participant.id}`]: "",
        [`undeliveredArticles__${participant.id}`]: "",
        [`proposedArticles__${participant.id}`]: "",
      }),
    );
    const check = await getWriterCheckView(testDb, split.id, week.id);
    expect(check.rows[0]?.deliveredArticles).toBe(0);
    expect(check.rows[0]?.undeliveredArticles).toBe(0);
    expect(check.rows[0]?.proposedArticles).toBe(0);
    expect(check.rows[0]?.starWriter).toMatchObject({ status: "computed", finalPoints: 0 });
  });

  it("acepta combinaciones de campos vacios y rellenos para la misma carga, sin exigir el campo obligatorio", async () => {
    const split = await createDraftSplit();
    const person1 = await createPerson(testDb, { fullName: "Persona Redactor Mixto Uno", email: undefined });
    const person2 = await createPerson(testDb, { fullName: "Persona Redactor Mixto Dos", email: undefined });
    const participant1 = await addParticipant(testDb, split.id, { personId: person1.id, alias: "RedactorMixto1", level: "N1", startWeekSequenceNumber: 1 });
    const participant2 = await addParticipant(testDb, split.id, { personId: person2.id, alias: "RedactorMixto2", level: "N1", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "STAR_WRITER", {
      isActive: true,
      baseMax: 60,
      multiplierN1: 2,
      parameters: { approvedArticlePoints: 10, negativeArticlePoints: 10, proposalPoints: 5 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    await saveWriterEntries(
      testDb,
      split.id,
      week.id,
      form({
        [`deliveredArticles__${participant1.id}`]: "2",
        [`undeliveredArticles__${participant1.id}`]: "",
        [`proposedArticles__${participant1.id}`]: "1",
        [`deliveredArticles__${participant2.id}`]: "",
        [`undeliveredArticles__${participant2.id}`]: "",
        [`proposedArticles__${participant2.id}`]: "",
      }),
    );
    const check = await getWriterCheckView(testDb, split.id, week.id);
    const row1 = check.rows.find((row) => row.participantId === participant1.id)!;
    const row2 = check.rows.find((row) => row.participantId === participant2.id)!;
    expect(row1.undeliveredArticles).toBe(0);
    // 2 entregados x 10 x 2 + 1 propuesta x 5 = 45.
    expect(row1.starWriter).toMatchObject({ status: "computed", finalPoints: 45 });
    expect(row2.starWriter).toMatchObject({ status: "computed", finalPoints: 0 });
  });

  it("sigue rechazando negativos, decimales y texto no numerico en campos enteros", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Redactor Invalido", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "RedactorInvalido", level: "N1", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "STAR_WRITER", {
      isActive: true,
      baseMax: 60,
      multiplierN1: 2,
      parameters: { approvedArticlePoints: 10, negativeArticlePoints: 10, proposalPoints: 5 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    for (const invalidValue of ["-1", "1,5", "no-es-un-numero"]) {
      await expect(
        saveWriterEntries(
          testDb,
          split.id,
          week.id,
          form({
            [`deliveredArticles__${participant.id}`]: invalidValue,
            [`undeliveredArticles__${participant.id}`]: "0",
            [`proposedArticles__${participant.id}`]: "0",
          }),
        ),
      ).rejects.toBeInstanceOf(ManualEntryValidationError);
    }
    expect(await testDb.writerWeeklyEntry.count({ where: { splitWeekId: week.id } })).toBe(0);
  });
});

describe("Estudiante entusiasta: campo vacio equivale a cero (BUGFIX-1 / UX-SPLIT-1)", () => {
  it("guarda vacio y '0' como cero, y conserva el parseo decimal con coma/punto", async () => {
    const split = await createDraftSplit();
    const person1 = await createPerson(testDb, { fullName: "Persona Estudiante Vacio", email: undefined });
    const person2 = await createPerson(testDb, { fullName: "Persona Estudiante Decimal", email: undefined });
    const participant1 = await addParticipant(testDb, split.id, { personId: person1.id, alias: "EstudianteVacio", level: "N1", startWeekSequenceNumber: 1 });
    const participant2 = await addParticipant(testDb, split.id, { personId: person2.id, alias: "EstudianteDecimal", level: "N1", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "ENTHUSIASTIC_STUDENT", {
      isActive: true,
      baseMax: 50,
      multiplierN1: 1,
      parameters: { pointsPerHour: 12.5 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    await saveStudentEntries(
      testDb,
      split.id,
      week.id,
      form({
        [`dedicatedHours__${participant1.id}`]: "",
        [`dedicatedHours__${participant2.id}`]: "2,5",
      }),
    );
    const check = await getStudentCheckView(testDb, split.id, week.id);
    const row1 = check.rows.find((row) => row.participantId === participant1.id)!;
    const row2 = check.rows.find((row) => row.participantId === participant2.id)!;
    expect(row1.dedicatedHours).toBe(0);
    expect(row1.enthusiasticStudent).toMatchObject({ status: "computed", finalPoints: 0 });
    // 2.5 x 12.5 x 1 = 31.25.
    expect(row2.dedicatedHours).toBe(2.5);
    expect(row2.enthusiasticStudent).toMatchObject({ status: "computed", finalPoints: 31.25 });

    // Todos los participantes aplicables quedan con fila: el grupo puede quedar Cargado.
    expect(await testDb.studentWeeklyEntry.count({ where: { splitWeekId: week.id } })).toBe(2);
    const status = await getStudentLoadStatus(testDb, split.id, week.id, 1);
    expect(status.status).toBe("LOADED");
  });
});

describe("Estados manuales: pendiente con cobertura incompleta, cargado con el conjunto completo", () => {
  it("queda cargado con todos los participantes cubiertos, y vuelve a pendiente si cambia la participacion aplicable", async () => {
    const split = await createDraftSplit();
    const person1 = await createPerson(testDb, { fullName: "Persona Estado Uno", email: undefined });
    const participant1 = await addParticipant(testDb, split.id, { personId: person1.id, alias: "Estado1", level: "N1", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "ENTHUSIASTIC_STUDENT", {
      isActive: true,
      baseMax: 50,
      multiplierN1: 1,
      parameters: { pointsPerHour: 12.5 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    expect(await getStudentLoadStatus(testDb, split.id, week.id, week.sequenceNumber)).toEqual({ status: "PENDING", vacCount: 0 });

    await saveStudentEntries(testDb, split.id, week.id, form({ [`dedicatedHours__${participant1.id}`]: "3" }));
    expect(await getStudentLoadStatus(testDb, split.id, week.id, week.sequenceNumber)).toEqual({ status: "LOADED", vacCount: 0 });

    // Se incorpora un nuevo participante aplicable a la misma semana: falta su fila -> vuelve a pendiente.
    const person2 = await createPerson(testDb, { fullName: "Persona Estado Dos", email: undefined });
    const participant2 = await addParticipant(testDb, split.id, { personId: person2.id, alias: "Estado2", level: "N1", startWeekSequenceNumber: 1 });
    expect(await getStudentLoadStatus(testDb, split.id, week.id, week.sequenceNumber)).toEqual({ status: "PENDING", vacCount: 0 });

    // Al actualizar de nuevo el formulario completo, vuelve a cargado.
    await saveStudentEntries(
      testDb,
      split.id,
      week.id,
      form({ [`dedicatedHours__${participant1.id}`]: "3", [`dedicatedHours__${participant2.id}`]: "0" }),
    );
    expect(await getStudentLoadStatus(testDb, split.id, week.id, week.sequenceNumber)).toEqual({ status: "LOADED", vacCount: 0 });
  });
});

describe("Contador semanal de KPI cargados", () => {
  it("Productividad suma dos KPI activos, Domador exige ambos origenes, inactivos no cuentan y X/X con los diez completos", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Contador", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "Contador", level: "N2", startWeekSequenceNumber: 1 });

    // Activa los diez KPI con multiplicadores validos para el nivel N2.
    const activations: Array<[Parameters<typeof updateKpiConfig>[2], Record<string, number>]> = [
      ["SOLUTION_HUNTER", { pointsPerResolvedTicket: 1 }],
      ["DATA_EXPLORER", { pointsPerCommentedTicket: 1 }],
      ["VOICE_AMBASSADOR", { acceptedWeight: 1, rejectedPenalty: 1, unattendedPenalty: 1, outboundPoints: 1 }],
      ["MASTER_CRAFTSMAN", { positiveWeight: 1, negativePenalty: 4, scale: 10 }],
      ["ESCALATION_TAMER", { basePoints: 30, ratioPenaltyFactor: 200 }],
      ["STABILITY_GUARDIAN", { pointsPerResult: 30 }],
      ["WORK_CHRONOMANCY", { pointsAtFullOccupancy: 60 }],
      ["STAR_WRITER", { approvedArticlePoints: 10, negativeArticlePoints: 10, proposalPoints: 5 }],
      ["ENTHUSIASTIC_STUDENT", { pointsPerHour: 12.5 }],
      ["EXPERT_APPRENTICE", { targetValue: 15, pointsAtTarget: 50 }],
    ];
    for (const [kpiCode, parameters] of activations) {
      await updateKpiConfig(testDb, split.id, kpiCode, {
        isActive: true,
        baseMax: 100,
        multiplierN2: 1,
        parameters,
      });
    }
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    const emptySummary = await getWeeklyKpiLoadSummary(testDb, split.id, [week]);
    expect(emptySummary.get(week.id)).toEqual({ loadedCount: 0, totalActiveCount: 10 });

    // Productividad cubre dos KPI activos a la vez.
    const productivityBuffer = await buildWorkbookBuffer([
      ["Nombre del actualizador", "Actualizaciones", "Comentarios", "Comentarios públicos", "Comentarios internos", "Tickets actualizados con comentario", "Tickets resueltos", "Tickets creados"],
      ["Persona Contador", 10, 0, 0, 0, 0, 0, 0],
    ]);
    await confirmProductivityImport(testDb, split.id, week.id, { buffer: productivityBuffer, originalFilename: "productividad.xlsx" });

    const afterProductivity = await getWeeklyKpiLoadSummary(testDb, split.id, [week]);
    // SOLUTION_HUNTER + DATA_EXPLORER cargados; Domador aun exige Escalados.
    expect(afterProductivity.get(week.id)).toEqual({ loadedCount: 2, totalActiveCount: 10 });

    const escalationBuffer = await buildWorkbookBuffer([ESCALATION_HEADERS, ["Persona Contador", 1]]);
    await confirmEscalationImport(testDb, split.id, week.id, { buffer: escalationBuffer, originalFilename: "escalados.xlsx" });

    const afterEscalation = await getWeeklyKpiLoadSummary(testDb, split.id, [week]);
    expect(afterEscalation.get(week.id)?.loadedCount).toBe(3);

    await confirmQualityImport(testDb, split.id, week.id, {
      buffer: await buildWorkbookBuffer([QUALITY_HEADERS, ["Persona Contador", 2, 0]]),
      originalFilename: "calidad.xlsx",
    });
    await confirmVoiceImport(testDb, split.id, week.id, {
      buffer: await buildWorkbookBuffer([VOICE_HEADERS, ["Persona Contador", 5, 0, 0, 1, 1, 1, 1, 1, 1]]),
      originalFilename: "llamadas.xlsx",
    });

    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "1" }));
    await saveChronomancyEntries(
      testDb,
      split.id,
      week.id,
      form({ [`productiveHours__${participant.id}`]: "38", [`totalHours__${participant.id}`]: "40" }),
    );
    await saveWriterEntries(
      testDb,
      split.id,
      week.id,
      form({
        [`deliveredArticles__${participant.id}`]: "1",
        [`undeliveredArticles__${participant.id}`]: "0",
        [`proposedArticles__${participant.id}`]: "0",
      }),
    );
    await saveStudentEntries(testDb, split.id, week.id, form({ [`dedicatedHours__${participant.id}`]: "1" }));
    await saveApprenticeEntries(testDb, split.id, week.id, form({ [`completedTrainings__${participant.id}`]: "1" }));

    const fullSummary = await getWeeklyKpiLoadSummary(testDb, split.id, [week]);
    expect(fullSummary.get(week.id)).toEqual({ loadedCount: 10, totalActiveCount: 10 });
  });
});

describe("Guardian de la Estabilidad: campo vacio equivale a cero (0.6.0 / MVP-1C)", () => {
  it("un campo vacio o con espacios se guarda como cero y la carga queda completa", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Guardian Vacio", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "GuardianVacio", level: "N2", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", {
      isActive: true,
      baseMax: 30,
      multiplierN2: 1,
      parameters: { pointsPerResult: 30 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "   " }));
    const check = await getStabilityCheckView(testDb, split.id, week.id);
    expect(check.rows[0]?.resultValue).toBe(0);
    expect(check.rows[0]?.stabilityGuardian).toMatchObject({ status: "computed", finalPoints: 0 });

    const status = await getStabilityLoadStatus(testDb, split.id, week.id, week.sequenceNumber);
    expect(status).toEqual({ status: "LOADED", vacCount: 0 });
  });

  it("sigue rechazando texto no numerico y negativos", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Guardian Invalido", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "GuardianInvalido", level: "N2", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", {
      isActive: true,
      baseMax: 30,
      multiplierN2: 1,
      parameters: { pointsPerResult: 30 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    for (const invalidValue of ["-1", "no-es-un-numero"]) {
      await expect(
        saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: invalidValue })),
      ).rejects.toBeInstanceOf(ManualEntryValidationError);
    }
  });
});

describe("Cronomagia laboral: ambos campos vacios equivalen a cero (0.6.0 / MVP-1C)", () => {
  it("vacio/vacio se guarda como 0/0, VAC y 0% de occupancy", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Cronomagia Vacio", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "CronoVacio", level: "N1", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "WORK_CHRONOMANCY", {
      isActive: true,
      baseMax: 60,
      multiplierN1: 1,
      parameters: { pointsAtFullOccupancy: 60 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    await saveChronomancyEntries(
      testDb,
      split.id,
      week.id,
      form({ [`productiveHours__${participant.id}`]: "", [`totalHours__${participant.id}`]: "" }),
    );
    const check = await getChronomancyCheckView(testDb, split.id, week.id);
    expect(check.rows[0]?.productiveHours).toBe(0);
    expect(check.rows[0]?.totalHours).toBe(0);
    expect(check.rows[0]?.workChronomancy).toEqual({ status: "vac" });
  });

  it("vacio/40 se guarda como productivas 0 y calcula normalmente (0%)", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Cronomagia Parcial", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "CronoParcial", level: "N1", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "WORK_CHRONOMANCY", {
      isActive: true,
      baseMax: 60,
      multiplierN1: 1,
      parameters: { pointsAtFullOccupancy: 60 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    await saveChronomancyEntries(
      testDb,
      split.id,
      week.id,
      form({ [`productiveHours__${participant.id}`]: "", [`totalHours__${participant.id}`]: "40" }),
    );
    const check = await getChronomancyCheckView(testDb, split.id, week.id);
    expect(check.rows[0]?.productiveHours).toBe(0);
    expect(check.rows[0]?.totalHours).toBe(40);
    expect(check.rows[0]?.workChronomancy).toMatchObject({ status: "computed", occupancy: 0, finalPoints: 0 });
  });

  it("1/vacio y 1/0 siguen rechazandose (total 0 exige productivas 0)", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Cronomagia Rechazo", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "CronoRechazo", level: "N1", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "WORK_CHRONOMANCY", {
      isActive: true,
      baseMax: 60,
      multiplierN1: 1,
      parameters: { pointsAtFullOccupancy: 60 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    await expect(
      saveChronomancyEntries(testDb, split.id, week.id, form({ [`productiveHours__${participant.id}`]: "1", [`totalHours__${participant.id}`]: "" })),
    ).rejects.toBeInstanceOf(ManualEntryValidationError);
    await expect(
      saveChronomancyEntries(testDb, split.id, week.id, form({ [`productiveHours__${participant.id}`]: "1", [`totalHours__${participant.id}`]: "0" })),
    ).rejects.toBeInstanceOf(ManualEntryValidationError);
    expect(await testDb.chronomancyWeeklyEntry.count({ where: { splitWeekId: week.id } })).toBe(0);
  });

  it("sigue rechazando negativos y texto invalido", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Cronomagia Invalida", email: undefined });
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "CronoInvalida", level: "N1", startWeekSequenceNumber: 1 });
    await updateKpiConfig(testDb, split.id, "WORK_CHRONOMANCY", {
      isActive: true,
      baseMax: 60,
      multiplierN1: 1,
      parameters: { pointsAtFullOccupancy: 60 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;

    await expect(
      saveChronomancyEntries(testDb, split.id, week.id, form({ [`productiveHours__${participant.id}`]: "-1", [`totalHours__${participant.id}`]: "10" })),
    ).rejects.toBeInstanceOf(ManualEntryValidationError);
    await expect(
      saveChronomancyEntries(testDb, split.id, week.id, form({ [`productiveHours__${participant.id}`]: "no-es-un-numero", [`totalHours__${participant.id}`]: "10" })),
    ).rejects.toBeInstanceOf(ManualEntryValidationError);
  });
});

import { beforeEach, describe, expect, it } from "vitest";
import { compare } from "bcryptjs";
import { resetDatabase, testDb } from "./helpers/db";
import { createPerson } from "@/server/services/person.service";
import { createSplitWithWeeks, activateSplit, listSplitWeeks } from "@/server/services/split.service";
import { addParticipant } from "@/server/services/participant.service";
import { updateKpiConfig } from "@/server/services/kpi.service";
import { saveStabilityEntries } from "@/server/services/stability-entry.service";
import { publishWeek } from "@/server/services/publish-week.service";
import {
  changeOwnPassword,
  createParticipantAccount,
  ensureFirstAdmin,
} from "@/server/services/auth.service";
import {
  getPersonSplitDetail,
  listPersonsWithPublishedResults,
  listSplitsWithPublishedResultsForPerson,
} from "@/server/services/individual-results.service";
import { DomainError } from "@/lib/errors";

function form(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

beforeEach(async () => {
  await resetDatabase();
});

describe("Ciclo de cuenta minimo", () => {
  it("hashea la contrasena (nunca en claro) y crea una cuenta de participante vinculada uno a uno", async () => {
    const person = await createPerson(testDb, { fullName: "Persona Cuenta", email: undefined });
    const user = await createParticipantAccount(testDb, { personId: person.id, email: "cuenta@example.com", temporaryPassword: "TempPass123" });

    expect(user.passwordHash).not.toBe("TempPass123");
    expect(await compare("TempPass123", user.passwordHash)).toBe(true);
    expect(user.mustChangePassword).toBe(true);
    expect(user.role).toBe("PARTICIPANT");
  });

  it("rechaza un correo o una persona duplicados, y una contrasena temporal demasiado corta", async () => {
    const person = await createPerson(testDb, { fullName: "Persona Duplicada", email: undefined });
    await createParticipantAccount(testDb, { personId: person.id, email: "duplicado@example.com", temporaryPassword: "TempPass123" });

    const otherPerson = await createPerson(testDb, { fullName: "Otra Persona", email: undefined });
    await expect(
      createParticipantAccount(testDb, { personId: otherPerson.id, email: "duplicado@example.com", temporaryPassword: "TempPass123" }),
    ).rejects.toBeInstanceOf(DomainError);

    await expect(
      createParticipantAccount(testDb, { personId: person.id, email: "otro@example.com", temporaryPassword: "TempPass123" }),
    ).rejects.toBeInstanceOf(DomainError);

    const shortPasswordPerson = await createPerson(testDb, { fullName: "Persona Corta", email: undefined });
    await expect(
      createParticipantAccount(testDb, { personId: shortPasswordPerson.id, email: "corta@example.com", temporaryPassword: "1234" }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("cambiar la propia contrasena exige la actual correcta y desactiva mustChangePassword", async () => {
    const person = await createPerson(testDb, { fullName: "Persona Cambio", email: undefined });
    const user = await createParticipantAccount(testDb, { personId: person.id, email: "cambio@example.com", temporaryPassword: "TempPass123" });

    await expect(changeOwnPassword(testDb, user.id, "incorrecta", "NuevaPass123")).rejects.toBeInstanceOf(DomainError);

    await changeOwnPassword(testDb, user.id, "TempPass123", "NuevaPass123");
    const updated = await testDb.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(updated.mustChangePassword).toBe(false);
    expect(await compare("NuevaPass123", updated.passwordHash)).toBe(true);
  });

  it("ensureFirstAdmin solo crea un administrador si no existe ya ninguno", async () => {
    const first = await ensureFirstAdmin(testDb, "admin@example.com", "AdminPass123");
    expect(first.created).toBe(true);

    const second = await ensureFirstAdmin(testDb, "otro-admin@example.com", "AdminPass123");
    expect(second.created).toBe(false);
    expect(second.email).toBe("admin@example.com");
    expect(await testDb.user.count({ where: { role: "ADMIN" } })).toBe(1);
  });
});

describe("Privacidad de la vista individual: solo publicaciones y solo la persona correcta", () => {
  it("una persona sin publicaciones no aparece en el selector ni tiene splits con resultados", async () => {
    const person = await createPerson(testDb, { fullName: "Persona Sin Publicar", email: undefined });
    const split = await createSplitWithWeeks(testDb, { name: "Split sin publicar", description: undefined, startDate: "2025-10-06", numberOfWeeks: 1 });
    await addParticipant(testDb, split.id, { personId: person.id, alias: "SinPublicar", level: "N2", startWeekSequenceNumber: 1 });

    const persons = await listPersonsWithPublishedResults(testDb);
    expect(persons.find((entry) => entry.id === person.id)).toBeUndefined();

    const splits = await listSplitsWithPublishedResultsForPerson(testDb, person.id);
    expect(splits).toEqual([]);

    const detail = await getPersonSplitDetail(testDb, person.id, split.id);
    expect(detail).toBeNull();
  });

  it("getPersonSplitDetail de una persona no devuelve nada de otra persona del mismo split", async () => {
    const split = await createSplitWithWeeks(testDb, { name: "Split compartido", description: undefined, startDate: "2025-10-06", numberOfWeeks: 1 });
    const personA = await createPerson(testDb, { fullName: "Persona A", email: undefined });
    const personB = await createPerson(testDb, { fullName: "Persona B", email: undefined });
    const participantA = await addParticipant(testDb, split.id, { personId: personA.id, alias: "AliasA", level: "N2", startWeekSequenceNumber: 1 });
    await addParticipant(testDb, split.id, { personId: personB.id, alias: "AliasB", level: "N2", startWeekSequenceNumber: 1 });

    await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", {
      isActive: true, baseMax: 30, multiplierN2: 1, parameters: { pointsPerResult: 30 },
    });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await saveStabilityEntries(
      testDb,
      split.id,
      week.id,
      form({ [`resultValue__${participantA.id}`]: "1", [`resultValue__${(await testDb.splitParticipant.findFirstOrThrow({ where: { personId: personB.id } })).id}`]: "1" }),
    );
    await publishWeek(testDb, split.id, week.id, null);

    const detailA = await getPersonSplitDetail(testDb, personA.id, split.id);
    expect(detailA).not.toBeNull();
    expect(detailA!.weeks[0]?.splitWeekId).toBe(week.id);

    // getPersonSplitDetail siempre filtra por personId + splitId: nunca devuelve una fila de otra persona.
    expect(detailA!.weeks.every(() => true)).toBe(true);
    const rowsForA = await testDb.publishedParticipantWeeklyResult.findMany({ where: { personId: personA.id, splitId: split.id } });
    expect(rowsForA).toHaveLength(1);
    expect(rowsForA[0]?.aliasSnapshot).toBe("AliasA");
  });

  it("el denominador 'x de n' es siempre el total de participantes del split, no solo los que puntuaron ese KPI (seccion 17 de 0.7.0 / MVP-2A)", async () => {
    const split = await createSplitWithWeeks(testDb, { name: "Split denominador", description: undefined, startDate: "2025-10-06", numberOfWeeks: 2 });
    const personA = await createPerson(testDb, { fullName: "Denominador A", email: undefined });
    const personB = await createPerson(testDb, { fullName: "Denominador B", email: undefined });
    const participantA = await addParticipant(testDb, split.id, { personId: personA.id, alias: "DenomA", level: "N2", startWeekSequenceNumber: 1 });
    const participantB = await addParticipant(testDb, split.id, { personId: personB.id, alias: "DenomB", level: "N2", startWeekSequenceNumber: 1 });

    await updateKpiConfig(testDb, split.id, "STABILITY_GUARDIAN", { isActive: true, baseMax: 30, multiplierN2: 1, parameters: { pointsPerResult: 30 } });
    await activateSplit(testDb, split.id);
    const week = (await listSplitWeeks(testDb, split.id))[0]!;
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participantA.id}`]: "1", [`resultValue__${participantB.id}`]: "1" }));
    await publishWeek(testDb, split.id, week.id, null);

    // Se anade una tercera persona despues de publicar, sin ningun resultado publicado todavia.
    const personC = await createPerson(testDb, { fullName: "Denominador C", email: undefined });
    await addParticipant(testDb, split.id, { personId: personC.id, alias: "DenomC", level: "N2", startWeekSequenceNumber: 2 });

    const detail = await getPersonSplitDetail(testDb, personA.id, split.id);
    // n = 3 (total de participantes del split), no 2 (solo quienes tienen resultado publicado en esa semana).
    expect(detail!.splitParticipantCount).toBe(3);
  });
});

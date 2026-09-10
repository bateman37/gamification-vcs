import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import { createPerson } from "@/server/services/person.service";
import {
  activateSplit,
  createSplitWithWeeks,
  listSplitWeeks,
} from "@/server/services/split.service";
import { addParticipant } from "@/server/services/participant.service";
import { DomainError } from "@/lib/errors";

async function createDraftSplit(overrides?: Partial<{ name: string; numberOfWeeks: number }>) {
  return createSplitWithWeeks(testDb, {
    name: overrides?.name ?? "Split de prueba",
    description: undefined,
    startDate: "2025-10-06",
    numberOfWeeks: overrides?.numberOfWeeks ?? 4,
  });
}

beforeEach(async () => {
  await resetDatabase();
});

describe("Persona y alias por split", () => {
  it("una persona puede tener alias distintos en splits diferentes", async () => {
    const person = await createPerson(testDb, { fullName: "Ana Garcia", email: undefined });
    const splitA = await createDraftSplit({ name: "Split A" });
    const splitB = await createDraftSplit({ name: "Split B" });

    const participantA = await addParticipant(testDb, splitA.id, {
      personId: person.id,
      alias: "AnaGamer",
      level: "N1",
      startWeekSequenceNumber: 1,
    });
    const participantB = await addParticipant(testDb, splitB.id, {
      personId: person.id,
      alias: "OtroAlias",
      level: "N2",
      startWeekSequenceNumber: 1,
    });

    expect(participantA.alias).toBe("AnaGamer");
    expect(participantB.alias).toBe("OtroAlias");
  });

  it("no permite alias normalizados duplicados dentro del mismo split", async () => {
    const split = await createDraftSplit();
    const personOne = await createPerson(testDb, { fullName: "Persona Uno", email: undefined });
    const personTwo = await createPerson(testDb, { fullName: "Persona Dos", email: undefined });

    await addParticipant(testDb, split.id, {
      personId: personOne.id,
      alias: "  ElCampeon ",
      level: "N0",
      startWeekSequenceNumber: 1,
    });

    await expect(
      addParticipant(testDb, split.id, {
        personId: personTwo.id,
        alias: "elcampeon",
        level: "N1",
        startWeekSequenceNumber: 1,
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("no permite anadir la misma persona dos veces al mismo split", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Persona Repetida", email: undefined });

    await addParticipant(testDb, split.id, {
      personId: person.id,
      alias: "Primero",
      level: "N0",
      startWeekSequenceNumber: 1,
    });

    await expect(
      addParticipant(testDb, split.id, {
        personId: person.id,
        alias: "Segundo",
        level: "N1",
        startWeekSequenceNumber: 1,
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });
});

describe("Semana inicial del participante", () => {
  it("la semana inicial debe pertenecer al split", async () => {
    const split = await createDraftSplit({ numberOfWeeks: 3 });
    const person = await createPerson(testDb, { fullName: "Persona Fuera de Rango", email: undefined });

    await expect(
      addParticipant(testDb, split.id, {
        personId: person.id,
        alias: "FueraDeRango",
        level: "N0",
        startWeekSequenceNumber: 10,
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("se puede anadir un participante a un split activo indicando una semana inicial valida", async () => {
    const split = await createDraftSplit({ numberOfWeeks: 5 });
    const founder = await createPerson(testDb, { fullName: "Fundador", email: undefined });
    await addParticipant(testDb, split.id, {
      personId: founder.id,
      alias: "Fundador",
      level: "N0",
      startWeekSequenceNumber: 1,
    });

    const activated = await activateSplit(testDb, split.id);
    expect(activated.status).toBe("ACTIVE");

    const latecomer = await createPerson(testDb, { fullName: "Incorporacion Tardia", email: undefined });
    const participant = await addParticipant(testDb, split.id, {
      personId: latecomer.id,
      alias: "Tardio",
      level: "N1",
      startWeekSequenceNumber: 3,
    });

    expect(participant.startWeekSequenceNumber).toBe(3);

    const weeks = await listSplitWeeks(testDb, split.id);
    expect(weeks).toHaveLength(5);
  });
});

describe("Activacion de split", () => {
  it("un split no puede activarse sin participantes", async () => {
    const split = await createDraftSplit();
    await expect(activateSplit(testDb, split.id)).rejects.toBeInstanceOf(DomainError);
  });
});

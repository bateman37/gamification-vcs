import { beforeEach, describe, expect, it } from "vitest";
import { resetDatabase, testDb } from "./helpers/db";
import { markAllPresent } from "./helpers/attendance";
import { createPerson } from "@/server/services/person.service";
import { createSplitWithWeeks, activateSplit } from "@/server/services/split.service";
import { addParticipant, updateParticipant } from "@/server/services/participant.service";
import { createFaction, updateFaction } from "@/server/services/faction.service";
import { updateKpiConfig } from "@/server/services/kpi.service";
import { saveStabilityEntries } from "@/server/services/stability-entry.service";
import { publishWeek } from "@/server/services/publish-week.service";
import { openMarket, closeMarket } from "@/server/services/economy.service";
import { purchaseStoreItem } from "@/server/services/purchase.service";
import { createNewsWithDeliveries } from "@/server/services/news.service";
import {
  countUnreadNews,
  previewRecentNews,
  listNewsDeliveries,
  markNewsRead,
  markNewsUnread,
  archiveNews,
  restoreNews,
  markAllNewsRead,
} from "@/server/services/news-inbox.service";
import { sendManualNews } from "@/server/services/news-manual.service";
import { manualNewsFormSchema } from "@/server/validation/news-manual";
import { buildNewsActionPath, InvalidNewsLinkError } from "@/domain/news-links";
import { DomainError } from "@/lib/errors";

function form(values: Record<string, string>): FormData {
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) formData.set(key, value);
  return formData;
}

async function createDraftSplit(numberOfWeeks = 2) {
  return createSplitWithWeeks(testDb, { name: "Split de noticias", description: undefined, startDate: "2025-10-06", numberOfWeeks });
}

async function createAdminUser(email = "admin@example.com") {
  return testDb.user.create({ data: { email, passwordHash: "hash", role: "ADMIN" } });
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

describe("Enlaces internos seguros", () => {
  it("construye rutas permitidas segun el destino", () => {
    expect(buildNewsActionPath({ kind: "RESULTS", splitId: "s1" }, "PERSON")).toBe("/resultados?vista=por-split&split=s1");
    expect(buildNewsActionPath({ kind: "PROFILE", splitParticipantId: "p1" }, "PERSON")).toBe("/fichas/p1");
    expect(buildNewsActionPath({ kind: "MARKET", splitParticipantId: "p1" }, "PERSON")).toBe("/fichas/p1#mercado");
    expect(buildNewsActionPath({ kind: "NONE" }, "PERSON")).toBeNull();
  });

  it("rechaza un destino administrativo para un destinatario de jugador", () => {
    expect(() => buildNewsActionPath({ kind: "SPLIT_ADMIN", splitId: "s1" }, "PERSON")).toThrow(InvalidNewsLinkError);
    expect(buildNewsActionPath({ kind: "SPLIT_ADMIN", splitId: "s1" }, "USER")).toBe("/splits/s1");
  });
});

describe("Servicio nucleo: creacion e idempotencia", () => {
  it("rechaza crear una noticia sin destinatarios", async () => {
    await expect(
      createNewsWithDeliveries(testDb, { origin: "AUTOMATIC", category: "ANNOUNCEMENT", title: "T", body: "B" }, []),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("un eventKey repetido no duplica la noticia ni sus entregas", async () => {
    const person = await createPerson(testDb, { fullName: "Ana" });
    const first = await createNewsWithDeliveries(
      testDb,
      { origin: "AUTOMATIC", category: "ANNOUNCEMENT", title: "T", body: "B", eventKey: "evento-unico" },
      [{ personId: person.id }],
    );
    const second = await createNewsWithDeliveries(
      testDb,
      { origin: "AUTOMATIC", category: "ANNOUNCEMENT", title: "T2", body: "B2", eventKey: "evento-unico" },
      [{ personId: person.id }],
    );
    expect(second.created).toBe(false);
    expect(second.newsItemId).toBe(first.newsItemId);
    expect(await testDb.newsItem.count()).toBe(1);
    expect(await testDb.newsDelivery.count()).toBe(1);
  });

  it("deduplica destinatarios repetidos en la misma llamada", async () => {
    const person = await createPerson(testDb, { fullName: "Ana" });
    await createNewsWithDeliveries(testDb, { origin: "AUTOMATIC", category: "ANNOUNCEMENT", title: "T", body: "B" }, [
      { personId: person.id },
      { personId: person.id },
    ]);
    expect(await testDb.newsDelivery.count()).toBe(1);
  });
});

describe("Bandeja: contador, previsualizacion, paginacion y privacidad", () => {
  it("el contador excluye leidas y archivadas, y la vista previa se limita a las no archivadas", async () => {
    const person = await createPerson(testDb, { fullName: "Ana" });
    const identity = { userId: "sin-cuenta", personId: person.id };

    for (let i = 0; i < 3; i += 1) {
      await createNewsWithDeliveries(
        testDb,
        { origin: "AUTOMATIC", category: "ANNOUNCEMENT", title: `Noticia ${i}`, body: "B", eventKey: `n-${i}` },
        [{ personId: person.id }],
      );
    }
    expect(await countUnreadNews(testDb, identity)).toBe(3);

    const [first] = (await previewRecentNews(testDb, identity)).slice(-1);
    await markNewsRead(testDb, identity, first!.deliveryId);
    expect(await countUnreadNews(testDb, identity)).toBe(2);

    await archiveNews(testDb, identity, first!.deliveryId);
    const preview = await previewRecentNews(testDb, identity);
    expect(preview.find((item) => item.deliveryId === first!.deliveryId)).toBeUndefined();
  });

  it("archivar marca como leida si no lo estaba, y restaurar no la vuelve a marcar como no leida", async () => {
    const person = await createPerson(testDb, { fullName: "Ana" });
    const identity = { userId: "sin-cuenta", personId: person.id };
    const { newsItemId } = await createNewsWithDeliveries(
      testDb,
      { origin: "AUTOMATIC", category: "ANNOUNCEMENT", title: "T", body: "B", eventKey: "e1" },
      [{ personId: person.id }],
    );
    const delivery = await testDb.newsDelivery.findFirstOrThrow({ where: { newsItemId } });

    await archiveNews(testDb, identity, delivery.id);
    let reloaded = await testDb.newsDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
    expect(reloaded.readAt).not.toBeNull();
    expect(reloaded.archivedAt).not.toBeNull();

    await restoreNews(testDb, identity, delivery.id);
    reloaded = await testDb.newsDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
    expect(reloaded.archivedAt).toBeNull();
    expect(reloaded.readAt).not.toBeNull();
  });

  it("marcar todas como leidas no afecta a las archivadas ni a otro destinatario", async () => {
    const personA = await createPerson(testDb, { fullName: "Ana" });
    const personB = await createPerson(testDb, { fullName: "Bea" });
    const identityA = { userId: "sin-cuenta-a", personId: personA.id };
    const identityB = { userId: "sin-cuenta-b", personId: personB.id };

    await createNewsWithDeliveries(testDb, { origin: "AUTOMATIC", category: "ANNOUNCEMENT", title: "T1", body: "B", eventKey: "e1" }, [
      { personId: personA.id },
    ]);
    await createNewsWithDeliveries(testDb, { origin: "AUTOMATIC", category: "ANNOUNCEMENT", title: "T2", body: "B", eventKey: "e2" }, [
      { personId: personA.id },
    ]);
    await createNewsWithDeliveries(testDb, { origin: "AUTOMATIC", category: "ANNOUNCEMENT", title: "T3", body: "B", eventKey: "e3" }, [
      { personId: personB.id },
    ]);

    const [toArchive] = await previewRecentNews(testDb, identityA, 1);
    await archiveNews(testDb, identityA, toArchive!.deliveryId);

    await markAllNewsRead(testDb, identityA);
    expect(await countUnreadNews(testDb, identityA)).toBe(0);
    expect(await countUnreadNews(testDb, identityB)).toBe(1);

    const archived = await testDb.newsDelivery.findUniqueOrThrow({ where: { id: toArchive!.deliveryId } });
    // Restaurarla no debe quedar sin leer solo porque "marcar todas" ignoraba las archivadas.
    expect(archived.archivedAt).not.toBeNull();
  });

  it("no consulta ni muta una entrega ajena aunque el id sea valido", async () => {
    const personA = await createPerson(testDb, { fullName: "Ana" });
    const personB = await createPerson(testDb, { fullName: "Bea" });
    const { newsItemId } = await createNewsWithDeliveries(
      testDb,
      { origin: "AUTOMATIC", category: "ANNOUNCEMENT", title: "T", body: "B", eventKey: "e1" },
      [{ personId: personA.id }],
    );
    const delivery = await testDb.newsDelivery.findFirstOrThrow({ where: { newsItemId } });

    const identityB = { userId: "sin-cuenta-b", personId: personB.id };
    await markNewsRead(testDb, identityB, delivery.id);

    const stillUnread = await testDb.newsDelivery.findUniqueOrThrow({ where: { id: delivery.id } });
    expect(stillUnread.readAt).toBeNull();
  });

  it("la paginacion por cursor no repite ni omite elementos", async () => {
    const person = await createPerson(testDb, { fullName: "Ana" });
    const identity = { userId: "sin-cuenta", personId: person.id };
    for (let i = 0; i < 25; i += 1) {
      await createNewsWithDeliveries(
        testDb,
        { origin: "AUTOMATIC", category: "ANNOUNCEMENT", title: `Noticia ${i}`, body: "B", eventKey: `page-${i}` },
        [{ personId: person.id }],
      );
    }
    const firstPage = await listNewsDeliveries(testDb, identity, { status: "all" }, null, 20);
    expect(firstPage.items).toHaveLength(20);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await listNewsDeliveries(testDb, identity, { status: "all" }, firstPage.nextCursor, 20);
    expect(secondPage.items).toHaveLength(5);
    expect(secondPage.nextCursor).toBeNull();

    const allIds = new Set([...firstPage.items, ...secondPage.items].map((item) => item.deliveryId));
    expect(allIds.size).toBe(25);
  });

  it("un administrador vinculado ve sus noticias directas y las de su propia persona, sin duplicar", async () => {
    const person = await createPerson(testDb, { fullName: "Admin-persona" });
    const user = await testDb.user.create({ data: { email: "vinculado@example.com", passwordHash: "h", role: "ADMIN", personId: person.id } });

    await createNewsWithDeliveries(testDb, { origin: "AUTOMATIC", category: "ADMIN", title: "Aviso admin", body: "B", eventKey: "admin-1" }, [
      { userId: user.id },
    ]);
    await createNewsWithDeliveries(testDb, { origin: "AUTOMATIC", category: "PROFILE", title: "Aviso jugador", body: "B", eventKey: "jugador-1" }, [
      { personId: person.id },
    ]);

    const identity = { userId: user.id, personId: person.id };
    const page = await listNewsDeliveries(testDb, identity, { status: "all" }, null, 20);
    expect(page.items).toHaveLength(2);
  });
});

describe("Alta de participante y ficha incompleta", () => {
  it("crea exactamente una noticia con destino a la ficha, mencionando solo lo realmente pendiente", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Carla" });
    const participant = await addParticipant(testDb, split.id, {
      personId: person.id,
      alias: "carla",
      level: "N1",
      startWeekSequenceNumber: 1,
    });

    const deliveries = await testDb.newsDelivery.findMany({ where: { recipientPersonId: person.id }, include: { newsItem: true } });
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]!.actionPath).toBe(`/fichas/${participant.id}`);
    expect(deliveries[0]!.newsItem.category).toBe("PROFILE");
    // Este split no usa profesiones: el texto no debe mencionar una profesion pendiente.
    expect(deliveries[0]!.newsItem.body.toLowerCase()).not.toContain("profesion");
  });

  it("un alta no genera una segunda noticia si se reintenta con la misma clave", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Carla" });
    const participant = await addParticipant(testDb, split.id, {
      personId: person.id,
      alias: "carla",
      level: "N1",
      startWeekSequenceNumber: 1,
    });
    // Simula una carrera de reintento con la misma clave idempotente ya usada por el alta real.
    await expect(
      createNewsWithDeliveries(
        testDb,
        { origin: "AUTOMATIC", category: "PROFILE", title: "Duplicado", body: "B", eventKey: `participant-added:${participant.id}` },
        [{ personId: person.id }],
      ),
    ).resolves.toMatchObject({ created: false });
    expect(await testDb.newsItem.count({ where: { eventKey: `participant-added:${participant.id}` } })).toBe(1);
  });
});

describe("Facciones y profesiones: solo notifican cambios reales en un split activo", () => {
  it("no notifica una reasignacion de faccion mientras el split sigue en borrador", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Dani" });
    await activateStabilityKpi(split.id);
    const factionA = await createFaction(testDb, split.id, { name: "Alfa", color: "#ff0000" });
    const factionB = await createFaction(testDb, split.id, { name: "Beta", color: "#00ff00" });
    const participant = await addParticipant(testDb, split.id, {
      personId: person.id,
      alias: "dani",
      level: "N2",
      startWeekSequenceNumber: 1,
      factionId: factionA.id,
    });

    await updateParticipant(testDb, participant.id, { alias: "dani", level: "N2", factionId: factionB.id });

    const factionNews = await testDb.newsItem.findMany({ where: { category: "FACTION" } });
    expect(factionNews).toHaveLength(0);
  });

  it("notifica una reasignacion real de faccion durante un split activo, pero no un guardado identico", async () => {
    const split = await createDraftSplit();
    const personA = await createPerson(testDb, { fullName: "Ana" });
    const personB = await createPerson(testDb, { fullName: "Bea" });
    const personC = await createPerson(testDb, { fullName: "Cris" });
    await activateStabilityKpi(split.id);
    const factionA = await createFaction(testDb, split.id, { name: "Alfa", color: "#ff0000" });
    const factionB = await createFaction(testDb, split.id, { name: "Beta", color: "#00ff00" });

    const pA = await addParticipant(testDb, split.id, { personId: personA.id, alias: "ana", level: "N2", startWeekSequenceNumber: 1, factionId: factionA.id });
    await addParticipant(testDb, split.id, { personId: personB.id, alias: "bea", level: "N2", startWeekSequenceNumber: 1, factionId: factionA.id });
    await addParticipant(testDb, split.id, { personId: personC.id, alias: "cris", level: "N2", startWeekSequenceNumber: 1, factionId: factionA.id });
    // Beta necesita tambien 3 aplicables para poder activar el split.
    const personD = await createPerson(testDb, { fullName: "Duna" });
    const personE = await createPerson(testDb, { fullName: "Elia" });
    const personF = await createPerson(testDb, { fullName: "Feli" });
    await addParticipant(testDb, split.id, { personId: personD.id, alias: "duna", level: "N2", startWeekSequenceNumber: 1, factionId: factionB.id });
    await addParticipant(testDb, split.id, { personId: personE.id, alias: "elia", level: "N2", startWeekSequenceNumber: 1, factionId: factionB.id });
    await addParticipant(testDb, split.id, { personId: personF.id, alias: "feli", level: "N2", startWeekSequenceNumber: 1, factionId: factionB.id });

    await activateSplit(testDb, split.id);
    await testDb.newsItem.deleteMany({});
    await testDb.newsDelivery.deleteMany({});

    await updateParticipant(testDb, pA.id, { alias: "ana", level: "N2", factionId: factionB.id });
    let factionNews = await testDb.newsItem.findMany({ where: { category: "FACTION" } });
    expect(factionNews).toHaveLength(1);
    expect(factionNews[0]!.body).toContain("Beta");

    // Guardar exactamente la misma faccion no debe generar una segunda noticia.
    await updateParticipant(testDb, pA.id, { alias: "ana", level: "N2", factionId: factionB.id });
    factionNews = await testDb.newsItem.findMany({ where: { category: "FACTION" } });
    expect(factionNews).toHaveLength(1);
  });

  it("renombrar una faccion notifica solo a sus miembros actuales", async () => {
    const split = await createDraftSplit();
    const personA = await createPerson(testDb, { fullName: "Ana" });
    const personB = await createPerson(testDb, { fullName: "Bea" });
    const personC = await createPerson(testDb, { fullName: "Cris" });
    const personOutside = await createPerson(testDb, { fullName: "Zoe" });
    await activateStabilityKpi(split.id);
    const factionA = await createFaction(testDb, split.id, { name: "Alfa", color: "#ff0000" });
    const factionB = await createFaction(testDb, split.id, { name: "Beta", color: "#00ff00" });
    await addParticipant(testDb, split.id, { personId: personA.id, alias: "ana", level: "N2", startWeekSequenceNumber: 1, factionId: factionA.id });
    await addParticipant(testDb, split.id, { personId: personB.id, alias: "bea", level: "N2", startWeekSequenceNumber: 1, factionId: factionA.id });
    await addParticipant(testDb, split.id, { personId: personC.id, alias: "cris", level: "N2", startWeekSequenceNumber: 1, factionId: factionA.id });
    await addParticipant(testDb, split.id, { personId: personOutside.id, alias: "zoe", level: "N2", startWeekSequenceNumber: 1, factionId: factionB.id });
    const personD = await createPerson(testDb, { fullName: "Duna" });
    const personE = await createPerson(testDb, { fullName: "Elia" });
    await addParticipant(testDb, split.id, { personId: personD.id, alias: "duna", level: "N2", startWeekSequenceNumber: 1, factionId: factionB.id });
    await addParticipant(testDb, split.id, { personId: personE.id, alias: "elia", level: "N2", startWeekSequenceNumber: 1, factionId: factionB.id });

    await activateSplit(testDb, split.id);
    await testDb.newsItem.deleteMany({});
    await testDb.newsDelivery.deleteMany({});

    await updateFaction(testDb, split.id, factionA.id, { name: "Alfa renombrada", color: "#ff0000" });

    const renameNews = await testDb.newsItem.findFirstOrThrow({ where: { category: "FACTION" } });
    const deliveries = await testDb.newsDelivery.findMany({ where: { newsItemId: renameNews.id } });
    expect(deliveries).toHaveLength(3);
    const recipientIds = new Set(deliveries.map((d) => d.recipientPersonId));
    expect(recipientIds.has(personOutside.id)).toBe(false);
  });
});

describe("Mercado y compra", () => {
  it("abrir/cerrar el mercado crea una unica noticia por transicion, no por objeto, y respeta OPEN->OPEN", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Gara" });
    await activateStabilityKpi(split.id);
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "gara", level: "N2", startWeekSequenceNumber: 1 });
    await activateSplit(testDb, split.id);

    const slot = await testDb.splitEquipmentSlot.create({ data: { splitId: split.id, name: "Arma", nameNormalized: "arma", displayOrder: 0 } });
    await testDb.splitStoreItem.create({
      data: {
        splitId: split.id,
        name: "Espada",
        nameNormalized: "espada",
        priceCredits: 10,
        equipmentSlotId: slot.id,
        kpiCode: "STABILITY_GUARDIAN",
        bonusPercent: 10,
      },
    });

    await testDb.newsItem.deleteMany({});
    await openMarket(testDb, split.id);
    let marketNews = await testDb.newsItem.findMany({ where: { category: "MARKET" } });
    expect(marketNews).toHaveLength(1);
    const deliveries = await testDb.newsDelivery.findMany({ where: { newsItemId: marketNews[0]!.id } });
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]!.recipientPersonId).toBe(person.id);

    // Abrir un mercado ya abierto no debe generar una segunda noticia.
    await openMarket(testDb, split.id);
    marketNews = await testDb.newsItem.findMany({ where: { category: "MARKET" } });
    expect(marketNews).toHaveLength(1);

    await closeMarket(testDb, split.id);
    marketNews = await testDb.newsItem.findMany({ where: { category: "MARKET" } });
    expect(marketNews).toHaveLength(2);

    void participant;
  });

  it("una compra confirmada crea una noticia con precio y saldo dentro de la misma transaccion", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Gara" });
    await activateStabilityKpi(split.id);
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "gara", level: "N2", startWeekSequenceNumber: 1 });
    await activateSplit(testDb, split.id);

    const slot = await testDb.splitEquipmentSlot.create({ data: { splitId: split.id, name: "Arma", nameNormalized: "arma", displayOrder: 0 } });
    const item = await testDb.splitStoreItem.create({
      data: {
        splitId: split.id,
        name: "Espada",
        nameNormalized: "espada",
        priceCredits: 10,
        equipmentSlotId: slot.id,
        kpiCode: "STABILITY_GUARDIAN",
        bonusPercent: 10,
      },
    });
    const week = await testDb.splitWeek.findFirstOrThrow({ where: { splitId: split.id, sequenceNumber: 1 } });
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "20" }));
    await markAllPresent(testDb, split.id, week.id);
    await publishWeek(testDb, split.id, week.id, null);
    await openMarket(testDb, split.id);
    await testDb.newsItem.deleteMany({ where: { category: "PURCHASE" } });

    await purchaseStoreItem(testDb, person.id, participant.id, item.id);

    const purchaseNews = await testDb.newsItem.findFirstOrThrow({ where: { category: "PURCHASE" } });
    expect(purchaseNews.body).toBe("10 créditos · Saldo restante: 10 créditos.");
  });

  it("una compra fallida (saldo insuficiente) no crea ninguna noticia", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Gara" });
    await activateStabilityKpi(split.id);
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "gara", level: "N2", startWeekSequenceNumber: 1 });
    await activateSplit(testDb, split.id);
    const slot = await testDb.splitEquipmentSlot.create({ data: { splitId: split.id, name: "Arma", nameNormalized: "arma", displayOrder: 0 } });
    const item = await testDb.splitStoreItem.create({
      data: { splitId: split.id, name: "Espada", nameNormalized: "espada", priceCredits: 999, equipmentSlotId: slot.id, kpiCode: "STABILITY_GUARDIAN", bonusPercent: 10 },
    });
    await openMarket(testDb, split.id);

    await expect(purchaseStoreItem(testDb, person.id, participant.id, item.id)).rejects.toBeInstanceOf(DomainError);
    expect(await testDb.newsItem.count({ where: { category: "PURCHASE" } })).toBe(0);
  });
});

describe("Publicacion semanal: resumen personalizado", () => {
  it("genera un unico resumen por participante con posicion, creditos y sin datos de otros", async () => {
    const split = await createDraftSplit();
    const personA = await createPerson(testDb, { fullName: "Ana" });
    const personB = await createPerson(testDb, { fullName: "Bea" });
    await activateStabilityKpi(split.id);
    const pA = await addParticipant(testDb, split.id, { personId: personA.id, alias: "ana", level: "N2", startWeekSequenceNumber: 1 });
    const pB = await addParticipant(testDb, split.id, { personId: personB.id, alias: "bea", level: "N2", startWeekSequenceNumber: 1 });
    await activateSplit(testDb, split.id);

    const week = await testDb.splitWeek.findFirstOrThrow({ where: { splitId: split.id, sequenceNumber: 1 } });
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${pA.id}`]: "10", [`resultValue__${pB.id}`]: "5" }));

    await testDb.newsItem.deleteMany({});
    await markAllPresent(testDb, split.id, week.id);
    const result = await publishWeek(testDb, split.id, week.id, null);
    expect(result.alreadyPublished).toBe(false);

    const resultsNews = await testDb.newsItem.findMany({ where: { category: "RESULTS" } });
    expect(resultsNews).toHaveLength(2);

    const deliveryA = await testDb.newsDelivery.findFirstOrThrow({ where: { recipientPersonId: personA.id, newsItem: { category: "RESULTS" } } });
    expect(deliveryA.actionPath).toBe(`/resultados?vista=por-split&split=${split.id}`);
    const newsA = await testDb.newsItem.findUniqueOrThrow({ where: { id: deliveryA.newsItemId } });
    expect(newsA.body).toContain("de 2");
    expect(newsA.body).not.toContain("bea");
  });

  it("una publicacion fallida no deja noticias, y una carrera/reintento no duplica el resumen", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Ana" });
    await activateStabilityKpi(split.id);
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "ana", level: "N2", startWeekSequenceNumber: 1 });
    await activateSplit(testDb, split.id);
    const week = await testDb.splitWeek.findFirstOrThrow({ where: { splitId: split.id, sequenceNumber: 1 } });
    await testDb.newsItem.deleteMany({});
    await testDb.newsDelivery.deleteMany({});

    // Sin cargar Guardian de la Estabilidad todavia: la semana no esta completa.
    await expect(publishWeek(testDb, split.id, week.id, null)).rejects.toBeInstanceOf(DomainError);
    expect(await testDb.newsItem.count()).toBe(0);

    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "10" }));
    await markAllPresent(testDb, split.id, week.id);
    // Carrera concurrente: dos publicaciones simultaneas de la misma semana solo deben crear un
    // resumen, nunca dos (la segunda se resuelve de forma idempotente, ver publish-week.service.ts).
    const [resultA, resultB] = await Promise.all([
      publishWeek(testDb, split.id, week.id, null),
      publishWeek(testDb, split.id, week.id, null),
    ]);
    expect([resultA.alreadyPublished, resultB.alreadyPublished].filter(Boolean)).toHaveLength(1);
    expect(await testDb.newsItem.count({ where: { category: "RESULTS" } })).toBe(1);
  });
});

describe("Semana lista para revisar y proxima ubicacion pendiente", () => {
  it("crea un unico aviso administrativo cuando se completan todos los KPI activos, sin duplicar al recargar", async () => {
    const split = await createDraftSplit();
    const person = await createPerson(testDb, { fullName: "Ana" });
    await activateStabilityKpi(split.id);
    const participant = await addParticipant(testDb, split.id, { personId: person.id, alias: "ana", level: "N2", startWeekSequenceNumber: 1 });
    await activateSplit(testDb, split.id);
    await createAdminUser();
    const week = await testDb.splitWeek.findFirstOrThrow({ where: { splitId: split.id, sequenceNumber: 1 } });

    await testDb.newsItem.deleteMany({});
    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "10" }));
    let readyNews = await testDb.newsItem.findMany({ where: { category: "ADMIN", eventKey: `week-ready:${week.id}` } });
    expect(readyNews).toHaveLength(1);

    await saveStabilityEntries(testDb, split.id, week.id, form({ [`resultValue__${participant.id}`]: "20" }));
    readyNews = await testDb.newsItem.findMany({ where: { category: "ADMIN", eventKey: `week-ready:${week.id}` } });
    expect(readyNews).toHaveLength(1);
  });
});

describe("Envio manual", () => {
  it("resuelve destinatarios por split, faccion y persona, y congela el publico", async () => {
    const split = await createDraftSplit();
    const admin = await createAdminUser();
    const personA = await createPerson(testDb, { fullName: "Ana" });
    const personB = await createPerson(testDb, { fullName: "Bea" });
    await activateStabilityKpi(split.id);
    const faction = await createFaction(testDb, split.id, { name: "Alfa", color: "#ff0000" });
    const otherFaction = await createFaction(testDb, split.id, { name: "Beta", color: "#00ff00" });
    await addParticipant(testDb, split.id, { personId: personA.id, alias: "ana", level: "N2", startWeekSequenceNumber: 1, factionId: faction.id });
    await addParticipant(testDb, split.id, { personId: personB.id, alias: "bea", level: "N2", startWeekSequenceNumber: 1, factionId: otherFaction.id });

    const toAll = await sendManualNews(testDb, admin.id, {
      splitId: split.id,
      audienceType: "SPLIT",
      priority: "NORMAL",
      title: "Aviso",
      body: "Mensaje",
      destination: "NONE",
      idempotencyKey: "manual-1",
    });
    expect(toAll.recipientCount).toBe(2);

    const toFaction = await sendManualNews(testDb, admin.id, {
      splitId: split.id,
      audienceType: "FACTION",
      factionId: faction.id,
      priority: "NORMAL",
      title: "Aviso faccion",
      body: "Mensaje",
      destination: "NONE",
      idempotencyKey: "manual-2",
    });
    expect(toFaction.recipientCount).toBe(1);
  });

  it("rechaza una faccion o persona de otro split", async () => {
    const split = await createDraftSplit();
    const otherSplit = await createDraftSplit();
    const admin = await createAdminUser();
    const foreignFaction = await createFaction(testDb, otherSplit.id, { name: "Ajena", color: "#000000" });

    await expect(
      sendManualNews(testDb, admin.id, {
        splitId: split.id,
        audienceType: "FACTION",
        factionId: foreignFaction.id,
        priority: "NORMAL",
        title: "T",
        body: "B",
        destination: "NONE",
        idempotencyKey: "k1",
      }),
    ).rejects.toBeInstanceOf(DomainError);
  });

  it("rechaza un titulo vacio, un cuerpo excesivo o un destino no valido en la validacion de servidor", () => {
    const base = {
      splitId: "s1",
      audienceType: "SPLIT" as const,
      priority: "NORMAL" as const,
      destination: "NONE" as const,
      idempotencyKey: "k2",
    };
    expect(() => manualNewsFormSchema.parse({ ...base, title: "", body: "Mensaje" })).toThrow();
    expect(() => manualNewsFormSchema.parse({ ...base, title: "Titulo", body: "x".repeat(601) })).toThrow();
    expect(() => manualNewsFormSchema.parse({ ...base, title: "Titulo", body: "Mensaje", destination: "OTRA" })).toThrow();
  });

  it("un doble envio con la misma clave de idempotencia no duplica el mensaje", async () => {
    const split = await createDraftSplit();
    const admin = await createAdminUser();
    const person = await createPerson(testDb, { fullName: "Ana" });
    await addParticipant(testDb, split.id, { personId: person.id, alias: "ana", level: "N2", startWeekSequenceNumber: 1 });

    const input = {
      splitId: split.id,
      audienceType: "SPLIT" as const,
      priority: "NORMAL" as const,
      title: "Aviso",
      body: "Mensaje",
      destination: "NONE" as const,
      idempotencyKey: "doble-envio",
    };
    await sendManualNews(testDb, admin.id, input);
    const second = await sendManualNews(testDb, admin.id, input);
    expect(second.alreadySent).toBe(true);
    expect(await testDb.newsItem.count({ where: { origin: "MANUAL" } })).toBe(1);
  });
});

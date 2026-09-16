import type { Prisma, PrismaClient } from "@prisma/client";
import { normalizeForMatching } from "@/lib/normalize";
import { BADGE_CATALOG } from "@/domain/badges/badge-catalog";
import {
  sortBadgeClassification,
  type BadgeClassificationEntry,
  type BadgeClassificationSourceEntry,
  type BadgeSortKey,
} from "@/domain/badges/badge-classification";

/**
 * Lecturas y catalogo del modulo Badges (`1.2.3`, ver docs/BADGES.md). No
 * reimplementa ningun ranking de gamificacion: solo agrega concesiones ya
 * emitidas (`BadgeAward`), calculadas siempre al consultar, con un numero
 * acotado de consultas (nunca una por persona ni una por badge).
 */

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Crea o repara el catalogo cerrado de badges a partir de `BADGE_CATALOG`
 * (idempotente: nunca duplica una categoria, nunca borra ni recalcula
 * concesiones ya emitidas). Se llama al finalizar un split y al importar el
 * historico, nunca en cada arranque de la aplicacion: es la unica forma en
 * que un badge derivado de un `KpiCode` nuevo aparece sin una migracion de
 * codigo dedicada al catalogo de badges.
 */
export async function ensureBadgeCatalogSeeded(db: Db): Promise<void> {
  for (const entry of BADGE_CATALOG) {
    const nameNormalized = normalizeForMatching(entry.name);
    await db.badge.upsert({
      where: { code: entry.code },
      update: { name: entry.name, nameNormalized, type: entry.type, kpiCode: entry.kpiCode, sortOrder: entry.sortOrder },
      create: {
        code: entry.code,
        name: entry.name,
        nameNormalized,
        type: entry.type,
        kpiCode: entry.kpiCode,
        sortOrder: entry.sortOrder,
      },
    });
  }
}

export interface BadgeCatalogRow {
  id: string;
  code: string;
  name: string;
  type: "MVP" | "TEAM_MVP" | "KPI";
  sortOrder: number;
}

/** Catalogo persistido, en orden de presentacion. Requiere `ensureBadgeCatalogSeeded` previo. */
export async function listBadgeCatalog(db: PrismaClient): Promise<BadgeCatalogRow[]> {
  return db.badge.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, code: true, name: true, type: true, sortOrder: true },
  });
}

interface PersonAggregate {
  personId: string;
  fullName: string;
  mvpCount: number;
  teamMvpCount: number;
  totalCount: number;
  countByBadgeCode: Map<string, number>;
}

/**
 * Agrega todas las concesiones ya emitidas por persona, en tres consultas
 * acotadas (concesiones, personas, avatares), nunca una por persona ni una
 * por badge (seccion 9 del encargo). Una concesion historica todavia sin
 * vincular (`recipient.personId === null`) nunca contamina esta agregacion
 * publica (seccion 8 del encargo).
 */
async function aggregateBadgeAwardsByPerson(db: PrismaClient): Promise<Map<string, PersonAggregate>> {
  const awards = await db.badgeAward.findMany({
    select: {
      personId: true,
      recipient: { select: { personId: true } },
      badge: { select: { code: true, type: true } },
    },
  });

  const byPerson = new Map<string, PersonAggregate>();
  for (const award of awards) {
    const resolvedPersonId = award.personId ?? award.recipient?.personId ?? null;
    if (!resolvedPersonId) continue;

    let aggregate = byPerson.get(resolvedPersonId);
    if (!aggregate) {
      aggregate = { personId: resolvedPersonId, fullName: "", mvpCount: 0, teamMvpCount: 0, totalCount: 0, countByBadgeCode: new Map() };
      byPerson.set(resolvedPersonId, aggregate);
    }
    aggregate.totalCount += 1;
    if (award.badge.type === "MVP") aggregate.mvpCount += 1;
    else if (award.badge.type === "TEAM_MVP") aggregate.teamMvpCount += 1;
    else aggregate.countByBadgeCode.set(award.badge.code, (aggregate.countByBadgeCode.get(award.badge.code) ?? 0) + 1);
  }

  if (byPerson.size === 0) return byPerson;

  const persons = await db.person.findMany({
    where: { id: { in: Array.from(byPerson.keys()) } },
    select: { id: true, fullName: true },
  });
  for (const person of persons) {
    const aggregate = byPerson.get(person.id);
    if (aggregate) aggregate.fullName = person.fullName;
  }
  return byPerson;
}

export interface BadgeClassificationResult {
  entries: BadgeClassificationEntry[];
  /** Categorias KPI del catalogo (incluidas las historicas), para los controles de ordenacion. */
  kpiCategories: { code: string; name: string }[];
}

/**
 * La clasificacion de badges no reutiliza la ruta de avatar de ficha
 * (`/api/fichas/[splitParticipantId]/avatar`): esa ruta esta pensada para
 * que un participante vea unicamente su propio avatar
 * (`readAvatarForViewer`), y esta clasificacion es publica entre todos los
 * usuarios autenticados. Ampliar esa autorizacion afectaria a toda la
 * aplicacion, no solo a Badges (ver docs/DECISIONS.md), asi que la interfaz
 * usa siempre un avatar decorativo por iniciales, nunca la foto real.
 */
export async function computeBadgeClassification(db: PrismaClient, sortKey: BadgeSortKey): Promise<BadgeClassificationResult> {
  const [byPerson, catalog] = await Promise.all([aggregateBadgeAwardsByPerson(db), listBadgeCatalog(db)]);

  const sourceEntries: BadgeClassificationSourceEntry[] = Array.from(byPerson.values()).map((aggregate) => ({
    personId: aggregate.personId,
    fullName: aggregate.fullName,
    mvpCount: aggregate.mvpCount,
    teamMvpCount: aggregate.teamMvpCount,
    totalCount: aggregate.totalCount,
    countByBadgeCode: aggregate.countByBadgeCode,
  }));

  const entries = sortBadgeClassification(sourceEntries, sortKey);

  return {
    entries,
    kpiCategories: catalog.filter((badge) => badge.type === "KPI").map((badge) => ({ code: badge.code, name: badge.name })),
  };
}

export interface PersonBadgeOccurrence {
  splitLabel: string;
  /** `null` en una concesion historica: el encargo prohibe inventar una fecha (seccion 6.3). */
  grantedAt: Date | null;
  reason: string;
}

export interface PersonBadgeShowcaseEntry {
  code: string;
  name: string;
  type: "MVP" | "TEAM_MVP" | "KPI";
  sortOrder: number;
  count: number;
  occurrences: PersonBadgeOccurrence[];
}

export interface PersonBadgeShowcase {
  personId: string;
  totalBadges: number;
  /** Todo el catalogo, incluidas las categorias sin ninguna concesion (`count: 0`, para mostrarlas bloqueadas). */
  badges: PersonBadgeShowcaseEntry[];
}

/** "Mi vitrina" / "Badges de la persona" (seccion 6.3 del encargo): colección completa de una persona, catalogo incluido. */
export async function getPersonBadgeShowcase(db: PrismaClient, personId: string): Promise<PersonBadgeShowcase> {
  const [catalog, awards] = await Promise.all([
    listBadgeCatalog(db),
    db.badgeAward.findMany({
      where: { OR: [{ personId }, { recipient: { personId } }] },
      select: {
        badgeNameSnapshot: true,
        splitLabelSnapshot: true,
        grantedAt: true,
        reason: true,
        badge: { select: { code: true, name: true, type: true, sortOrder: true } },
      },
      orderBy: [{ grantedAt: "asc" }],
    }),
  ]);

  const byCode = new Map<string, PersonBadgeShowcaseEntry>();
  for (const badge of catalog) {
    byCode.set(badge.code, { code: badge.code, name: badge.name, type: badge.type, sortOrder: badge.sortOrder, count: 0, occurrences: [] });
  }
  for (const award of awards) {
    let entry = byCode.get(award.badge.code);
    if (!entry) {
      // Defensivo: nunca deberia ocurrir tras `ensureBadgeCatalogSeeded`, pero una concesion no debe desaparecer aunque el catalogo estuviera incompleto.
      entry = { code: award.badge.code, name: award.badge.name, type: award.badge.type, sortOrder: award.badge.sortOrder, count: 0, occurrences: [] };
      byCode.set(award.badge.code, entry);
    }
    entry.count += 1;
    entry.occurrences.push({ splitLabel: award.splitLabelSnapshot, grantedAt: award.grantedAt, reason: award.reason });
  }

  const badges = Array.from(byCode.values()).sort((a, b) => a.sortOrder - b.sortOrder);
  return { personId, totalBadges: awards.length, badges };
}

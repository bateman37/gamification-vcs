import type { PrismaClient } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { normalizeForMatching } from "@/lib/normalize";
import { getBadgeCatalogEntry, resolveBadgeCodeForCategoryLabel } from "@/domain/badges/badge-catalog";
import { LEGACY_BADGES_VERSION, LEGACY_BADGE_GRANTS, LEGACY_BADGES_V1_EXPECTED_TOTALS } from "@/domain/badges/legacy-badges-v1";
import { validateLegacyBadgeDataset } from "@/domain/badges/legacy-badges-validator";
import { ensureBadgeCatalogSeeded } from "@/server/services/badge.service";

/**
 * Importacion e hilo administrativo del historico de badges (`1.2.3`,
 * secciones 3.3/4 del encargo, ver docs/BADGES.md). La importacion es
 * transaccional, idempotente y nunca reescribe una concesion ya existente;
 * la vinculacion automatica solo enlaza cuando hay exactamente una
 * coincidencia inequivoca, y nunca vincula dos destinatarios a la misma
 * persona (la restriccion unica de base de datos lo protege incluso si esta
 * capa tuviera un error de calculo).
 */

const UNIQUE_CONSTRAINT_ERROR_CODE = "P2002";

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === UNIQUE_CONSTRAINT_ERROR_CODE;
}

export interface LegacyImportSummary {
  datasetVersion: string;
  recipientsCreated: number;
  recipientsExisting: number;
  awardsCreated: number;
  awardsExisting: number;
  linked: number;
  pending: number;
  totalRecipients: number;
  totalAwards: number;
}

/**
 * Importa (o repara de forma segura) `legacy-badges-v1`: crea o reutiliza el
 * catalogo de badges, los 18 destinatarios historicos y las 127 concesiones,
 * y ejecuta despues la vinculacion automatica. Falla explicitamente sin
 * escribir nada si el dataset no supera sus controles de integridad
 * (18/127/9/30/88, seccion 4.3 del encargo). Reejecutarla no duplica nada:
 * cada destinatario y cada concesion tiene su propia clave de idempotencia.
 */
export async function importLegacyBadgesV1(db: PrismaClient): Promise<LegacyImportSummary> {
  const validation = validateLegacyBadgeDataset(LEGACY_BADGE_GRANTS, LEGACY_BADGES_V1_EXPECTED_TOTALS);
  if (!validation.ok) {
    throw new DomainError(
      `El dataset ${LEGACY_BADGES_VERSION} no supera los controles de integridad, la importación se ha cancelado sin escribir nada: ${validation.mismatches.join(" ")}`,
    );
  }

  const uniqueRecipientNames = new Map<string, string>(); // normalizedName -> originalName (primera aparicion)
  for (const grant of LEGACY_BADGE_GRANTS) {
    const normalized = normalizeForMatching(grant.recipientName);
    if (!uniqueRecipientNames.has(normalized)) uniqueRecipientNames.set(normalized, grant.recipientName);
  }

  let recipientsCreated = 0;
  let awardsCreated = 0;

  await db.$transaction(async (tx) => {
    await ensureBadgeCatalogSeeded(tx);
    const badges = await tx.badge.findMany({ select: { id: true, code: true } });
    const badgeIdByCode = new Map(badges.map((badge) => [badge.code, badge.id]));

    const existingRecipients = await tx.badgeHistoricalRecipient.findMany({
      where: { datasetVersion: LEGACY_BADGES_VERSION },
      select: { normalizedName: true, id: true },
    });
    const existingRecipientIdByNormalizedName = new Map(existingRecipients.map((r) => [r.normalizedName, r.id]));

    const recipientIdByNormalizedName = new Map<string, string>(existingRecipientIdByNormalizedName);
    for (const [normalizedName, originalName] of uniqueRecipientNames) {
      if (recipientIdByNormalizedName.has(normalizedName)) continue;
      const recipient = await tx.badgeHistoricalRecipient.upsert({
        where: { datasetVersion_normalizedName: { datasetVersion: LEGACY_BADGES_VERSION, normalizedName } },
        update: {},
        create: { datasetVersion: LEGACY_BADGES_VERSION, originalName, normalizedName },
      });
      recipientIdByNormalizedName.set(normalizedName, recipient.id);
      recipientsCreated += 1;
    }

    const existingAwardKeys = await tx.badgeAward.findMany({
      where: { idempotencyKey: { startsWith: `${LEGACY_BADGES_VERSION}:` } },
      select: { idempotencyKey: true },
    });
    const existingAwardKeySet = new Set(existingAwardKeys.map((row) => row.idempotencyKey));

    for (const grant of LEGACY_BADGE_GRANTS) {
      const badgeCode = resolveBadgeCodeForCategoryLabel(grant.categoryLabel);
      if (!badgeCode) continue; // ya bloqueado por la validacion de integridad previa; defensivo.
      const badgeId = badgeIdByCode.get(badgeCode);
      if (!badgeId) continue;

      const normalizedName = normalizeForMatching(grant.recipientName);
      const recipientId = recipientIdByNormalizedName.get(normalizedName);
      if (!recipientId) continue;

      const splitLabelKey = normalizeForMatching(grant.splitLabel);
      const idempotencyKey = `${LEGACY_BADGES_VERSION}:${splitLabelKey}:${badgeCode}:${recipientId}`;
      if (existingAwardKeySet.has(idempotencyKey)) continue;

      await tx.badgeAward.create({
        data: {
          badgeId,
          recipientId,
          splitId: null,
          splitLabelSnapshot: grant.splitLabel,
          badgeNameSnapshot: getBadgeCatalogEntry(badgeCode)?.name ?? grant.categoryLabel,
          origin: "LEGACY_IMPORT",
          grantedAt: null,
          reason: `Importado de ${LEGACY_BADGES_VERSION}: ${grant.splitLabel}.`,
          idempotencyKey,
        },
      });
      existingAwardKeySet.add(idempotencyKey);
      awardsCreated += 1;
    }
  });

  const linkResult = await runAutomaticBadgeRecipientLinking(db);
  const adminSummary = await listBadgeHistoricalAdminSummary(db);

  return {
    datasetVersion: LEGACY_BADGES_VERSION,
    recipientsCreated,
    recipientsExisting: adminSummary.totalRecipients - recipientsCreated,
    awardsCreated,
    awardsExisting: adminSummary.totalAwards - awardsCreated,
    linked: linkResult.linked,
    pending: linkResult.pending,
    totalRecipients: adminSummary.totalRecipients,
    totalAwards: adminSummary.totalAwards,
  };
}

export interface AutoLinkResult {
  linked: number;
  pending: number;
}

/**
 * Vinculacion automatica (seccion 3.3 del encargo): enlaza un destinatario
 * historico pendiente con una `Person` solo cuando existe una unica
 * coincidencia inequivoca por nombre normalizado, y esa persona todavia no
 * esta vinculada a otro destinatario. Nunca elige entre varias coincidencias
 * ni sobrescribe un enlace ya confirmado. Segura de reejecutar.
 */
export async function runAutomaticBadgeRecipientLinking(db: PrismaClient): Promise<AutoLinkResult> {
  const [unlinkedRecipients, persons, linkedPersonRows] = await Promise.all([
    db.badgeHistoricalRecipient.findMany({ where: { personId: null } }),
    db.person.findMany({ select: { id: true, fullName: true } }),
    db.badgeHistoricalRecipient.findMany({ where: { personId: { not: null } }, select: { personId: true } }),
  ]);
  if (unlinkedRecipients.length === 0) return { linked: 0, pending: 0 };

  const personsByNormalizedName = new Map<string, { id: string; fullName: string }[]>();
  for (const person of persons) {
    const normalized = normalizeForMatching(person.fullName);
    const group = personsByNormalizedName.get(normalized) ?? [];
    group.push(person);
    personsByNormalizedName.set(normalized, group);
  }
  const usedPersonIds = new Set(linkedPersonRows.map((row) => row.personId!));

  let linked = 0;
  let pending = 0;
  for (const recipient of unlinkedRecipients) {
    const candidates = (personsByNormalizedName.get(recipient.normalizedName) ?? []).filter((person) => !usedPersonIds.has(person.id));
    if (candidates.length !== 1) {
      pending += 1;
      continue;
    }
    const person = candidates[0]!;
    try {
      await db.badgeHistoricalRecipient.update({ where: { id: recipient.id }, data: { personId: person.id, linkedAt: new Date() } });
      usedPersonIds.add(person.id);
      linked += 1;
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        pending += 1;
        continue;
      }
      throw error;
    }
  }
  return { linked, pending };
}

/**
 * Vincula, corrige o desvincula manualmente un destinatario historico
 * (seccion 3.3 del encargo). Nunca altera ni borra las concesiones ya
 * asociadas a ese destinatario: solo cambia a que persona apuntan.
 * `personId: null` desvincula. La restriccion unica de base de datos impide
 * vincular la misma persona a dos destinatarios a la vez.
 */
export async function relinkBadgeHistoricalRecipient(db: PrismaClient, recipientId: string, personId: string | null): Promise<void> {
  const recipient = await db.badgeHistoricalRecipient.findUnique({ where: { id: recipientId } });
  if (!recipient) throw new DomainError("El destinatario histórico indicado no existe.");

  if (personId) {
    const person = await db.person.findUnique({ where: { id: personId } });
    if (!person) throw new DomainError("La persona indicada no existe.");
  }

  try {
    await db.badgeHistoricalRecipient.update({
      where: { id: recipientId },
      data: { personId, linkedAt: personId ? new Date() : null },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw new DomainError("Esa persona ya está vinculada a otro destinatario histórico. Desvincúlala primero.", "personId");
    }
    throw error;
  }
}

export interface BadgeHistoricalRecipientRow {
  id: string;
  originalName: string;
  personId: string | null;
  personFullName: string | null;
  linkedAt: Date | null;
  awardCount: number;
}

export interface BadgeHistoricalAdminSummary {
  totalRecipients: number;
  linkedCount: number;
  pendingCount: number;
  totalAwards: number;
  recipients: BadgeHistoricalRecipientRow[];
}

/** Resumen administrativo (seccion 3.3 del encargo): destinatarios, enlazados, pendientes y concesiones importadas. */
export async function listBadgeHistoricalAdminSummary(db: PrismaClient): Promise<BadgeHistoricalAdminSummary> {
  const [recipients, totalAwards] = await Promise.all([
    db.badgeHistoricalRecipient.findMany({
      orderBy: { originalName: "asc" },
      include: { person: { select: { fullName: true } }, _count: { select: { awards: true } } },
    }),
    db.badgeAward.count(),
  ]);

  const rows: BadgeHistoricalRecipientRow[] = recipients.map((recipient) => ({
    id: recipient.id,
    originalName: recipient.originalName,
    personId: recipient.personId,
    personFullName: recipient.person?.fullName ?? null,
    linkedAt: recipient.linkedAt,
    awardCount: recipient._count.awards,
  }));

  return {
    totalRecipients: rows.length,
    linkedCount: rows.filter((row) => row.personId !== null).length,
    pendingCount: rows.filter((row) => row.personId === null).length,
    totalAwards,
    recipients: rows,
  };
}

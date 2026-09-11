import type { PrismaClient, SplitParticipant, SplitWeek } from "@prisma/client";
import { KPI_CATALOG_LIST, type KpiCode } from "@/domain/kpis/catalog";

/**
 * Contador de "KPI cargados" por semana, para la columna independiente del
 * calendario de semanas (ver docs/MANUAL_KPI_ENTRY.md). Calculado siempre
 * al consultar, con un numero acotado de consultas para todo el calendario
 * (nunca una consulta por KPI y semana): las cabeceras de carga de los
 * cuatro origenes de Excel y las cinco entradas manuales se piden una sola
 * vez cada una para todas las semanas del split.
 */

export interface WeekKpiLoadSummary {
  loadedCount: number;
  totalActiveCount: number;
}

function isApplicable(participant: SplitParticipant, weekSequenceNumber: number): boolean {
  if (participant.startWeekSequenceNumber > weekSequenceNumber) return false;
  if (participant.endWeekSequenceNumber !== null && participant.endWeekSequenceNumber < weekSequenceNumber) return false;
  return true;
}

/** IDs de participantes aplicables a una semana, filtrados opcionalmente por nivel N2 (Guardian de la Estabilidad). */
function applicableParticipantIds(
  participants: SplitParticipant[],
  weekSequenceNumber: number,
  onlyN2: boolean,
): string[] {
  return participants
    .filter((participant) => (onlyN2 ? participant.level === "N2" : true))
    .filter((participant) => isApplicable(participant, weekSequenceNumber))
    .map((participant) => participant.id);
}

function isManualEntryComplete(requiredIds: string[], savedIds: ReadonlySet<string>): boolean {
  if (requiredIds.length === 0) return true;
  return requiredIds.every((id) => savedIds.has(id));
}

export async function getWeeklyKpiLoadSummary(
  db: PrismaClient,
  splitId: string,
  weeks: SplitWeek[],
): Promise<Map<string, WeekKpiLoadSummary>> {
  const weekIds = weeks.map((week) => week.id);

  const [kpiConfigs, participants, productivityImports, escalationImports, qualityImports, voiceImports, stabilityEntries, chronomancyEntries, writerEntries, studentEntries, apprenticeEntries] =
    await Promise.all([
      db.splitKpiConfig.findMany({ where: { splitId, isActive: true } }),
      db.splitParticipant.findMany({ where: { splitId } }),
      db.productivityImport.findMany({ where: { splitWeekId: { in: weekIds } }, select: { splitWeekId: true } }),
      db.escalationImport.findMany({ where: { splitWeekId: { in: weekIds } }, select: { splitWeekId: true } }),
      db.qualityImport.findMany({ where: { splitWeekId: { in: weekIds } }, select: { splitWeekId: true } }),
      db.voiceImport.findMany({ where: { splitWeekId: { in: weekIds } }, select: { splitWeekId: true } }),
      db.stabilityWeeklyEntry.findMany({ where: { splitWeekId: { in: weekIds } }, select: { splitWeekId: true, splitParticipantId: true } }),
      db.chronomancyWeeklyEntry.findMany({ where: { splitWeekId: { in: weekIds } }, select: { splitWeekId: true, splitParticipantId: true } }),
      db.writerWeeklyEntry.findMany({ where: { splitWeekId: { in: weekIds } }, select: { splitWeekId: true, splitParticipantId: true } }),
      db.studentWeeklyEntry.findMany({ where: { splitWeekId: { in: weekIds } }, select: { splitWeekId: true, splitParticipantId: true } }),
      db.apprenticeWeeklyEntry.findMany({ where: { splitWeekId: { in: weekIds } }, select: { splitWeekId: true, splitParticipantId: true } }),
    ]);

  const activeCodes = new Set<KpiCode>(kpiConfigs.map((config) => config.kpiCode));

  const productivityWeekIds = new Set(productivityImports.map((row) => row.splitWeekId));
  const escalationWeekIds = new Set(escalationImports.map((row) => row.splitWeekId));
  const qualityWeekIds = new Set(qualityImports.map((row) => row.splitWeekId));
  const voiceWeekIds = new Set(voiceImports.map((row) => row.splitWeekId));

  function groupByWeek(rows: { splitWeekId: string; splitParticipantId: string }[]): Map<string, Set<string>> {
    const map = new Map<string, Set<string>>();
    for (const row of rows) {
      const set = map.get(row.splitWeekId) ?? new Set<string>();
      set.add(row.splitParticipantId);
      map.set(row.splitWeekId, set);
    }
    return map;
  }

  const stabilityByWeek = groupByWeek(stabilityEntries);
  const chronomancyByWeek = groupByWeek(chronomancyEntries);
  const writerByWeek = groupByWeek(writerEntries);
  const studentByWeek = groupByWeek(studentEntries);
  const apprenticeByWeek = groupByWeek(apprenticeEntries);

  const summaries = new Map<string, WeekKpiLoadSummary>();

  for (const week of weeks) {
    let loadedCount = 0;
    const totalActiveCount = activeCodes.size;

    const isLoaded: Record<KpiCode, () => boolean> = {
      SOLUTION_HUNTER: () => productivityWeekIds.has(week.id),
      DATA_EXPLORER: () => productivityWeekIds.has(week.id),
      VOICE_AMBASSADOR: () => voiceWeekIds.has(week.id),
      MASTER_CRAFTSMAN: () => qualityWeekIds.has(week.id),
      ESCALATION_TAMER: () => escalationWeekIds.has(week.id) && productivityWeekIds.has(week.id),
      STABILITY_GUARDIAN: () =>
        isManualEntryComplete(
          applicableParticipantIds(participants, week.sequenceNumber, true),
          stabilityByWeek.get(week.id) ?? new Set(),
        ),
      WORK_CHRONOMANCY: () =>
        isManualEntryComplete(
          applicableParticipantIds(participants, week.sequenceNumber, false),
          chronomancyByWeek.get(week.id) ?? new Set(),
        ),
      STAR_WRITER: () =>
        isManualEntryComplete(applicableParticipantIds(participants, week.sequenceNumber, false), writerByWeek.get(week.id) ?? new Set()),
      ENTHUSIASTIC_STUDENT: () =>
        isManualEntryComplete(
          applicableParticipantIds(participants, week.sequenceNumber, false),
          studentByWeek.get(week.id) ?? new Set(),
        ),
      EXPERT_APPRENTICE: () =>
        isManualEntryComplete(
          applicableParticipantIds(participants, week.sequenceNumber, false),
          apprenticeByWeek.get(week.id) ?? new Set(),
        ),
    };

    for (const catalogEntry of KPI_CATALOG_LIST) {
      if (!activeCodes.has(catalogEntry.code)) continue;
      if (isLoaded[catalogEntry.code]()) loadedCount += 1;
    }

    summaries.set(week.id, { loadedCount, totalActiveCount });
  }

  return summaries;
}

import { Prisma, type ParticipantLevel, type PrismaClient, type SplitWeek } from "@prisma/client";
import { DomainError } from "@/lib/errors";
import { getSplitById, getSplitWeek } from "@/server/services/split.service";
import { listApplicableParticipantsForWeek, type ParticipantWithPerson } from "@/server/services/participant.service";
import { listKpiConfigsForSplit } from "@/server/services/kpi.service";
import { listPositionPointRules } from "@/server/services/position-points.service";
import { getWeeklyKpiLoadSummary } from "@/server/services/kpi-load-summary.service";
import { toKpiConfigView, type KpiConfigView } from "@/domain/kpis/mapping";
import { KPI_CATALOG, KPI_CATALOG_LIST, type KpiCode } from "@/domain/kpis/catalog";
import { applyBaseMax, multiplierForLevel, type KpiComputation } from "@/domain/kpis/shared";
import { resolveSolutionHunterOutcome, resolveDataExplorerOutcome } from "@/domain/kpis/productivity";
import { resolveVoiceAmbassadorOutcome } from "@/domain/kpis/voice";
import { resolveMasterCraftsmanOutcome } from "@/domain/kpis/quality";
import { resolveEscalationTamerOutcome } from "@/domain/kpis/escalation";
import { resolveStabilityGuardianOutcome } from "@/domain/kpis/stability";
import { resolveWorkChronomancyOutcome } from "@/domain/kpis/chronomancy";
import { resolveStarWriterOutcome } from "@/domain/kpis/writer";
import { resolveEnthusiasticStudentOutcome } from "@/domain/kpis/student";
import { resolveExpertApprenticeOutcome } from "@/domain/kpis/apprentice";
import { rankByScoreDescending, compareNormalizedAlias } from "@/domain/ranking";

/**
 * Motor agregado de resultados semanales (ver docs/RESULTS_PUBLICATION.md).
 * Construye el resultado completo de una semana reutilizando los resolvers
 * de `src/domain/kpis/*`: no duplica ninguna formula. Usado tanto por la
 * previsualizacion en vivo como por la publicacion (que vuelve a llamar a
 * este mismo motor dentro de su propia transaccion, en vez de confiar en
 * datos calculados previamente).
 */

export type KpiResultStatus = "COMPUTED" | "VAC" | "NOT_APPLICABLE";

export interface ParticipantKpiResult {
  kpiCode: KpiCode;
  kpiName: string;
  status: KpiResultStatus;
  rawPoints: number | null;
  finalPoints: number | null;
  baseMax: number | null;
  capped: boolean;
  kpiRank: number | null;
  rankedParticipantCount: number | null;
}

export interface ParticipantWeeklyResult {
  splitParticipantId: string;
  personId: string;
  fullName: string;
  alias: string;
  level: ParticipantLevel;
  kpiResults: ParticipantKpiResult[];
  totalKpiPoints: number;
  applicableMaxPoints: number | null;
  weeklyRank: number;
  positionPoints: number | null;
}

export interface WeeklyResultsComputation {
  splitId: string;
  weekId: string;
  weekSequenceNumber: number;
  weekStartDate: Date;
  weekEndDate: Date;
  computedAt: Date;
  activeKpiCodes: KpiCode[];
  participants: ParticipantWeeklyResult[];
  totalActiveKpiCount: number;
  totalParticipantCount: number;
  vacCountsByKpi: Partial<Record<KpiCode, number>>;
  totalVacCount: number;
  completeness: { loadedCount: number; totalActiveCount: number };
  /** `totalActiveCount > 0 && loadedCount === totalActiveCount` (regla unica de completitud semanal, seccion 2). */
  isComplete: boolean;
  /** Inconsistencias que deben impedir la publicacion (fila inesperada ausente, posicion sin regla configurada, etc.). Vacio si se puede publicar. */
  blockingIssues: string[];
}

interface ResolvedKpiOutcome {
  status: KpiResultStatus;
  computation: KpiComputation | null;
  blockingIssue: string | null;
}

interface RawDataContext {
  hasEscalationImport: boolean;
  productivity: Map<string, { ticketsResolved: number; ticketsUpdatedWithComment: number; updates: number }>;
  voice: Map<string, { accepted: number; rejected: number; unattended: number; outbound: number }>;
  quality: Map<string, { good: number; bad: number }>;
  escalation: Map<string, { groupReassignments: number }>;
  stability: Map<string, number>;
  chronomancy: Map<string, { productiveHours: number; totalHours: number }>;
  writer: Map<string, { delivered: number; undelivered: number; proposed: number }>;
  student: Map<string, number>;
  apprentice: Map<string, number>;
}

function importOutcomeToResult(outcome: { status: "not_applicable" | "no_data" | "computed" } & Partial<KpiComputation>): ResolvedKpiOutcome {
  if (outcome.status === "not_applicable") return { status: "NOT_APPLICABLE", computation: null, blockingIssue: null };
  if (outcome.status === "no_data") {
    // Ausencia en una carga de Excel ya confirmada: VAC, nunca carga parcial (ver docs/DECISIONS.md).
    return { status: "VAC", computation: null, blockingIssue: null };
  }
  return {
    status: "COMPUTED",
    computation: { rawPoints: outcome.rawPoints!, finalPoints: outcome.finalPoints!, capped: outcome.capped! },
    blockingIssue: null,
  };
}

function manualOutcomeToResult(
  outcome: { status: "not_applicable" | "no_data" | "computed" } & Partial<KpiComputation>,
  participantAlias: string,
  kpiLabel: string,
): ResolvedKpiOutcome {
  if (outcome.status === "not_applicable") return { status: "NOT_APPLICABLE", computation: null, blockingIssue: null };
  if (outcome.status === "no_data") {
    // Entrada manual atomica: si la semana esta marcada como completa, una fila ausente es una inconsistencia, no un cero silencioso (seccion 3.3).
    return {
      status: "VAC",
      computation: null,
      blockingIssue: `${kpiLabel}: falta la entrada guardada de "${participantAlias}" en una semana marcada como completa. Vuelve a introducir sus datos antes de publicar.`,
    };
  }
  return {
    status: "COMPUTED",
    computation: { rawPoints: outcome.rawPoints!, finalPoints: outcome.finalPoints!, capped: outcome.capped! },
    blockingIssue: null,
  };
}

function resolveParticipantKpi(
  kpiCode: KpiCode,
  config: KpiConfigView,
  participant: ParticipantWithPerson,
  ctx: RawDataContext,
): ResolvedKpiOutcome {
  const level = participant.level;

  switch (kpiCode) {
    case "SOLUTION_HUNTER": {
      const row = ctx.productivity.get(participant.id);
      return importOutcomeToResult(resolveSolutionHunterOutcome(config, level, row?.ticketsResolved));
    }
    case "DATA_EXPLORER": {
      const row = ctx.productivity.get(participant.id);
      return importOutcomeToResult(resolveDataExplorerOutcome(config, level, row?.ticketsUpdatedWithComment));
    }
    case "VOICE_AMBASSADOR": {
      const row = ctx.voice.get(participant.id);
      return importOutcomeToResult(
        resolveVoiceAmbassadorOutcome(config, level, row?.accepted, row?.rejected, row?.unattended, row?.outbound),
      );
    }
    case "MASTER_CRAFTSMAN": {
      const row = ctx.quality.get(participant.id);
      return importOutcomeToResult(resolveMasterCraftsmanOutcome(config, level, row?.good, row?.bad));
    }
    case "ESCALATION_TAMER": {
      const escalationRow = ctx.escalation.get(participant.id);
      const productivityRow = ctx.productivity.get(participant.id);
      const outcome = resolveEscalationTamerOutcome(config, level, {
        hasEscalationImport: ctx.hasEscalationImport,
        groupReassignments: escalationRow?.groupReassignments,
        updates: productivityRow?.updates,
      });
      if (outcome.status === "not_applicable") return { status: "NOT_APPLICABLE", computation: null, blockingIssue: null };
      if (outcome.status === "no_escalation_data" || outcome.status === "vac") {
        return { status: "VAC", computation: null, blockingIssue: null };
      }
      if (outcome.status === "no_productivity_data") {
        return {
          status: "VAC",
          computation: null,
          blockingIssue: `Domador de Escaladas: "${participant.alias}" tiene fila en Escalados pero no en Productividad de la misma semana. Resuelve la carga antes de publicar.`,
        };
      }
      if (outcome.status === "zero_updates") {
        // Decision (0.6.0 / MVP-1C, ver docs/DECISIONS.md): con Actualizaciones en 0 el ratio de escalados no es calculable
        // (division por cero); se interpreta como ratio 0 (sin escalados posibles sobre cero actualizaciones), reutilizando
        // el mismo helper `applyBaseMax` que el resto de KPI, sin duplicar la formula de `calculateEscalationTamerPoints`.
        const basePoints = config.parameters.basePoints ?? 30;
        const multiplier = multiplierForLevel(config, level) ?? 0;
        const raw = new Prisma.Decimal(basePoints).mul(multiplier);
        return { status: "COMPUTED", computation: applyBaseMax(raw, config.baseMax), blockingIssue: null };
      }
      return { status: "COMPUTED", computation: outcome, blockingIssue: null };
    }
    case "STABILITY_GUARDIAN": {
      const resultValue = ctx.stability.get(participant.id);
      return manualOutcomeToResult(resolveStabilityGuardianOutcome(config, level, resultValue), participant.alias, "Guardian de la Estabilidad");
    }
    case "WORK_CHRONOMANCY": {
      const row = ctx.chronomancy.get(participant.id);
      const outcome = resolveWorkChronomancyOutcome(config, level, row?.productiveHours, row?.totalHours);
      if (outcome.status === "not_applicable") return { status: "NOT_APPLICABLE", computation: null, blockingIssue: null };
      if (outcome.status === "no_data") {
        return {
          status: "VAC",
          computation: null,
          blockingIssue: `Cronomagia laboral: falta la entrada guardada de "${participant.alias}" en una semana marcada como completa. Vuelve a introducir sus datos antes de publicar.`,
        };
      }
      if (outcome.status === "vac") return { status: "VAC", computation: null, blockingIssue: null };
      return { status: "COMPUTED", computation: outcome, blockingIssue: null };
    }
    case "STAR_WRITER": {
      const row = ctx.writer.get(participant.id);
      return manualOutcomeToResult(
        resolveStarWriterOutcome(config, level, row?.delivered, row?.undelivered, row?.proposed),
        participant.alias,
        "Redactor estrella",
      );
    }
    case "ENTHUSIASTIC_STUDENT": {
      const dedicatedHours = ctx.student.get(participant.id);
      return manualOutcomeToResult(resolveEnthusiasticStudentOutcome(config, level, dedicatedHours), participant.alias, "Estudiante entusiasta");
    }
    case "EXPERT_APPRENTICE": {
      const completedTrainings = ctx.apprentice.get(participant.id);
      return manualOutcomeToResult(resolveExpertApprenticeOutcome(config, level, completedTrainings), participant.alias, "Aprendiz experto");
    }
  }
}

async function loadRawDataContext(db: PrismaClient, splitId: string, weekId: string, activeCodes: Set<KpiCode>): Promise<RawDataContext> {
  const needsProductivity = activeCodes.has("SOLUTION_HUNTER") || activeCodes.has("DATA_EXPLORER") || activeCodes.has("ESCALATION_TAMER");
  const needsVoice = activeCodes.has("VOICE_AMBASSADOR");
  const needsQuality = activeCodes.has("MASTER_CRAFTSMAN");
  const needsEscalation = activeCodes.has("ESCALATION_TAMER");
  const needsStability = activeCodes.has("STABILITY_GUARDIAN");
  const needsChronomancy = activeCodes.has("WORK_CHRONOMANCY");
  const needsWriter = activeCodes.has("STAR_WRITER");
  const needsStudent = activeCodes.has("ENTHUSIASTIC_STUDENT");
  const needsApprentice = activeCodes.has("EXPERT_APPRENTICE");

  const [productivityImport, voiceImport, qualityImport, escalationImport, stabilityEntries, chronomancyEntries, writerEntries, studentEntries, apprenticeEntries] =
    await Promise.all([
      needsProductivity ? db.productivityImport.findUnique({ where: { splitWeekId: weekId }, include: { rows: true } }) : Promise.resolve(null),
      needsVoice ? db.voiceImport.findUnique({ where: { splitWeekId: weekId }, include: { rows: true } }) : Promise.resolve(null),
      needsQuality ? db.qualityImport.findUnique({ where: { splitWeekId: weekId }, include: { rows: true } }) : Promise.resolve(null),
      needsEscalation ? db.escalationImport.findUnique({ where: { splitWeekId: weekId }, include: { rows: true } }) : Promise.resolve(null),
      needsStability ? db.stabilityWeeklyEntry.findMany({ where: { splitWeekId: weekId } }) : Promise.resolve([]),
      needsChronomancy ? db.chronomancyWeeklyEntry.findMany({ where: { splitWeekId: weekId } }) : Promise.resolve([]),
      needsWriter ? db.writerWeeklyEntry.findMany({ where: { splitWeekId: weekId } }) : Promise.resolve([]),
      needsStudent ? db.studentWeeklyEntry.findMany({ where: { splitWeekId: weekId } }) : Promise.resolve([]),
      needsApprentice ? db.apprenticeWeeklyEntry.findMany({ where: { splitWeekId: weekId } }) : Promise.resolve([]),
    ]);

  return {
    hasEscalationImport: escalationImport !== null,
    productivity: new Map(
      (productivityImport?.rows ?? []).map((row) => [
        row.splitParticipantId,
        { ticketsResolved: row.ticketsResolved, ticketsUpdatedWithComment: row.ticketsUpdatedWithComment, updates: row.updates },
      ]),
    ),
    voice: new Map(
      (voiceImport?.rows ?? []).map((row) => [
        row.splitParticipantId,
        {
          accepted: row.acceptedCallSegments,
          rejected: row.rejectedCallSegments,
          unattended: row.unattendedCallSegments,
          outbound: row.outboundCalls,
        },
      ]),
    ),
    quality: new Map(
      (qualityImport?.rows ?? []).map((row) => [row.splitParticipantId, { good: row.goodSatisfactionTickets, bad: row.badSatisfactionTickets }]),
    ),
    escalation: new Map((escalationImport?.rows ?? []).map((row) => [row.splitParticipantId, { groupReassignments: row.groupReassignments }])),
    stability: new Map(stabilityEntries.map((entry) => [entry.splitParticipantId, entry.resultValue.toNumber()])),
    chronomancy: new Map(
      chronomancyEntries.map((entry) => [
        entry.splitParticipantId,
        { productiveHours: entry.productiveHours.toNumber(), totalHours: entry.totalHours.toNumber() },
      ]),
    ),
    writer: new Map(
      writerEntries.map((entry) => [
        entry.splitParticipantId,
        { delivered: entry.deliveredArticles, undelivered: entry.undeliveredArticles, proposed: entry.proposedArticles },
      ]),
    ),
    student: new Map(studentEntries.map((entry) => [entry.splitParticipantId, entry.dedicatedHours.toNumber()])),
    apprentice: new Map(apprenticeEntries.map((entry) => [entry.splitParticipantId, entry.completedTrainings])),
  };
}

/**
 * Calcula el resultado completo de una semana. Cuando la semana no esta
 * completa (`isComplete: false`), no calcula la tabla por participante: el
 * llamador debe explicar que falta y no mostrar una tabla parcial (seccion
 * 4.3). Vuelve a validar y recalcular todo desde base de datos: nunca debe
 * llamarse confiando en datos calculados previamente en el navegador.
 */
export async function computeWeeklyResults(db: PrismaClient, splitId: string, weekId: string): Promise<WeeklyResultsComputation> {
  const split = await getSplitById(db, splitId);
  if (!split) throw new DomainError("El split indicado no existe.");
  const week = await getSplitWeek(db, splitId, weekId);
  if (!week) throw new DomainError("La semana indicada no pertenece a este split.");

  const [kpiConfigs, summaryByWeek] = await Promise.all([
    listKpiConfigsForSplit(db, splitId),
    getWeeklyKpiLoadSummary(db, splitId, [week]),
  ]);
  const completeness = summaryByWeek.get(week.id) ?? { loadedCount: 0, totalActiveCount: 0 };
  const isComplete = completeness.totalActiveCount > 0 && completeness.loadedCount === completeness.totalActiveCount;

  const activeConfigs = kpiConfigs.filter((config) => config.isActive);
  const activeCodes = KPI_CATALOG_LIST.map((entry) => entry.code).filter((code) => activeConfigs.some((config) => config.kpiCode === code));

  const base: WeeklyResultsComputation = {
    splitId,
    weekId: week.id,
    weekSequenceNumber: week.sequenceNumber,
    weekStartDate: week.startDate,
    weekEndDate: week.endDate,
    computedAt: new Date(),
    activeKpiCodes: activeCodes,
    participants: [],
    totalActiveKpiCount: activeCodes.length,
    totalParticipantCount: 0,
    vacCountsByKpi: {},
    totalVacCount: 0,
    completeness,
    isComplete,
    blockingIssues: [],
  };

  if (!isComplete) return base;

  const participants = await listApplicableParticipantsForWeek(db, splitId, week.sequenceNumber);
  const configByCode = new Map(activeConfigs.map((config) => [config.kpiCode, toKpiConfigView(config)]));
  const ctx = await loadRawDataContext(db, splitId, week.id, new Set(activeCodes));

  const blockingIssues: string[] = [];
  const vacCountsByKpi: Partial<Record<KpiCode, number>> = {};
  for (const code of activeCodes) vacCountsByKpi[code] = 0;

  interface WorkingParticipant {
    participant: ParticipantWithPerson;
    kpiResults: ParticipantKpiResult[];
    totalKpiPointsDecimal: Prisma.Decimal;
    applicableMaxPointsDecimal: Prisma.Decimal;
    hasApplicableMax: boolean;
  }

  const working: WorkingParticipant[] = participants.map((participant) => {
    let totalKpiPointsDecimal = new Prisma.Decimal(0);
    let applicableMaxPointsDecimal = new Prisma.Decimal(0);
    let hasApplicableMax = false;

    const kpiResults: ParticipantKpiResult[] = activeCodes.map((code) => {
      const config = configByCode.get(code)!;
      const resolved = resolveParticipantKpi(code, config, participant, ctx);
      if (resolved.blockingIssue) blockingIssues.push(resolved.blockingIssue);
      if (resolved.status === "VAC") vacCountsByKpi[code] = (vacCountsByKpi[code] ?? 0) + 1;

      if (resolved.status === "COMPUTED" && resolved.computation) {
        totalKpiPointsDecimal = totalKpiPointsDecimal.plus(resolved.computation.finalPoints);
        applicableMaxPointsDecimal = applicableMaxPointsDecimal.plus(config.baseMax);
        hasApplicableMax = true;
      }

      return {
        kpiCode: code,
        kpiName: KPI_CATALOG[code].name,
        status: resolved.status,
        rawPoints: resolved.computation ? resolved.computation.rawPoints.toNumber() : null,
        finalPoints: resolved.computation ? resolved.computation.finalPoints.toNumber() : null,
        baseMax: resolved.status === "NOT_APPLICABLE" ? null : config.baseMax,
        capped: resolved.computation?.capped ?? false,
        kpiRank: null,
        rankedParticipantCount: null,
      };
    });

    return { participant, kpiResults, totalKpiPointsDecimal, applicableMaxPointsDecimal, hasApplicableMax };
  });

  // Ranking por KPI (seccion 3.5): solo entre resultados COMPUTED.
  for (const code of activeCodes) {
    const computedEntries = working
      .map((entry) => ({ entry, kpiResult: entry.kpiResults.find((result) => result.kpiCode === code)! }))
      .filter(({ kpiResult }) => kpiResult.status === "COMPUTED");

    const ranked = rankByScoreDescending(
      computedEntries,
      ({ kpiResult }) => new Prisma.Decimal(kpiResult.finalPoints ?? 0),
      (a, b) => compareNormalizedAlias(a.entry.participant.aliasNormalized, b.entry.participant.aliasNormalized) || a.entry.participant.id.localeCompare(b.entry.participant.id),
    );
    for (const { item, rank } of ranked) {
      item.kpiResult.kpiRank = rank;
      item.kpiResult.rankedParticipantCount = computedEntries.length;
    }
  }

  // Ranking semanal (seccion 3.4): todos los participantes aplicables entran, ordenados por la suma de KPI descendente.
  const positionRules = await listPositionPointRules(db, splitId);
  const pointsByPosition = new Map(positionRules.map((rule) => [rule.position, rule.points]));

  const weeklyRanked = rankByScoreDescending(
    working,
    (entry) => entry.totalKpiPointsDecimal,
    (a, b) => compareNormalizedAlias(a.participant.aliasNormalized, b.participant.aliasNormalized) || a.participant.id.localeCompare(b.participant.id),
  );

  const resultParticipants: ParticipantWeeklyResult[] = weeklyRanked.map(({ item, rank }) => {
    const positionPoints = pointsByPosition.get(rank);
    if (positionPoints === undefined) {
      blockingIssues.push(`No existe una regla de puntos por posicion configurada para la posicion ${rank}. Configurala antes de publicar.`);
    }
    return {
      splitParticipantId: item.participant.id,
      personId: item.participant.personId,
      fullName: item.participant.person.fullName,
      alias: item.participant.alias,
      level: item.participant.level,
      kpiResults: item.kpiResults,
      totalKpiPoints: item.totalKpiPointsDecimal.toNumber(),
      applicableMaxPoints: item.hasApplicableMax ? item.applicableMaxPointsDecimal.toNumber() : null,
      weeklyRank: rank,
      positionPoints: positionPoints ?? null,
    };
  });

  const totalVacCount = Object.values(vacCountsByKpi).reduce((sum, count) => sum + (count ?? 0), 0);

  return {
    ...base,
    participants: resultParticipants,
    totalParticipantCount: resultParticipants.length,
    vacCountsByKpi,
    totalVacCount,
    blockingIssues: Array.from(new Set(blockingIssues)),
  };
}

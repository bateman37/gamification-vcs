/**
 * Plantillas de texto plano de las noticias automaticas (`1.0.0` / MVP-3,
 * ver docs/NEWS_CENTER.md). Funciones puras: reciben datos ya resueltos por
 * el servicio que dispara el evento y devuelven `{ title, body }` listo
 * para congelar en `NewsItem`. No hay motor generico de plantillas: cada
 * evento tiene su propia funcion explicita, facil de leer y de probar.
 *
 * El texto se renderiza siempre como texto plano escapado en la interfaz:
 * estas funciones nunca devuelven HTML ni Markdown.
 */

import { formatCalendarDateEs } from "@/lib/dates";
import { formatPoints } from "@/lib/format";
import type { SplitFinalizationSummary } from "@/domain/split-finalization";

export interface NewsText {
  title: string;
  body: string;
}

// --- Jugador -----------------------------------------------------------

export function participantAddedNewsTemplate(input: {
  splitName: string;
  factionName: string | null;
  needsAvatar: boolean;
  needsProfession: boolean;
}): NewsText {
  const parts: string[] = ["Ya formas parte de este split."];
  if (input.factionName) {
    parts.push(`Perteneces a la facción ${input.factionName}.`);
  }
  const pending: string[] = [];
  if (input.needsAvatar) pending.push("tu avatar");
  if (input.needsProfession) pending.push("tu profesión");
  if (pending.length > 0) {
    parts.push(`Revisa tu alias y completa ${pending.join(" y ")} antes de la primera publicación.`);
  } else {
    parts.push("Revisa tu alias cuando quieras personalizarlo.");
  }
  return { title: `Te han añadido a ${input.splitName}`, body: parts.join(" ") };
}

export function splitActivatedNewsTemplateForParticipant(input: {
  splitName: string;
  startDate: Date;
  needsAvatar: boolean;
  needsProfession: boolean;
  nextLocation: { name: string; kpiName: string; bonusPercent: number; weekStartDate: Date } | null;
}): NewsText {
  const parts: string[] = [`${input.splitName} ya está activo desde el ${formatCalendarDateEs(input.startDate)}.`];
  const pending: string[] = [];
  if (input.needsAvatar) pending.push("tu avatar");
  if (input.needsProfession) pending.push("tu profesión");
  if (pending.length > 0) {
    parts.push(`Completa ${pending.join(" y ")} antes de la primera publicación.`);
  }
  if (input.nextLocation) {
    parts.push(
      `La semana del ${formatCalendarDateEs(input.nextLocation.weekStartDate)} tendrá la localización "${input.nextLocation.name}", que potenciará ${input.nextLocation.kpiName} un +${input.nextLocation.bonusPercent} %.`,
    );
  }
  return { title: `${input.splitName} ya está activo`, body: parts.join(" ") };
}

export function factionReassignedNewsTemplate(input: { factionName: string }): NewsText {
  return {
    title: "Tienes una nueva facción",
    body: `Ahora perteneces a la facción ${input.factionName}.`,
  };
}

export function factionRenamedNewsTemplate(input: { oldName: string; newName: string }): NewsText {
  return {
    title: "Tu facción ha cambiado de nombre",
    body: `Tu facción "${input.oldName}" ahora se llama "${input.newName}".`,
  };
}

export function professionAssignedNewsTemplate(input: {
  professionName: string;
  kpiNameA: string;
  kpiNameB: string;
  bonusPercent: number;
}): NewsText {
  return {
    title: "Ya tienes profesión",
    body: `Tu profesión es ${input.professionName}: potencia ${input.kpiNameA} y ${input.kpiNameB} un +${input.bonusPercent} %.`,
  };
}

export function locationCreatedNewsTemplate(input: {
  weekStartDate: Date;
  name: string;
  kpiName: string;
  bonusPercent: number;
}): NewsText {
  return {
    title: `Nueva ubicación · semana del ${formatCalendarDateEs(input.weekStartDate)}`,
    body: `"${input.name}" potenciará ${input.kpiName} un +${input.bonusPercent} %.`,
  };
}

export function locationUpdatedNewsTemplate(input: {
  weekStartDate: Date;
  name: string;
  kpiName: string;
  bonusPercent: number;
}): NewsText {
  return {
    title: `Ubicación actualizada · semana del ${formatCalendarDateEs(input.weekStartDate)}`,
    body: `"${input.name}" ahora potenciará ${input.kpiName} un +${input.bonusPercent} %.`,
  };
}

export function locationDeletedNewsTemplate(input: { weekStartDate: Date; name: string }): NewsText {
  return {
    title: `Ubicación cancelada · semana del ${formatCalendarDateEs(input.weekStartDate)}`,
    body: `Se ha cancelado la localización "${input.name}" de esa semana.`,
  };
}

export function marketOpenedNewsTemplateForParticipant(input: { itemCount: number }): NewsText {
  return {
    title: "El mercado ya está abierto",
    body: `Hay ${input.itemCount} ${input.itemCount === 1 ? "objeto disponible" : "objetos disponibles"} para comprar. Consulta tu saldo en tu ficha.`,
  };
}

export function marketClosedNewsTemplateForParticipant(): NewsText {
  return {
    title: "El mercado se ha cerrado",
    body: "Ya no se pueden comprar objetos. Los que ya tienes siguen equipables mientras el split esté activo.",
  };
}

export function purchaseCompletedNewsTemplate(input: {
  itemName: string;
  priceCredits: number;
  remainingBalance: number;
}): NewsText {
  return {
    title: `Has comprado ${input.itemName}`,
    body: `${input.priceCredits} créditos · Saldo restante: ${input.remainingBalance} créditos.`,
  };
}

export function weekPublishedNewsTemplate(input: {
  weekStartDate: Date;
  totalKpiPoints: number;
  /** `null` para una persona ausente esa semana (`1.1.1`): nunca afirma una posicion ficticia. */
  rank: number | null;
  totalParticipants: number;
  positionPoints: number;
  creditsEarned: number;
  faction: { name: string; rank: number } | null;
  professionJustLocked: boolean;
}): NewsText {
  const parts: string[] =
    input.rank === null
      ? [
          `Ausencia · Sin datos semanales · 0 créditos${input.positionPoints > 0 ? ` · ${input.positionPoints} puntos por posición` : ""}.`,
        ]
      : [
          `Posición semanal: ${input.rank} de ${input.totalParticipants} · ${formatPoints(input.totalKpiPoints)} puntos KPI · ${input.positionPoints} puntos por posición · ${input.creditsEarned} créditos.`,
        ];
  if (input.faction) {
    parts.push(`Tu facción, ${input.faction.name}, ha quedado ${input.faction.rank}.`);
  }
  if (input.professionJustLocked) {
    parts.push("Tu profesión ya es definitiva para el resto del split.");
  }
  parts.push("Puedes consultar el detalle completo.");
  return {
    title: `Resultados publicados · ${formatCalendarDateEs(input.weekStartDate)}`,
    body: parts.join(" "),
  };
}

/** Noticia administrativa cuando toda la plantilla aplicable estuvo ausente esa semana (`1.1.1`, seccion E4/F6). */
export function adminWeekAllAbsentNewsTemplate(input: { splitName: string; weekStartDate: Date }): NewsText {
  return {
    title: `Semana publicada sin presentes · ${input.splitName}`,
    body: `La semana del ${formatCalendarDateEs(input.weekStartDate)} se publicó sin ningún participante presente: no hay ranking semanal, y todos recibieron 0 puntos KPI y 0 créditos.`,
  };
}

// --- Administracion ------------------------------------------------------

export function adminSplitCreatedNewsTemplate(input: { splitName: string; startDate: Date; numberOfWeeks: number }): NewsText {
  return {
    title: `Split creado: ${input.splitName}`,
    body: `Empieza el ${formatCalendarDateEs(input.startDate)} y tiene ${input.numberOfWeeks} semanas.`,
  };
}

export function adminSplitActivatedNewsTemplate(input: {
  splitName: string;
  participantCount: number;
  activeKpiCount: number;
  startDate: Date;
}): NewsText {
  return {
    title: `${input.splitName} ya está activo`,
    body: `${input.participantCount} participantes y ${input.activeKpiCount} KPI activos desde el ${formatCalendarDateEs(input.startDate)}.`,
  };
}

export function adminIncompleteProfilesNewsTemplate(input: { splitName: string; aliases: string[] }): NewsText {
  const preview = input.aliases.slice(0, 5).join(", ");
  const suffix = input.aliases.length > 5 ? `, y ${input.aliases.length - 5} más` : "";
  return {
    title: `Fichas incompletas en ${input.splitName}`,
    body: `${input.aliases.length} ${input.aliases.length === 1 ? "participante tiene" : "participantes tienen"} avatar o profesión pendiente: ${preview}${suffix}.`,
  };
}

export function adminWeekReadyNewsTemplate(input: { splitName: string; weekStartDate: Date }): NewsText {
  return {
    title: `Semana lista para revisar · ${input.splitName}`,
    body: `Todos los KPI activos de la semana del ${formatCalendarDateEs(input.weekStartDate)} ya están cargados. Puedes previsualizar la publicación.`,
  };
}

export function adminWeekPublishedNewsTemplate(input: {
  splitName: string;
  weekStartDate: Date;
  participantCount: number;
  totalCreditsGenerated: number;
  publishedByName: string;
}): NewsText {
  return {
    title: `Semana publicada · ${input.splitName}`,
    body: `La semana del ${formatCalendarDateEs(input.weekStartDate)} se publicó para ${input.participantCount} participantes (${input.totalCreditsGenerated} créditos generados). Publicado por ${input.publishedByName}.`,
  };
}

export function adminNextLocationMissingNewsTemplate(input: { splitName: string; weekStartDate: Date }): NewsText {
  return {
    title: `Falta localización · ${input.splitName}`,
    body: `La semana del ${formatCalendarDateEs(input.weekStartDate)} todavía no tiene una localización configurada.`,
  };
}

export function adminMarketOpenedNewsTemplate(input: { splitName: string; itemCount: number }): NewsText {
  return {
    title: `Mercado abierto · ${input.splitName}`,
    body: `${input.itemCount} ${input.itemCount === 1 ? "objeto disponible" : "objetos disponibles"} para la venta.`,
  };
}

export function adminMarketClosedNewsTemplate(input: { splitName: string }): NewsText {
  return {
    title: `Mercado cerrado · ${input.splitName}`,
    body: "Ya no se pueden realizar nuevas compras en este split.",
  };
}

// --- Finalizacion de split (`1.2.2`) ------------------------------------

const PODIUM_RANK_LABELS: Record<1 | 2 | 3, { singular: string; plural: string }> = {
  1: { singular: "Ganador", plural: "Ganadores" },
  2: { singular: "Subcampeón", plural: "Subcampeones" },
  3: { singular: "Tercero", plural: "Terceros" },
};

/** Une una lista de nombres al estilo castellano ("A", "A y B", "A, B y C"). */
function formatNameList(names: readonly string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0]!;
  if (names.length === 2) return `${names[0]} y ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

/**
 * Cuerpo compartido de la noticia de finalizacion (jugador y administracion
 * usan exactamente el mismo texto de resumen, seccion 9.2 del encargo).
 * Puestos sin entrada y facción sin datos se omiten en vez de inventar un
 * resultado.
 */
function buildFinalizationSummaryLines(summary: SplitFinalizationSummary): string[] {
  const lines: string[] = [];

  for (const entry of summary.podium) {
    const label = entry.names.length > 1 ? PODIUM_RANK_LABELS[entry.rank].plural : PODIUM_RANK_LABELS[entry.rank].singular;
    lines.push(`${label}: ${formatNameList(entry.names)}.`);
  }

  if (summary.factionWinner.hasFactionData && summary.factionWinner.names.length > 0) {
    const label = summary.factionWinner.names.length > 1 ? "Facciones ganadoras" : "Facción ganadora";
    lines.push(`${label}: ${formatNameList(summary.factionWinner.names)}.`);
  }

  if (summary.kpiWinners.length > 0) {
    lines.push("Ganadores por KPI:");
    for (const kpiWinner of summary.kpiWinners) {
      if (!kpiWinner.hasApplicableData) {
        lines.push(`${kpiWinner.kpiName}: Sin datos aplicables.`);
      } else {
        lines.push(`${kpiWinner.kpiName}: ${formatNameList(kpiWinner.winners)} (${formatPoints(kpiWinner.sum)} puntos).`);
      }
    }
  }

  return lines;
}

export function splitFinalizedNewsTemplateForParticipant(input: { splitName: string; summary: SplitFinalizationSummary }): NewsText {
  return {
    title: `Split finalizado · ${input.splitName}`,
    body: buildFinalizationSummaryLines(input.summary).join("\n"),
  };
}

export function adminSplitFinalizedNewsTemplate(input: {
  splitName: string;
  participantCount: number;
  summary: SplitFinalizationSummary;
}): NewsText {
  const intro = `Split finalizado con ${input.participantCount} ${input.participantCount === 1 ? "participante" : "participantes"}.`;
  return {
    title: `Split finalizado · ${input.splitName}`,
    body: [intro, ...buildFinalizationSummaryLines(input.summary)].join("\n"),
  };
}

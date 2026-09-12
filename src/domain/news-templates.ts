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
    parts.push(`Perteneces a la faccion ${input.factionName}.`);
  }
  const pending: string[] = [];
  if (input.needsAvatar) pending.push("tu avatar");
  if (input.needsProfession) pending.push("tu profesion");
  if (pending.length > 0) {
    parts.push(`Revisa tu alias y completa ${pending.join(" y ")} antes de la primera publicacion.`);
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
  const parts: string[] = [`${input.splitName} ya esta activo desde el ${formatCalendarDateEs(input.startDate)}.`];
  const pending: string[] = [];
  if (input.needsAvatar) pending.push("tu avatar");
  if (input.needsProfession) pending.push("tu profesion");
  if (pending.length > 0) {
    parts.push(`Completa ${pending.join(" y ")} antes de la primera publicacion.`);
  }
  if (input.nextLocation) {
    parts.push(
      `La semana del ${formatCalendarDateEs(input.nextLocation.weekStartDate)} tendra la localizacion "${input.nextLocation.name}", que potenciara ${input.nextLocation.kpiName} un +${input.nextLocation.bonusPercent} %.`,
    );
  }
  return { title: `${input.splitName} ya esta activo`, body: parts.join(" ") };
}

export function factionReassignedNewsTemplate(input: { factionName: string }): NewsText {
  return {
    title: "Tienes una nueva faccion",
    body: `Ahora perteneces a la faccion ${input.factionName}.`,
  };
}

export function factionRenamedNewsTemplate(input: { oldName: string; newName: string }): NewsText {
  return {
    title: "Tu faccion ha cambiado de nombre",
    body: `Tu faccion "${input.oldName}" ahora se llama "${input.newName}".`,
  };
}

export function professionAssignedNewsTemplate(input: {
  professionName: string;
  kpiNameA: string;
  kpiNameB: string;
  bonusPercent: number;
}): NewsText {
  return {
    title: "Ya tienes profesion",
    body: `Tu profesion es ${input.professionName}: potencia ${input.kpiNameA} y ${input.kpiNameB} un +${input.bonusPercent} %.`,
  };
}

export function locationCreatedNewsTemplate(input: {
  weekStartDate: Date;
  name: string;
  kpiName: string;
  bonusPercent: number;
}): NewsText {
  return {
    title: `Nueva ubicacion · semana del ${formatCalendarDateEs(input.weekStartDate)}`,
    body: `"${input.name}" potenciara ${input.kpiName} un +${input.bonusPercent} %.`,
  };
}

export function locationUpdatedNewsTemplate(input: {
  weekStartDate: Date;
  name: string;
  kpiName: string;
  bonusPercent: number;
}): NewsText {
  return {
    title: `Ubicacion actualizada · semana del ${formatCalendarDateEs(input.weekStartDate)}`,
    body: `"${input.name}" ahora potenciara ${input.kpiName} un +${input.bonusPercent} %.`,
  };
}

export function locationDeletedNewsTemplate(input: { weekStartDate: Date; name: string }): NewsText {
  return {
    title: `Ubicacion cancelada · semana del ${formatCalendarDateEs(input.weekStartDate)}`,
    body: `Se ha cancelado la localizacion "${input.name}" de esa semana.`,
  };
}

export function marketOpenedNewsTemplateForParticipant(input: { itemCount: number }): NewsText {
  return {
    title: "El mercado ya esta abierto",
    body: `Hay ${input.itemCount} ${input.itemCount === 1 ? "objeto disponible" : "objetos disponibles"} para comprar. Consulta tu saldo en tu ficha.`,
  };
}

export function marketClosedNewsTemplateForParticipant(): NewsText {
  return {
    title: "El mercado se ha cerrado",
    body: "Ya no se pueden comprar objetos. Los que ya tienes siguen equipables mientras el split este activo.",
  };
}

export function purchaseCompletedNewsTemplate(input: {
  itemName: string;
  priceCredits: number;
  remainingBalance: number;
}): NewsText {
  return {
    title: `Has comprado ${input.itemName}`,
    body: `${input.priceCredits} creditos · Saldo restante: ${input.remainingBalance} creditos.`,
  };
}

export function weekPublishedNewsTemplate(input: {
  weekStartDate: Date;
  totalKpiPoints: number;
  rank: number;
  totalParticipants: number;
  positionPoints: number;
  creditsEarned: number;
  faction: { name: string; rank: number } | null;
  professionJustLocked: boolean;
}): NewsText {
  const parts: string[] = [
    `Posicion semanal: ${input.rank} de ${input.totalParticipants} · ${formatPoints(input.totalKpiPoints)} puntos KPI · ${input.positionPoints} puntos por posicion · ${input.creditsEarned} creditos.`,
  ];
  if (input.faction) {
    parts.push(`Tu faccion, ${input.faction.name}, ha quedado ${input.faction.rank}.`);
  }
  if (input.professionJustLocked) {
    parts.push("Tu profesion ya es definitiva para el resto del split.");
  }
  parts.push("Puedes consultar el detalle completo.");
  return {
    title: `Resultados publicados · ${formatCalendarDateEs(input.weekStartDate)}`,
    body: parts.join(" "),
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
    title: `${input.splitName} ya esta activo`,
    body: `${input.participantCount} participantes y ${input.activeKpiCount} KPI activos desde el ${formatCalendarDateEs(input.startDate)}.`,
  };
}

export function adminIncompleteProfilesNewsTemplate(input: { splitName: string; aliases: string[] }): NewsText {
  const preview = input.aliases.slice(0, 5).join(", ");
  const suffix = input.aliases.length > 5 ? `, y ${input.aliases.length - 5} mas` : "";
  return {
    title: `Fichas incompletas en ${input.splitName}`,
    body: `${input.aliases.length} ${input.aliases.length === 1 ? "participante tiene" : "participantes tienen"} avatar o profesion pendiente: ${preview}${suffix}.`,
  };
}

export function adminWeekReadyNewsTemplate(input: { splitName: string; weekStartDate: Date }): NewsText {
  return {
    title: `Semana lista para revisar · ${input.splitName}`,
    body: `Todos los KPI activos de la semana del ${formatCalendarDateEs(input.weekStartDate)} ya estan cargados. Puedes previsualizar la publicacion.`,
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
    body: `La semana del ${formatCalendarDateEs(input.weekStartDate)} se publico para ${input.participantCount} participantes (${input.totalCreditsGenerated} creditos generados). Publicado por ${input.publishedByName}.`,
  };
}

export function adminNextLocationMissingNewsTemplate(input: { splitName: string; weekStartDate: Date }): NewsText {
  return {
    title: `Falta localizacion · ${input.splitName}`,
    body: `La semana del ${formatCalendarDateEs(input.weekStartDate)} todavia no tiene una localizacion configurada.`,
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

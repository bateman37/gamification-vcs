/**
 * Enlaces internos seguros de una noticia (`1.0.0` / MVP-3, ver
 * docs/NEWS_CENTER.md, seccion 28 del encargo). El administrador nunca
 * escribe una URL libre: elige uno de estos destinos cerrados y el servidor
 * construye el `actionPath` real para cada destinatario. Las noticias
 * automaticas tambien pasan siempre por aqui, nunca concatenan una ruta a
 * mano en el servicio que las genera.
 *
 * Reglas:
 * - Siempre empieza por `/` (nunca `javascript:`, HTML ni una URL externa).
 * - `SPLIT_ADMIN` es exclusivo de destinatarios `USER` (administracion): una
 *   noticia de jugador nunca puede enlazar al detalle administrativo de un
 *   split.
 */

export type NewsRecipientKind = "PERSON" | "USER";

export type NewsLinkTarget =
  | { kind: "NONE" }
  | { kind: "RESULTS"; splitId: string }
  | { kind: "PROFILE"; splitParticipantId: string }
  | { kind: "MARKET"; splitParticipantId: string }
  /** "Mi vitrina" del modulo Badges (`1.2.3`). Sin parametros: siempre la vitrina del propio destinatario. */
  | { kind: "BADGES_SHOWCASE" }
  /** Detalle administrativo del split, opcionalmente anclado a una seccion (`#participantes`...). Exclusivo de destinatarios `USER`. */
  | { kind: "SPLIT_ADMIN"; splitId: string; anchor?: string }
  /** Resultados administrativos de una semana concreta. Exclusivo de destinatarios `USER`. */
  | { kind: "WEEK_RESULTS_ADMIN"; splitId: string; weekId: string }
  /** Economia y mercado administrativos del split. Exclusivo de destinatarios `USER`. */
  | { kind: "SPLIT_ECONOMY_ADMIN"; splitId: string }
  /** Pantalla de localizacion semanal. Exclusivo de destinatarios `USER`. */
  | { kind: "WEEK_LOCATION_ADMIN"; splitId: string; weekId: string };

export class InvalidNewsLinkError extends Error {}

function assertAdminRecipient(recipientKind: NewsRecipientKind): void {
  if (recipientKind !== "USER") {
    throw new InvalidNewsLinkError("Este destino es exclusivo de la administracion: nunca se envia a un destinatario de jugador.");
  }
}

export function buildNewsActionPath(target: NewsLinkTarget, recipientKind: NewsRecipientKind): string | null {
  switch (target.kind) {
    case "NONE":
      return null;
    case "RESULTS":
      return `/resultados?vista=por-split&split=${encodeURIComponent(target.splitId)}`;
    case "PROFILE":
      return `/fichas/${encodeURIComponent(target.splitParticipantId)}`;
    case "MARKET":
      return `/fichas/${encodeURIComponent(target.splitParticipantId)}#mercado`;
    case "BADGES_SHOWCASE":
      return `/badges?vista=vitrina`;
    case "SPLIT_ADMIN":
      assertAdminRecipient(recipientKind);
      return `/splits/${encodeURIComponent(target.splitId)}${target.anchor ? `#${target.anchor}` : ""}`;
    case "WEEK_RESULTS_ADMIN":
      assertAdminRecipient(recipientKind);
      return `/splits/${encodeURIComponent(target.splitId)}/weeks/${encodeURIComponent(target.weekId)}/resultados`;
    case "SPLIT_ECONOMY_ADMIN":
      assertAdminRecipient(recipientKind);
      return `/splits/${encodeURIComponent(target.splitId)}/economia`;
    case "WEEK_LOCATION_ADMIN":
      assertAdminRecipient(recipientKind);
      return `/splits/${encodeURIComponent(target.splitId)}/weeks/${encodeURIComponent(target.weekId)}/localizacion`;
  }
}

/** Destinos que el formulario de envio manual ofrece al administrador (seccion 40 del encargo). */
export const MANUAL_NEWS_DESTINATIONS = ["NONE", "RESULTS", "PROFILE", "MARKET"] as const;
export type ManualNewsDestination = (typeof MANUAL_NEWS_DESTINATIONS)[number];

export function isManualNewsDestination(value: string): value is ManualNewsDestination {
  return (MANUAL_NEWS_DESTINATIONS as readonly string[]).includes(value);
}

export function buildManualNewsActionPath(
  destination: ManualNewsDestination,
  context: { splitId: string; splitParticipantId: string },
): string | null {
  switch (destination) {
    case "NONE":
      return buildNewsActionPath({ kind: "NONE" }, "PERSON");
    case "RESULTS":
      return buildNewsActionPath({ kind: "RESULTS", splitId: context.splitId }, "PERSON");
    case "PROFILE":
      return buildNewsActionPath({ kind: "PROFILE", splitParticipantId: context.splitParticipantId }, "PERSON");
    case "MARKET":
      return buildNewsActionPath({ kind: "MARKET", splitParticipantId: context.splitParticipantId }, "PERSON");
  }
}

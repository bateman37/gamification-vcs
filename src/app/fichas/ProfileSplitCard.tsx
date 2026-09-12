import Link from "next/link";
import type { SplitStatus } from "@prisma/client";
import { formatCalendarDate, formatCalendarDateEs } from "@/lib/dates";
import { SPLIT_STATUS_LABELS } from "@/lib/labels";
import { Badge, Button, LinkButton } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { PROFESSION_BONUS_LABEL } from "@/domain/profession-bonus";
import { formatPoweredKpis } from "@/domain/profession-display";
import type { ProfileCard } from "@/server/services/participant-profile.service";
import { ProfileAvatar } from "./ProfileAvatar";

const STATUS_TONE: Record<SplitStatus, "slate" | "green" | "gray"> = {
  DRAFT: "slate",
  ACTIVE: "green",
  CLOSED: "gray",
};

/**
 * Tarjeta horizontal de una ficha en el listado `/fichas` (`1.0.1`, parte F
 * del encargo). Es solo un resumen con acciones: la edicion de alias,
 * avatar y profesion vive en la ruta dedicada `/fichas/[splitParticipantId]`,
 * nunca duplicada aqui.
 */
export function ProfileSplitCard({ card }: { card: ProfileCard }) {
  const isClosed = card.splitStatus === "CLOSED";

  return (
    <div className="flex flex-col gap-4 rounded-card border border-border bg-surface p-4 sm:flex-row sm:items-center sm:gap-6">
      <ProfileAvatar splitParticipantId={card.splitParticipantId} alias={card.alias} avatarVersion={card.avatarVersion} size={56} />

      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-base font-semibold">{card.splitName}</h3>
          <Badge tone={STATUS_TONE[card.splitStatus]}>{SPLIT_STATUS_LABELS[card.splitStatus]}</Badge>
          {isClosed && (
            <span className="inline-flex items-center gap-1 text-xs text-text-muted">
              <Icon name="ShieldCheck" className="h-3.5 w-3.5" />
              Solo lectura
            </span>
          )}
        </div>
        <p className="text-xs text-text-muted">Inicio: {formatCalendarDate(card.splitStartDate)}</p>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-text-muted">Alias</dt>
            <dd className="font-medium">{card.alias}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Nivel técnico</dt>
            <dd className="font-medium">{card.level}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Facción</dt>
            <dd className="font-medium">
              {card.faction ? (
                <span className="inline-flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className="h-3 w-3 rounded-full border border-border-strong"
                    style={{ backgroundColor: card.faction.color }}
                  />
                  {card.faction.name}
                </span>
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Profesión</dt>
            <dd className="font-medium">
              {card.profession ? (
                <>
                  {card.profession.name}
                  <span className="block text-xs font-normal text-text-muted">{formatPoweredKpis(card.profession)}</span>
                  <span className="block text-xs font-normal text-text-muted">{PROFESSION_BONUS_LABEL}</span>
                </>
              ) : card.splitUsesProfessions ? (
                <span className="inline-block rounded-full bg-reward-soft px-2 py-0.5 text-xs font-medium text-reward-ink">Sin elegir</span>
              ) : (
                <span className="text-text-muted">—</span>
              )}
            </dd>
          </div>
        </dl>

        {card.activeLocation && (
          <div className="rounded-md border border-info/30 bg-info-soft p-2 text-xs text-info-ink">
            <p className="font-semibold">Localización activa esta semana: {card.activeLocation.name}</p>
            <p>
              Potencia: {card.activeLocation.kpiName} · {card.activeLocation.bonusLabel} · del{" "}
              {formatCalendarDateEs(card.activeLocation.startDate)} al {formatCalendarDateEs(card.activeLocation.endDate)}
            </p>
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
        {card.hasPublishedResults ? (
          <LinkButton href={`/resultados?vista=por-split&split=${card.splitId}`} variant="secondary">
            <Icon name="Trophy" className="h-4 w-4" />
            Resultados del split
          </LinkButton>
        ) : (
          <Button
            type="button"
            variant="secondary"
            disabled
            aria-label="Resultados del split: aún no hay resultados publicados"
            title="Aún no hay resultados publicados"
          >
            <Icon name="Trophy" className="h-4 w-4" />
            Resultados del split
          </Button>
        )}
        <LinkButton href={`/fichas/${card.splitParticipantId}`} variant={isClosed ? "secondary" : "game"}>
          <Icon name="IdCard" className="h-4 w-4" />
          {isClosed ? "Ver personaje" : "Configurar personaje"}
        </LinkButton>
      </div>
    </div>
  );
}

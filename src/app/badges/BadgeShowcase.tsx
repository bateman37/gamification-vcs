import type { ReactNode } from "react";
import { InitialsAvatar } from "@/components/InitialsAvatar";
import { EmptyState } from "@/components/ui";
import { formatCalendarDateEs } from "@/lib/dates";
import type { PersonBadgeShowcase, PersonBadgeShowcaseEntry } from "@/server/services/badge.service";

/**
 * "Mi vitrina" / "Badges de la persona" (seccion 6.3 del encargo): MVP
 * destacado en ambar/dorado, MVP Team en violeta, coleccion de badges KPI
 * con contador e identidad propia por categoria, categorias no conseguidas
 * visibles pero atenuadas (nunca ocultas), y cada medalla conseguida abre
 * los splits en los que se obtuvo.
 */

function formatOccurrenceLabel(occurrence: PersonBadgeShowcaseEntry["occurrences"][number]): string {
  return occurrence.grantedAt ? `${occurrence.splitLabel} · ${formatCalendarDateEs(occurrence.grantedAt)}` : occurrence.splitLabel;
}

function HeroBadgeCard({
  fallbackName,
  entry,
  tone,
  description,
}: {
  fallbackName: string;
  entry: PersonBadgeShowcaseEntry | undefined;
  tone: "reward" | "game";
  description: string;
}) {
  const earned = !!entry && entry.count > 0;
  const toneBorder = tone === "reward" ? "border-reward/40 bg-reward-soft" : "border-game/40 bg-game-soft";
  const toneText = tone === "reward" ? "text-reward-ink" : "text-game-ink";

  return (
    <div className={`rounded-card border p-4 ${earned ? toneBorder : "border-dashed border-border-strong bg-surface-muted opacity-70"}`}>
      <div className="flex items-center justify-between gap-2">
        <p className={`text-lg font-bold ${earned ? toneText : "text-text-muted"}`}>{entry?.name ?? fallbackName}</p>
        {earned && <span className="rounded-full bg-white/70 px-2 py-0.5 text-xs font-semibold text-ink">x{entry!.count}</span>}
      </div>
      <p className="mt-1 text-xs text-text-muted">{description}</p>
      {earned ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs font-medium text-ink underline">Ver splits conseguidos</summary>
          <ul className="mt-1 space-y-0.5 text-xs text-text-muted">
            {entry!.occurrences.map((occurrence, index) => (
              <li key={index}>{formatOccurrenceLabel(occurrence)}</li>
            ))}
          </ul>
        </details>
      ) : (
        <p className="mt-2 text-xs italic text-text-muted">Todavía no conseguido.</p>
      )}
    </div>
  );
}

function KpiBadgeCard({ entry }: { entry: PersonBadgeShowcaseEntry }) {
  const earned = entry.count > 0;
  return (
    <li
      className={`rounded-card border p-3 text-center ${
        earned ? "border-primary/30 bg-primary-soft" : "border-dashed border-border-strong bg-surface-muted opacity-60"
      }`}
    >
      <p className={`text-sm font-medium ${earned ? "text-primary" : "text-text-muted"}`}>{entry.name}</p>
      {earned ? (
        <>
          <p className="mt-1 text-xs font-semibold text-ink">x{entry.count}</p>
          <details className="mt-1">
            <summary className="cursor-pointer text-xs text-ink underline">Splits</summary>
            <ul className="mt-1 space-y-0.5 text-left text-xs text-text-muted">
              {entry.occurrences.map((occurrence, index) => (
                <li key={index}>{formatOccurrenceLabel(occurrence)}</li>
              ))}
            </ul>
          </details>
        </>
      ) : (
        <p className="mt-1 text-xs text-text-muted">Bloqueado</p>
      )}
    </li>
  );
}

export function BadgeShowcase({ showcase, personFullName }: { showcase: PersonBadgeShowcase; personFullName: string }): ReactNode {
  const mvp = showcase.badges.find((badge) => badge.type === "MVP");
  const teamMvp = showcase.badges.find((badge) => badge.type === "TEAM_MVP");
  const kpiBadges = showcase.badges.filter((badge) => badge.type === "KPI");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 rounded-card border border-border bg-surface p-4">
        <InitialsAvatar fullName={personFullName} className="h-14 w-14 text-lg" />
        <div>
          <p className="text-lg font-semibold text-ink">{personFullName}</p>
          <p className="text-sm text-text-muted">
            {showcase.totalBadges} {showcase.totalBadges === 1 ? "badge" : "badges"} en total
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <HeroBadgeCard fallbackName="MVP" entry={mvp} tone="reward" description="Ganador de la clasificación general de un split." />
        <HeroBadgeCard fallbackName="MVP Team" entry={teamMvp} tone="game" description="Miembro de la facción ganadora de un split." />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-ink">Categorías KPI</h2>
        {kpiBadges.length === 0 ? (
          <EmptyState>Todavía no hay categorías KPI en el catálogo.</EmptyState>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {kpiBadges.map((badge) => (
              <KpiBadgeCard key={badge.code} entry={badge} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

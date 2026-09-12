import type { SplitWeek } from "@prisma/client";
import { formatCalendarDateEs } from "@/lib/dates";
import { Button, LinkButton } from "@/components/ui";
import { Icon } from "@/components/Icon";

/**
 * Acceso a "Presentar resultados" (`1.0.1`, parte I del encargo), debajo
 * del calendario de semanas: siempre indica, con la fecha real de la
 * semana, cual se presentaria si se pulsa el boton (nunca solo "Semana 1").
 * Deshabilitado con una explicacion clara si el split todavia no tiene
 * ninguna semana publicada.
 */
export function PresentationLaunchSection({
  splitId,
  weeks,
  publishedAtByWeekId,
}: {
  splitId: string;
  weeks: SplitWeek[];
  publishedAtByWeekId: Map<string, Date>;
}) {
  const lastPublishedWeek = [...weeks].reverse().find((week) => publishedAtByWeekId.has(week.id)) ?? null;

  return (
    <section className="flex flex-col gap-3 rounded-card border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Icon name="Play" className="h-4 w-4 text-primary" />
          Presentar resultados
        </h2>
        {lastPublishedWeek ? (
          <p className="mt-1 text-sm text-text-muted">
            Se presentará la semana del {formatCalendarDateEs(lastPublishedWeek.startDate)} al {formatCalendarDateEs(lastPublishedWeek.endDate)}.
          </p>
        ) : (
          <p className="mt-1 text-sm text-text-muted">Publica una semana para presentar sus resultados.</p>
        )}
      </div>
      {lastPublishedWeek ? (
        <LinkButton href={`/splits/${splitId}/presentacion-resultados`} variant="game">
          <Icon name="Play" className="h-4 w-4" />
          Presentar resultados
        </LinkButton>
      ) : (
        <Button type="button" variant="game" disabled title="Publica una semana para presentar sus resultados">
          <Icon name="Play" className="h-4 w-4" />
          Presentar resultados
        </Button>
      )}
    </section>
  );
}

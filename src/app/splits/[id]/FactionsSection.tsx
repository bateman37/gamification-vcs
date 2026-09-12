import type { SplitStatus } from "@prisma/client";
import { EmptyState } from "@/components/ui";
import type { FactionWithCounts } from "@/server/services/faction.service";
import { FactionCard } from "./FactionCard";
import { FactionCreateForm } from "./FactionCreateForm";

/** Seccion "Facciones" del detalle del split (`0.7.0` / MVP-2A, ver docs/FACTIONS.md). */
export function FactionsSection({
  splitId,
  splitStatus,
  factions,
  hasAnyPublication,
}: {
  splitId: string;
  splitStatus: SplitStatus;
  factions: FactionWithCounts[];
  hasAnyPublication: boolean;
}) {
  const readOnly = splitStatus === "CLOSED";
  const canCreateOrDelete = !hasAnyPublication;

  return (
    <section id="facciones" className="scroll-mt-20 space-y-3">
      <h2 className="text-lg font-semibold">Facciones</h2>
      <p className="text-sm text-text-muted">
        Un split necesita al menos dos facciones, con todos los participantes asignados, para poder activarse. El
        aporte de cada participante a su facción es siempre su puntuación por posición ya publicada (Renombre =
        puntos por posición): no existe una segunda fórmula ni un saldo independiente.
      </p>
      {hasAnyPublication && (
        <p className="text-sm text-reward-ink">
          Este split ya tiene semanas publicadas: no se pueden crear ni eliminar facciones, pero el nombre y el
          color siguen siendo editables.
        </p>
      )}
      {readOnly && <p className="text-sm text-text-muted">El split está cerrado: las facciones se muestran en modo solo lectura.</p>}

      {factions.length === 0 ? (
        <EmptyState>
          Todavía no hay ninguna facción configurada. Crea al menos dos para poder activar este split.
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {factions.map((faction) => (
            <FactionCard
              key={faction.id}
              splitId={splitId}
              faction={faction}
              readOnly={readOnly}
              canDelete={canCreateOrDelete && faction.participantCount === 0}
              deleteDisabledReason={
                !canCreateOrDelete
                  ? "No se puede eliminar: el split ya tiene semanas publicadas."
                  : faction.participantCount > 0
                    ? "No se puede eliminar: tiene participantes asignados."
                    : undefined
              }
            />
          ))}
        </div>
      )}

      {!readOnly && canCreateOrDelete && <FactionCreateForm splitId={splitId} />}
    </section>
  );
}

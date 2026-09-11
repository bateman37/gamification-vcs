import type { SplitStatus } from "@prisma/client";
import { EmptyState } from "@/components/ui";
import { PROFESSION_BONUS_LABEL } from "@/domain/profession-bonus";
import { toProfessionView } from "@/domain/profession-display";
import type { ProfessionWithCounts } from "@/server/services/profession.service";
import { ProfessionCard } from "./ProfessionCard";
import { ProfessionCreateForm } from "./ProfessionCreateForm";

/** Seccion "Profesiones del split" del detalle del split (`0.8.0` / MVP-2B, ver docs/PROFESSIONS_AND_PROFILES.md). */
export function ProfessionsSection({
  splitId,
  splitStatus,
  professions,
  hasAnyPublication,
}: {
  splitId: string;
  splitStatus: SplitStatus;
  professions: ProfessionWithCounts[];
  hasAnyPublication: boolean;
}) {
  const readOnly = splitStatus === "CLOSED";
  const canEditOrDelete = !hasAnyPublication && !readOnly;
  const lockedReason = hasAnyPublication
    ? "Bloqueado: el split ya tiene una semana publicada."
    : readOnly
      ? "El split esta cerrado."
      : undefined;

  return (
    <section id="profesiones" className="scroll-mt-20 space-y-3">
      <h2 className="text-lg font-semibold">Profesiones del split</h2>
      <p className="text-sm text-slate-600">
        Las profesiones son opcionales: si no creas ninguna, este split funciona exactamente igual que antes, sin
        selectores ni bonus. Cada profesion potencia exactamente dos KPI distintos y se aplica un bonus fijo de{" "}
        <span className="font-medium text-slate-800">{PROFESSION_BONUS_LABEL}</span>.
      </p>
      {hasAnyPublication && (
        <p className="text-sm text-amber-700">
          Este split ya tiene semanas publicadas: las profesiones y sus asignaciones quedaron bloqueadas y no pueden
          crearse, editarse ni eliminarse.
        </p>
      )}
      {readOnly && <p className="text-sm text-slate-500">El split esta cerrado: las profesiones se muestran en modo solo lectura.</p>}

      {professions.length === 0 ? (
        <EmptyState>
          {hasAnyPublication
            ? "Este split no utiliza profesiones y ya no puede anadirlas: se publico su primera semana sin ninguna creada."
            : "Todavia no hay ninguna profesion configurada. Este split no utiliza profesiones."}
        </EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {professions.map((profession) => (
            <ProfessionCard
              key={profession.id}
              splitId={splitId}
              profession={toProfessionView(profession)}
              participantCount={profession.participantCount}
              readOnly={readOnly}
              canEditOrDelete={canEditOrDelete}
              lockedReason={lockedReason}
            />
          ))}
        </div>
      )}

      {canEditOrDelete && <ProfessionCreateForm splitId={splitId} />}
    </section>
  );
}

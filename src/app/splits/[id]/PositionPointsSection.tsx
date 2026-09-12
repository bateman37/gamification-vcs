"use client";

import { useFormState, useFormStatus } from "react-dom";
import type { SplitPositionPointRule, SplitStatus } from "@prisma/client";
import { updatePositionPointsAction } from "@/server/actions/position-points.actions";
import {
  initialPositionPointsActionState,
  type PositionPointsActionState,
} from "@/server/actions/position-points-action-state";
import { ErrorMessage, FieldError, SubmitButton, SuccessMessage } from "@/components/ui";

function SavePositionPointsButton() {
  const { pending } = useFormStatus();
  return <SubmitButton pending={pending}>Guardar puntos por posicion</SubmitButton>;
}

function fieldErrorMessage(state: PositionPointsActionState, position: number): string | undefined {
  return state.fieldErrors?.find((error) => error.position === position)?.message;
}

export function PositionPointsSection({
  splitId,
  splitStatus,
  rules,
  locked,
}: {
  splitId: string;
  splitStatus: SplitStatus;
  rules: SplitPositionPointRule[];
  /** `true` desde que el split tiene al menos una semana publicada (seccion 12 de `0.7.0` / MVP-2A). */
  locked: boolean;
}) {
  const updateWithId = updatePositionPointsAction.bind(null, splitId);
  const [state, formAction] = useFormState<PositionPointsActionState, FormData>(
    updateWithId,
    initialPositionPointsActionState,
  );
  const readOnly = splitStatus === "CLOSED" || locked;
  const sortedRules = [...rules].sort((a, b) => a.position - b.position);

  return (
    <section id="puntos-posicion" className="scroll-mt-20 space-y-3">
      <h2 className="text-lg font-semibold">Puntos por posicion semanal</h2>
      <p className="text-sm text-text-muted">
        Configura los puntos que recibira cada posicion (1 a 15) al calcular la clasificacion semanal.
      </p>
      {splitStatus === "CLOSED" ? (
        <p className="text-sm text-text-muted">
          El split esta cerrado: los puntos por posicion se muestran en modo solo lectura.
        </p>
      ) : (
        locked && (
          <p className="text-sm text-reward-ink">
            La configuracion quedo bloqueada al publicar la primera semana del split.
          </p>
        )
      )}

      <form action={readOnly ? undefined : formAction} className="rounded-card border border-border bg-surface p-4">
        <div className="overflow-x-auto rounded-card border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Posicion</th>
                <th className="px-3 py-2 font-medium">Puntos</th>
              </tr>
            </thead>
            <tbody>
              {sortedRules.map((rule) => {
                const errorMessage = fieldErrorMessage(state, rule.position);
                return (
                  <tr key={rule.position} className="border-b border-border">
                    <td className="px-3 py-2">{rule.position}</td>
                    <td className="px-3 py-2">
                      {readOnly ? (
                        rule.points
                      ) : (
                        <>
                          <input
                            type="text"
                            inputMode="numeric"
                            name={`points__${rule.position}`}
                            defaultValue={rule.points}
                            aria-label={`Puntos de la posicion ${rule.position}`}
                            aria-invalid={errorMessage ? "true" : undefined}
                            className="w-20 rounded-control border border-border-strong px-2 py-1 text-sm"
                          />
                          <FieldError message={errorMessage} />
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!readOnly && (
          <div className="mt-4 space-y-3">
            {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}
            {state.ok && state.saved && <SuccessMessage>Puntos por posicion guardados correctamente.</SuccessMessage>}
            <SavePositionPointsButton />
          </div>
        )}
      </form>
    </section>
  );
}

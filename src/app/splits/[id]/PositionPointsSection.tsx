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
}: {
  splitId: string;
  splitStatus: SplitStatus;
  rules: SplitPositionPointRule[];
}) {
  const updateWithId = updatePositionPointsAction.bind(null, splitId);
  const [state, formAction] = useFormState<PositionPointsActionState, FormData>(
    updateWithId,
    initialPositionPointsActionState,
  );
  const readOnly = splitStatus === "CLOSED";
  const sortedRules = [...rules].sort((a, b) => a.position - b.position);

  return (
    <section id="puntos-posicion" className="scroll-mt-20 space-y-3">
      <h2 className="text-lg font-semibold">Puntos por posicion semanal</h2>
      <p className="text-sm text-slate-600">
        Configura los puntos que recibira cada posicion (1 a 15) al calcular la clasificacion semanal. Esta entrega
        solo guarda estos valores: todavia no calcula ninguna posicion ni reparte estos puntos.
      </p>
      {readOnly && (
        <p className="text-sm text-slate-500">
          El split esta cerrado: los puntos por posicion se muestran en modo solo lectura.
        </p>
      )}

      <form action={readOnly ? undefined : formAction} className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-100 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Posicion</th>
                <th className="px-3 py-2 font-medium">Puntos</th>
              </tr>
            </thead>
            <tbody>
              {sortedRules.map((rule) => {
                const errorMessage = fieldErrorMessage(state, rule.position);
                return (
                  <tr key={rule.position} className="border-b border-slate-100">
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
                            className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm"
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

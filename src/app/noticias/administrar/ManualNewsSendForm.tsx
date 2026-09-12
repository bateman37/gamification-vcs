"use client";

import { useFormState, useFormStatus } from "react-dom";
import { ErrorMessage, FieldError, SuccessMessage } from "@/components/ui";
import { initialActionState, type ActionState } from "@/server/actions/action-result";
import { sendManualNewsAction } from "@/server/actions/news-manual.actions";

function SendButton({ recipientCount }: { recipientCount: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || recipientCount === 0}
      onClick={(event) => {
        if (!window.confirm(`Se enviara a ${recipientCount} ${recipientCount === 1 ? "persona" : "personas"}. ¿Confirmas el envio?`)) {
          event.preventDefault();
        }
      }}
      className="rounded-control bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Enviando..." : `Enviar a ${recipientCount} ${recipientCount === 1 ? "persona" : "personas"}`}
    </button>
  );
}

export function ManualNewsSendForm({
  splitId,
  audienceType,
  factionId,
  splitParticipantId,
  recipientCount,
  idempotencyKey,
}: {
  splitId: string;
  audienceType: string;
  factionId: string;
  splitParticipantId: string;
  recipientCount: number;
  idempotencyKey: string;
}) {
  const [state, formAction] = useFormState<ActionState, FormData>(sendManualNewsAction, initialActionState);

  if (state.ok) {
    // Navegacion HTML completa (no `next/link`): igual que en los formularios manuales de KPI,
    // una navegacion client-side a la misma ruta no reinicia `useFormState` (ver CLAUDE.md).
    return (
      <div className="space-y-3">
        <SuccessMessage>Noticia enviada correctamente.</SuccessMessage>
        <a href="/noticias/administrar" className="text-sm font-medium text-primary hover:text-primary-hover">
          Enviar otra noticia
        </a>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="splitId" value={splitId} />
      <input type="hidden" name="audienceType" value={audienceType} />
      <input type="hidden" name="factionId" value={factionId} />
      <input type="hidden" name="splitParticipantId" value={splitParticipantId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />

      {!state.ok && state.error && <ErrorMessage>{state.error}</ErrorMessage>}

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="ma-priority" className="block text-xs font-medium text-text-muted">
            Prioridad
          </label>
          <select id="ma-priority" name="priority" defaultValue="NORMAL" className="mt-1 w-full rounded-control border border-border-strong bg-surface px-2 py-1.5 text-sm text-ink">
            <option value="NORMAL">Normal</option>
            <option value="IMPORTANT">Importante</option>
          </select>
        </div>
        <div>
          <label htmlFor="ma-destination" className="block text-xs font-medium text-text-muted">
            Destino
          </label>
          <select id="ma-destination" name="destination" defaultValue="NONE" className="mt-1 w-full rounded-control border border-border-strong bg-surface px-2 py-1.5 text-sm text-ink">
            <option value="NONE">Sin enlace</option>
            <option value="RESULTS">Resultados del split</option>
            <option value="PROFILE">Ficha del personaje</option>
            <option value="MARKET">Mercado del personaje</option>
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="ma-title" className="block text-xs font-medium text-text-muted">
          Titulo
        </label>
        <input id="ma-title" name="title" maxLength={120} required className="mt-1 w-full rounded-control border border-border-strong bg-surface px-2 py-1.5 text-sm text-ink" />
        <FieldError message={!state.ok ? state.fieldErrors?.title : undefined} />
      </div>

      <div>
        <label htmlFor="ma-body" className="block text-xs font-medium text-text-muted">
          Mensaje
        </label>
        <textarea id="ma-body" name="body" maxLength={600} rows={4} required className="mt-1 w-full rounded-control border border-border-strong bg-surface px-2 py-1.5 text-sm text-ink" />
        <FieldError message={!state.ok ? state.fieldErrors?.body : undefined} />
      </div>

      <SendButton recipientCount={recipientCount} />
    </form>
  );
}

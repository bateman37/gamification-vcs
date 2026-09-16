"use client";

import { useFormState, useFormStatus } from "react-dom";
import { importLegacyBadgesAction, runAutomaticBadgeLinkingAction } from "@/server/actions/badge.actions";
import { initialActionState } from "@/server/actions/action-result";
import { Button, ErrorMessage, SuccessMessage } from "@/components/ui";

function PendingButton({ pendingLabel, children }: { pendingLabel: string; children: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" disabled={pending}>
      {pending ? pendingLabel : children}
    </Button>
  );
}

/**
 * Controles administrativos del historico (seccion 4.2 del encargo):
 * ejecutar o reintentar `legacy-badges-v1` de forma segura, y volver a
 * ejecutar la vinculacion automatica sin tocar ninguna concesion.
 */
export function ImportControls() {
  const [importState, importAction] = useFormState(importLegacyBadgesAction, initialActionState);
  const [linkState, linkAction] = useFormState(runAutomaticBadgeLinkingAction, initialActionState);

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <form action={importAction} className="space-y-2 rounded-card border border-border bg-surface p-4">
        <p className="text-sm font-medium text-ink">Importar legacy-badges-v1</p>
        <p className="text-xs text-text-muted">
          Crea o repara el catálogo, los 18 destinatarios y las 127 concesiones históricas. Nunca duplica nada si se repite, y nunca
          borra ni reescribe una concesión ya existente.
        </p>
        <PendingButton pendingLabel="Importando…">Importar legacy-badges-v1</PendingButton>
        {importState.error && <ErrorMessage>{importState.error}</ErrorMessage>}
        {importState.ok && <SuccessMessage>Importación ejecutada correctamente.</SuccessMessage>}
      </form>

      <form action={linkAction} className="space-y-2 rounded-card border border-border bg-surface p-4">
        <p className="text-sm font-medium text-ink">Reejecutar vinculación automática</p>
        <p className="text-xs text-text-muted">
          Vuelve a intentar enlazar los destinatarios todavía pendientes con personas reales. Solo enlaza cuando hay una única
          coincidencia inequívoca.
        </p>
        <PendingButton pendingLabel="Vinculando…">Reejecutar vinculación</PendingButton>
        {linkState.error && <ErrorMessage>{linkState.error}</ErrorMessage>}
        {linkState.ok && <SuccessMessage>Vinculación automática ejecutada.</SuccessMessage>}
      </form>
    </div>
  );
}

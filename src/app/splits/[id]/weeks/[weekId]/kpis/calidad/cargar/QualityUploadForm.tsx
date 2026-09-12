"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { analyzeQualityImportAction, confirmQualityImportAction } from "@/server/actions/quality.actions";
import { initialQualityUploadState, type QualityUploadState } from "@/server/actions/quality-action-state";
import { ErrorMessage, SubmitButton, SuccessMessage } from "@/components/ui";
import { formatPoints } from "@/lib/format";
import type { MasterCraftsmanOutcomeView } from "@/domain/kpis/quality";
import type { QualityPreview } from "@/server/services/quality-import.service";

function AnalyzeButton() {
  const { pending } = useFormStatus();
  return <SubmitButton pending={pending}>Analizar archivo</SubmitButton>;
}

function ConfirmSubmit({ confirmFormAction, label }: { confirmFormAction: (formData: FormData) => void; label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      formAction={confirmFormAction}
      disabled={pending}
      className="rounded-control bg-success px-4 py-2 text-sm font-medium text-white hover:bg-success/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Guardando..." : label}
    </button>
  );
}

function formatOutcome(outcome: MasterCraftsmanOutcomeView | null): string {
  if (!outcome) return "-";
  if (outcome.status === "not_applicable") return "No aplica";
  if (outcome.status === "no_data") return "Sin dato";
  return formatPoints(outcome.finalPoints ?? 0);
}

function formatRawOutcome(outcome: MasterCraftsmanOutcomeView | null): string {
  if (!outcome || outcome.status !== "computed") return "-";
  return formatPoints(outcome.rawPoints ?? 0);
}

function PreviewSummary({ preview, weekId, splitId }: { preview: QualityPreview; weekId: string; splitId: string }) {
  return (
    <div className="space-y-4 rounded-card border border-border bg-canvas p-4">
      <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs font-medium text-text-muted">Archivo</dt>
          <dd>{preview.originalFilename}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-text-muted">Filas fuente</dt>
          <dd>{preview.sourceRowCount}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-text-muted">Encontradas</dt>
          <dd>{preview.found.length}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-text-muted">Ignoradas</dt>
          <dd>{preview.ignoredRows.length}</dd>
        </div>
      </div>

      {preview.existingImport && (
        <p className="text-sm text-reward-ink">
          Ya existe una carga de Calidad para esta semana ({preview.existingImport.originalFilename},{" "}
          {preview.existingImport.importedRowCount} filas). Confirmar la sustituira por completo.
        </p>
      )}

      {preview.blockingErrors.length > 0 && (
        <ErrorMessage>
          <ul className="list-disc space-y-1 pl-4">
            {preview.blockingErrors.map((error, index) => (
              <li key={index}>{error}</li>
            ))}
          </ul>
        </ErrorMessage>
      )}

      {preview.missingParticipants.length > 0 && (
        <div className="text-sm">
          <p className="font-medium text-ink">Participantes aplicables sin dato:</p>
          <ul className="mt-1 list-disc pl-4 text-text-muted">
            {preview.missingParticipants.map((participant) => (
              <li key={participant.participantId}>
                {participant.alias} ({participant.fullName})
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview.ambiguousRows.length > 0 && (
        <div className="text-sm">
          <p className="font-medium text-ink">Filas ambiguas:</p>
          <ul className="mt-1 list-disc pl-4 text-text-muted">
            {preview.ambiguousRows.map((row) => (
              <li key={row.rowNumber}>
                Fila {row.rowNumber} ({row.sourceAgentName}): podria ser {row.candidateAliases.join(", ")}
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview.ignoredRows.length > 0 && (
        <div className="text-sm">
          <p className="font-medium text-ink">Filas ignoradas (no pertenecen al split):</p>
          <ul className="mt-1 list-disc pl-4 text-text-muted">
            {preview.ignoredRows.map((row) => (
              <li key={row.rowNumber}>
                Fila {row.rowNumber}: {row.sourceAgentName}
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview.found.length > 0 && (
        <div className="overflow-x-auto rounded-card border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Nombre fuente</th>
                <th className="px-3 py-2 font-medium">Alias</th>
                <th className="px-3 py-2 font-medium">Nivel</th>
                <th className="px-3 py-2 font-medium">Buena</th>
                <th className="px-3 py-2 font-medium">Mala</th>
                {preview.masterCraftsmanActive && (
                  <th className="px-3 py-2 font-medium">Maestro Artesano (sin limite / final)</th>
                )}
              </tr>
            </thead>
            <tbody>
              {preview.found.map((row) => (
                <tr key={row.participantId} className="border-b border-border">
                  <td className="px-3 py-2">{row.sourceAgentName}</td>
                  <td className="px-3 py-2">{row.alias}</td>
                  <td className="px-3 py-2">{row.level}</td>
                  <td className="px-3 py-2">{row.goodSatisfactionTickets}</td>
                  <td className="px-3 py-2">{row.badSatisfactionTickets}</td>
                  {preview.masterCraftsmanActive && (
                    <td className="px-3 py-2">
                      {formatRawOutcome(row.masterCraftsman)} / {formatOutcome(row.masterCraftsman)}
                      {row.masterCraftsman?.status === "computed" && row.masterCraftsman.capped && (
                        <span className="ml-1 text-xs text-reward-ink">(máximo aplicado)</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Link
        href={`/splits/${splitId}/weeks/${weekId}/kpis`}
        className="inline-block text-sm text-text-muted underline hover:text-ink"
      >
        Volver a la lista de cargas
      </Link>
    </div>
  );
}

export function QualityUploadForm({ splitId, weekId }: { splitId: string; weekId: string }) {
  const analyzeWithIds = analyzeQualityImportAction.bind(null, splitId, weekId);
  const confirmWithIds = confirmQualityImportAction.bind(null, splitId, weekId);
  const [analyzeState, analyzeFormAction] = useFormState<QualityUploadState, FormData>(
    analyzeWithIds,
    initialQualityUploadState,
  );
  const [confirmState, confirmFormAction] = useFormState<QualityUploadState, FormData>(
    confirmWithIds,
    initialQualityUploadState,
  );

  if (confirmState.ok && confirmState.confirmed) {
    return (
      <div className="space-y-3">
        <SuccessMessage>Carga de Calidad confirmada correctamente.</SuccessMessage>
        <Link
          href={`/splits/${splitId}/weeks/${weekId}/kpis/calidad/comprobar`}
          className="inline-block text-sm text-text-muted underline hover:text-ink"
        >
          Ir a Comprobar
        </Link>
      </div>
    );
  }

  const preview = analyzeState.preview;

  return (
    <form action={analyzeFormAction} className="space-y-4 rounded-card border border-border bg-surface p-4">
      <div>
        <label htmlFor="file" className="block text-sm font-medium text-ink">
          Archivo Excel (.xlsx)
        </label>
        <input
          id="file"
          name="file"
          type="file"
          accept=".xlsx"
          required
          className="mt-1 block w-full text-sm text-ink"
        />
      </div>

      <div className="flex flex-wrap gap-3">
        <AnalyzeButton />
        {preview && preview.canConfirm && (
          <ConfirmSubmit
            confirmFormAction={confirmFormAction}
            label={preview.existingImport ? "Sustituir carga" : "Confirmar carga"}
          />
        )}
      </div>

      {!analyzeState.ok && analyzeState.error && <ErrorMessage>{analyzeState.error}</ErrorMessage>}
      {!confirmState.ok && confirmState.error && <ErrorMessage>{confirmState.error}</ErrorMessage>}

      {preview && <PreviewSummary preview={preview} splitId={splitId} weekId={weekId} />}
    </form>
  );
}

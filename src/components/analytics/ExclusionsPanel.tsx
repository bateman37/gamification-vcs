import Link from "next/link";
import { Alert, Badge, SectionHeader, TABLE_HEAD_ROW_CLASSES, TABLE_ROW_HOVER_CLASSES, TableContainer } from "@/components/ui";
import type { ExclusionRow } from "@/domain/analytics";
import { formatDateEs } from "./format";
import { HiddenPassthroughFields } from "./HiddenPassthroughFields";
import type { RawSearchParams } from "@/app/analitica/filters";

/**
 * "Ver exclusiones" (parte F2 del encargo): tabla compacta con revision
 * manual por resultado semanal. Las excepciones son parametros de lectura
 * de esta consulta, nunca cambios de la instantanea ni altas de ausencia
 * laboral.
 */
export function ExclusionsPanel({ exclusions, searchParams }: { exclusions: ExclusionRow[]; searchParams: RawSearchParams }) {
  if (exclusions.length === 0) {
    return (
      <div className="rounded-card border border-border bg-surface p-4">
        <SectionHeader title="Exclusiones por posibles ausencias" description="Ninguna observación excluida con los filtros actuales." />
      </div>
    );
  }

  const withPositive = exclusions.filter((row) => row.hasPositiveValue).length;

  return (
    <div className="rounded-card border border-border bg-surface p-4">
      <SectionHeader
        title={`Exclusiones por posibles ausencias (${exclusions.length})`}
        description="Se excluye una observación persona-split-semana cuando tiene al menos el umbral configurado de KPI aplicables a cero o sin dato. Es una regla de análisis, no una ausencia confirmada."
      />
      {withPositive > 0 && (
        <Alert tone="warning">
          {withPositive} de estas observaciones tienen también algún valor positivo entre sus KPI: revisa si hubo actividad real antes de descartarlas.
        </Alert>
      )}
      <TableContainer>
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr className={TABLE_HEAD_ROW_CLASSES}>
              <th className="px-3 py-2">Persona</th>
              <th className="px-3 py-2">Split</th>
              <th className="px-3 py-2">Semana</th>
              <th className="px-3 py-2">Nivel</th>
              <th className="px-3 py-2">Ceros/ausentes</th>
              <th className="px-3 py-2">Aplicables</th>
              <th className="px-3 py-2">Motivo</th>
              <th className="px-3 py-2">Acción</th>
            </tr>
          </thead>
          <tbody>
            {exclusions.map((row) => (
              <tr key={row.participantWeeklyResultId} className={TABLE_ROW_HOVER_CLASSES}>
                <td className="px-3 py-2">
                  <Link href={`/analitica/personas/${row.personId}`} className="text-primary hover:underline">
                    {row.personFullName}
                  </Link>
                </td>
                <td className="px-3 py-2">{row.splitName}</td>
                <td className="px-3 py-2">{formatDateEs(row.weekStartDate)}</td>
                <td className="px-3 py-2">{row.levelSnapshot}</td>
                <td className="px-3 py-2 tabular">{row.zeroLikeCount}</td>
                <td className="px-3 py-2 tabular">{row.applicableKpiCount}</td>
                <td className="px-3 py-2">
                  {row.hasPositiveValue ? <Badge tone="amber">Tiene valor positivo</Badge> : <Badge tone="slate">Solo ceros/ausencias</Badge>}
                  {row.decision === "excluded_manual" && <Badge tone="danger">Excluida manualmente</Badge>}
                </td>
                <td className="px-3 py-2 text-xs">
                  <div className="flex flex-col gap-1">
                    <ExclusionActionLink resultId={row.participantWeeklyResultId} action="include" label="Incluir en esta consulta" searchParams={searchParams} />
                    <ExclusionActionLink resultId={row.participantWeeklyResultId} action="exclude" label="Excluir de esta consulta" searchParams={searchParams} />
                    <ExclusionActionLink resultId={row.participantWeeklyResultId} action="auto" label="Volver a automático" searchParams={searchParams} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableContainer>
    </div>
  );
}

function ExclusionActionLink({
  resultId,
  action,
  label,
  searchParams,
}: {
  resultId: string;
  action: "include" | "exclude" | "auto";
  label: string;
  searchParams: RawSearchParams;
}) {
  // "Volver a automatico" (`action === "auto"`) omite `ov_<id>`: sin esa clave, la observacion
  // vuelve a decidirse solo por la regla automatica (parte F2).
  return (
    <form method="get" action="/analitica" className="inline">
      <HiddenPassthroughFields searchParams={searchParams} excludeKeys={[`ov_${resultId}`]} />
      {action !== "auto" && <input type="hidden" name={`ov_${resultId}`} value={action} />}
      <button type="submit" className="text-primary hover:underline">
        {label}
      </button>
    </form>
  );
}

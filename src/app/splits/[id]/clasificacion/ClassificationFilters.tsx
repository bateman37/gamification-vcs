"use client";

import { useRef } from "react";

export interface WeekOption {
  splitWeekId: string;
  weekSequenceNumber: number;
}

export interface KpiOption {
  code: string;
  name: string;
}

export function ClassificationFilters({
  weeks,
  kpis,
  selectedWeek,
  selectedKpi,
}: {
  weeks: WeekOption[];
  kpis: KpiOption[];
  selectedWeek: string;
  selectedKpi: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} method="get" className="flex flex-wrap items-end gap-4 rounded-card border border-border bg-surface p-4">
      <div>
        <label htmlFor="semana" className="block text-xs font-medium text-text-muted">
          Semana
        </label>
        <select
          id="semana"
          name="semana"
          defaultValue={selectedWeek}
          onChange={() => formRef.current?.requestSubmit()}
          className="mt-1 rounded-control border border-border-strong px-2 py-1.5 text-sm"
        >
          <option value="acumulado">Acumulado</option>
          {weeks.map((week) => (
            <option key={week.splitWeekId} value={week.splitWeekId}>
              Semana {week.weekSequenceNumber}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="kpi" className="block text-xs font-medium text-text-muted">
          KPI
        </label>
        <select
          id="kpi"
          name="kpi"
          defaultValue={selectedKpi}
          onChange={() => formRef.current?.requestSubmit()}
          className="mt-1 rounded-control border border-border-strong px-2 py-1.5 text-sm"
        >
          <option value="todos">Todos los KPI</option>
          {kpis.map((kpi) => (
            <option key={kpi.code} value={kpi.code}>
              {kpi.name}
            </option>
          ))}
        </select>
      </div>
      <p className="text-xs text-text-muted">Pulsa un encabezado de columna en la tabla para ordenar por esa columna.</p>
    </form>
  );
}

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
  selectedOrder,
}: {
  weeks: WeekOption[];
  kpis: KpiOption[];
  selectedWeek: string;
  selectedKpi: string;
  selectedOrder: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} method="get" className="flex flex-wrap items-end gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <div>
        <label htmlFor="semana" className="block text-xs font-medium text-slate-600">
          Semana
        </label>
        <select
          id="semana"
          name="semana"
          defaultValue={selectedWeek}
          onChange={() => formRef.current?.requestSubmit()}
          className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
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
        <label htmlFor="kpi" className="block text-xs font-medium text-slate-600">
          KPI
        </label>
        <select
          id="kpi"
          name="kpi"
          defaultValue={selectedKpi}
          onChange={() => formRef.current?.requestSubmit()}
          className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="todos">Todos los KPI</option>
          {kpis.map((kpi) => (
            <option key={kpi.code} value={kpi.code}>
              {kpi.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="orden" className="block text-xs font-medium text-slate-600">
          Ordenar por
        </label>
        <select
          id="orden"
          name="orden"
          defaultValue={selectedOrder}
          onChange={() => formRef.current?.requestSubmit()}
          className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          <option value="posicion">Puntos de posicion</option>
          <option value="totalKpi">Total KPI</option>
          {selectedKpi !== "todos" && <option value="kpi">KPI seleccionado</option>}
        </select>
      </div>
    </form>
  );
}

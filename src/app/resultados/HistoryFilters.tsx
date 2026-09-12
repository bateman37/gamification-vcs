"use client";

import { useRef } from "react";

export function HistoryFilters({
  years,
  splits,
  selectedYear,
  selectedSplitId,
  selectedGrouping,
  personId,
  gamificationMode,
}: {
  years: number[];
  splits: { id: string; name: string }[];
  selectedYear: string;
  selectedSplitId: string;
  selectedGrouping: string;
  personId: string | null;
  gamificationMode?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} method="get" className="flex flex-wrap items-end gap-4 rounded-card border border-border bg-surface p-4">
      {personId && <input type="hidden" name="persona" value={personId} />}
      <input type="hidden" name="vista" value="historico" />
      {gamificationMode && <input type="hidden" name="gamificacion" value={gamificationMode} />}

      <div>
        <label htmlFor="anio" className="block text-xs font-medium text-text-muted">
          Anio
        </label>
        <select
          id="anio"
          name="anio"
          defaultValue={selectedYear}
          onChange={() => formRef.current?.requestSubmit()}
          className="mt-1 rounded-control border border-border-strong px-2 py-1.5 text-sm"
        >
          <option value="todos">Todos</option>
          {years.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="splitFiltro" className="block text-xs font-medium text-text-muted">
          Split
        </label>
        <select
          id="splitFiltro"
          name="splitFiltro"
          defaultValue={selectedSplitId}
          onChange={() => formRef.current?.requestSubmit()}
          className="mt-1 rounded-control border border-border-strong px-2 py-1.5 text-sm"
        >
          <option value="todos">Todos</option>
          {splits.map((split) => (
            <option key={split.id} value={split.id}>
              {split.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="agrupacion" className="block text-xs font-medium text-text-muted">
          Agrupacion
        </label>
        <select
          id="agrupacion"
          name="agrupacion"
          defaultValue={selectedGrouping}
          onChange={() => formRef.current?.requestSubmit()}
          className="mt-1 rounded-control border border-border-strong px-2 py-1.5 text-sm"
        >
          <option value="semana">Semana</option>
          <option value="mes">Mes</option>
          <option value="año">Año</option>
        </select>
      </div>
    </form>
  );
}

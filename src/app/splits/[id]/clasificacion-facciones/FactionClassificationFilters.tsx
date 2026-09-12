"use client";

import { useRef } from "react";

export interface FactionWeekOption {
  splitWeekId: string;
  weekSequenceNumber: number;
}

export function FactionClassificationFilters({ weeks, selectedWeek }: { weeks: FactionWeekOption[]; selectedWeek: string }) {
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
    </form>
  );
}

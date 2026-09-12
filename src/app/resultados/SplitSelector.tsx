"use client";

import { useRef } from "react";
import type { PersonSplitOption } from "@/server/services/individual-results.service";

export function SplitSelector({
  splits,
  selectedSplitId,
  personId,
  gamificationMode,
}: {
  splits: PersonSplitOption[];
  selectedSplitId: string | null;
  personId: string | null;
  gamificationMode?: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} method="get" className="flex flex-wrap items-end gap-3">
      {personId && <input type="hidden" name="persona" value={personId} />}
      <input type="hidden" name="vista" value="por-split" />
      {gamificationMode && <input type="hidden" name="gamificacion" value={gamificationMode} />}
      <div>
        <label htmlFor="split" className="block text-xs font-medium text-slate-600">
          Split
        </label>
        <select
          id="split"
          name="split"
          defaultValue={selectedSplitId ?? ""}
          onChange={() => formRef.current?.requestSubmit()}
          className="mt-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        >
          {splits.map((split) => (
            <option key={split.splitId} value={split.splitId}>
              {split.splitName}
            </option>
          ))}
        </select>
      </div>
    </form>
  );
}

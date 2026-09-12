"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { NEWS_CATEGORY_OPTIONS } from "@/domain/news-category-display";

/** Filtros compactos de split y categoria (seccion 23 del encargo): navegan por query string, sin estado propio. */
export function NewsFilters({ splits }: { splits: { splitId: string; splitName: string }[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("cursor");
    router.push(`/noticias?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {splits.length > 1 && (
        <select
          aria-label="Filtrar por split"
          defaultValue={searchParams.get("split") ?? ""}
          onChange={(event) => updateParam("split", event.target.value)}
          className="rounded-control border border-border-strong bg-surface px-2 py-1.5 text-sm text-ink"
        >
          <option value="">Todos los splits</option>
          {splits.map((split) => (
            <option key={split.splitId} value={split.splitId}>
              {split.splitName}
            </option>
          ))}
        </select>
      )}
      <select
        aria-label="Filtrar por categoria"
        defaultValue={searchParams.get("categoria") ?? ""}
        onChange={(event) => updateParam("categoria", event.target.value)}
        className="rounded-control border border-border-strong bg-surface px-2 py-1.5 text-sm text-ink"
      >
        <option value="">Todas las categorias</option>
        {NEWS_CATEGORY_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

"use client";

import { Badge, EmptyState } from "@/components/ui";
import { StoreItemImage } from "@/components/equipment/StoreItemImage";
import { buildBonusSummary, computeEquipmentBonusDeltas } from "@/domain/equipment-bonus-summary";
import type { EquipmentBonusSummaryItem } from "@/domain/equipment-bonus-summary";
import type { EditorItemView, EditorLocationView, EditorProfessionView } from "./equipment-view";

/**
 * Panel lateral "Bonificadores activos" (`1.2.0`, seccion 10 del encargo).
 *
 * No es una calculadora de resultados: muestra los porcentajes configurados y
 * sus fuentes. Toda la agregacion vive en la funcion pura
 * `buildBonusSummary` (`src/domain/equipment-bonus-summary.ts`): este
 * componente no reimplementa ninguna formula del motor semanal.
 *
 * Mientras hay cambios sin confirmar, la parte de Equipo se calcula con el
 * borrador y se marca como vista previa; esos valores nunca se envian a
 * resultados ni al servidor como si fueran oficiales.
 */

function toSummaryItems(items: EditorItemView[]): EquipmentBonusSummaryItem[] {
  return items.map((item) => ({
    ownedItemId: item.ownedItemId,
    storeItemId: item.storeItemId,
    itemName: item.name,
    equipmentSlotId: item.equipmentSlotId,
    equipmentSlotName: item.equipmentSlotName,
    visualPosition: item.visualPosition,
    slotDisplayOrder: item.slotDisplayOrder,
    kpiCode: item.kpiCode,
    bonusPercent: item.bonusPercent,
    imageVersion: item.imageVersion,
  }));
}

export function EquipmentBonusSummary({
  splitId,
  draftItems,
  confirmedItems,
  profession,
  location,
  isDirty,
}: {
  splitId: string;
  draftItems: EditorItemView[];
  confirmedItems: EditorItemView[];
  profession: EditorProfessionView | null;
  location: EditorLocationView | null;
  isDirty: boolean;
}) {
  const summary = buildBonusSummary({ equippedItems: toSummaryItems(draftItems), profession, location });
  const deltas = isDirty ? computeEquipmentBonusDeltas(toSummaryItems(confirmedItems), toSummaryItems(draftItems)) : [];

  return (
    <section aria-labelledby="bonificadores-activos" className="space-y-3 rounded-card border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="bonificadores-activos" className="text-base font-semibold text-ink">
          Bonificadores activos
        </h3>
        {isDirty && <Badge tone="primary">Vista previa sin confirmar</Badge>}
      </div>

      {summary.isEmpty ? (
        <EmptyState>Todavía no tienes bonificadores activos en este split.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {summary.rows.map((row) => (
            <li key={row.kpiCode} className="space-y-1 rounded-control border border-border bg-surface-muted/60 p-3 text-xs">
              <p className="text-sm font-medium text-ink">{row.kpiName}</p>
              <dl className="space-y-0.5">
                {row.professionPercent > 0 && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-text-muted">Profesión{row.professionName ? ` (${row.professionName})` : ""}</dt>
                    <dd className="tabular text-game-ink">+{row.professionPercent} %</dd>
                  </div>
                )}
                {row.locationPercent > 0 && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-text-muted">Localización{row.locationName ? ` (${row.locationName})` : ""}</dt>
                    <dd className="tabular text-info-ink">+{row.locationPercent} %</dd>
                  </div>
                )}
                {row.equipmentPercent > 0 && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-text-muted">Objetos</dt>
                    <dd className="tabular text-primary">+{row.equipmentPercent} %</dd>
                  </div>
                )}
                <div className="flex justify-between gap-2 border-t border-border pt-1">
                  <dt className="font-medium text-ink">Total potencial</dt>
                  <dd className="tabular font-semibold text-ink">+{row.totalPotentialPercent} %</dd>
                </div>
              </dl>

              {row.equipmentEntries.length > 0 && (
                <ul className="space-y-1 pt-1">
                  {row.equipmentEntries.map((entry) => (
                    <li key={entry.ownedItemId} className="flex items-center gap-2">
                      <StoreItemImage
                        splitId={splitId}
                        storeItemId={entry.storeItemId}
                        imageVersion={entry.imageVersion}
                        itemName={entry.itemName}
                        size="sm"
                        decorative
                      />
                      <span className="min-w-0 flex-1 truncate text-text-muted">
                        {entry.itemName} · {entry.equipmentSlotName}
                      </span>
                      <span className="tabular text-text-muted">+{entry.bonusPercent} %</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      {deltas.length > 0 && (
        <div className="space-y-1 rounded-control border border-primary/30 bg-primary-soft p-3 text-xs">
          <p className="font-medium text-ink">Cambios respecto a tu equipo confirmado</p>
          <ul className="space-y-0.5">
            {deltas.map((delta) => (
              <li key={delta.kpiCode} className="flex justify-between gap-2">
                <span className="text-text-muted">{delta.kpiName}</span>
                <span className="tabular text-ink">
                  {delta.differencePercent > 0 ? "+" : "−"}
                  {Math.abs(delta.differencePercent)} %
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-text-muted">
        Los bonus se calculan por separado sobre la misma puntuación base y pueden superar el máximo base. Los puntos
        definitivos se fijan al publicar la semana.
      </p>
    </section>
  );
}

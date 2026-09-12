import { Badge, EmptyState } from "@/components/ui";
import { formatCalendarDateEs } from "@/lib/dates";
import type { OwnedItemView } from "@/server/services/inventory.service";

/** Inventario permanente del participante (`0.9.0` / MVP-2D, seccion 17 del encargo): sin vender, regalar ni destruir. */
export function InventoryPanel({ items }: { items: OwnedItemView[] }) {
  if (items.length === 0) {
    return <EmptyState>Todavia no has comprado ningun objeto.</EmptyState>;
  }

  return (
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <li key={item.ownedItemId} className="space-y-1 rounded-md border border-slate-200 bg-white p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-medium text-slate-800">{item.name}</span>
            {item.equipped && <Badge tone="green">Equipado</Badge>}
          </div>
          <p className="text-slate-600">Ranura: {item.equipmentSlotName}</p>
          <p className="text-slate-600">
            {item.kpiName} · +{item.bonusPercent} %
          </p>
          <p className="text-xs text-slate-500">
            Comprado el {formatCalendarDateEs(item.acquiredAt)} por {item.priceCredits} creditos.
          </p>
        </li>
      ))}
    </ul>
  );
}

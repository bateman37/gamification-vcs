import { FieldError } from "@/components/ui";
import { EQUIPMENT_BONUS_PERCENTS } from "@/domain/equipment-bonus";
import {
  STORE_ITEM_IMAGE_ACCEPT_ATTRIBUTE,
  STORE_ITEM_IMAGE_FIELD,
} from "@/domain/store-item-image-constraints";
import type { KpiCode } from "@/domain/kpis/catalog";

export interface StoreItemFormDefaults {
  name: string;
  description: string;
  priceCredits: number;
  equipmentSlotId: string;
  kpiCode: KpiCode | "";
  bonusPercent: number;
}

/** Campos compartidos del formulario de objetos (creacion y edicion), seccion 12 del encargo. */
export function StoreItemFormFields({
  idPrefix,
  defaults,
  fieldErrors,
  activeKpis,
  slots,
  withImageField = false,
}: {
  idPrefix: string;
  defaults?: StoreItemFormDefaults;
  fieldErrors?: Record<string, string>;
  activeKpis: { code: KpiCode; name: string }[];
  slots: { id: string; name: string }[];
  /** Solo en el alta: el objeto y su imagen se persisten de forma atomica (`1.2.0`). */
  withImageField?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor={`${idPrefix}-name`} className="block text-sm font-medium text-ink">
          Nombre
        </label>
        <input
          id={`${idPrefix}-name`}
          name="name"
          type="text"
          required
          maxLength={80}
          defaultValue={defaults?.name}
          className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
        />
        <FieldError message={fieldErrors?.name} />
      </div>

      <div className="sm:col-span-2">
        <label htmlFor={`${idPrefix}-description`} className="block text-sm font-medium text-ink">
          Descripcion (opcional)
        </label>
        <input
          id={`${idPrefix}-description`}
          name="description"
          type="text"
          maxLength={280}
          defaultValue={defaults?.description}
          className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
        />
        <FieldError message={fieldErrors?.description} />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-priceCredits`} className="block text-sm font-medium text-ink">
          Precio (créditos)
        </label>
        <input
          id={`${idPrefix}-priceCredits`}
          name="priceCredits"
          type="number"
          min={1}
          step={1}
          required
          defaultValue={defaults?.priceCredits}
          className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
        />
        <FieldError message={fieldErrors?.priceCredits} />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-equipmentSlotId`} className="block text-sm font-medium text-ink">
          Ranura
        </label>
        <select
          id={`${idPrefix}-equipmentSlotId`}
          name="equipmentSlotId"
          required
          defaultValue={defaults?.equipmentSlotId}
          className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
        >
          {slots.map((slot) => (
            <option key={slot.id} value={slot.id}>
              {slot.name}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors?.equipmentSlotId} />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-kpiCode`} className="block text-sm font-medium text-ink">
          KPI potenciado
        </label>
        <select
          id={`${idPrefix}-kpiCode`}
          name="kpiCode"
          required
          defaultValue={defaults?.kpiCode}
          className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
        >
          {activeKpis.map((kpi) => (
            <option key={kpi.code} value={kpi.code}>
              {kpi.name}
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors?.kpiCode} />
      </div>

      <div>
        <label htmlFor={`${idPrefix}-bonusPercent`} className="block text-sm font-medium text-ink">
          Bonus
        </label>
        <select
          id={`${idPrefix}-bonusPercent`}
          name="bonusPercent"
          required
          defaultValue={defaults?.bonusPercent ?? EQUIPMENT_BONUS_PERCENTS[1]}
          className="mt-1 w-full rounded-control border border-border-strong px-3 py-2 text-sm"
        >
          {EQUIPMENT_BONUS_PERCENTS.map((percent) => (
            <option key={percent} value={percent}>
              +{percent} %
            </option>
          ))}
        </select>
        <FieldError message={fieldErrors?.bonusPercent} />
      </div>

      {withImageField && (
        <div className="sm:col-span-2">
          <label htmlFor={`${idPrefix}-image`} className="block text-sm font-medium text-ink">
            Imagen del objeto (opcional)
          </label>
          <input
            id={`${idPrefix}-image`}
            type="file"
            name={STORE_ITEM_IMAGE_FIELD}
            accept={STORE_ITEM_IMAGE_ACCEPT_ATTRIBUTE}
            className="mt-1 block w-full text-sm"
          />
          <p className="mt-1 text-xs text-text-muted">
            JPEG, PNG o WebP, hasta 5 MB. Se procesa en el servidor a WebP (máximo 512 px). Sin imagen se muestra un
            icono neutro de su posición.
          </p>
          <FieldError message={fieldErrors?.[STORE_ITEM_IMAGE_FIELD]} />
        </div>
      )}
    </div>
  );
}

import { Alert, SectionHeader, StatCard, TABLE_HEAD_ROW_CLASSES, TABLE_ROW_HOVER_CLASSES, TableContainer } from "@/components/ui";
import type { GamificationTabData } from "@/server/services/analytics-gamification.service";
import { formatDateEs, formatPercentEs, formatPointsEs } from "./format";

/** Bloque 6 - Impacto de la gamificación (parte H7 del encargo). */
export function GamificationImpactTab({ data, startDate, endDate }: { data: GamificationTabData; startDate: Date; endDate: Date }) {
  const { bonus, economy, mostEquipped, mostValuable } = data;

  return (
    <div className="space-y-6">
      <Alert tone="info">
        El bonus mide el efecto matemático de las reglas sobre los puntos. La evolución del rendimiento sin bonus es descriptiva: estos datos por sí
        solos no demuestran que la gamificación haya causado una mejora.
      </Alert>

      <div className="rounded-card border border-border bg-surface p-4">
        <SectionHeader title="Puntos y bonus publicados" description="Muestra base y con gamificación a la vez, con independencia del selector principal." />
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Puntos base (sin bonus)" value={formatPointsEs(bonus.basePointsSum)} />
          <StatCard label="Puntos finales (con bonus)" value={formatPointsEs(bonus.finalPointsSum)} tone="game" />
          <StatCard
            label="% añadido sobre la base"
            value={formatPercentEs(bonus.bonusPercentOverBase)}
            helpText={bonus.bonusPercentOverBase === null ? "No calculable con base 0" : undefined}
          />
          <StatCard label="Mediciones incluidas" value={bonus.observationCount} />
        </dl>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Bonus de profesión" value={formatPointsEs(bonus.professionBonusSum)} tone="primary" />
          <StatCard label="Bonus de localización" value={formatPointsEs(bonus.locationBonusSum)} tone="info" />
          <StatCard label="Bonus de objetos" value={formatPointsEs(bonus.equipmentBonusSum)} tone="reward" />
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-text-muted">Desglose por KPI</p>
          <TableContainer>
            <table className="w-full text-left text-sm">
              <thead>
                <tr className={TABLE_HEAD_ROW_CLASSES}>
                  <th className="px-3 py-2">KPI</th>
                  <th className="px-3 py-2">Base</th>
                  <th className="px-3 py-2">Final</th>
                  <th className="px-3 py-2">Profesión</th>
                  <th className="px-3 py-2">Localización</th>
                  <th className="px-3 py-2">Objetos</th>
                  <th className="px-3 py-2">Mediciones</th>
                </tr>
              </thead>
              <tbody>
                {bonus.perKpi.map((row) => (
                  <tr key={row.kpiCode} className={TABLE_ROW_HOVER_CLASSES}>
                    <td className="px-3 py-2">{row.kpiName}</td>
                    <td className="px-3 py-2 tabular">{formatPointsEs(row.basePointsSum)}</td>
                    <td className="px-3 py-2 tabular">{formatPointsEs(row.finalPointsSum)}</td>
                    <td className="px-3 py-2 tabular">{formatPointsEs(row.professionBonusSum)}</td>
                    <td className="px-3 py-2 tabular">{formatPointsEs(row.locationBonusSum)}</td>
                    <td className="px-3 py-2 tabular">{formatPointsEs(row.equipmentBonusSum)}</td>
                    <td className="px-3 py-2 tabular">{row.measurementCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableContainer>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-xs font-medium text-text-muted">Objetos más equipados en publicaciones</p>
            <ul className="space-y-1 text-sm">
              {mostEquipped.length === 0 && <li className="text-text-muted">Sin objetos equipados en el periodo.</li>}
              {mostEquipped.map((item) => (
                <li key={`${item.storeItemId}-${item.itemName}`} className="flex justify-between">
                  <span>{item.itemName}</span>
                  <span className="tabular">{item.equippedCount} veces</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-text-muted">Objetos que más puntos han aportado</p>
            <ul className="space-y-1 text-sm">
              {mostValuable.length === 0 && <li className="text-text-muted">Sin aportación registrada en el periodo.</li>}
              {mostValuable.map((item) => (
                <li key={`${item.storeItemId}-${item.itemName}`} className="flex justify-between">
                  <span>{item.itemName}</span>
                  <span className="tabular">{formatPointsEs(item.totalBonusPoints)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-card border border-border bg-surface p-4">
        <SectionHeader
          title="Economía y uso del mercado"
          description={`Economía por fecha de operación: del ${formatDateEs(startDate)} al ${formatDateEs(endDate)}. Aplicado aquí: splits y fechas. Los filtros de nivel y posibles ausencias solo afectan al rendimiento y los bonus analizados.`}
        />
        <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Créditos emitidos" value={formatPointsEs(economy.creditsIssued)} tone="success" />
          <StatCard label="Créditos gastados" value={formatPointsEs(economy.creditsSpent)} tone="danger" />
          <StatCard label="Saldo inicial → cierre" value={`${formatPointsEs(economy.openingBalance)} → ${formatPointsEs(economy.closingBalance)}`} />
          <StatCard label="Compras / compradores" value={`${economy.purchaseCount} / ${economy.distinctBuyerCount}`} />
        </dl>
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-text-muted">Objetos más comprados</p>
          <ul className="space-y-1 text-sm">
            {economy.mostPurchasedItems.length === 0 && <li className="text-text-muted">Sin compras en el periodo.</li>}
            {economy.mostPurchasedItems.map((item) => (
              <li key={item.storeItemId} className="flex justify-between">
                <span>{item.itemName}</span>
                <span className="tabular">{item.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

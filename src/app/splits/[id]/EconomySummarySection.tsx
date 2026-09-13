import { Badge, LinkButton, StatCard } from "@/components/ui";
import { Icon } from "@/components/Icon";
import type { EconomyDashboardSummary } from "@/server/services/economy.service";

/**
 * Resumen compacto de "Economia y mercado" en el detalle del split (`0.9.0`
 * / MVP-2D, ampliado en `1.2.2`, seccion 10 del encargo), con enlace a la
 * vista administrativa detallada (`/splits/[id]/economia`). Deliberadamente
 * sencillo: no es un segundo panel de analitica.
 */
export function EconomySummarySection({ splitId, summary }: { splitId: string; summary: EconomyDashboardSummary }) {
  return (
    <section id="economia" className="scroll-mt-20 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Economía y mercado</h2>
        <LinkButton href={`/splits/${splitId}/economia`} variant="secondary">
          <Icon name="Store" className="h-4 w-4" />
          Administrar economía y mercado
        </LinkButton>
      </div>

      <div className="rounded-card border border-border bg-surface p-4">
        <div className="mb-3">
          <Badge tone={summary.marketStatus === "OPEN" ? "green" : "gray"}>
            {summary.marketStatus === "OPEN" ? "Mercado abierto" : "Mercado cerrado"}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <StatCard label="Ranuras activas" value={`${summary.activeSlotCount} / ${summary.totalSlotPositions}`} />
          <StatCard label="Objetos activos" value={`${summary.activeItemCount} / ${summary.totalItemCount}`} />
          <StatCard label="Créditos gastados" value={summary.creditsSpent} helpText="Suma histórica de compras confirmadas." />
          <StatCard label="Créditos disponibles" value={summary.creditsAvailable} helpText="Suma de los saldos actuales de todos los participantes." />
          <StatCard label="Objetos comprados" value={summary.purchaseCount} />
          <StatCard
            label="Participantes compradores"
            value={`${summary.buyerCount} / ${summary.participantCount}`}
          />
          <StatCard label="Objetos equipados" value={summary.equippedItemCount} />
        </div>
      </div>
    </section>
  );
}

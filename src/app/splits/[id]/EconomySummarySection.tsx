import Link from "next/link";
import { Badge } from "@/components/ui";
import type { MarketStatus } from "@prisma/client";

/**
 * Resumen compacto de "Economia y mercado" en el detalle del split (`0.9.0`
 * / MVP-2D, seccion 8 del encargo), con enlace a la vista administrativa
 * detallada (`/splits/[id]/economia`).
 */
export function EconomySummarySection({
  splitId,
  marketStatus,
  slotCount,
  itemCount,
}: {
  splitId: string;
  marketStatus: MarketStatus;
  slotCount: number;
  itemCount: number;
}) {
  return (
    <section id="economia" className="scroll-mt-20 space-y-3">
      <h2 className="text-lg font-semibold">Economia y mercado</h2>
      <div className="flex flex-wrap items-center gap-3 rounded-card border border-border bg-surface p-4">
        <Badge tone={marketStatus === "OPEN" ? "green" : "gray"}>
          {marketStatus === "OPEN" ? "Mercado abierto" : "Mercado cerrado"}
        </Badge>
        <span className="text-sm text-text-muted">
          {slotCount} ranura{slotCount === 1 ? "" : "s"} de equipo, {itemCount} objeto{itemCount === 1 ? "" : "s"} en el
          catalogo.
        </span>
        <Link href={`/splits/${splitId}/economia`} className="text-sm font-medium text-ink underline hover:text-ink">
          Administrar economia y mercado
        </Link>
      </div>
    </section>
  );
}

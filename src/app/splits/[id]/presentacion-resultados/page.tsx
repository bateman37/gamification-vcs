import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { getSplitById } from "@/server/services/split.service";
import { buildSplitResultsPresentation } from "@/server/services/results-presentation.service";
import { LinkButton, PageHeader, EmptyState } from "@/components/ui";
import { PresentationView } from "./PresentationView";

/**
 * Modo de proyeccion de resultados (`1.0.1`, parte I del encargo): ruta
 * exclusiva de administrador (`requireAdminSession`, ademas del middleware
 * que ya protege `/splits/*`). Nunca acepta `personId`/puntos/posiciones
 * del navegador: todo el DTO lo construye `buildSplitResultsPresentation`
 * en servidor a partir de la ultima semana publicada.
 */
export default async function PresentationResultsPage({ params }: { params: { id: string } }) {
  await requireAdminSession();
  const split = await getSplitById(prisma, params.id);
  if (!split) notFound();

  const presentation = await buildSplitResultsPresentation(prisma, params.id);

  if (!presentation.available) {
    return (
      <div className="space-y-4">
        <PageHeader title="Presentar resultados" description={split.name} />
        <EmptyState>Publica una semana para presentar sus resultados.</EmptyState>
        <LinkButton href={`/splits/${params.id}`} variant="secondary">
          Volver al split
        </LinkButton>
      </div>
    );
  }

  return <PresentationView splitId={params.id} data={presentation.data} />;
}

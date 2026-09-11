import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { listPersonsWithPublishedResults } from "@/server/services/individual-results.service";
import { EmptyState } from "@/components/ui";
import { PersonSelector } from "./PersonSelector";
import { PorSplitSection } from "./PorSplitSection";
import { HistoricoSection } from "./HistoricoSection";

function buildTabHref(vista: string, personId: string, isAdmin: boolean): string {
  const params = new URLSearchParams();
  params.set("vista", vista);
  if (isAdmin) params.set("persona", personId);
  return `/resultados?${params.toString()}`;
}

export default async function ResultadosPage({
  searchParams,
}: {
  searchParams: { persona?: string; vista?: string; split?: string; anio?: string; splitFiltro?: string; agrupacion?: string };
}) {
  const session = await requireSession();
  const isAdmin = session.user.role === "ADMIN";

  // El participante siempre usa la persona vinculada a su sesion: nunca se acepta un `persona` del navegador para decidir que ve (seccion 6.3).
  const personId = isAdmin ? searchParams.persona ?? null : session.user.personId;

  if (!isAdmin && !personId) {
    return <EmptyState>Tu cuenta no esta vinculada a ninguna persona. Contacta con un administrador.</EmptyState>;
  }

  const persons = isAdmin ? await listPersonsWithPublishedResults(prisma) : [];
  const vista = searchParams.vista === "historico" ? "historico" : "por-split";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Resultados</h1>
        <p className="text-sm text-slate-600">Evolucion y clasificacion a partir de las semanas publicadas.</p>
      </div>

      {isAdmin && <PersonSelector persons={persons} selectedPersonId={personId} />}

      {!personId ? (
        <EmptyState>Selecciona una persona para consultar sus resultados.</EmptyState>
      ) : (
        <>
          <nav className="flex gap-4 border-b border-slate-200 text-sm font-medium text-slate-600">
            <Link
              href={buildTabHref("por-split", personId, isAdmin)}
              className={`-mb-px border-b-2 px-1 py-2 ${vista === "por-split" ? "border-slate-900 text-slate-900" : "border-transparent hover:text-slate-900"}`}
            >
              Por split
            </Link>
            <Link
              href={buildTabHref("historico", personId, isAdmin)}
              className={`-mb-px border-b-2 px-1 py-2 ${vista === "historico" ? "border-slate-900 text-slate-900" : "border-transparent hover:text-slate-900"}`}
            >
              Historico general
            </Link>
          </nav>

          {vista === "por-split" ? (
            <PorSplitSection personId={personId} requestedSplitId={searchParams.split ?? null} isAdmin={isAdmin} />
          ) : (
            <HistoricoSection personId={personId} isAdmin={isAdmin} searchParams={searchParams} />
          )}
        </>
      )}
    </div>
  );
}

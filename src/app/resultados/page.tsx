import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { listPersonsWithPublishedResults } from "@/server/services/individual-results.service";
import { parseGamificationMode } from "@/domain/gamification-view";
import { EmptyState } from "@/components/ui";
import { PersonSelector } from "./PersonSelector";
import { PorSplitSection } from "./PorSplitSection";
import { HistoricoSection } from "./HistoricoSection";
import { GamificationToggle } from "./GamificationToggle";

function buildTabHref(vista: string, personId: string, isAdmin: boolean, gamificacion: string): string {
  const params = new URLSearchParams();
  params.set("vista", vista);
  if (isAdmin) params.set("persona", personId);
  params.set("gamificacion", gamificacion);
  return `/resultados?${params.toString()}`;
}

export default async function ResultadosPage({
  searchParams,
}: {
  searchParams: {
    persona?: string;
    vista?: string;
    split?: string;
    anio?: string;
    splitFiltro?: string;
    agrupacion?: string;
    semanaFaccion?: string;
    gamificacion?: string;
  };
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
  const gamificationMode = parseGamificationMode(searchParams.gamificacion);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Resultados</h1>
        <p className="text-sm text-text-muted">Evolucion y clasificacion a partir de las semanas publicadas.</p>
      </div>

      {isAdmin && <PersonSelector persons={persons} selectedPersonId={personId} gamificationMode={gamificationMode} />}

      {!personId ? (
        <EmptyState>Selecciona una persona para consultar sus resultados.</EmptyState>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
            <nav className="flex gap-4 text-sm font-medium text-text-muted">
              <Link
                href={buildTabHref("por-split", personId, isAdmin, gamificationMode)}
                className={`-mb-px border-b-2 px-1 py-2 ${vista === "por-split" ? "border-ink text-ink" : "border-transparent hover:text-ink"}`}
              >
                Por split
              </Link>
              <Link
                href={buildTabHref("historico", personId, isAdmin, gamificationMode)}
                className={`-mb-px border-b-2 px-1 py-2 ${vista === "historico" ? "border-ink text-ink" : "border-transparent hover:text-ink"}`}
              >
                Histórico general
              </Link>
            </nav>
            <GamificationToggle mode={gamificationMode} searchParams={searchParams} />
          </div>

          {vista === "por-split" ? (
            <PorSplitSection
              personId={personId}
              requestedSplitId={searchParams.split ?? null}
              isAdmin={isAdmin}
              factionWeek={searchParams.semanaFaccion ?? null}
              gamificationMode={gamificationMode}
            />
          ) : (
            <HistoricoSection personId={personId} isAdmin={isAdmin} searchParams={searchParams} gamificationMode={gamificationMode} />
          )}
        </>
      )}
    </div>
  );
}

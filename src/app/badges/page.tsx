import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { PageHeader, EmptyState, LinkButton } from "@/components/ui";
import { listAllPersons, getPersonById } from "@/server/services/person.service";
import { computeBadgeClassification, getPersonBadgeShowcase } from "@/server/services/badge.service";
import { BADGE_SORT_MVP } from "@/domain/badges/badge-classification";
import { BadgesTabsNav, type BadgesTab } from "./BadgesTabsNav";
import { BadgeClassificationTable } from "./BadgeClassificationTable";
import { BadgePersonSelector } from "./BadgePersonSelector";
import { BadgeShowcase } from "./BadgeShowcase";

/**
 * Modulo Badges (`1.2.3`, seccion 6 del encargo, ver docs/BADGES.md): dos
 * pestañas para todos los usuarios autenticados (clasificacion general
 * siempre visible; "Mi vitrina"/"Badges de la persona" segun el rol). Solo
 * el administrador puede seleccionar una persona distinta de si mismo y ve
 * el enlace discreto a la administracion historica.
 */
export default async function BadgesPage({
  searchParams,
}: {
  searchParams: { vista?: string; orden?: string; persona?: string };
}) {
  const session = await requireSession();
  const isAdmin = session.user.role === "ADMIN";
  const vista: BadgesTab = searchParams.vista === "vitrina" ? "vitrina" : "clasificacion";
  const sortKey = searchParams.orden && searchParams.orden.trim() !== "" ? searchParams.orden : BADGE_SORT_MVP;

  // El participante siempre usa la persona vinculada a su sesion: nunca se acepta un `persona` del navegador para decidir que ve (mismo criterio que /resultados y /fichas).
  const personId = isAdmin ? (searchParams.persona ?? null) : session.user.personId;

  const [classification, persons, showcasePerson] = await Promise.all([
    vista === "clasificacion" ? computeBadgeClassification(prisma, sortKey) : Promise.resolve(null),
    isAdmin && vista === "vitrina" ? listAllPersons(prisma) : Promise.resolve([]),
    vista === "vitrina" && personId ? getPersonById(prisma, personId) : Promise.resolve(null),
  ]);

  const showcase = vista === "vitrina" && personId && showcasePerson ? await getPersonBadgeShowcase(prisma, personId) : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Badges"
        description="Medallas permanentes por ganar un split, la facción ganadora o una categoría KPI."
        actions={
          isAdmin ? (
            <LinkButton href="/badges/administracion" variant="secondary">
              Administración histórica
            </LinkButton>
          ) : undefined
        }
      />

      <BadgesTabsNav activeTab={vista} isAdmin={isAdmin} orden={sortKey} persona={personId} />

      {vista === "clasificacion" ? (
        classification && classification.entries.length > 0 ? (
          <BadgeClassificationTable data={classification} sortKey={sortKey} />
        ) : (
          <EmptyState>Todavía no se ha concedido ningún badge.</EmptyState>
        )
      ) : (
        <div className="space-y-4">
          {isAdmin && <BadgePersonSelector persons={persons} selectedPersonId={personId} />}
          {!personId ? (
            <EmptyState>
              {isAdmin ? "Selecciona una persona para ver su vitrina." : "Tu cuenta no está vinculada a ninguna persona. Contacta con un administrador."}
            </EmptyState>
          ) : !showcasePerson ? (
            <EmptyState>La persona seleccionada no existe.</EmptyState>
          ) : (
            showcase && <BadgeShowcase showcase={showcase} personFullName={showcasePerson.fullName} />
          )}
        </div>
      )}
    </div>
  );
}

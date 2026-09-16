import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { PageHeader, StatCard, EmptyState, LinkButton, TableContainer, TABLE_HEAD_ROW_CLASSES, TABLE_ROW_HOVER_CLASSES } from "@/components/ui";
import { listBadgeHistoricalAdminSummary } from "@/server/services/badge-historical.service";
import { listAllPersons } from "@/server/services/person.service";
import { ImportControls } from "./ImportControls";
import { RecipientLinkForm } from "./RecipientLinkForm";

/**
 * Administracion historica de Badges (`1.2.3`, seccion 3.3/4.2 del encargo,
 * ver docs/BADGES.md): seccion discreta, exclusiva de `ADMIN`, para
 * importar/reintentar `legacy-badges-v1` y resolver la vinculacion de sus
 * destinatarios con personas reales.
 */
export default async function BadgeHistoricalAdminPage() {
  await requireAdminSession();

  const [summary, persons] = await Promise.all([listBadgeHistoricalAdminSummary(prisma), listAllPersons(prisma)]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Administración histórica de Badges"
        description='Importa "legacy-badges-v1" y resuelve la vinculación de sus destinatarios con personas reales.'
        actions={
          <LinkButton href="/badges" variant="secondary">
            Volver a Badges
          </LinkButton>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Destinatarios" value={summary.totalRecipients} />
        <StatCard label="Enlazados" value={summary.linkedCount} tone="success" />
        <StatCard label="Pendientes" value={summary.pendingCount} tone={summary.pendingCount > 0 ? "danger" : "ink"} />
        <StatCard label="Concesiones importadas" value={summary.totalAwards} />
      </div>

      <ImportControls />

      {summary.totalRecipients === 0 ? (
        <EmptyState>Todavía no se ha importado ningún histórico. Usa &quot;Importar legacy-badges-v1&quot; arriba.</EmptyState>
      ) : (
        <TableContainer>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={TABLE_HEAD_ROW_CLASSES}>
                <th scope="col" className="px-3 py-2">
                  Nombre histórico
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  Concesiones
                </th>
                <th scope="col" className="px-3 py-2">
                  Persona vinculada
                </th>
              </tr>
            </thead>
            <tbody>
              {summary.recipients.map((recipient) => (
                <tr key={recipient.id} className={TABLE_ROW_HOVER_CLASSES}>
                  <td className="px-3 py-2 font-medium text-ink">{recipient.originalName}</td>
                  <td className="tabular px-3 py-2 text-right">{recipient.awardCount}</td>
                  <td className="px-3 py-2">
                    <RecipientLinkForm recipientId={recipient.id} persons={persons} selectedPersonId={recipient.personId} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableContainer>
      )}
    </div>
  );
}

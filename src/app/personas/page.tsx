import { prisma } from "@/lib/prisma";
import { listPersonsWithParticipationCount } from "@/server/services/person.service";
import { listPersonsWithAccount } from "@/server/services/auth.service";
import { requireAdminSession } from "@/lib/session";
import { EmptyState } from "@/components/ui";
import { PersonCreateForm } from "./PersonCreateForm";
import { PersonEditRow } from "./PersonEditRow";

export default async function PersonasPage() {
  await requireAdminSession();
  const [people, peopleWithAccount] = await Promise.all([
    listPersonsWithParticipationCount(prisma),
    listPersonsWithAccount(prisma),
  ]);
  const accountByPersonId = new Map(peopleWithAccount.map((person) => [person.id, person.account]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Personas</h1>
        <p className="text-sm text-text-muted">
          Registro global de personas. Una persona puede participar en cero, uno o varios splits.
        </p>
      </div>

      <PersonCreateForm />

      <div className="rounded-card border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-canvas text-text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Nombre</th>
              <th className="px-3 py-2 font-medium">Correo</th>
              <th className="px-3 py-2 text-center font-medium">Splits</th>
              <th className="px-3 py-2 font-medium">Cuenta</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {people.map((person) => (
              <PersonEditRow key={person.id} person={person} account={accountByPersonId.get(person.id) ?? null} />
            ))}
          </tbody>
        </table>
        {people.length === 0 && (
          <div className="p-4">
            <EmptyState>Todavía no hay personas registradas.</EmptyState>
          </div>
        )}
      </div>
    </div>
  );
}

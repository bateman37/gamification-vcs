import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSplitById, listSplitWeeks } from "@/server/services/split.service";
import { listParticipantsForSplit } from "@/server/services/participant.service";
import { listAllPersons } from "@/server/services/person.service";
import { formatCalendarDate } from "@/lib/dates";
import { Badge, EmptyState } from "@/components/ui";
import { SPLIT_STATUS_LABELS } from "@/lib/labels";
import { EditSplitDraftForm } from "./EditSplitDraftForm";
import { ActivateSplitButton } from "./ActivateSplitButton";
import { AddParticipantForm } from "./AddParticipantForm";
import { ParticipantEditRow } from "./ParticipantEditRow";

const STATUS_TONE: Record<string, "slate" | "green" | "gray"> = {
  DRAFT: "slate",
  ACTIVE: "green",
  CLOSED: "gray",
};

export default async function SplitDetailPage({ params }: { params: { id: string } }) {
  const split = await getSplitById(prisma, params.id);
  if (!split) {
    notFound();
  }

  const [weeks, participants, people] = await Promise.all([
    listSplitWeeks(prisma, split.id),
    listParticipantsForSplit(prisma, split.id),
    listAllPersons(prisma),
  ]);

  const participatingPersonIds = new Set(participants.map((participant) => participant.personId));
  const availablePeople = people.filter((person) => !participatingPersonIds.has(person.id));

  const canActivate = split.status === "DRAFT" && participants.length > 0;

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{split.name}</h1>
          <Badge tone={STATUS_TONE[split.status]}>{SPLIT_STATUS_LABELS[split.status]}</Badge>
        </div>
        {split.description && <p className="mt-1 text-sm text-slate-600">{split.description}</p>}
        <p className="mt-1 text-sm text-slate-600">
          Inicio: {formatCalendarDate(split.startDate)} - {split.numberOfWeeks} semanas
        </p>
      </div>

      {split.status === "DRAFT" && (
        <div>
          {canActivate ? (
            <ActivateSplitButton splitId={split.id} />
          ) : (
            <p className="text-sm text-slate-500">
              Anade al menos un participante para poder activar el split.
            </p>
          )}
        </div>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Calendario de semanas</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Semana</th>
                <th className="px-3 py-2 font-medium">Inicio</th>
                <th className="px-3 py-2 font-medium">Fin</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={week.id} className="border-b border-slate-100">
                  <td className="px-3 py-2">{week.sequenceNumber}</td>
                  <td className="px-3 py-2">{formatCalendarDate(week.startDate)}</td>
                  <td className="px-3 py-2">{formatCalendarDate(week.endDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Participantes</h2>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-2 font-medium">Persona</th>
                <th className="px-3 py-2 font-medium">Alias</th>
                <th className="px-3 py-2 font-medium">Nivel</th>
                <th className="px-3 py-2 text-center font-medium">Semana inicial</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {participants.map((participant) => (
                <ParticipantEditRow key={participant.id} splitId={split.id} participant={participant} />
              ))}
            </tbody>
          </table>
          {participants.length === 0 && (
            <div className="p-4">
              <EmptyState>Todavia no hay participantes en este split.</EmptyState>
            </div>
          )}
        </div>

        {split.status !== "CLOSED" && (
          <AddParticipantForm
            splitId={split.id}
            people={availablePeople}
            weeks={weeks}
            splitStatus={split.status}
          />
        )}
      </section>

      {split.status === "DRAFT" && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Editar split</h2>
          <EditSplitDraftForm split={split} />
        </section>
      )}
    </div>
  );
}

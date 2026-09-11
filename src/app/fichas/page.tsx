import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { listProfileCardsForPerson } from "@/server/services/participant-profile.service";
import { formatCalendarDate } from "@/lib/dates";
import { SPLIT_STATUS_LABELS } from "@/lib/labels";
import { Badge, EmptyState } from "@/components/ui";
import { PROFESSION_BONUS_LABEL } from "@/domain/profession-bonus";
import { formatPoweredKpis } from "@/domain/profession-display";
import { ProfileAvatar } from "./ProfileAvatar";
import { ProfileAliasForm } from "./ProfileAliasForm";
import { ProfileProfessionForm } from "./ProfileProfessionForm";
import { ProfileAvatarForm } from "./ProfileAvatarForm";

const STATUS_TONE: Record<string, "slate" | "green" | "gray"> = {
  DRAFT: "slate",
  ACTIVE: "green",
  CLOSED: "gray",
};

/**
 * Fichas privadas de participante (`0.8.0` / MVP-2B, ver
 * docs/PROFESSIONS_AND_PROFILES.md). La persona se resuelve **siempre**
 * desde `session.user.personId`: esta pagina no acepta ningun `personId` del
 * navegador para decidir que fichas puede ver o editar.
 */
export default async function FichasPage() {
  const session = await requireSession();
  const personId = session.user.personId;

  if (!personId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Fichas</h1>
          <p className="text-sm text-slate-600">Tu alias, tu profesion y tu avatar en cada split.</p>
        </div>
        <EmptyState>Tu cuenta no esta vinculada a ninguna persona. Contacta con un administrador.</EmptyState>
      </div>
    );
  }

  const cards = await listProfileCardsForPerson(prisma, personId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Fichas</h1>
        <p className="text-sm text-slate-600">
          Una ficha por cada split en el que participas: alias, profesion y avatar son propios de cada split.
        </p>
      </div>

      {cards.length === 0 ? (
        <EmptyState>Todavia no participas en ningun split.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {cards.map((card) => (
            <section key={card.splitParticipantId} className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start gap-4">
                <ProfileAvatar
                  splitParticipantId={card.splitParticipantId}
                  alias={card.alias}
                  avatarVersion={card.avatarVersion}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold">{card.splitName}</h2>
                    <Badge tone={STATUS_TONE[card.splitStatus]}>{SPLIT_STATUS_LABELS[card.splitStatus]}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-600">Inicio: {formatCalendarDate(card.splitStartDate)}</p>
                  <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-xs text-slate-500">Alias</dt>
                      <dd className="font-medium">{card.alias}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Nivel tecnico</dt>
                      <dd className="font-medium">{card.level}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Faccion</dt>
                      <dd className="font-medium">
                        {card.faction ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              aria-hidden
                              className="h-3 w-3 rounded-full border border-slate-300"
                              style={{ backgroundColor: card.faction.color }}
                            />
                            {card.faction.name}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-slate-500">Profesion</dt>
                      <dd className="font-medium">
                        {card.profession ? (
                          <>
                            {card.profession.name}
                            <span className="block text-xs font-normal text-slate-500">{formatPoweredKpis(card.profession)}</span>
                            <span className="block text-xs font-normal text-slate-500">{PROFESSION_BONUS_LABEL}</span>
                          </>
                        ) : card.splitUsesProfessions ? (
                          <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                            Sin elegir
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </dd>
                    </div>
                  </dl>
                  {card.hasPublishedResults && (
                    <p className="mt-2 text-sm">
                      <Link href={`/resultados?vista=por-split&split=${card.splitId}`} className="underline hover:text-slate-900">
                        Ver mis resultados de este split
                      </Link>
                    </p>
                  )}
                </div>
              </div>

              {card.editable ? (
                <div className="grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 md:grid-cols-2">
                  <ProfileAliasForm splitParticipantId={card.splitParticipantId} alias={card.alias} />
                  <ProfileAvatarForm splitParticipantId={card.splitParticipantId} hasAvatar={card.avatarVersion !== null} />
                  <div className="md:col-span-2">
                    <ProfileProfessionForm
                      splitParticipantId={card.splitParticipantId}
                      splitUsesProfessions={card.splitUsesProfessions}
                      profession={card.profession}
                      availableProfessions={card.availableProfessions}
                      locked={card.professionLocked}
                      editable={card.editable}
                    />
                  </div>
                </div>
              ) : (
                <p className="border-t border-slate-100 pt-4 text-sm text-slate-500">
                  El split esta cerrado: esta ficha es de solo lectura.
                </p>
              )}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

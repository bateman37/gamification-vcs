import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { listProfileCardsForPerson } from "@/server/services/participant-profile.service";
import { groupAndOrderProfileCards } from "@/domain/profile-order";
import { EmptyState } from "@/components/ui";
import { ProfileSplitCard } from "./ProfileSplitCard";

/**
 * Fichas privadas de participante (`0.8.0` / MVP-2B, rediseño `1.0.1` parte
 * F del encargo): un resumen y punto de entrada, no un segundo lugar de
 * edicion. Cada participacion es una tarjeta horizontal agrupada por
 * estado del split; la edicion de alias, avatar y profesion vive en
 * `/fichas/[splitParticipantId]`. La persona se resuelve siempre desde
 * `session.user.personId`.
 */
export default async function FichasPage() {
  const session = await requireSession();
  const personId = session.user.personId;

  if (!personId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold">Fichas</h1>
          <p className="text-sm text-text-muted">Tu alias, tu profesion y tu avatar en cada split.</p>
        </div>
        <EmptyState>Tu cuenta no esta vinculada a ninguna persona. Contacta con un administrador.</EmptyState>
      </div>
    );
  }

  const cards = await listProfileCardsForPerson(prisma, personId);
  const { active, upcoming, closed } = groupAndOrderProfileCards(cards);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Fichas</h1>
        <p className="text-sm text-text-muted">
          Una ficha por cada split en el que participas: alias, profesion y avatar son propios de cada split.
        </p>
      </div>

      {cards.length === 0 ? (
        <EmptyState>Todavia no participas en ningun split.</EmptyState>
      ) : (
        <>
          {active.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">Splits activos</h2>
              <div className="space-y-3">
                {active.map((card) => (
                  <ProfileSplitCard key={card.splitParticipantId} card={card} />
                ))}
              </div>
            </section>
          )}

          {upcoming.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-text-muted">Proximos splits</h2>
              <div className="space-y-3">
                {upcoming.map((card) => (
                  <ProfileSplitCard key={card.splitParticipantId} card={card} />
                ))}
              </div>
            </section>
          )}

          {closed.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-base font-semibold text-text-muted">Splits finalizados</h2>
              <div className="space-y-3">
                {closed.map((card) => (
                  <ProfileSplitCard key={card.splitParticipantId} card={card} />
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

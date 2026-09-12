import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { DomainError } from "@/lib/errors";
import { getCharacterConfig } from "@/server/services/character-config.service";
import { formatPoweredKpis } from "@/domain/profession-display";
import { PROFESSION_BONUS_LABEL } from "@/domain/profession-bonus";
import { SPLIT_STATUS_LABELS } from "@/lib/labels";
import { Badge } from "@/components/ui";
import { ProfileAvatar } from "@/app/fichas/ProfileAvatar";
import { EquipmentPanel } from "./EquipmentPanel";
import { InventoryPanel } from "./InventoryPanel";
import { MarketPanel } from "./MarketPanel";
import { HistoryPanel } from "./HistoryPanel";

const STATUS_TONE: Record<string, "slate" | "green" | "gray"> = {
  DRAFT: "slate",
  ACTIVE: "green",
  CLOSED: "gray",
};

/**
 * Configuracion privada del personaje (`0.9.0` / MVP-2D, parte I del
 * encargo): resumen, equipo, inventario, mercado e historial de una
 * participacion de split concreta. Resuelve siempre la persona desde
 * `session.user.personId`; nunca acepta un `personId` del navegador. Un
 * `ADMIN` vinculado a una persona solo puede usar su propia participacion en
 * esta ruta.
 */
export default async function CharacterConfigPage({ params }: { params: { splitParticipantId: string } }) {
  const session = await requireSession();
  const personId = session.user.personId;
  if (!personId) {
    notFound();
  }

  let character;
  try {
    character = await getCharacterConfig(prisma, personId, params.splitParticipantId);
  } catch (error) {
    if (error instanceof DomainError) notFound();
    throw error;
  }

  return (
    <div className="space-y-8">
      <div>
        <Link href="/fichas" className="text-sm text-text-muted underline hover:text-ink">
          &larr; Volver a Fichas
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <ProfileAvatar splitParticipantId={character.splitParticipantId} alias={character.alias} avatarVersion={character.avatarVersion} size={64} />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold">Configurar personaje</h1>
              <Badge tone={STATUS_TONE[character.splitStatus]}>{SPLIT_STATUS_LABELS[character.splitStatus]}</Badge>
            </div>
            <p className="text-sm text-text-muted">
              {character.splitName} · {character.alias}
            </p>
          </div>
        </div>
      </div>

      <section id="resumen" className="space-y-3">
        <h2 className="text-lg font-semibold">Resumen</h2>
        <dl className="grid grid-cols-2 gap-4 rounded-card border border-border bg-surface p-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-text-muted">Nivel tecnico</dt>
            <dd className="font-medium">{character.level}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Faccion</dt>
            <dd className="font-medium">{character.faction?.name ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Profesion</dt>
            <dd className="font-medium">
              {character.profession ? (
                <>
                  {character.profession.name}
                  <span className="block text-xs font-normal text-text-muted">{formatPoweredKpis(character.profession)}</span>
                  <span className="block text-xs font-normal text-text-muted">{PROFESSION_BONUS_LABEL}</span>
                </>
              ) : (
                "—"
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Moneda actual</dt>
            <dd className="font-medium">{character.balance} creditos</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Total puntos KPI oficiales</dt>
            <dd className="font-medium">{character.totalOfficialKpiPoints.toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Total puntos de posicion</dt>
            <dd className="font-medium">{character.totalPositionPoints}</dd>
          </div>
          <div>
            <dt className="text-xs text-text-muted">Semanas publicadas</dt>
            <dd className="font-medium">{character.publishedWeekCount}</dd>
          </div>
          {character.activeLocation && (
            <div className="col-span-2 sm:col-span-3">
              <dt className="text-xs text-text-muted">Localizacion activa esta semana</dt>
              <dd className="font-medium">
                {character.activeLocation.name} · {character.activeLocation.kpiName} · {character.activeLocation.bonusLabel}
              </dd>
            </div>
          )}
        </dl>
        {character.hasPublishedResults && (
          <p className="text-sm">
            <Link href={`/resultados?vista=por-split&split=${character.splitId}`} className="underline hover:text-ink">
              Ver mis resultados de este split
            </Link>
          </p>
        )}
      </section>

      <section id="equipo" className="space-y-3 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">Equipo</h2>
        <EquipmentPanel
          splitParticipantId={character.splitParticipantId}
          slots={character.equipment}
          inventory={character.inventory}
          editable={character.splitStatus === "ACTIVE"}
        />
      </section>

      <section id="inventario" className="space-y-3 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">Inventario</h2>
        <InventoryPanel items={character.inventory} />
      </section>

      <section id="mercado" className="space-y-3 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">Mercado</h2>
        <MarketPanel
          splitParticipantId={character.splitParticipantId}
          marketStatus={character.marketStatus}
          balance={character.balance}
          catalog={character.storeCatalog}
        />
      </section>

      <section id="historial" className="space-y-3 border-t border-border pt-6">
        <h2 className="text-lg font-semibold">Historial</h2>
        <HistoryPanel ledger={character.ledger} weekLocations={character.weekLocations} />
      </section>
    </div>
  );
}

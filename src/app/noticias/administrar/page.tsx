import { prisma } from "@/lib/prisma";
import { requireAdminSession } from "@/lib/session";
import { listSplitsWithParticipantCount } from "@/server/services/split.service";
import { listFactionsForSplit } from "@/server/services/faction.service";
import { listParticipantsForSplit } from "@/server/services/participant.service";
import { previewManualNewsAudience, listManualNewsHistory, generateIdempotencyKey } from "@/server/services/news-manual.service";
import { PageHeader, Card, SectionHeader } from "@/components/ui";
import { AudienceSelectorForm } from "./AudienceSelectorForm";
import { ManualNewsSendForm } from "./ManualNewsSendForm";
import { ManualNewsHistory } from "./ManualNewsHistory";

/**
 * Envio manual de noticias (`1.0.0` / MVP-3, ver docs/NEWS_CENTER.md,
 * seccion 40 del encargo). Solo `ADMIN`: la pagina vuelve a comprobar la
 * sesion en servidor ademas del middleware.
 */
export default async function AdministrarNoticiasPage({
  searchParams,
}: {
  searchParams: { splitId?: string; audienceType?: string; factionId?: string; splitParticipantId?: string };
}) {
  await requireAdminSession();

  const splitId = searchParams.splitId ?? "";
  const audienceType = searchParams.audienceType === "FACTION" || searchParams.audienceType === "PERSON" ? searchParams.audienceType : "SPLIT";
  const factionId = searchParams.factionId ?? "";
  const splitParticipantId = searchParams.splitParticipantId ?? "";

  const [splits, history] = await Promise.all([listSplitsWithParticipantCount(prisma), listManualNewsHistory(prisma)]);

  const factions = splitId ? await listFactionsForSplit(prisma, splitId) : [];
  const participants = splitId ? await listParticipantsForSplit(prisma, splitId) : [];

  let recipientCount = 0;
  if (splitId) {
    try {
      const audience =
        audienceType === "FACTION" && factionId
          ? ({ audienceType: "FACTION", factionId } as const)
          : audienceType === "PERSON" && splitParticipantId
            ? ({ audienceType: "PERSON", splitParticipantId } as const)
            : ({ audienceType: "SPLIT" } as const);
      const preview = await previewManualNewsAudience(prisma, splitId, audience);
      recipientCount = preview.recipientCount;
    } catch {
      recipientCount = 0;
    }
  }

  const canSend =
    splitId !== "" && (audienceType === "SPLIT" || (audienceType === "FACTION" && factionId !== "") || (audienceType === "PERSON" && splitParticipantId !== ""));

  return (
    <div className="space-y-6">
      <PageHeader title="Enviar noticia" description="Mensaje manual segmentado por split, facción o persona (sección 40 del encargo)." />

      <Card className="space-y-4">
        <SectionHeader title="Destinatarios" />
        <AudienceSelectorForm
          splits={splits.map((split) => ({ id: split.id, name: split.name }))}
          selectedSplitId={splitId}
          audienceType={audienceType}
          factions={factions.map((faction) => ({ id: faction.id, name: faction.name }))}
          selectedFactionId={factionId}
          participants={participants.map((participant) => ({ id: participant.id, alias: participant.alias }))}
          selectedParticipantId={splitParticipantId}
        />

        {canSend ? (
          <ManualNewsSendForm
            splitId={splitId}
            audienceType={audienceType}
            factionId={factionId}
            splitParticipantId={splitParticipantId}
            recipientCount={recipientCount}
            idempotencyKey={generateIdempotencyKey()}
          />
        ) : (
          <p className="text-sm text-text-muted">Selecciona un split y un publico para redactar el mensaje.</p>
        )}
      </Card>

      <div className="space-y-3">
        <SectionHeader title="Historial de envios" />
        <ManualNewsHistory entries={history} />
      </div>
    </div>
  );
}

"use client";

import type { PresentationFaction, PresentationParticipant } from "@/server/services/results-presentation.service";
import { formatPoints } from "@/lib/format";

/**
 * Tarjetas de revelacion de "Presentar resultados" (`1.0.1`, parte I del
 * encargo): composicion original coherente con "Prisma competitivo" (no
 * una copia literal de capturas antiguas de PowerPoint), ambar para el
 * primer puesto, azul/violeta como estructura, color de faccion solo como
 * acento de identidad. `animated` se desactiva con `prefers-reduced-motion`.
 */

function AvatarOrInitials({ splitParticipantId, alias, avatarVersion, size }: { splitParticipantId: string; alias: string; avatarVersion: string | null; size: number }) {
  const initials = alias
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");

  if (!avatarVersion) {
    return (
      <span
        aria-hidden
        className="flex shrink-0 items-center justify-center rounded-full bg-white/10 font-semibold text-white"
        style={{ width: size, height: size, fontSize: Math.round(size / 2.8) }}
      >
        {initials || "?"}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- imagen privada servida por su propia ruta protegida, decorativa en la presentacion.
    <img
      src={`/api/fichas/${splitParticipantId}/avatar?v=${avatarVersion}`}
      alt=""
      aria-hidden
      width={size}
      height={size}
      className="shrink-0 rounded-full border border-white/20 object-cover"
      style={{ width: size, height: size }}
    />
  );
}

const RANK_EMPHASIS: Record<number, string> = {
  1: "border-reward bg-reward-soft/10 text-reward scale-[1.03]",
  2: "border-white/40 text-white",
  3: "border-white/25 text-white",
};

export function ParticipantRevealCard({
  entry,
  pointsLabel,
}: {
  entry: PresentationParticipant;
  pointsLabel: string;
}) {
  const emphasis = RANK_EMPHASIS[entry.rank] ?? "border-white/15 text-white";
  return (
    <div className={`animate-reveal-in flex items-center gap-4 rounded-card border bg-white/5 p-4 ${emphasis}`}>
      <span className="tabular w-10 shrink-0 text-center text-2xl font-bold">{entry.rank}</span>
      <AvatarOrInitials splitParticipantId={entry.splitParticipantId} alias={entry.alias} avatarVersion={entry.avatarVersion} size={48} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-lg font-semibold">{entry.alias}</p>
        <p className="text-sm text-white/70">{pointsLabel}</p>
      </div>
      <span className="tabular shrink-0 text-2xl font-bold">{formatPoints(entry.points)}</span>
    </div>
  );
}

export function FactionRevealCard({ entry }: { entry: PresentationFaction }) {
  const emphasis = RANK_EMPHASIS[entry.rank] ?? "border-white/15 text-white";
  return (
    <div className={`animate-reveal-in rounded-card border bg-white/5 p-4 ${emphasis}`}>
      <div className="flex items-center gap-4">
        <span className="tabular w-10 shrink-0 text-center text-2xl font-bold">{entry.rank}</span>
        <span aria-hidden className="h-6 w-6 shrink-0 rounded-full border border-white/40" style={{ backgroundColor: entry.color }} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold">{entry.name}</p>
          <p className="text-sm text-white/70">Puntuación de facción (suma de los tres mejores)</p>
        </div>
        <span className="tabular shrink-0 text-2xl font-bold">{formatPoints(entry.score)}</span>
      </div>
      {entry.topContributors.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 pl-14 text-xs text-white/60">
          {entry.topContributors.map((contributor) => (
            <li key={contributor.alias}>
              {contributor.alias}: {formatPoints(contributor.positionPoints)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

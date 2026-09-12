"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { SplitResultsPresentationData, PresentationParticipant, PresentationFaction } from "@/server/services/results-presentation.service";
import { buildRevealGroups } from "@/domain/results-presentation-reveal";
import { formatCalendarDateEs } from "@/lib/dates";
import { formatPoints } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { ParticipantRevealCard, FactionRevealCard } from "./PresentationCards";

type RevealPhaseKey = "weekly-individual" | "general-individual" | "weekly-faction" | "general-faction";
type Phase = "cover" | RevealPhaseKey | "summary";

const AUTO_ADVANCE_MS = 3000;

const PHASE_TITLES: Record<RevealPhaseKey, string> = {
  "weekly-individual": "Clasificación semanal individual",
  "general-individual": "Clasificación general individual",
  "weekly-faction": "Clasificación semanal de facciones",
  "general-faction": "Clasificación general de facciones",
};

function isInteractiveElement(element: Element | null): boolean {
  if (!element) return false;
  const tag = element.tagName;
  return tag === "BUTTON" || tag === "A" || tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

/**
 * Modo de proyeccion de "Presentar resultados" (`1.0.1`, parte I del
 * encargo). Se renderiza como un lienzo fijo a pantalla completa que cubre
 * por completo la barra lateral y la cabecera de la aplicacion (`z-50`,
 * `position: fixed`, `inset-0`): no hace falta reestructurar el layout raiz
 * ni depender de la API de pantalla completa del navegador para verse
 * inmersivo, aunque tambien ofrece activarla. El estado de la revelacion es
 * puramente local a React: nunca se guarda en Prisma, nunca genera
 * noticias ni modifica la semana.
 */
export function PresentationView({ splitId, data }: { splitId: string; data: SplitResultsPresentationData }) {
  const phases = useMemo<Phase[]>(() => {
    const revealPhases: RevealPhaseKey[] = ["weekly-individual", "general-individual"];
    if (data.hasFactionData) revealPhases.push("weekly-faction", "general-faction");
    return ["cover", ...revealPhases, "summary"];
  }, [data.hasFactionData]);

  const revealGroupsByPhase = useMemo(() => {
    const groups: Partial<Record<RevealPhaseKey, (PresentationParticipant | PresentationFaction)[][]>> = {
      "weekly-individual": buildRevealGroups(data.weeklyIndividualTop),
      "general-individual": buildRevealGroups(data.generalIndividualTop),
    };
    if (data.hasFactionData) {
      groups["weekly-faction"] = buildRevealGroups(data.weeklyFactionTop);
      groups["general-faction"] = buildRevealGroups(data.generalFactionTop);
    }
    return groups;
  }, [data]);

  const [phaseIndex, setPhaseIndex] = useState(0);
  const [revealedCount, setRevealedCount] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [summaryTab, setSummaryTab] = useState<"individual" | "facciones">("individual");
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const phase = phases[phaseIndex] ?? "cover";
  const currentGroups = useMemo(
    () => (phase === "cover" || phase === "summary" ? [] : (revealGroupsByPhase[phase] ?? [])),
    [phase, revealGroupsByPhase],
  );

  useEffect(() => {
    setFullscreenSupported(typeof document !== "undefined" && Boolean(document.documentElement.requestFullscreen));
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Bloquea el scroll de la pagina detras del lienzo mientras se presenta (mismo patron que MobileNav).
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function goNext() {
    if (phase === "cover") {
      setPhaseIndex(1);
      return;
    }
    if (phase === "summary") return;
    if (revealedCount < currentGroups.length) {
      setRevealedCount((count) => count + 1);
    } else if (phaseIndex < phases.length - 1) {
      setPhaseIndex((index) => index + 1);
      setRevealedCount(0);
      setPlaying(false);
    }
  }

  function goPrevious() {
    if (phase === "cover") return;
    if (revealedCount > 0) {
      setRevealedCount((count) => count - 1);
      return;
    }
    if (phaseIndex === 0) return;
    const previousIndex = phaseIndex - 1;
    const previousPhase = phases[previousIndex];
    const previousGroups = previousPhase === "cover" || previousPhase === "summary" ? [] : (revealGroupsByPhase[previousPhase as RevealPhaseKey] ?? []);
    setPhaseIndex(previousIndex);
    setRevealedCount(previousGroups.length);
    setPlaying(false);
  }

  function restartPhase() {
    setRevealedCount(0);
    setPlaying(false);
  }

  function skipPhase() {
    if (phase === "cover" || phase === "summary") return;
    setRevealedCount(currentGroups.length);
    setPlaying(false);
  }

  function togglePlaying() {
    if (phase === "cover" || phase === "summary") return;
    setPlaying((value) => !value);
  }

  function restartPresentation() {
    setPhaseIndex(0);
    setRevealedCount(0);
    setPlaying(false);
  }

  // Avance automatico: solo mientras se reproduce y queden grupos por revelar en la fase actual.
  useEffect(() => {
    if (!playing) return;
    if (phase === "cover" || phase === "summary") return;
    if (revealedCount >= currentGroups.length) {
      setPlaying(false);
      return;
    }
    const timer = setTimeout(() => setRevealedCount((count) => count + 1), AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [playing, phase, revealedCount, currentGroups]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (document.fullscreenElement) document.exitFullscreen().catch(() => undefined);
        return;
      }
      if (isInteractiveElement(document.activeElement)) return;
      if (event.key === " ") {
        event.preventDefault();
        togglePlaying();
      } else if (event.key === "ArrowRight" || event.key === "Enter") {
        goNext();
      } else if (event.key === "ArrowLeft") {
        goPrevious();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- las funciones se recrean cada render pero leen el estado mas reciente via closure; no hace falta memoizarlas para este control interno.
  });

  function enterFullscreen() {
    containerRef.current?.requestFullscreen?.().catch(() => undefined);
  }

  const weekIntervalLabel = `Semana del ${formatCalendarDateEs(data.weekStartDate)} al ${formatCalendarDateEs(data.weekEndDate)}`;

  const liveMessage = useMemo(() => {
    if (phase === "cover") return `${data.splitName}: presentación lista para comenzar.`;
    if (phase === "summary") return "Resumen final de la clasificación general.";
    if (revealedCount === 0) return `${PHASE_TITLES[phase]}: sin revelar todavía.`;
    const group = currentGroups[revealedCount - 1] ?? [];
    const rank = group[0]?.rank;
    const names = group.map((entry) => ("alias" in entry ? entry.alias : entry.name)).join(", ");
    return `Se revela la posición ${rank}: ${names}.`;
  }, [phase, revealedCount, currentGroups, data.splitName]);

  return (
    <div ref={containerRef} className="fixed inset-0 z-50 flex flex-col bg-ink text-white">
      <div aria-live="polite" className="sr-only">
        {liveMessage}
      </div>

      <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 sm:px-8">
        <p className="truncate text-sm font-medium text-white/70">{data.splitName} · Resultados semanales</p>
        <div className="flex items-center gap-2">
          {fullscreenSupported && !isFullscreen && (
            <button
              type="button"
              onClick={enterFullscreen}
              className="inline-flex items-center gap-1.5 rounded-control border border-white/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
            >
              <Icon name="Maximize" className="h-3.5 w-3.5" />
              Entrar en pantalla completa
            </button>
          )}
          <Link
            href={`/splits/${splitId}`}
            className="inline-flex items-center gap-1.5 rounded-control border border-white/20 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
          >
            <Icon name="X" className="h-3.5 w-3.5" />
            Salir de la presentación
          </Link>
        </div>
      </header>

      {/* `<div>`, no `<main>`: esta vista se monta dentro del `<main>` global de AppShell (cubierto
          visualmente por el lienzo fijo), y dos landmarks `main` en la misma pagina serian invalidos. */}
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-4 py-8 sm:px-8">
        {phase === "cover" && (
          <div className="flex max-w-xl flex-col items-center gap-4 text-center">
            <h1 className="text-3xl font-bold sm:text-4xl">{data.splitName}</h1>
            <p className="text-lg text-white/80">Resultados semanales</p>
            <p className="tabular text-white/70">{weekIntervalLabel}</p>
            <span className="inline-block rounded-full bg-success-soft px-3 py-1 text-sm font-medium text-success">Publicado</span>
            <button
              type="button"
              onClick={goNext}
              className="mt-4 rounded-control bg-primary px-6 py-3 text-base font-semibold text-white hover:bg-primary-hover"
            >
              Comenzar presentación
            </button>
          </div>
        )}

        {phase !== "cover" && phase !== "summary" && (
          <div className="w-full max-w-2xl space-y-4">
            <div className="text-center">
              <h2 className="text-2xl font-bold">{PHASE_TITLES[phase]}</h2>
              <p className="tabular text-sm text-white/60">{weekIntervalLabel}</p>
            </div>
            <div className="space-y-3">
              {currentGroups.slice(0, revealedCount).map((group, groupIndex) =>
                group.map((entry) =>
                  "alias" in entry ? (
                    <ParticipantRevealCard
                      key={entry.splitParticipantId}
                      entry={entry}
                      pointsLabel={phase === "weekly-individual" ? "Puntos KPI de la semana" : "Puntos por posición acumulados"}
                    />
                  ) : (
                    <FactionRevealCard key={`${groupIndex}-${entry.factionId}`} entry={entry} />
                  ),
                ),
              )}
              {revealedCount === 0 && <p className="text-center text-white/50">Pulsa &quot;Siguiente&quot; para empezar a revelar posiciones.</p>}
            </div>
          </div>
        )}

        {phase === "summary" && (
          <div className="w-full max-w-3xl space-y-4">
            <h2 className="text-center text-2xl font-bold">Clasificación general individual</h2>
            {data.hasFactionData && (
              <div className="flex justify-center gap-2 text-sm">
                <button
                  type="button"
                  onClick={() => setSummaryTab("individual")}
                  className={`rounded-control px-3 py-1.5 ${summaryTab === "individual" ? "bg-primary text-white" : "border border-white/20 text-white/70"}`}
                >
                  Individual
                </button>
                <button
                  type="button"
                  onClick={() => setSummaryTab("facciones")}
                  className={`rounded-control px-3 py-1.5 ${summaryTab === "facciones" ? "bg-primary text-white" : "border border-white/20 text-white/70"}`}
                >
                  Clasificación general de facciones
                </button>
              </div>
            )}

            {summaryTab === "individual" ? (
              <div className="max-h-[60vh] overflow-y-auto rounded-card border border-white/15">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/15 bg-white/5 text-white/70">
                    <tr>
                      <th className="px-3 py-2">Posición</th>
                      <th className="px-3 py-2">Alias</th>
                      <th className="px-3 py-2 text-right">Puntos por posición</th>
                      <th className="px-3 py-2 text-right">Puntos KPI acumulados</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.generalIndividualFull.map((row) => (
                      <tr key={row.splitParticipantId} className="border-b border-white/10 last:border-b-0">
                        <td className="tabular px-3 py-2">{row.rank}</td>
                        <td className="px-3 py-2">{row.alias}</td>
                        <td className="tabular px-3 py-2 text-right font-semibold">{row.totalPositionPoints}</td>
                        <td className="tabular px-3 py-2 text-right text-white/70">{formatPoints(row.totalKpiPoints)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="max-h-[60vh] overflow-y-auto rounded-card border border-white/15">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-white/15 bg-white/5 text-white/70">
                    <tr>
                      <th className="px-3 py-2">Posición</th>
                      <th className="px-3 py-2">Facción</th>
                      <th className="px-3 py-2 text-right">Puntuacion acumulada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.generalFactionFull.map((row) => (
                      <tr key={row.factionId} className="border-b border-white/10 last:border-b-0">
                        <td className="tabular px-3 py-2">{row.rank}</td>
                        <td className="px-3 py-2">
                          <span className="inline-flex items-center gap-2">
                            <span aria-hidden className="h-3 w-3 rounded-full border border-white/40" style={{ backgroundColor: row.color }} />
                            {row.name}
                          </span>
                        </td>
                        <td className="tabular px-3 py-2 text-right font-semibold">{formatPoints(row.totalScore)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <button type="button" onClick={restartPresentation} className="rounded-control border border-white/20 px-4 py-2 text-sm font-medium hover:bg-white/10">
                Repetir presentación
              </button>
              <Link href={`/splits/${splitId}`} className="rounded-control bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover">
                Volver al split
              </Link>
            </div>
          </div>
        )}
      </div>

      {phase !== "cover" && phase !== "summary" && (
        <footer className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 px-4 py-3 sm:px-8">
          <button type="button" onClick={goPrevious} className="inline-flex items-center gap-1.5 rounded-control border border-white/20 px-3 py-2 text-sm hover:bg-white/10">
            <Icon name="SkipBack" className="h-4 w-4" />
            Anterior
          </button>
          <button type="button" onClick={togglePlaying} className="inline-flex items-center gap-1.5 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover">
            <Icon name={playing ? "Pause" : "Play"} className="h-4 w-4" />
            {playing ? "Pausar" : "Reanudar"}
          </button>
          <button type="button" onClick={goNext} className="inline-flex items-center gap-1.5 rounded-control border border-white/20 px-3 py-2 text-sm hover:bg-white/10">
            Siguiente
            <Icon name="SkipForward" className="h-4 w-4" />
          </button>
          <button type="button" onClick={restartPhase} className="inline-flex items-center gap-1.5 rounded-control border border-white/20 px-3 py-2 text-sm hover:bg-white/10">
            <Icon name="RotateCcw" className="h-4 w-4" />
            Reiniciar fase
          </button>
          <button type="button" onClick={skipPhase} className="rounded-control border border-white/20 px-3 py-2 text-sm hover:bg-white/10">
            Saltar fase
          </button>
        </footer>
      )}
    </div>
  );
}

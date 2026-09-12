import { describe, expect, it } from "vitest";
import { resolveHistoryDisplayConfig, HISTORY_MEDIA_HELP_NOTE } from "@/domain/history-display";

/**
 * Pruebas acotadas de la parte E del encargo `1.0.1`: la agrupacion
 * `Semana` oculta la media (siempre coincidiria con la suma de una unica
 * semana) y `Mes`/`Año` la muestran con la nota de ayuda accesible.
 */
describe("resolveHistoryDisplayConfig", () => {
  it("agrupacion Semana oculta media por KPI, columna de media y columna de semanas publicadas", () => {
    const config = resolveHistoryDisplayConfig("semana");
    expect(config.showPerKpiAverage).toBe(false);
    expect(config.showAverageKpiColumn).toBe(false);
    expect(config.showPublishedWeeksColumn).toBe(false);
    expect(config.helpNote).toBeNull();
  });

  it("agrupacion Mes muestra media semanal con nota de ayuda", () => {
    const config = resolveHistoryDisplayConfig("mes");
    expect(config.showPerKpiAverage).toBe(true);
    expect(config.showAverageKpiColumn).toBe(true);
    expect(config.showPublishedWeeksColumn).toBe(true);
    expect(config.averageKpiColumnHeader).toBe("Media semanal total KPI");
    expect(config.helpNote).toBe(HISTORY_MEDIA_HELP_NOTE);
  });

  it("agrupacion Año se comporta igual que Mes", () => {
    const config = resolveHistoryDisplayConfig("año");
    expect(config.showPerKpiAverage).toBe(true);
    expect(config.showAverageKpiColumn).toBe(true);
    expect(config.helpNote).not.toBeNull();
  });
});

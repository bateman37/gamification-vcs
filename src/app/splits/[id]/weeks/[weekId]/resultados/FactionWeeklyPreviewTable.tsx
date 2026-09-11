import { formatPoints } from "@/lib/format";

export interface FactionWeeklyPreviewRow {
  factionId: string;
  name: string;
  color: string;
  weeklyRank: number;
  weeklyScore: number;
  topContributors: { alias: string; positionPoints: number }[];
}

/** Previsualizacion compacta de la clasificacion de facciones, debajo de la tabla individual (seccion 5 de docs/FACTIONS.md). */
export function FactionWeeklyPreviewTable({ rows }: { rows: FactionWeeklyPreviewRow[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-slate-700">Clasificacion de facciones de la semana</h2>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-slate-600">
            <tr>
              <th className="px-3 py-2 font-medium">Pos.</th>
              <th className="px-3 py-2 font-medium">Faccion</th>
              <th className="px-3 py-2 font-medium">Top 3 (Renombre = puntos por posicion)</th>
              <th className="px-3 py-2 text-center font-medium">Suma</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.factionId} className="border-b border-slate-100">
                <td className="px-3 py-2 font-medium">{row.weeklyRank}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="h-3 w-3 rounded-full border border-slate-300" style={{ backgroundColor: row.color }} />
                    {row.name}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600">
                  {row.topContributors.map((contributor) => `${contributor.alias} (${formatPoints(contributor.positionPoints)})`).join(", ")}
                </td>
                <td className="px-3 py-2 text-center font-semibold">{formatPoints(row.weeklyScore)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

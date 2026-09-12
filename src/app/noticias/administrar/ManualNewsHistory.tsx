import { formatCalendarDateEs } from "@/lib/dates";
import { Badge, TableContainer, EmptyState, TABLE_HEAD_ROW_CLASSES, TABLE_ROW_HOVER_CLASSES } from "@/components/ui";
import type { ManualNewsHistoryEntry } from "@/server/services/news-manual.service";

/** Historico de envios manuales (seccion 44 del encargo): nunca muestra quien lo ha leido. */
export function ManualNewsHistory({ entries }: { entries: ManualNewsHistoryEntry[] }) {
  if (entries.length === 0) return <EmptyState>Todavía no se ha enviado ninguna noticia manual.</EmptyState>;

  return (
    <TableContainer>
      <table className="w-full text-left text-sm">
        <thead className={TABLE_HEAD_ROW_CLASSES}>
          <tr>
            <th className="px-3 py-2 font-medium">Fecha</th>
            <th className="px-3 py-2 font-medium">Autor</th>
            <th className="px-3 py-2 font-medium">Split</th>
            <th className="px-3 py-2 font-medium">Publico</th>
            <th className="px-3 py-2 font-medium">Prioridad</th>
            <th className="px-3 py-2 font-medium">Titulo / mensaje</th>
            <th className="px-3 py-2 text-right font-medium">Destinatarios</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id} className={TABLE_ROW_HOVER_CLASSES}>
              <td className="px-3 py-2 text-text-muted">{formatCalendarDateEs(entry.createdAt)}</td>
              <td className="px-3 py-2 text-text-muted">{entry.authorEmail ?? "—"}</td>
              <td className="px-3 py-2 text-text-muted">{entry.splitNameSnapshot ?? "—"}</td>
              <td className="px-3 py-2 text-text-muted">{entry.manualAudienceSnapshot ?? "—"}</td>
              <td className="px-3 py-2">{entry.priority === "IMPORTANT" ? <Badge tone="reward">Importante</Badge> : <Badge>Normal</Badge>}</td>
              <td className="px-3 py-2">
                <div className="font-medium text-ink">{entry.title}</div>
                <div className="text-xs text-text-muted">{entry.body}</div>
              </td>
              <td className="tabular px-3 py-2 text-right text-ink">{entry.recipientCount}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableContainer>
  );
}

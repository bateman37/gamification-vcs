import { markAllNewsReadAction } from "@/server/actions/news.actions";

export function MarkAllReadForm() {
  return (
    <form action={markAllNewsReadAction}>
      <button type="submit" className="rounded-control border border-border-strong px-3 py-1.5 text-sm font-medium text-ink hover:bg-surface-muted">
        Marcar todas como leidas
      </button>
    </form>
  );
}

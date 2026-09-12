import Link from "next/link";

export default function SplitNotFound() {
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold">Split no encontrado</h1>
      <p className="text-sm text-text-muted">El split solicitado no existe o ha sido eliminado.</p>
      <Link href="/splits" className="text-sm font-medium text-ink underline">
        Volver al listado de splits
      </Link>
    </div>
  );
}

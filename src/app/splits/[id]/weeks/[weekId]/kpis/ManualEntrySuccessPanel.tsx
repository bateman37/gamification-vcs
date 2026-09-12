import { SuccessMessage } from "@/components/ui";

/**
 * Bloque de exito compartido por los cinco formularios manuales de KPI
 * (ver docs/MANUAL_KPI_ENTRY.md). El enlace "Volver a introducir datos"
 * usa una etiqueta `<a>` normal, nunca `next/link`: apunta a la misma URL
 * que la pantalla actual, y una navegacion client-side de Next.js a la
 * misma ruta no desmonta el Client Component ni reinicia `useFormState`,
 * dejando la pantalla de exito visible para siempre. Una navegacion HTML
 * completa fuerza la recarga del Server Component (que recupera los datos
 * ya guardados desde PostgreSQL) y reinicia el estado local del formulario.
 */
export function ManualEntrySuccessPanel({
  message,
  introducirHref,
  comprobarHref,
  backHref,
}: {
  message: string;
  introducirHref: string;
  comprobarHref: string;
  backHref: string;
}) {
  return (
    <div className="space-y-3">
      <SuccessMessage>{message}</SuccessMessage>
      <div className="flex flex-wrap gap-4 text-sm">
        <a href={comprobarHref} className="underline hover:text-ink">
          Ir a Comprobar
        </a>
        <a href={introducirHref} className="underline hover:text-ink">
          Volver a introducir datos
        </a>
        <a href={backHref} className="underline hover:text-ink">
          Volver a las cargas de la semana
        </a>
      </div>
    </div>
  );
}

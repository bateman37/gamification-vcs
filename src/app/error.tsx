"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-md bg-danger-soft p-6 text-center">
      <h2 className="text-lg font-semibold text-danger-ink">Error de servidor</h2>
      <p className="mt-2 text-sm text-danger-ink">
        Ha ocurrido un problema inesperado. Intentalo de nuevo en unos segundos.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-control bg-danger px-4 py-2 text-sm font-medium text-white hover:bg-danger/90"
      >
        Reintentar
      </button>
    </div>
  );
}

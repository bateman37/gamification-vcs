"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="rounded-md bg-red-50 p-6 text-center">
      <h2 className="text-lg font-semibold text-red-800">Error de servidor</h2>
      <p className="mt-2 text-sm text-red-700">
        Ha ocurrido un problema inesperado. Intentalo de nuevo en unos segundos.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800"
      >
        Reintentar
      </button>
    </div>
  );
}

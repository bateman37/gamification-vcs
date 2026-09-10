import type { ReactNode } from "react";

export function ErrorMessage({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
      {children}
    </p>
  );
}

export function SuccessMessage({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700" role="status">
      {children}
    </p>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">{children}</p>;
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-red-600">{message}</p>;
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "green" | "amber" | "gray" }) {
  const toneClasses: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-green-100 text-green-800",
    amber: "bg-amber-100 text-amber-800",
    gray: "bg-gray-200 text-gray-700",
  };
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}

export function SubmitButton({ children, pending, className = "" }: { children: ReactNode; pending: boolean; className?: string }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {pending ? "Guardando..." : children}
    </button>
  );
}

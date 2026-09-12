import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import Link from "next/link";

/**
 * Componentes compartidos del sistema visual "Prisma competitivo" (`1.0.0`
 * / MVP-3, ver docs/DESIGN_SYSTEM.md). Los nombres y firmas anteriores a
 * esta version (`SubmitButton`, `Badge`, `ErrorMessage`, `SuccessMessage`,
 * `EmptyState`, `FieldError`) se mantienen intactos para no romper los mas
 * de setenta componentes que ya los usan: solo cambian sus clases
 * internas, ahora basadas en los tokens semanticos de Tailwind en vez de
 * colores `slate`/`green`/`amber`/`red` sueltos.
 */

// --- Botones -------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const BUTTON_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-hover",
  secondary: "border border-border-strong bg-surface text-ink hover:bg-surface-muted",
  ghost: "bg-transparent text-ink hover:bg-surface-muted",
  danger: "bg-danger text-white hover:bg-danger/90",
};

const BUTTON_BASE_CLASSES =
  "inline-flex items-center justify-center gap-2 rounded-control px-4 py-2 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60";

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button className={`${BUTTON_BASE_CLASSES} ${BUTTON_VARIANT_CLASSES[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function LinkButton({
  children,
  variant = "secondary",
  className = "",
  href,
  ...props
}: AnchorHTMLAttributes<HTMLAnchorElement> & { variant?: ButtonVariant; href: string }) {
  return (
    <Link href={href} className={`${BUTTON_BASE_CLASSES} ${BUTTON_VARIANT_CLASSES[variant]} ${className}`} {...props}>
      {children}
    </Link>
  );
}

export function IconButton({
  children,
  label,
  className = "",
  variant = "ghost",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; variant?: ButtonVariant }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-control transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 ${BUTTON_VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/** Conserva el nombre y la firma anteriores (usado en mas de veinte formularios existentes). */
export function SubmitButton({ children, pending, className = "" }: { children: ReactNode; pending: boolean; className?: string }) {
  return (
    <Button type="submit" disabled={pending} variant="primary" className={className}>
      {pending ? "Guardando..." : children}
    </Button>
  );
}

// --- Tarjetas --------------------------------------------------------------

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-card border border-border bg-surface p-4 shadow-soft ${className}`}>{children}</div>;
}

export function StatCard({
  label,
  value,
  helpText,
  tone = "ink",
}: {
  label: string;
  value: ReactNode;
  helpText?: ReactNode;
  tone?: "ink" | "primary" | "game" | "info" | "reward" | "success" | "danger";
}) {
  const valueToneClass: Record<string, string> = {
    ink: "text-ink",
    primary: "text-primary",
    game: "text-game-ink",
    info: "text-info-ink",
    reward: "text-reward-ink",
    success: "text-success",
    danger: "text-danger",
  };
  return (
    <div className="rounded-card border border-border bg-surface p-4 shadow-soft">
      <dt className="text-xs font-medium text-text-muted">{label}</dt>
      <dd className={`tabular mt-1 text-xl font-semibold ${valueToneClass[tone]}`}>{value}</dd>
      {helpText && <dd className="mt-1 text-xs text-text-muted">{helpText}</dd>}
    </div>
  );
}

// --- Cabeceras -------------------------------------------------------------

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function SectionHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {description && <p className="text-sm text-text-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

// --- Mensajes y estados -----------------------------------------------------

export function ErrorMessage({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-control border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger-ink" role="alert">
      {children}
    </p>
  );
}

export function SuccessMessage({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-control border border-success/20 bg-success-soft px-3 py-2 text-sm text-success" role="status">
      {children}
    </p>
  );
}

type AlertTone = "success" | "warning" | "info" | "error";

const ALERT_CLASSES: Record<AlertTone, string> = {
  success: "border-success/20 bg-success-soft text-success",
  warning: "border-reward/30 bg-reward-soft text-reward-ink",
  info: "border-info/20 bg-info-soft text-info-ink",
  error: "border-danger/20 bg-danger-soft text-danger-ink",
};

export function Alert({ tone = "info", children }: { tone?: AlertTone; children: ReactNode }) {
  return (
    <div className={`rounded-control border px-3 py-2 text-sm ${ALERT_CLASSES[tone]}`} role={tone === "error" ? "alert" : "status"}>
      {children}
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="rounded-card border border-dashed border-border-strong px-4 py-6 text-center text-sm text-text-muted">{children}</p>;
}

export function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs text-danger">{message}</p>;
}

// --- Badge -------------------------------------------------------------

type BadgeTone = "slate" | "green" | "amber" | "gray" | "primary" | "game" | "info" | "reward" | "success" | "danger";

const BADGE_TONE_CLASSES: Record<BadgeTone, string> = {
  // Tonos heredados (mas de quince usos existentes): se mapean al tono semantico mas cercano.
  slate: "bg-surface-muted text-text-muted",
  gray: "bg-surface-muted text-text-muted",
  green: "bg-success-soft text-success",
  amber: "bg-reward-soft text-reward-ink",
  primary: "bg-primary-soft text-primary",
  game: "bg-game-soft text-game-ink",
  info: "bg-info-soft text-info-ink",
  reward: "bg-reward-soft text-reward-ink",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger-ink",
};

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${BADGE_TONE_CLASSES[tone]}`}>{children}</span>;
}

// --- Tablas -------------------------------------------------------------

export function TableContainer({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-card border border-border bg-surface">{children}</div>;
}

export const TABLE_HEAD_ROW_CLASSES = "border-b border-border bg-surface-muted text-text-muted";
export const TABLE_ROW_HOVER_CLASSES = "border-b border-border last:border-b-0 hover:bg-surface-muted/60";

// --- Otros -----------------------------------------------------------------

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-control bg-surface-muted ${className}`} />;
}

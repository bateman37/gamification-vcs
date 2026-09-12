import { requireSession } from "@/lib/session";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function ChangePasswordPage() {
  const session = await requireSession();

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Cambiar contrasena</h1>
        <p className="mt-1 text-sm text-text-muted">
          {session.user.mustChangePassword
            ? "Tu contrasena es temporal: debes cambiarla antes de continuar."
            : "Cambia la contrasena de tu cuenta cuando quieras."}
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}

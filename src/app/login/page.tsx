import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  const session = await getCurrentSession();
  if (session?.user) redirect("/");

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Iniciar sesión</h1>
        <p className="mt-1 text-sm text-text-muted">Accede con el correo y la contraseña de tu cuenta.</p>
      </div>
      <LoginForm />
    </div>
  );
}

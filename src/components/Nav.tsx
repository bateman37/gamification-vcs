import Link from "next/link";
import { getCurrentSession } from "@/lib/session";
import { LogoutButton } from "@/components/LogoutButton";

/**
 * Navegacion superior segun sesion (ver docs/AUTHENTICATION.md):
 * administrador ve `Personas`, `Splits` y `Resultados`; participante ve
 * `Resultados` y `Fichas` (`0.8.0` / MVP-2B); sin sesion, solo se muestra el
 * enlace a `Login`. `Fichas` tambien aparece para un administrador vinculado
 * a una persona, porque entonces tiene fichas propias que consultar. La
 * decision real de acceso vive en el middleware y en cada pagina: esta
 * navegacion solo refleja lo que ya es cierto en servidor.
 */
export async function Nav() {
  const session = await getCurrentSession();

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-screen-2xl flex-wrap items-center gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <span className="text-lg font-semibold text-slate-800">Gamification VCS</span>
        <nav className="flex flex-wrap gap-4 text-sm font-medium text-slate-600">
          {session?.user.role === "ADMIN" && (
            <>
              <Link href="/personas" className="hover:text-slate-900">
                Personas
              </Link>
              <Link href="/splits" className="hover:text-slate-900">
                Splits
              </Link>
            </>
          )}
          {session?.user && (
            <Link href="/resultados" className="hover:text-slate-900">
              Resultados
            </Link>
          )}
          {session?.user && (session.user.role === "PARTICIPANT" || session.user.personId) && (
            <Link href="/fichas" className="hover:text-slate-900">
              Fichas
            </Link>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-4 text-sm">
          {session?.user ? (
            <>
              <Link href="/cuenta/cambiar-contrasena" className="text-slate-600 hover:text-slate-900">
                Mi cuenta
              </Link>
              <LogoutButton />
            </>
          ) : (
            <Link href="/login" className="text-slate-600 hover:text-slate-900">
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

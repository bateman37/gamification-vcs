import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";

/**
 * Acceso raiz (`1.0.0` / MVP-3, seccion 13 del encargo): Noticias es el
 * punto de entrada de cualquier usuario autenticado. No elimina los
 * accesos directos existentes (`/personas`, `/splits`, `/resultados`...).
 */
export default async function HomePage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/login");
  redirect("/noticias");
}

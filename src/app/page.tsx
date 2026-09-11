import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";

export default async function HomePage() {
  const session = await getCurrentSession();
  if (!session?.user) redirect("/login");
  redirect(session.user.role === "ADMIN" ? "/personas" : "/resultados");
}

import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * Proteccion de rutas en servidor (ver docs/AUTHENTICATION.md): se ejecuta
 * para cada peticion a las rutas del `matcher`, incluida una URL escrita a
 * mano o un enlace directo, no solo cuando se navega desde la interfaz.
 * `Personas` y `Splits` (y todo lo que cuelga de ellos, incluidas las
 * cargas de KPI, la previsualizacion de resultados y la clasificacion
 * detallada) son exclusivos de administrador; `Resultados`, `Fichas`
 * (`0.8.0` / MVP-2B) y `Cuenta` son para cualquier usuario autenticado (la
 * autorizacion fina dentro de `Resultados` y `Fichas`, como que persona ve o
 * edita cada uno, se resuelve en servidor a partir de la sesion, nunca de un
 * parametro del navegador).
 */
export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const path = req.nextUrl.pathname;

    if (token?.mustChangePassword && path !== "/cuenta/cambiar-contrasena") {
      return NextResponse.redirect(new URL("/cuenta/cambiar-contrasena", req.url));
    }

    // `/noticias/administrar` (envio manual, seccion 40 del encargo) es exclusivo de administrador,
    // igual que `Personas` y `Splits`; el resto de `/noticias` es para cualquier usuario autenticado.
    const isAdminOnlyPath = path.startsWith("/personas") || path.startsWith("/splits") || path.startsWith("/noticias/administrar");
    if (isAdminOnlyPath && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/noticias", req.url));
    }

    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      authorized: ({ token }) => Boolean(token),
    },
  },
);

export const config = {
  matcher: ["/personas/:path*", "/splits/:path*", "/resultados/:path*", "/fichas/:path*", "/cuenta/:path*", "/noticias/:path*"],
};

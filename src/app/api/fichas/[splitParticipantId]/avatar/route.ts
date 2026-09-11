import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { readAvatarForViewer } from "@/server/services/participant-profile.service";

/**
 * Sirve el avatar de una participacion (`0.8.0` / MVP-2B, seccion 22 del
 * encargo). Autorizacion resuelta siempre en servidor desde la sesion:
 *
 * - `PARTICIPANT`: solo la ficha vinculada a su propio `personId`;
 * - `ADMIN`: cualquiera.
 *
 * Un intento de leer la ficha de otra persona devuelve `404`, igual que una
 * ficha inexistente: no se revela si existe. Nunca se expone ninguna ruta
 * del sistema de archivos; los bytes viven en PostgreSQL.
 */
export async function GET(
  _request: Request,
  { params }: { params: { splitParticipantId: string } },
): Promise<NextResponse> {
  const session = await getCurrentSession();
  if (!session?.user) {
    return new NextResponse(null, { status: 401 });
  }

  const avatar = await readAvatarForViewer(prisma, params.splitParticipantId, {
    isAdmin: session.user.role === "ADMIN",
    personId: session.user.personId ?? null,
  });
  if (!avatar) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(avatar.data), {
    status: 200,
    headers: {
      "Content-Type": avatar.mimeType,
      "Content-Length": String(avatar.data.byteLength),
      // El MIME final es real (siempre el de la imagen ya procesada): `nosniff` impide que el
      // navegador intente interpretarla como otra cosa.
      "X-Content-Type-Options": "nosniff",
      // Cache privada: el avatar es un dato de una ficha concreta, nunca compartido por un proxy.
      "Cache-Control": "private, max-age=0, must-revalidate",
      ETag: `"${avatar.sha256}"`,
      "Content-Disposition": "inline",
    },
  });
}

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { readFactionImageForViewer } from "@/server/services/faction-image.service";

/**
 * Sirve el emblema de una faccion (`1.2.2`, ver docs/FACTIONS.md). Mismo
 * patron que la ruta de imagen de objeto: la autorizacion se resuelve
 * siempre en servidor desde la sesion.
 *
 * - `ADMIN`: cualquier faccion;
 * - participante: solo facciones de un split en el que participa.
 *
 * Una faccion inexistente y un acceso cruzado devuelven ambos `404`: no se
 * revela si la faccion existe. Nunca se expone ninguna ruta del sistema de
 * archivos; los bytes viven en PostgreSQL.
 */
export async function GET(
  request: Request,
  { params }: { params: { splitId: string; factionId: string } },
): Promise<NextResponse> {
  const session = await getCurrentSession();
  if (!session?.user) {
    return new NextResponse(null, { status: 401 });
  }

  const image = await readFactionImageForViewer(prisma, params.splitId, params.factionId, {
    isAdmin: session.user.role === "ADMIN",
    personId: session.user.personId ?? null,
  });
  if (!image) {
    return new NextResponse(null, { status: 404 });
  }

  const etag = `"${image.sha256}"`;
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers: { ETag: etag } });
  }

  return new NextResponse(new Uint8Array(image.data), {
    status: 200,
    headers: {
      "Content-Type": image.mimeType,
      "Content-Length": String(image.data.byteLength),
      // El MIME final es real (siempre el de la imagen ya procesada): `nosniff` impide que el
      // navegador intente interpretarla como otra cosa.
      "X-Content-Type-Options": "nosniff",
      // Cache privada: el emblema pertenece a una faccion de un split concreto, nunca la comparte un proxy.
      "Cache-Control": "private, max-age=0, must-revalidate",
      ETag: etag,
      "Content-Disposition": "inline",
    },
  });
}

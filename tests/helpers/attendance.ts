import type { PrismaClient } from "@prisma/client";
import { getChronomancyFormView, saveChronomancyEntries } from "@/server/services/chronomancy-entry.service";

/**
 * Helper de pruebas (`1.1.1`, ver docs/WEEKLY_ATTENDANCE_AND_HOURS.md): las
 * horas semanales son ahora un requisito obligatorio para publicar,
 * independiente de si `WORK_CHRONOMANCY` esta activo. Marca a todos los
 * participantes aplicables de una semana como presentes con `totalHours`
 * horas (40 por defecto), reutilizando el mismo camino de guardado real
 * (`saveChronomancyEntries`) que usa la aplicacion.
 */
export async function markAllPresent(db: PrismaClient, splitId: string, weekId: string, totalHours = 40): Promise<void> {
  const formView = await getChronomancyFormView(db, splitId, weekId);
  const formData = new FormData();
  for (const row of formView.rows) {
    formData.set(`totalHours__${row.participantId}`, String(totalHours));
    if (row.productiveHoursApplicable) {
      formData.set(`productiveHours__${row.participantId}`, "0");
    }
  }
  await saveChronomancyEntries(db, splitId, weekId, formData);
}

/** Marca a un unico participante como ausente (`totalHours = 0`) para una semana ya con horas guardadas para el resto, sin tocar las demas filas. */
export async function markParticipantAbsent(db: PrismaClient, splitId: string, weekId: string, participantId: string): Promise<void> {
  const formView = await getChronomancyFormView(db, splitId, weekId);
  const formData = new FormData();
  for (const row of formView.rows) {
    const isTarget = row.participantId === participantId;
    formData.set(`totalHours__${row.participantId}`, isTarget ? "0" : String(row.totalHours ?? 40));
    if (row.productiveHoursApplicable) {
      formData.set(`productiveHours__${row.participantId}`, isTarget ? "0" : String(row.productiveHours ?? 0));
    }
  }
  await saveChronomancyEntries(db, splitId, weekId, formData);
}

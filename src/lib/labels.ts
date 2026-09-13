import type { ParticipantLevel, SplitStatus } from "@prisma/client";

export const SPLIT_STATUS_LABELS: Record<SplitStatus, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  // `1.2.2`: reutiliza el estado terminal existente `CLOSED`, solo cambia su etiqueta visible.
  CLOSED: "Finalizado",
};

export const PARTICIPANT_LEVEL_LABELS: Record<ParticipantLevel, string> = {
  N0: "N0",
  N1: "N1",
  N2: "N2",
};

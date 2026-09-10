import type { ParticipantLevel, SplitStatus } from "@prisma/client";

export const SPLIT_STATUS_LABELS: Record<SplitStatus, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  CLOSED: "Cerrado",
};

export const PARTICIPANT_LEVEL_LABELS: Record<ParticipantLevel, string> = {
  N0: "N0",
  N1: "N1",
  N2: "N2",
};

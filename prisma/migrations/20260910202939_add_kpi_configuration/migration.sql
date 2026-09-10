-- CreateEnum
-- El orden de los valores coincide con el orden de presentacion del
-- catalogo (ver src/domain/kpis/catalog.ts): PostgreSQL ordena los enums
-- por orden de declaracion, no alfabeticamente.
CREATE TYPE "KpiCode" AS ENUM ('SOLUTION_HUNTER', 'DATA_EXPLORER', 'VOICE_AMBASSADOR', 'MASTER_CRAFTSMAN', 'ESCALATION_TAMER', 'STABILITY_GUARDIAN', 'WORK_CHRONOMANCY', 'STAR_WRITER', 'ENTHUSIASTIC_STUDENT', 'EXPERT_APPRENTICE');

-- CreateTable
CREATE TABLE "SplitKpiConfig" (
    "id" TEXT NOT NULL,
    "splitId" TEXT NOT NULL,
    "kpiCode" "KpiCode" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "baseMax" DECIMAL(12,4) NOT NULL,
    "multiplierN0" DECIMAL(12,4),
    "multiplierN1" DECIMAL(12,4),
    "multiplierN2" DECIMAL(12,4),
    "parameters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SplitKpiConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SplitKpiConfig_splitId_kpiCode_key" ON "SplitKpiConfig"("splitId", "kpiCode");

-- AddForeignKey
ALTER TABLE "SplitKpiConfig" ADD CONSTRAINT "SplitKpiConfig_splitId_fkey" FOREIGN KEY ("splitId") REFERENCES "Split"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CheckConstraint: el maximo base siempre debe ser mayor que cero.
ALTER TABLE "SplitKpiConfig" ADD CONSTRAINT "SplitKpiConfig_baseMax_positive_check" CHECK ("baseMax" > 0);

-- CheckConstraint: los multiplicadores, cuando existen, deben ser mayores o
-- iguales que cero. Un multiplicador NULL significa "no aplicable para ese
-- nivel", no multiplicador cero, por eso no se exige NOT NULL aqui.
ALTER TABLE "SplitKpiConfig" ADD CONSTRAINT "SplitKpiConfig_multiplierN0_nonnegative_check" CHECK ("multiplierN0" IS NULL OR "multiplierN0" >= 0);
ALTER TABLE "SplitKpiConfig" ADD CONSTRAINT "SplitKpiConfig_multiplierN1_nonnegative_check" CHECK ("multiplierN1" IS NULL OR "multiplierN1" >= 0);
ALTER TABLE "SplitKpiConfig" ADD CONSTRAINT "SplitKpiConfig_multiplierN2_nonnegative_check" CHECK ("multiplierN2" IS NULL OR "multiplierN2" >= 0);

-- CheckConstraint: si un KPI esta activo, debe tener informado al menos un
-- multiplicador de nivel aplicable.
ALTER TABLE "SplitKpiConfig" ADD CONSTRAINT "SplitKpiConfig_active_requires_multiplier_check" CHECK (
    "isActive" = false
    OR "multiplierN0" IS NOT NULL
    OR "multiplierN1" IS NOT NULL
    OR "multiplierN2" IS NOT NULL
);

-- Backfill: crea las diez configuraciones de KPI, inactivas y con los
-- valores predeterminados de Split 8, para cada split que ya existiera
-- antes de esta migracion (datos de MVP-1A). No modifica personas,
-- splits, semanas ni participantes existentes, ni cambia el estado de
-- ningun split: los splits activos que ya existan quedaran con sus diez
-- KPI inactivos hasta que el administrador los configure (ver
-- docs/DECISIONS.md). Sobre una base de datos vacia esta sentencia no
-- inserta ninguna fila.
INSERT INTO "SplitKpiConfig" ("id", "splitId", "kpiCode", "isActive", "baseMax", "multiplierN0", "multiplierN1", "multiplierN2", "parameters", "createdAt", "updatedAt")
SELECT
    gen_random_uuid(),
    s."id",
    defaults."kpiCode"::"KpiCode",
    false,
    defaults."baseMax",
    defaults."multiplierN0",
    defaults."multiplierN1",
    defaults."multiplierN2",
    defaults."parameters"::jsonb,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Split" s
CROSS JOIN (
    VALUES
        ('SOLUTION_HUNTER', 70, 2.5, 1, 1.85, '{"pointsPerResolvedTicket": 1}'),
        ('DATA_EXPLORER', 70, 0.62, 0.5, 1.5, '{"pointsPerCommentedTicket": 1}'),
        ('VOICE_AMBASSADOR', 50, 1.25, 1.5, 2, '{"acceptedWeight": 1, "rejectedPenalty": 1, "unattendedPenalty": 1, "outboundPoints": 1}'),
        ('MASTER_CRAFTSMAN', 100, 3, 2, 2, '{"positiveWeight": 1, "negativePenalty": 4, "scale": 10}'),
        ('ESCALATION_TAMER', 30, 1, 1, 1, '{"basePoints": 30, "ratioPenaltyFactor": 200}'),
        ('STABILITY_GUARDIAN', 30, NULL, NULL, 1, '{"pointsPerResult": 30}'),
        ('WORK_CHRONOMANCY', 60, 1, 1, 1, '{"pointsAtFullOccupancy": 60}'),
        ('STAR_WRITER', 60, 4, 1.5, 2, '{"approvedArticlePoints": 10, "negativeArticlePoints": 10, "proposalPoints": 5}'),
        ('ENTHUSIASTIC_STUDENT', 50, 1, 1, 1, '{"pointsPerHour": 12.5}'),
        ('EXPERT_APPRENTICE', 50, 1, 1, 1.25, '{"targetValue": 15, "pointsAtTarget": 50}')
) AS defaults("kpiCode", "baseMax", "multiplierN0", "multiplierN1", "multiplierN2", "parameters");

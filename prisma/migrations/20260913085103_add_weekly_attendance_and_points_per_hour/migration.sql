-- CreateEnum
CREATE TYPE "WeeklyAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT');

-- AlterEnum
ALTER TYPE "PublishedKpiOutcomeStatus" ADD VALUE 'ABSENT';

-- AlterTable
ALTER TABLE "ChronomancyWeeklyEntry" ALTER COLUMN "productiveHours" DROP NOT NULL;

-- AlterTable
ALTER TABLE "PublishedParticipantWeeklyResult" ADD COLUMN     "attendanceStatus" "WeeklyAttendanceStatus",
ADD COLUMN     "positionPointsRuleRank" INTEGER,
ADD COLUMN     "productiveHoursSnapshot" DECIMAL(12,4),
ADD COLUMN     "totalHoursSnapshot" DECIMAL(12,4),
ALTER COLUMN "weeklyRank" DROP NOT NULL;

-- Una semana con todos los participantes aplicables ausentes (seccion E4 del encargo `1.1.1`, ver
-- docs/WEEKLY_ATTENDANCE_AND_HOURS.md) es valida y tiene 0 presentes: el denominador semanal
-- ("x de n") puede ser legitimamente 0, ya no solo >= 1.
ALTER TABLE "PublishedParticipantWeeklyResult" DROP CONSTRAINT "PublishedParticipantWeeklyResult_rankedParticipantCount_check";
ALTER TABLE "PublishedParticipantWeeklyResult" ADD CONSTRAINT "PublishedParticipantWeeklyResult_rankedParticipantCount_check" CHECK ("rankedParticipantCount" >= 0);

ALTER TABLE "PublishedParticipantWeeklyResult" ADD CONSTRAINT "PublishedParticipantWeeklyResult_positionPointsRuleRank_check" CHECK ("positionPointsRuleRank" IS NULL OR "positionPointsRuleRank" >= 1);
ALTER TABLE "PublishedParticipantWeeklyResult" ADD CONSTRAINT "PublishedParticipantWeeklyResult_totalHoursSnapshot_check" CHECK ("totalHoursSnapshot" IS NULL OR "totalHoursSnapshot" >= 0);
ALTER TABLE "PublishedParticipantWeeklyResult" ADD CONSTRAINT "PublishedParticipantWeeklyResult_productiveHoursSnapshot_check" CHECK ("productiveHoursSnapshot" IS NULL OR "productiveHoursSnapshot" >= 0);

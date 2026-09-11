-- Restricciones razonables de no-negatividad para el ranking y los puntos
-- por posicion publicados (docs/RESULTS_PUBLICATION.md). No restringen
-- "totalKpiPoints" ni "finalPoints", que si pueden ser negativos.
ALTER TABLE "PublishedParticipantWeeklyResult"
  ADD CONSTRAINT "PublishedParticipantWeeklyResult_weeklyRank_check" CHECK ("weeklyRank" >= 1),
  ADD CONSTRAINT "PublishedParticipantWeeklyResult_positionPoints_check" CHECK ("positionPoints" >= 0),
  ADD CONSTRAINT "PublishedParticipantWeeklyResult_rankedParticipantCount_check" CHECK ("rankedParticipantCount" >= 1);

ALTER TABLE "PublishedKpiResult"
  ADD CONSTRAINT "PublishedKpiResult_kpiRank_check" CHECK ("kpiRank" IS NULL OR "kpiRank" >= 1),
  ADD CONSTRAINT "PublishedKpiResult_rankedParticipantCount_check" CHECK ("rankedParticipantCount" IS NULL OR "rankedParticipantCount" >= 1),
  ADD CONSTRAINT "PublishedKpiResult_baseMax_check" CHECK ("baseMax" IS NULL OR "baseMax" > 0);

ALTER TABLE "SplitPositionPointRule"
  ADD CONSTRAINT "SplitPositionPointRule_points_check" CHECK ("points" >= 0),
  ADD CONSTRAINT "SplitPositionPointRule_position_check" CHECK ("position" BETWEEN 1 AND 15);

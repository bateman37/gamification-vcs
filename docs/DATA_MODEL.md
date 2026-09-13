# Modelo de datos — MVP-1A a `0.8.5` / MVP-2C

Fuente de verdad: `prisma/schema.prisma` y las migraciones
`prisma/migrations/20260910133815_init/migration.sql` (MVP-1A),
`prisma/migrations/20260910202939_add_kpi_configuration/migration.sql`
(MVP-1B),
`prisma/migrations/20260911082446_add_productivity_import/migration.sql`
(IMPORT-1A / MVP-1C.1),
`prisma/migrations/20260911100002_add_escalations_quality_voice_import/migration.sql`
(MVP-1C.2 / IMPORT-1B),
`prisma/migrations/20260911111623_add_manual_kpi_entries/migration.sql`
(MVP-1C.3 / INPUT-1C),
`prisma/migrations/20260911140000_add_position_points/migration.sql`
(`BUGFIX-1 / UX-SPLIT-1`),
`prisma/migrations/20260911154959_add_results_publication_and_auth/migration.sql`,
`prisma/migrations/20260911155500_add_publication_check_constraints/migration.sql`
(`0.6.0` / MVP-1C) y
`prisma/migrations/20260911205212_add_factions/migration.sql`
(`0.7.0` / MVP-2A) y
`prisma/migrations/20260911222334_add_professions_and_participant_profiles/migration.sql`
(`0.8.0` / MVP-2B) y
`prisma/migrations/20260912003932_add_weekly_locations/migration.sql`
(`0.8.5` / MVP-2C) y
`prisma/migrations/20260912115557_add_economy_inventory_equipment/migration.sql`
(`0.9.0` / MVP-2D) y
`prisma/migrations/20260913150000_add_faction_image_and_dynamic_position_points/migration.sql`
(`1.2.2`, imagen de faccion y rango dinamico de puntos por posicion). Este
documento describe y explica ese esquema; en caso de discrepancia, el
esquema real manda. (Las migraciones intermedias entre `0.9.0` y `1.2.2`
—noticias, analitica, asistencia, equipo visual— se documentan en sus
propios ficheros de `docs/`, referenciados desde `README.md` y
`docs/ROADMAP.md`.)

## Diagrama entidad-relacion

```mermaid
erDiagram
    Person ||--o{ SplitParticipant : "participa como"
    Split ||--o{ SplitWeek : "tiene"
    Split ||--o{ SplitParticipant : "tiene"
    Split ||--o{ SplitKpiConfig : "configura"
    Split ||--o{ SplitPositionPointRule : "configura"
    Split ||--o{ SplitFaction : "tiene"
    SplitFaction ||--o{ SplitParticipant : "agrupa"
    SplitFaction ||--o{ PublishedParticipantWeeklyResult : "tiene resultado en (snapshot)"
    SplitFaction ||--o| SplitFactionImage : "tiene imagen"
    Split ||--o{ SplitProfession : "tiene"
    SplitProfession ||--o{ SplitParticipant : "es profesion de"
    SplitProfession ||--o{ PublishedParticipantWeeklyResult : "tiene resultado en (snapshot)"
    SplitParticipant ||--o| SplitParticipantAvatar : "tiene avatar"
    SplitWeek ||--o{ SplitParticipant : "es semana inicial de"
    SplitWeek ||--o| ProductivityImport : "tiene carga vigente"
    ProductivityImport ||--o{ ProductivityWeeklyRow : "contiene"
    SplitParticipant ||--o{ ProductivityWeeklyRow : "tiene fila en"
    SplitWeek ||--o| EscalationImport : "tiene carga vigente"
    EscalationImport ||--o{ EscalationWeeklyRow : "contiene"
    SplitParticipant ||--o{ EscalationWeeklyRow : "tiene fila en"
    SplitWeek ||--o| QualityImport : "tiene carga vigente"
    QualityImport ||--o{ QualityWeeklyRow : "contiene"
    SplitParticipant ||--o{ QualityWeeklyRow : "tiene fila en"
    SplitWeek ||--o| VoiceImport : "tiene carga vigente"
    VoiceImport ||--o{ VoiceWeeklyRow : "contiene"
    SplitParticipant ||--o{ VoiceWeeklyRow : "tiene fila en"
    SplitWeek ||--o{ StabilityWeeklyEntry : "tiene entrada"
    SplitParticipant ||--o{ StabilityWeeklyEntry : "tiene fila en"
    SplitWeek ||--o{ ChronomancyWeeklyEntry : "tiene entrada"
    SplitParticipant ||--o{ ChronomancyWeeklyEntry : "tiene fila en"
    SplitWeek ||--o{ WriterWeeklyEntry : "tiene entrada"
    SplitParticipant ||--o{ WriterWeeklyEntry : "tiene fila en"
    SplitWeek ||--o{ StudentWeeklyEntry : "tiene entrada"
    SplitParticipant ||--o{ StudentWeeklyEntry : "tiene fila en"
    SplitWeek ||--o{ ApprenticeWeeklyEntry : "tiene entrada"
    SplitParticipant ||--o{ ApprenticeWeeklyEntry : "tiene fila en"
    Person ||--o| User : "tiene cuenta"
    SplitWeek ||--o| SplitWeekLocation : "tiene localizacion"
    SplitWeekLocation ||--o{ WeekPublication : "congelada en"
    Split ||--o| SplitEconomySettings : "configura mercado"
    Split ||--o{ SplitEquipmentSlot : "tiene"
    Split ||--o{ SplitStoreItem : "tiene"
    SplitEquipmentSlot ||--o{ SplitStoreItem : "contiene"
    SplitStoreItem ||--o| SplitStoreItemImage : "tiene imagen"
    SplitParticipant ||--o{ ItemPurchase : "compra"
    SplitParticipant ||--o{ SplitParticipantItem : "posee"
    SplitParticipant ||--o{ SplitParticipantEquippedItem : "equipa"
    SplitParticipant ||--o{ CreditLedgerEntry : "tiene movimiento"
    SplitStoreItem ||--o{ ItemPurchase : "origina"
    ItemPurchase ||--o| SplitParticipantItem : "genera"
    ItemPurchase ||--o| CreditLedgerEntry : "genera debito"
    SplitParticipantItem ||--o| SplitParticipantEquippedItem : "esta equipado en"
    SplitEquipmentSlot ||--o{ SplitParticipantEquippedItem : "recibe"
    PublishedParticipantWeeklyResult ||--o| CreditLedgerEntry : "genera credito"
    PublishedParticipantWeeklyResult ||--o{ PublishedEquippedItem : "congela equipo en"
    SplitWeek ||--o| WeekPublication : "tiene publicacion"
    User ||--o{ WeekPublication : "publica"
    WeekPublication ||--o{ PublishedParticipantWeeklyResult : "contiene"
    Split ||--o{ PublishedParticipantWeeklyResult : "contiene (desnormalizado)"
    SplitParticipant ||--o{ PublishedParticipantWeeklyResult : "tiene resultado en"
    Person ||--o{ PublishedParticipantWeeklyResult : "tiene resultado en"
    PublishedParticipantWeeklyResult ||--o{ PublishedKpiResult : "contiene"

    User {
        string id PK
        string email "unico, normalizado"
        string passwordHash "bcrypt, nunca en claro"
        enum role "ADMIN, PARTICIPANT"
        string personId FK "opcional, unico"
        boolean isActive
        boolean mustChangePassword
        datetime createdAt
        datetime updatedAt
    }

    WeekPublication {
        string id PK
        string splitWeekId FK "unico: una publicacion por semana"
        datetime publishedAt
        string publishedByUserId FK "opcional"
        string locationId FK "opcional; localizacion congelada (0.8.5)"
        string locationNameSnapshot "opcional, congelado al publicar"
        enum locationKpiCodeSnapshot "opcional, congelado al publicar"
        int locationBonusPercentSnapshot "opcional, 10/20/30/40/50 cuando existe"
        datetime createdAt
    }

    SplitWeekLocation {
        string id PK
        string splitWeekId FK "unico: como mucho una localizacion por semana"
        string name
        enum kpiCode "catalogo cerrado; debe estar activo en el split"
        int bonusPercent "10, 20, 30, 40 o 50"
        datetime createdAt
        datetime updatedAt
    }

    PublishedParticipantWeeklyResult {
        string id PK
        string publicationId FK
        string splitId FK "desnormalizado, para consultas por split"
        string splitParticipantId FK
        string personId FK
        string fullNameSnapshot
        string aliasSnapshot
        enum levelSnapshot "N0, N1, N2"
        decimal totalKpiPoints "puede ser negativo"
        decimal applicableMaxPoints "opcional"
        int weeklyRank "opcional desde 1.1.1; null si estuvo ausente o nadie estuvo presente"
        int positionPoints "no negativo"
        int rankedParticipantCount "mayor o igual que 0 desde 1.1.1 (0 si todos ausentes)"
        enum attendanceStatus "PRESENT, ABSENT; opcional, null en publicaciones anteriores a 1.1.1 (1.1.1)"
        decimal totalHoursSnapshot "opcional, no negativo; congelado al publicar (1.1.1)"
        decimal productiveHoursSnapshot "opcional, no negativo; null si no se capturo (1.1.1)"
        int positionPointsRuleRank "opcional, mayor o igual que 1; posicion usada para conceder positionPoints (1.1.1)"
        string factionId FK "opcional; null si el split no usa facciones o es anterior a 0.7.0"
        string factionNameSnapshot "opcional, congelado al publicar"
        string factionColorSnapshot "opcional, congelado al publicar"
        string professionId FK "opcional; null si el split no usa profesiones o es anterior a 0.8.0"
        string professionNameSnapshot "opcional, congelado al publicar"
        enum professionKpiCodeA "opcional, congelado al publicar"
        enum professionKpiCodeB "opcional, congelado al publicar"
        int professionBonusPercent "opcional; siempre 20 cuando hay profesion"
        boolean splitUsedProfessions "false en publicaciones anteriores a 0.8.0"
        int creditsEarned "max(0, floor(totalKpiPoints)); congelado al publicar (0.9.0)"
        datetime createdAt
    }

    PublishedKpiResult {
        string id PK
        string participantWeeklyResultId FK
        enum kpiCode "catalogo cerrado"
        string kpiNameSnapshot
        enum outcomeStatus "COMPUTED, VAC, NOT_APPLICABLE, ABSENT (1.1.1)"
        decimal rawPoints "opcional"
        decimal finalPoints "opcional, puede ser negativo; incluye el bonus desde 0.8.0"
        decimal baseMax "opcional, mayor que cero"
        boolean capped
        decimal basePointsBeforeProfession "opcional; tras el maximo y antes del bonus"
        decimal professionBonusPoints "opcional; puntos anadidos por la profesion"
        boolean professionApplied "si el bonus se aplico realmente a este KPI"
        string professionNameSnapshot "opcional, congelado al publicar"
        decimal locationBonusPoints "opcional; puntos anadidos por la localizacion (0.8.5)"
        boolean locationApplied "si el bonus de localizacion se aplico realmente a este KPI"
        decimal equipmentBonusPoints "opcional; puntos anadidos por objetos de equipo (0.9.0)"
        boolean equipmentApplied "si algun objeto aplico su bonus a este KPI"
        int kpiRank "opcional, mayor o igual que 1"
        int rankedParticipantCount "opcional"
        datetime createdAt
    }

    Person {
        string id PK
        string fullName
        string email "opcional, unico, normalizado"
        datetime createdAt
        datetime updatedAt
    }

    Split {
        string id PK
        string name
        string description "opcional"
        date startDate "siempre lunes"
        int numberOfWeeks "1 a 52"
        enum status "DRAFT, ACTIVE, CLOSED"
        datetime createdAt
        datetime updatedAt
    }

    SplitWeek {
        string id PK
        string splitId FK
        int sequenceNumber "identidad: splitId + sequenceNumber"
        date startDate "lunes"
        date endDate "domingo"
        datetime createdAt
        datetime updatedAt
    }

    SplitParticipant {
        string id PK
        string splitId FK
        string personId FK
        string alias
        string aliasNormalized "minusculas, sin espacios exteriores"
        enum level "N0, N1, N2"
        int startWeekSequenceNumber "FK compuesta a SplitWeek"
        int endWeekSequenceNumber "opcional, sin usar todavia"
        string factionId FK "opcional, ver SplitFaction"
        string professionId FK "opcional, ver SplitProfession"
        datetime createdAt
        datetime updatedAt
    }

    SplitProfession {
        string id PK
        string splitId FK
        string name
        string nameNormalized "minusculas, sin espacios exteriores; unico por split"
        enum kpiCodeA "catalogo cerrado; distinto de kpiCodeB"
        enum kpiCodeB "catalogo cerrado"
        boolean availableN0
        boolean availableN1
        boolean availableN2 "al menos uno de los tres es true"
        datetime createdAt
        datetime updatedAt
    }

    SplitParticipantAvatar {
        string splitParticipantId PK "clave primaria y unica"
        bytes imageData "imagen ya procesada (WebP)"
        string mimeType "MIME final real"
        int byteSize "positivo; coincide con octet_length(imageData)"
        string sha256 "version estable para cache/ETag"
        datetime createdAt
        datetime updatedAt
    }

    SplitFaction {
        string id PK
        string splitId FK
        string name
        string nameNormalized "minusculas, sin espacios exteriores; unico por split"
        string color "hexadecimal #RRGGBB"
        datetime createdAt
        datetime updatedAt
    }

    SplitKpiConfig {
        string id PK
        string splitId FK
        enum kpiCode "catalogo cerrado, ver KpiCode"
        boolean isActive "por defecto false"
        decimal baseMax "mayor que cero"
        decimal multiplierN0 "opcional: null = nivel no aplicable"
        decimal multiplierN1 "opcional: null = nivel no aplicable"
        decimal multiplierN2 "opcional: null = nivel no aplicable"
        json parameters "parametros propios del KPI, validados por esquema"
        datetime createdAt
        datetime updatedAt
    }

    ProductivityImport {
        string id PK
        string splitWeekId FK "unico: una carga vigente por semana"
        string originalFilename
        string fileSha256 "identifica el archivo, no deduce la semana"
        int sourceRowCount
        int importedRowCount
        datetime createdAt
        datetime updatedAt
    }

    ProductivityWeeklyRow {
        string id PK
        string productivityImportId FK
        string splitParticipantId FK "onDelete Restrict"
        string sourceAgentName "trazabilidad"
        int updates "conservado para Domador de Escaladas"
        int comments
        int publicComments
        int internalComments
        int ticketsUpdatedWithComment "entrada de Explorador de datos"
        int ticketsResolved "entrada de Cazador de soluciones"
        int ticketsCreated
        datetime createdAt
        datetime updatedAt
    }

    EscalationImport {
        string id PK
        string splitWeekId FK "unico: una carga vigente por semana"
        string originalFilename
        string fileSha256
        int sourceRowCount
        int importedRowCount
        datetime createdAt
        datetime updatedAt
    }

    EscalationWeeklyRow {
        string id PK
        string escalationImportId FK
        string splitParticipantId FK "onDelete Restrict"
        string sourceAgentName "trazabilidad"
        int groupReassignments "numerador de Domador de Escaladas"
        datetime createdAt
        datetime updatedAt
    }

    QualityImport {
        string id PK
        string splitWeekId FK "unico: una carga vigente por semana"
        string originalFilename
        string fileSha256
        int sourceRowCount
        int importedRowCount
        datetime createdAt
        datetime updatedAt
    }

    QualityWeeklyRow {
        string id PK
        string qualityImportId FK
        string splitParticipantId FK "onDelete Restrict"
        string sourceAgentName "trazabilidad"
        int goodSatisfactionTickets
        int badSatisfactionTickets
        datetime createdAt
        datetime updatedAt
    }

    VoiceImport {
        string id PK
        string splitWeekId FK "unico: una carga vigente por semana"
        string originalFilename
        string fileSha256
        int sourceRowCount
        int importedRowCount
        datetime createdAt
        datetime updatedAt
    }

    VoiceWeeklyRow {
        string id PK
        string voiceImportId FK
        string splitParticipantId FK "onDelete Restrict"
        string sourceAgentName "trazabilidad"
        int acceptedCallSegments
        int rejectedCallSegments
        int unattendedCallSegments
        int outboundCalls
        decimal segmentDurationHours "trazabilidad, no puntua"
        decimal segmentTalkTimeHours "trazabilidad, no puntua"
        decimal segmentWrapUpTimeHours "trazabilidad, no puntua"
        decimal segmentTalkTimeMinutes "trazabilidad, no puntua"
        decimal segmentWrapUpTimeMinutes "trazabilidad, no puntua"
        datetime createdAt
        datetime updatedAt
    }

    StabilityWeeklyEntry {
        string id PK
        string splitWeekId FK
        string splitParticipantId FK "onDelete Restrict"
        decimal resultValue "no negativo; 0 es un dato real"
        datetime createdAt
        datetime updatedAt
    }

    ChronomancyWeeklyEntry {
        string id PK
        string splitWeekId FK
        string splitParticipantId FK "onDelete Restrict"
        decimal productiveHours "opcional desde 1.1.1; no negativo; null = no aplica (KPI inactivo o nivel no aplicable)"
        decimal totalHours "no negativo; 0 = VAC del KPI y ausencia semanal (1.1.1); obligatorio para todo participante aplicable"
        datetime createdAt
        datetime updatedAt
    }

    WriterWeeklyEntry {
        string id PK
        string splitWeekId FK
        string splitParticipantId FK "onDelete Restrict"
        int deliveredArticles "no negativo"
        int undeliveredArticles "no negativo, conteo positivo"
        int proposedArticles "no negativo"
        datetime createdAt
        datetime updatedAt
    }

    StudentWeeklyEntry {
        string id PK
        string splitWeekId FK
        string splitParticipantId FK "onDelete Restrict"
        decimal dedicatedHours "no negativo"
        datetime createdAt
        datetime updatedAt
    }

    ApprenticeWeeklyEntry {
        string id PK
        string splitWeekId FK
        string splitParticipantId FK "onDelete Restrict"
        int completedTrainings "no negativo; maximo targetValue validado en servicio"
        datetime createdAt
        datetime updatedAt
    }

    SplitPositionPointRule {
        string id PK
        string splitId FK
        int position "1 a 15"
        int points "no negativo"
        datetime createdAt
        datetime updatedAt
    }

    SplitEconomySettings {
        string splitId PK "tambien FK a Split"
        enum marketStatus "CLOSED, OPEN; siempre CLOSED al crear o migrar"
        datetime createdAt
        datetime updatedAt
    }

    SplitEquipmentSlot {
        string id PK
        string splitId FK
        string name
        string nameNormalized "unico por split"
        int displayOrder "no negativo; solo ordena las ranuras historicas sin ubicar"
        enum visualPosition "1.2.0: catalogo cerrado de 10; unico por split; null = pendiente de ubicar"
        boolean isActive "1.2.0: por defecto true"
        datetime createdAt
        datetime updatedAt
    }

    SplitStoreItem {
        string id PK
        string splitId FK
        string name
        string nameNormalized "unico por split"
        string description "opcional"
        int priceCredits "entero positivo"
        string equipmentSlotId FK "misma split"
        enum kpiCode "catalogo cerrado; activo en el split al crear/editar"
        int bonusPercent "10, 20, 30, 40 o 50"
        boolean isForSale "por defecto true"
        datetime createdAt
        datetime updatedAt
    }

    SplitStoreItemImage {
        string splitStoreItemId PK "1.2.0: uno-a-uno con el objeto"
        bytes imageData "WebP ya procesado en servidor"
        string mimeType "image/webp"
        int byteSize "> 0 y = octet_length(imageData)"
        string sha256 "version estable para ETag e imageVersion"
        datetime createdAt
        datetime updatedAt
    }

    ItemPurchase {
        string id PK
        string splitParticipantId FK "onDelete Restrict"
        string storeItemId FK "onDelete Restrict"
        string itemNameSnapshot
        int priceCreditsSnapshot
        string equipmentSlotIdSnapshot
        string equipmentSlotNameSnapshot
        enum kpiCodeSnapshot
        int bonusPercentSnapshot
        datetime purchasedAt
    }

    SplitParticipantItem {
        string id PK
        string splitParticipantId FK "onDelete Restrict"
        string storeItemId FK "onDelete Restrict"
        string purchaseId FK "unico, onDelete Restrict"
        datetime acquiredAt
    }

    SplitParticipantEquippedItem {
        string splitParticipantId PK "compuesta con equipmentSlotId"
        string equipmentSlotId PK "compuesta con splitParticipantId"
        string ownedItemId FK "unico: el mismo objeto nunca se equipa dos veces"
        datetime equippedAt
        datetime updatedAt
    }

    CreditLedgerEntry {
        string id PK
        string splitParticipantId FK "onDelete Restrict"
        enum type "WEEKLY_EARNING, PURCHASE"
        int amount "con signo: >=0 en WEEKLY_EARNING, <0 en PURCHASE"
        string description
        string publishedResultId FK "opcional, unico: como mucho un WEEKLY_EARNING por resultado"
        string purchaseId FK "opcional, unico: como mucho un PURCHASE por compra"
        datetime createdAt
    }

    PublishedEquippedItem {
        string id PK
        string participantWeeklyResultId FK
        string storeItemId FK "opcional, onDelete SetNull"
        string itemNameSnapshot
        string equipmentSlotId FK "opcional, onDelete SetNull"
        string equipmentSlotNameSnapshot
        enum kpiCodeSnapshot
        int bonusPercentSnapshot
        int displayOrder
        datetime createdAt
    }
```

## Tablas, campos y relaciones

### `Person`

Registro global y estable, reutilizable entre splits.

- `id`: UUID, clave primaria.
- `fullName`: nombre completo, obligatorio.
- `email`: opcional. Se normaliza (recortado y en minusculas) antes de
  guardarse, y tiene un indice unico (`Person_email_key`). Preparado para
  identificar en el futuro la cuenta del participante.
- `createdAt`, `updatedAt`: gestionados automaticamente.
- No existe borrado fisico en esta entrega. No se ha disenado todavia
  ninguna regla de baja o desactivacion: se ha pospuesto deliberadamente
  (ver `docs/DECISIONS.md`).

### `Split`

Una edicion de la gamificacion.

- `id`: UUID, clave primaria.
- `name`, `description` (opcional).
- `startDate`: columna `DATE` (sin hora). Restriccion de base de datos
  `Split_startDate_is_monday_check` que exige que sea lunes
  (`EXTRACT(ISODOW FROM "startDate") = 1`).
- `numberOfWeeks`: entero. Restriccion de base de datos
  `Split_numberOfWeeks_range_check` que exige un valor entre 1 y 52.
- `status`: enum `SplitStatus` (`DRAFT`, `ACTIVE`, `CLOSED`). Se crea
  siempre en `DRAFT`. El cierre funcional (`CLOSED`) no se implementa
  todavia; el estado queda preparado en el modelo.

### `SplitWeek`

Las semanas generadas de un split.

- `id`: UUID, clave primaria.
- `splitId`: referencia a `Split` (borrado en cascada si se borra el
  split).
- `sequenceNumber`: numero secuencial dentro del split (1, 2, 3...). Es la
  identidad funcional de la semana junto con `splitId`; el numero ISO del
  calendario no se guarda ni se usa como identidad.
- `startDate` / `endDate`: columnas `DATE`. Restricciones de base de datos
  que exigen que `startDate` sea lunes y `endDate` sea domingo.
- Indice unico `SplitWeek_splitId_sequenceNumber_key` sobre
  (`splitId`, `sequenceNumber`).

### `SplitParticipant`

La relacion entre una persona y un split, con sus datos propios de esa
participacion.

- `id`: UUID, clave primaria.
- `splitId`, `personId`: referencias a `Split` y `Person`.
- `alias`: tal como lo escribe el administrador.
- `aliasNormalized`: version normalizada (recortada y en minusculas),
  usada exclusivamente para garantizar la unicidad dentro del split.
  Restriccion de base de datos que impide que quede vacia.
- `level`: enum `ParticipantLevel` (`N0`, `N1`, `N2`).
- `startWeekSequenceNumber`: semana desde la que participa. Es una clave
  foranea **compuesta** hacia `SplitWeek` (`splitId` +
  `sequenceNumber`), lo que garantiza a nivel de base de datos que la
  semana inicial pertenece al mismo split.
- `endWeekSequenceNumber`: opcional, sin uso todavia. Preparado para un
  futuro cierre de participacion; cuando se use, debera referenciar una
  semana del mismo split (regla a aplicar en su momento, no forzada aun
  por una restriccion de base de datos).
- Indice unico `SplitParticipant_splitId_personId_key`: una persona solo
  puede aparecer una vez en un mismo split.
- Indice unico `SplitParticipant_splitId_aliasNormalized_key`: el alias
  normalizado es unico dentro del split (el mismo alias si puede
  repetirse en splits distintos).
- `factionId` (`0.7.0` / MVP-2A, ver `docs/FACTIONS.md`): referencia
  opcional a `SplitFaction` con `onDelete: Restrict` (una faccion con
  participantes asignados nunca se borra fisicamente). Nullable para
  migrar de forma segura splits existentes y splits que no usan facciones;
  los servicios exigen una asignacion completa antes de activar o publicar
  un split que ya tiene alguna faccion creada. Indice `SplitParticipant_factionId_idx`.
- `professionId` (`0.8.0` / MVP-2B, ver `docs/PROFESSIONS_AND_PROFILES.md`):
  referencia opcional a `SplitProfession` con `onDelete: Restrict` (una
  profesion con participantes asignados nunca se borra fisicamente).
  Nullable: `null` mientras el split no usa profesiones o mientras la
  persona todavia no ha elegido antes de la primera publicacion. Una
  persona tiene como mucho **una** profesion en cada split; la relacion
  pertenece a la participacion, nunca a `Person`. Indice
  `SplitParticipant_professionId_idx`.

### `SplitProfession` (`0.8.0` / MVP-2B)

Profesion de un split (ver `docs/PROFESSIONS_AND_PROFILES.md`). Es una capa
opcional: un split sin ninguna profesion creada se comporta exactamente
como en `0.7.0`.

- `id`: UUID, clave primaria.
- `splitId`: referencia a `Split` (borrado en cascada si se borra el split).
- `name`, `nameNormalized` (minusculas, sin espacios exteriores, con
  restriccion `SplitProfession_nameNormalized_not_blank_check`). Indice
  unico `SplitProfession_splitId_nameNormalized_key`: unico dentro del
  split, puede repetirse en otro split.
- `kpiCodeA` / `kpiCodeB`: dos codigos del enum `KpiCode`, con la
  restriccion de base de datos `SplitProfession_distinct_kpis_check` que
  exige que sean **distintos**. No se guardan formulas, expresiones ni JSON
  libre: solo dos codigos del catalogo cerrado.
- `availableN0` / `availableN1` / `availableN2`: booleanos, con la
  restriccion `SplitProfession_at_least_one_level_check` que exige que al
  menos uno sea `true`.
- El porcentaje del bonus **no** es una columna: es una constante unica y
  tipada del dominio (`PROFESSION_BONUS_PERCENT`,
  `src/domain/profession-bonus.ts`), siempre `20`.
- No se borra fisicamente una profesion referenciada por
  `SplitParticipant.professionId` ni por
  `PublishedParticipantWeeklyResult.professionId` (`onDelete: Restrict`);
  el servicio comprueba ademas explicitamente que no tenga participantes
  asignados y que el split no tenga publicaciones.

### `SplitParticipantAvatar` (`0.8.0` / MVP-2B)

Avatar de una participacion de split. Entidad **uno-a-uno separada** a
proposito, para no cargar los bytes en las consultas normales de
participantes, fichas o resultados (ver `docs/PROFESSIONS_AND_PROFILES.md`,
seccion 13).

- `splitParticipantId`: clave primaria **y** unica, con `onDelete: Cascade`
  desde `SplitParticipant` (el avatar no tiene sentido sin su ficha).
- `imageData`: `Bytes` (`bytea`) con la imagen **ya procesada**: WebP,
  maximo 512 px por lado, sin EXIF ni metadatos del original. El archivo
  original subido nunca se guarda.
- `mimeType`: MIME final real de `imageData` (siempre `image/webp` en esta
  entrega).
- `byteSize`: `Int`, con dos restricciones de base de datos que exigen que
  sea positivo y que coincida con `octet_length("imageData")`.
- `sha256`: hash de `imageData`, usado como version estable de cache
  (`ETag`) y para construir la URL de la imagen sin cargar los bytes.

### `SplitFaction` (`0.7.0` / MVP-2A)

Faccion de un split (ver `docs/FACTIONS.md`).

- `id`: UUID, clave primaria.
- `splitId`: referencia a `Split` (borrado en cascada si se borra el
  split).
- `name`, `nameNormalized` (minusculas, sin espacios exteriores, con
  restriccion de base de datos que impide que quede vacio). Indice unico
  `SplitFaction_splitId_nameNormalized_key`: unico dentro del split, puede
  repetirse en otro split.
- `color`: hexadecimal `#RRGGBB`, validado en servicio y con la
  restriccion de base de datos `SplitFaction_color_format_check`. Solo es
  una ayuda visual, no necesita ser unico.
- No se borra fisicamente una faccion referenciada por
  `SplitParticipant.factionId` (`onDelete: Restrict`) ni por
  `PublishedParticipantWeeklyResult.factionId`: el servicio comprueba
  ademas explicitamente que no tenga participantes asignados ni el split
  publicaciones antes de permitir eliminarla.
- `image` (`1.2.2`): relacion opcional uno-a-uno con `SplitFactionImage`
  (ver mas abajo). Recurso cosmetico actual: nunca se congela en un
  snapshot y un cambio de emblema no altera ninguna publicacion existente.

### `SplitFactionImage` (`1.2.2`)

Emblema opcional de una faccion (ver `docs/FACTIONS.md`, seccion 16). Misma
forma y mismo patron que `SplitParticipantAvatar`/`SplitStoreItemImage`:
entidad uno-a-uno separada para no cargar los bytes en listados de
facciones.

- `splitFactionId`: clave primaria y unica, con `onDelete: Cascade` desde
  `SplitFaction`.
- `imageData`: `Bytes` con la imagen ya procesada (WebP, maximo 512 px por
  lado, sin EXIF ni metadatos del original).
- `mimeType`: siempre `image/webp` en esta entrega.
- `byteSize`: `Int`, con restricciones de base de datos que exigen que sea
  positivo y que coincida con `octet_length("imageData")`.
- `sha256`: hash de `imageData`, usado como version estable de cache
  (`ETag`) y como `imageVersion` en las DTO de faccion.

### `SplitKpiConfig`

Configuracion de un KPI del catalogo cerrado (enum `KpiCode`, ver
`src/domain/kpis/catalog.ts` y `docs/KPI_CONFIGURATION.md`) para un split
concreto. Cada split conserva su propia copia editable, independiente de
los valores predeterminados del catalogo y de la configuracion de otros
splits.

- `id`: UUID, clave primaria.
- `splitId`: referencia a `Split` (borrado en cascada si se borra el
  split).
- `kpiCode`: enum `KpiCode` con los diez codigos del catalogo cerrado. El
  orden de declaracion del enum coincide con el orden de presentacion del
  catalogo (PostgreSQL ordena los enums por orden de declaracion, no
  alfabeticamente).
- `isActive`: si el KPI esta activo en este split. `false` por defecto.
- `baseMax`: `Decimal(12,4)` (nunca `Float`, para no perder precision en
  comparaciones). Restriccion de base de datos que exige que sea mayor que
  cero.
- `multiplierN0` / `multiplierN1` / `multiplierN2`: `Decimal(12,4)`
  opcionales. Restriccion de base de datos que exige, cuando existen, que
  sean mayores o iguales que cero. Un valor `NULL` significa que ese nivel
  **no es aplicable** a ese KPI, no que el multiplicador sea cero.
- Restriccion de base de datos adicional: si `isActive` es `true`, al
  menos uno de los tres multiplicadores debe estar informado.
- `parameters`: `Json` (`jsonb`) con los parametros propios del tipo de
  calculo de ese KPI (ver `docs/KPI_CONFIGURATION.md`). Nunca se acepta tal
  cual desde el navegador: la accion de servidor construye este objeto a
  partir de los campos que el catalogo declara para ese `kpiCode`, y el
  esquema de validacion de ese KPI concreto lo valida antes de guardarse.
- Indice unico `SplitKpiConfig_splitId_kpiCode_key`: un split tiene como
  mucho una configuracion por cada KPI del catalogo (en la practica,
  siempre las diez).

### `ProductivityImport`

Cabecera de la carga semanal del Excel de Productividad para una semana de
un split (ver `docs/IMPORT_PRODUCTIVITY.md`). Un unico archivo alimenta
`SOLUTION_HUNTER` y `DATA_EXPLORER`.

- `id`: UUID, clave primaria.
- `splitWeekId`: referencia a `SplitWeek` (borrado en cascada si se borra
  la semana). Indice unico: como mucho una carga **vigente** por semana.
- `originalFilename`: nombre del archivo tal como se subio, solo para
  mostrarlo en pantalla; nunca se guarda el binario.
- `fileSha256`: hash del contenido procesado. Identifica el archivo para
  depuracion administrativa; no se usa para deducir la semana ni ninguna
  otra logica de negocio.
- `sourceRowCount` / `importedRowCount`: total de filas de datos leidas y
  numero de filas realmente persistidas (solo las "encontradas"). Ambas
  con restriccion de base de datos que exige un valor no negativo.

### `ProductivityWeeklyRow`

Una fila por participante encontrado dentro de una carga.

- `id`: UUID, clave primaria.
- `productivityImportId`: referencia a `ProductivityImport` (borrado en
  cascada si se borra la carga, por ejemplo al sustituirla).
- `splitParticipantId`: referencia a `SplitParticipant` con
  `onDelete: Restrict`, a proposito: una fila de productividad nunca debe
  desaparecer por borrar accidentalmente al participante.
- `sourceAgentName`: nombre tal como aparecia en la columna "Nombre del
  actualizador", conservado para trazabilidad (la identidad real es
  `Person.fullName`, pero se guarda el texto de origen).
- Los siete conteos (`updates`, `comments`, `publicComments`,
  `internalComments`, `ticketsUpdatedWithComment`, `ticketsResolved`,
  `ticketsCreated`) son `Int`, todos con restriccion de base de datos que
  exige un valor no negativo. `updates` se conserva para el futuro calculo
  de Domador de Escaladas (`ESCALATION_TAMER`); no se usa todavia.
- Indice unico `ProductivityWeeklyRow_productivityImportId_splitParticipant_key`
  (`productivityImportId` + `splitParticipantId`): una carga solo puede
  tener una fila por participante.
- Los puntos de Cazador de soluciones y Explorador de datos **no** se
  guardan aqui: se calculan al consultar, a partir de estos conteos, el
  nivel del participante y `SplitKpiConfig` (ver
  `docs/IMPORT_PRODUCTIVITY.md` y `docs/DECISIONS.md`).

### `EscalationImport` y `EscalationWeeklyRow`

Misma forma que `ProductivityImport`/`ProductivityWeeklyRow` (ver
`docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md`), para la carga semanal del
Excel de Escalados. `EscalationWeeklyRow.groupReassignments` (`Int`, no
negativo) es el numerador de Domador de Escaladas (`ESCALATION_TAMER`); el
denominador (`ProductivityWeeklyRow.updates`) no se duplica aqui, se lee de
Productividad de la misma semana y participante al calcular. Igual que
Productividad: `splitWeekId` unico en la cabecera, `onDelete: Restrict`
desde la fila hacia el participante, y una fila como maximo por
participante dentro de una carga (`@@unique([escalationImportId, splitParticipantId])`).

### `QualityImport` y `QualityWeeklyRow`

Misma forma, para la carga semanal del Excel de Calidad.
`QualityWeeklyRow.goodSatisfactionTickets` y `badSatisfactionTickets`
(`Int`, no negativos) alimentan Maestro Artesano (`MASTER_CRAFTSMAN`).

### `VoiceImport` y `VoiceWeeklyRow`

Misma forma, para la carga semanal del Excel de Llamadas.
`VoiceWeeklyRow` guarda cuatro conteos (`Int`, no negativos:
`acceptedCallSegments`, `rejectedCallSegments`, `unattendedCallSegments`,
`outboundCalls`) que alimentan Embajador de voz (`VOICE_AMBASSADOR`), mas
cinco metricas de tiempo (`Decimal(14,6)`, no negativas: `segmentDurationHours`, `segmentTalkTimeHours`,
`segmentWrapUpTimeHours`, `segmentTalkTimeMinutes`,
`segmentWrapUpTimeMinutes`) conservadas solo para trazabilidad, sin
intervenir en el calculo.

Los puntos de los tres KPI, igual que Productividad, **no** se guardan:
se calculan al consultar a partir de estos conteos, el nivel del
participante y `SplitKpiConfig`.

### Las cinco entradas manuales (`MVP-1C.3 / INPUT-1C`)

Sin fichero, cabecera de carga, hash ni nombre de origen: una fila semanal
tipada por participante, guardada directamente por el administrador (ver
`docs/MANUAL_KPI_ENTRY.md`). Las cinco comparten la misma forma: `id`
(UUID), `splitWeekId` (`onDelete: Cascade` desde `SplitWeek`),
`splitParticipantId` (`onDelete: Restrict` desde `SplitParticipant`, igual
que las filas de importacion), timestamps, restriccion unica
`[splitWeekId, splitParticipantId]` (una fila por participante y semana) y
restricciones SQL de no negatividad. Ninguna guarda puntos, porcentajes,
estados, `VAC`, maximos ni contadores derivados: todo se calcula al
consultar.

- **`StabilityWeeklyEntry`**: `resultValue` (`Decimal(12,4)`, no negativo).
  Alimenta Guardian de la Estabilidad (`STABILITY_GUARDIAN`).
- **`ChronomancyWeeklyEntry`**: `totalHours` (`Decimal(12,4)`, no negativo,
  obligatorio) y `productiveHours` (`Decimal(12,4)`, no negativo, nullable
  desde `1.1.1`: solo se captura si `WORK_CHRONOMANCY` esta activo y
  aplica al nivel). Alimenta Cronomagia laboral y, desde `1.1.1`, es
  tambien el unico dato de asistencia semanal
  (`docs/WEEKLY_ATTENDANCE_AND_HOURS.md`): el bloque se guarda para todo
  participante aplicable de toda semana, independientemente de si el KPI
  esta activo. No tiene columna `occupancy`: se calcula al consultar.
- **`WriterWeeklyEntry`**: `deliveredArticles`, `undeliveredArticles`,
  `proposedArticles` (`Int`, no negativos). Alimenta Redactor estrella
  (`STAR_WRITER`).
- **`StudentWeeklyEntry`**: `dedicatedHours` (`Decimal(12,4)`, no
  negativo). Alimenta Estudiante entusiasta (`ENTHUSIASTIC_STUDENT`).
- **`ApprenticeWeeklyEntry`**: `completedTrainings` (`Int`, no negativo).
  Alimenta Aprendiz experto (`EXPERT_APPRENTICE`). El maximo
  (`targetValue` de `SplitKpiConfig`) se valida en el servicio, no en la
  base de datos: un cambio posterior de `targetValue` no modifica ni
  recorta silenciosamente los valores ya guardados.

Migracion `add_manual_kpi_entries`, compatible con los datos existentes de
`0.4.0`.

### `SplitPositionPointRule` (`BUGFIX-1 / UX-SPLIT-1`, rango dinamico desde `1.2.2`)

Puntos por posicion semanal de un split (ver
`docs/POSITION_POINTS_CONFIGURATION.md`). No es un KPI ni se relaciona con
`SplitKpiConfig`: es una configuracion aparte.

- `id`: UUID, clave primaria.
- `splitId`: referencia a `Split` (borrado en cascada si se borra el
  split).
- `position`: entero. Restriccion de base de datos `position >= 1` (hasta
  `1.2.2`, `SplitPositionPointRule_position_range_check` exigia ademas
  `<= 15`; esa migracion elimino el limite superior). Desde `1.2.2` el
  rango superior es dinamico por split
  (`N = maximo(15, participantes del split, mayor posicion ya persistida)`,
  `resolveRequiredPositionCount`, `src/domain/position-points.ts`),
  calculado siempre en servicio, nunca en base de datos.
- `points`: entero. Restriccion de base de datos
  `SplitPositionPointRule_points_nonnegative_check` que exige un valor no
  negativo.
- Indice unico `SplitPositionPointRule_splitId_position_key`
  (`splitId` + `position`).

Cada split conserva su propia copia (igual que `SplitKpiConfig`): editar
los puntos de un split no modifica los de otro. Migracion
`add_position_points`, con backfill de los quince valores exactos de
Split 8 para cada split existente y creacion automatica de las quince
reglas al crear un split nuevo, dentro de la misma transaccion que crea el
split, sus semanas y su configuracion de KPI.

### `User` (`0.6.0` / MVP-1C)

Cuenta de acceso local (ver `docs/AUTHENTICATION.md`).

- `id`: UUID, clave primaria.
- `email`: normalizado, unico (`User_email_key`).
- `passwordHash`: hash `bcrypt`; nunca se guarda la contrasena en claro ni
  con cifrado reversible.
- `role`: enum `UserRole` (`ADMIN`, `PARTICIPANT`).
- `personId`: referencia opcional y **unica** a `Person`
  (`User_personId_key`), `onDelete: Restrict`. Un `PARTICIPANT` debe
  quedar vinculado uno a uno con una persona; un `ADMIN` puede no estarlo.
- `isActive`: si la cuenta puede iniciar sesion.
- `mustChangePassword`: obliga a cambiar la contrasena en el proximo
  acceso (activado al crear la cuenta o al restablecer la contrasena
  temporal).

### `WeekPublication` (`0.6.0` / MVP-1C)

Publicacion de una semana: operacion de dominio irreversible que crea una
instantanea inmutable y bloquea cualquier modificacion posterior de las
entradas de esa semana (ver `docs/RESULTS_PUBLICATION.md`).

- `id`: UUID, clave primaria.
- `splitWeekId`: referencia unica a `SplitWeek` (`onDelete: Restrict`): como
  mucho una publicacion por semana.
- `publishedAt`: fecha/hora de la publicacion.
- `publishedByUserId`: referencia opcional a `User` (`onDelete: SetNull`),
  para conservar el historial de quien publico cuando sea posible.
- `locationId`, `locationNameSnapshot`, `locationKpiCodeSnapshot`,
  `locationBonusPercentSnapshot` (`0.8.5` / MVP-2C, ver
  `docs/WEEKLY_LOCATIONS.md`): localizacion de la semana congelada al
  publicar. Los cuatro campos son opcionales: `null` cuando la semana no
  tenia localizacion o en publicaciones anteriores a esta version, que
  nunca se completan retroactivamente. Como la localizacion es unica y
  comun a toda la semana, se congela una sola vez aqui (no se repite en
  cada fila de participante). `locationId` es una referencia opcional a
  `SplitWeekLocation` con `onDelete: SetNull` (defensivo: la ventana
  temporal ya impide borrar una localizacion referenciada por una
  publicacion).

`WeekPublication` es la unica fuente de verdad de que una semana esta
publicada: no se mezcla con `SplitStatus.CLOSED`, que sigue cerrando el
split completo. No existe "despublicar" ni "reabrir" en esta entrega.

### `SplitWeekLocation` (`0.8.5` / MVP-2C)

Localizacion semanal (ver `docs/WEEKLY_LOCATIONS.md`). Capa opcional: una
semana sin localizacion se comporta exactamente como en `0.8.0`.

- `id`: UUID, clave primaria.
- `splitWeekId`: referencia **unica** a `SplitWeek` (`onDelete: Cascade`,
  igual que las entradas manuales semanales): como mucho una localizacion
  por semana. El split se deduce siempre via `splitWeek.splitId`, sin
  duplicar `splitId` en esta tabla.
- `name`: obligatorio, recortado de espacios exteriores, maximo 80
  caracteres.
- `kpiCode`: enum `KpiCode` del catalogo cerrado; debe estar activo en el
  split al crear o editar la localizacion (comprobado en servicio).
- `bonusPercent`: `Int`, restringido en base de datos
  (`SplitWeekLocation_bonusPercent_allowed_check`) a exactamente `10`,
  `20`, `30`, `40` o `50`.
- No se borra ni se cambia en silencio si el KPI que potencia se
  desactiva: `updateKpiConfig` rechaza esa desactivacion mientras exista
  una localizacion **futura** que lo use (ver `docs/WEEKLY_LOCATIONS.md`).

### `PublishedParticipantWeeklyResult` y `PublishedKpiResult` (`0.6.0` / MVP-1C)

Instantanea congelada de un participante en una semana publicada: nombre,
alias, nivel, totales, ranking, puntos por posicion y el detalle de cada
KPI, tal como eran en el momento de publicar. Un cambio posterior en
`SplitParticipant`, `Person`, `SplitKpiConfig` o `SplitPositionPointRule`
nunca modifica estas filas.

- `PublishedParticipantWeeklyResult.splitId` esta **desnormalizado** desde
  `splitParticipant`/`publication.splitWeek.split` para poder consultar la
  clasificacion de un split completo indexando directamente por `splitId`
  (`PublishedParticipantWeeklyResult_splitId_idx`), sin recorrer esa
  cadena de relaciones por cada fila (ver `docs/DECISIONS.md`).
- `totalKpiPoints` y `PublishedKpiResult.finalPoints`/`rawPoints` son
  `Decimal` y **pueden ser negativos** (sin restriccion de base de datos
  en ese sentido); `weeklyRank`, `positionPoints`, `rankedParticipantCount`
  y `kpiRank` tienen restricciones de no negatividad/minimo `1` donde
  corresponde (`add_publication_check_constraints`).
- `PublishedKpiResult.outcomeStatus`: enum `PublishedKpiOutcomeStatus`
  (`COMPUTED`, `VAC`, `NOT_APPLICABLE`, `ABSENT` desde `1.1.1`).
- `attendanceStatus`, `totalHoursSnapshot`, `productiveHoursSnapshot` y
  `positionPointsRuleRank` (`1.1.1`, ver
  `docs/WEEKLY_ATTENDANCE_AND_HOURS.md`): asistencia semanal congelada,
  determinada exclusivamente por `totalHours` de
  `ChronomancyWeeklyEntry`. Los cuatro son opcionales: `null` en
  publicaciones anteriores a esta version (cobertura desconocida, nunca
  reinterpretada como presente ni como ausente). `weeklyRank` pasa a
  opcional en esta misma migracion (`null` para una ausencia, o cuando
  nadie estuvo presente esa semana); `rankedParticipantCount` relaja su
  minimo de `1` a `0` (una semana con todos ausentes tiene legitimamente
  `0` presentes). `positionPointsRuleRank` es la posicion realmente usada
  para conceder `positionPoints`: coincide con `weeklyRank` para un
  presente, y con la ultima posicion efectivamente ocupada por una
  persona presente para un ausente (`null` sin ningun presente esa
  semana).
- Indices unicos: un solo resultado por participante y publicacion
  (`@@unique([publicationId, splitParticipantId])`) y un solo resultado por
  KPI y participante publicado (`@@unique([participantWeeklyResultId,
  kpiCode])`).
- `onDelete: Cascade` desde `WeekPublication` hacia
  `PublishedParticipantWeeklyResult`, y desde ahi hacia
  `PublishedKpiResult`; `onDelete: Restrict` hacia `Split`,
  `SplitParticipant`, `Person` y `SplitFaction` (una fila publicada nunca
  desaparece por borrar accidentalmente la entidad viva a la que hace
  referencia).
- `factionId`, `factionNameSnapshot`, `factionColorSnapshot` (`0.7.0` /
  MVP-2A, ver `docs/FACTIONS.md`): faccion del participante congelada en
  el momento de publicar. Los tres son opcionales: `null` cuando el split
  no usa facciones, o en publicaciones anteriores a esta version (nunca se
  completan retroactivamente). Indice `PublishedParticipantWeeklyResult_factionId_idx`.
  No existe un "renombre" ni un total de faccion persistido: la
  clasificacion de facciones se calcula siempre al consultar a partir de
  estos snapshots y de `positionPoints` (`faction-classification.service.ts`).
- `professionId`, `professionNameSnapshot`, `professionKpiCodeA`,
  `professionKpiCodeB`, `professionBonusPercent` y `splitUsedProfessions`
  (`0.8.0` / MVP-2B, ver `docs/PROFESSIONS_AND_PROFILES.md`): profesion del
  participante congelada al publicar. Los cinco primeros son opcionales
  (`null` cuando el split no usa profesiones o en publicaciones anteriores
  a esta version, que nunca se completan retroactivamente);
  `splitUsedProfessions` es `Boolean` con valor predeterminado `false` y
  distingue "el split no usaba profesiones" de "publicacion anterior a
  `0.8.0`". Restriccion
  `PublishedParticipantWeeklyResult_professionBonusPercent_check`
  (`NULL` o mayor que cero) e indice
  `PublishedParticipantWeeklyResult_professionId_idx`.
- `PublishedKpiResult.basePointsBeforeProfession`,
  `professionBonusPoints`, `professionApplied` y `professionNameSnapshot`
  (`0.8.0` / MVP-2B): desglose congelado del bonus de profesion de cada
  KPI. Desde `0.8.5` / MVP-2C, `basePointsBeforeProfession` es tambien la
  base anterior al bonus de localizacion (no se ha renombrado: sigue
  siendo la unica fuente numerica persistida para ese concepto, ver
  `docs/WEEKLY_LOCATIONS.md`).
  `PublishedKpiResult.locationBonusPoints` y `locationApplied` (`0.8.5` /
  MVP-2C) son el desglose congelado del bonus de localizacion, calculado
  de forma independiente sobre esa misma base, nunca encadenado con el de
  profesion. `finalPoints` sigue siendo el valor definitivo
  (`baseFinalPoints + professionBonusPoints + locationBonusPoints`); en
  publicaciones anteriores a `0.8.0` coincide con los puntos tras el
  maximo base, porque entonces no existia ningun bonus.

### Economia, inventario y equipo (`0.9.0` / MVP-2D)

Ver `docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md` para el detalle funcional
completo. Resumen del esquema:

- **`SplitEconomySettings`**: uno-a-uno con `Split` (clave primaria =
  `splitId`, `onDelete: Cascade`). `marketStatus` empieza siempre `CLOSED`
  (splits nuevos y migrados).
- **`SplitEquipmentSlot`**: ranuras de equipo de un split, sin numero ni
  nombres codificados. `nameNormalized` unico por split
  (`@@unique([splitId, nameNormalized])`); `displayOrder` decide el orden
  de presentacion. **`1.2.0`** anade `visualPosition`
  (`EquipmentVisualPosition`, catalogo cerrado de diez claves, unica por
  split con `@@unique([splitId, visualPosition])`; `null` = ranura historica
  todavia sin ubicar, y varios `null` conviven porque PostgreSQL no los hace
  colisionar) e `isActive`. La identidad (`id`), la posicion visual y el
  nombre visible son tres conceptos distintos: solo el `id` relaciona
  objetos, compras, inventario, equipo y snapshots, asi que renombrar o
  ubicar una ranura nunca rompe ninguna relacion. Desde `1.2.0`
  `displayOrder` solo ordena las ranuras sin ubicar (las ubicadas usan el
  orden fijo del catalogo).
- **`SplitStoreItem`**: catalogo de objetos del split. `equipmentSlotId`
  con `onDelete: Restrict` (no se borra una ranura con objetos). `kpiCode`
  y `bonusPercent` (restringido en base de datos al conjunto cerrado
  `10/20/30/40/50`, igual que `SplitWeekLocation`) definen su efecto;
  `isForSale` controla su disponibilidad sin afectar a quien ya lo posee.
- **`SplitStoreItemImage`** (`1.2.0`): imagen opcional del objeto, en una
  entidad separada uno-a-uno (clave primaria = `splitStoreItemId`,
  `onDelete: Cascade`), con el mismo patron que `SplitParticipantAvatar`.
  Guarda los bytes **ya procesados a WebP en servidor**, el MIME real, el
  tamano (`byteSize > 0` y `= octet_length(imageData)`, restricciones de
  base de datos) y el `sha256` usado como `ETag` y como `imageVersion` en
  las DTO. Los bytes nunca se seleccionan en un listado y nunca se duplican
  dentro de una compra ni de una publicacion. La imagen es puramente
  cosmetica: es la unica propiedad que puede cambiar despues de la primera
  compra del objeto (ver `docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md`,
  seccion 22.5).
- **`ItemPurchase`**: compra confirmada, con instantanea inmutable de
  nombre, precio, ranura, KPI y porcentaje tal como eran al comprar.
  `@@unique([splitParticipantId, storeItemId])`: como mucho una compra del
  mismo objeto por participante. `onDelete: Restrict` hacia participante y
  objeto: una compra confirmada nunca desaparece.
- **`SplitParticipantItem`**: inventario. Referencia a la compra de origen
  (`purchaseId` unico) y al objeto vivo; `@@unique([splitParticipantId,
  storeItemId])` refuerza la regla de una unidad por objeto.
- **`SplitParticipantEquippedItem`**: equipo actual. Clave primaria
  compuesta `(splitParticipantId, equipmentSlotId)`: como mucho un objeto
  equipado por ranura. `ownedItemId` es ademas unico: el mismo objeto
  poseido nunca aparece equipado en dos ranuras a la vez (garantizado
  tambien porque el servicio siempre resuelve la ranura a partir del
  propio objeto, nunca de un valor enviado por el cliente).
- **`CreditLedgerEntry`**: libro de movimientos inmutable, fuente de
  verdad del saldo (`balance = suma de los movimientos del
  participante`). `publishedResultId` y `purchaseId` son referencias
  opcionales y unicas: como mucho un `WEEKLY_EARNING` por resultado
  publicado y un `PURCHASE` por compra. Restriccion de base de datos sobre
  el signo del importe segun el tipo, y sobre que cada movimiento tenga
  exactamente una referencia de origen coherente con su tipo.
- **`PublishedEquippedItem`**: instantanea del equipo congelada al
  publicar, una fila por objeto (nunca un JSON opaco). Las referencias
  vivas (`storeItemId`, `equipmentSlotId`) son `onDelete: SetNull` y solo
  de conveniencia: las vistas historicas usan siempre los campos
  `*Snapshot`.
- `PublishedParticipantWeeklyResult.creditsEarned` congela el mismo
  entero que el movimiento `WEEKLY_EARNING` vinculado.
  `PublishedKpiResult.equipmentBonusPoints`/`equipmentApplied` completan
  el desglose de bonus ya existente de profesion y localizacion
  (`basePointsBeforeProfession` sigue siendo la unica base persistida
  para los tres).

## Decisiones sobre fechas

- Todas las fechas de negocio (`Split.startDate`, `SplitWeek.startDate`,
  `SplitWeek.endDate`) se guardan como columnas `DATE` de PostgreSQL, sin
  componente horario.
- En el codigo de la aplicacion (`src/lib/dates.ts`) estas fechas se
  representan siempre como `Date` de JavaScript a medianoche **UTC**, y se
  parsean/formatean explicitamente como fechas de calendario
  (`AAAA-MM-DD`). Esto evita el error tipico de que un lunes se convierta
  en domingo (o viceversa) por la zona horaria del proceso.
- La generacion de semanas (`generateSplitWeeks`) es una funcion pura que
  no depende de la hora actual ni de la zona horaria del servidor.
- `currentCalendarDate()` (`0.8.5` / MVP-2C) obtiene "hoy" como fecha de
  calendario UTC, para comparar con `SplitWeek.startDate`/`endDate` (ver
  `docs/WEEKLY_LOCATIONS.md`). Acepta un `now` opcional para que la
  logica que la usa (`resolveWeekLocationWindow`, `findNextWeek`,
  `src/domain/location-window.ts`) siga siendo una funcion pura y
  comprobable con una fecha inyectada, nunca con el reloj real ni
  `sleep`.

## Backfill de splits existentes (`MVP-1B`)

La migracion `add_kpi_configuration` crea, ademas del enum y la tabla, una
sentencia `INSERT ... SELECT` que genera las diez `SplitKpiConfig` (una
por `KpiCode`, inactivas, con los valores predeterminados de Split 8) para
cada `Split` que ya existiera antes de aplicar la migracion. Sobre una
base de datos vacia esa sentencia no inserta ninguna fila. No modifica
`Person`, `SplitWeek` ni `SplitParticipant` existentes, ni cambia el
`status` de ningun split: un split `ACTIVE` que ya existiera quedara con
sus diez KPI inactivos hasta que el administrador los configure (ver
`docs/DECISIONS.md`).

## Entidades pospuestas

Estas entidades aparecen en el contexto funcional del producto pero
**no** se han creado todavia. Se documentan para que una futura entrega no
tenga que redescubrirlas:

- Despublicar/reabrir una semana ya publicada, o cierre irreversible de un
  split completo (`SplitStatus.CLOSED` ya existe, pero no se activa
  automaticamente).
- Las facciones se implementaron en `0.7.0` / MVP-2A (`SplitFaction`, ver
  `docs/FACTIONS.md`), las profesiones en `0.8.0` / MVP-2B
  (`SplitProfession`, ver `docs/PROFESSIONS_AND_PROFILES.md`), las
  localizaciones semanales en `0.8.5` / MVP-2C (`SplitWeekLocation`, ver
  `docs/WEEKLY_LOCATIONS.md`) y los objetos, el inventario, el equipo y la
  economia de creditos en `0.9.0` / MVP-2D (`SplitEconomySettings`,
  `SplitEquipmentSlot`, `SplitStoreItem`, `ItemPurchase`,
  `SplitParticipantItem`, `SplitParticipantEquippedItem`,
  `CreditLedgerEntry`, `PublishedEquippedItem`, ver
  `docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md`); "renombre" no es una entidad
  propia, es `positionPoints` ya existente.

Con `0.6.0` / MVP-1C, ademas de los diez origenes de datos de KPI
(`ProductivityImport`/`ProductivityWeeklyRow`,
`EscalationImport`/`EscalationWeeklyRow`, `QualityImport`/`QualityWeeklyRow`,
`VoiceImport`/`VoiceWeeklyRow` y las cinco entradas manuales), el modelo
incluye autenticacion (`User`) y el ciclo completo de resultados
(`WeekPublication`, `PublishedParticipantWeeklyResult`,
`PublishedKpiResult`). La clasificacion general y la vista individual se
calculan en servicio a partir de estas tablas publicadas, sin tablas
propias adicionales (ver `docs/RESULTS_PUBLICATION.md`).

Con `0.7.0` / MVP-2A se anade `SplitFaction` y su relacion opcional desde
`SplitParticipant` y desde `PublishedParticipantWeeklyResult` (snapshot).
La clasificacion de facciones tampoco anade tablas propias: se calcula en
servicio a partir de estos snapshots y de `positionPoints` (ver
`docs/FACTIONS.md`).

Con `0.8.0` / MVP-2B se anaden `SplitProfession` (con su relacion opcional
desde `SplitParticipant` y su snapshot en
`PublishedParticipantWeeklyResult`), el desglose del bonus en
`PublishedKpiResult` y `SplitParticipantAvatar`. El bonus no tiene tabla
propia ni contador persistido: es una funcion pura aplicada en el momento
de calcular la semana y congelada despues en la instantanea publicada (ver
`docs/PROFESSIONS_AND_PROFILES.md`).

Con `0.8.5` / MVP-2C se anade `SplitWeekLocation` (relacion uno-a-uno
opcional desde `SplitWeek`), su snapshot en `WeekPublication` (una sola
vez por semana, no por participante) y su desglose por KPI en
`PublishedKpiResult`. Igual que el bonus de profesion, no tiene contador
persistido propio: es una funcion pura (`applyLocationBonus`) aplicada de
forma independiente sobre el mismo `baseFinalPoints` y congelada despues
en la instantanea publicada (ver `docs/WEEKLY_LOCATIONS.md`).

Con `0.9.0` / MVP-2D se anaden `SplitEconomySettings`,
`SplitEquipmentSlot`, `SplitStoreItem`, `ItemPurchase`,
`SplitParticipantItem`, `SplitParticipantEquippedItem`,
`CreditLedgerEntry` y `PublishedEquippedItem`, ademas de
`creditsEarned` en `PublishedParticipantWeeklyResult` y
`equipmentBonusPoints`/`equipmentApplied` en `PublishedKpiResult`. El
bonus de objetos, igual que el de profesion y localizacion, no tiene
contador persistido aparte de su snapshot: es una funcion pura
(`applyEquipmentBonuses`) aplicada de forma independiente sobre el mismo
`baseFinalPoints` y congelada despues en `PublishedEquippedItem` y en el
desglose de `PublishedKpiResult` (ver
`docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md`). La migracion incluye ademas un
backfill idempotente de `CreditLedgerEntry`/`creditsEarned` para toda
publicacion anterior a esta version, a partir exclusivamente de
`totalKpiPoints` ya publicado.

Con `1.0.0` / MVP-3 se anaden `NewsItem` (contenido inmutable de una
noticia: origen, categoria, prioridad, titulo, cuerpo, `eventKey` de
idempotencia, y datos de envio manual) y `NewsDelivery` (entrega privada
a exactamente un destinatario: una `Person` para noticias de jugador o un
`User` para noticias de administracion, con `readAt`/`archivedAt` y el
`actionPath` ya construido en servidor). Ninguna otra tabla existente
cambia: las noticias se generan leyendo el resultado de operaciones ya
persistidas por los servicios de negocio (alta de participante,
activacion, facciones, profesiones, localizaciones, mercado, compra y
publicacion), nunca al reves. Ver `docs/NEWS_CENTER.md`.

Con `1.2.0` (equipo visual, inventario RPG e imagenes de objetos) se anade
el enum `EquipmentVisualPosition` y la tabla `SplitStoreItemImage`, y
`SplitEquipmentSlot` gana `visualPosition` (nullable, unica por split) e
`isActive`. La migracion es estrictamente aditiva y no destructiva: ninguna
ranura, objeto, compra, inventario, equipo, movimiento de creditos ni
publicacion se elimina, se sustituye ni se reasigna, y `visualPosition` solo
se rellena automaticamente por coincidencia exacta del nombre normalizado
con un nombre base del catalogo (nunca se deduce una posicion a partir de un
nombre libre). Ninguna otra tabla cambia: la posicion visual es presentacion
y **no** se congela en `PublishedEquippedItem`, cuyos snapshots de nombre,
ranura, KPI y porcentaje siguen siendo la verdad historica. Ver
`docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md`, seccion 22.

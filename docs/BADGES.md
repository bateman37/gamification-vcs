# Badges y vitrina histórica (`1.2.3`)

Documento funcional exhaustivo del módulo **Badges**: medallas permanentes
que una `Person` obtiene por ganar un Split (MVP), pertenecer a la facción
ganadora (MVP Team) o ganar una categoría KPI, más el histórico importado
de forma permanente e idempotente de los 9 Splits anteriores
(`legacy-badges-v1`, 18 destinatarios, 127 concesiones).

Los badges pertenecen siempre a la **persona global** (`Person`), nunca al
alias, al participante de un split, al nivel ni a la facción.

## 1. Catálogo cerrado de badges

Fuente única de verdad tipada: `src/domain/badges/badge-catalog.ts`
(`BADGE_CATALOG`), igual que el catálogo de KPI
(`src/domain/kpis/catalog.ts`). No existe ningún CRUD de administración que
permita crear o borrar categorías desde la interfaz.

| # | Categoría | `code` | Tipo | Deriva de |
|---|---|---|---|---|
| 1 | Cazador de soluciones | `SOLUTION_HUNTER` | `KPI` | `KpiCode.SOLUTION_HUNTER` |
| 2 | Explorador de datos | `DATA_EXPLORER` | `KPI` | `KpiCode.DATA_EXPLORER` |
| 3 | Embajador de voz | `VOICE_AMBASSADOR` | `KPI` | `KpiCode.VOICE_AMBASSADOR` |
| 4 | Maestro Artesano | `MASTER_CRAFTSMAN` | `KPI` | `KpiCode.MASTER_CRAFTSMAN` |
| 5 | Domador de Escaladas | `ESCALATION_TAMER` | `KPI` | `KpiCode.ESCALATION_TAMER` |
| 6 | Cronomagia laboral | `WORK_CHRONOMANCY` | `KPI` | `KpiCode.WORK_CHRONOMANCY` |
| 7 | Travesía del Padawan | `LEGACY_PADAWAN_JOURNEY` | `KPI` | ninguno (histórica) |
| 8 | Guardián de la Estabilidad | `STABILITY_GUARDIAN` | `KPI` | `KpiCode.STABILITY_GUARDIAN` |
| 9 | Redactor estrella | `STAR_WRITER` | `KPI` | `KpiCode.STAR_WRITER` |
| 10 | Estudiante entusiasta | `ENTHUSIASTIC_STUDENT` | `KPI` | `KpiCode.ENTHUSIASTIC_STUDENT` |
| 11 | Aprendiz experto | `EXPERT_APPRENTICE` | `KPI` | `KpiCode.EXPERT_APPRENTICE` |
| 12 | Guardián del conocimiento | `LEGACY_KNOWLEDGE_GUARDIAN` | `KPI` | ninguno (histórica) |
| 13 | MVP | `MVP` | `MVP` | — |
| 14 | MVP Team | `TEAM_MVP` | `TEAM_MVP` | — |

Para las diez categorías que corresponden a un `KpiCode` activo del
catálogo actual, `Badge.code` **reutiliza exactamente ese mismo valor**: es
lo que permite que un badge nuevo se derive automáticamente
(`ensureBadgeCatalogSeeded`, `src/server/services/badge.service.ts`) cuando
el catálogo de KPI crezca en el futuro, sin necesitar una migración de
código dedicada al catálogo de badges (solo la migración de Prisma que ya
haría falta para el `KpiCode` nuevo). "Travesía del Padawan" y "Guardián
del conocimiento" son categorías **históricas**: no corresponden a ningún
`KpiCode` del catálogo activo de `MVP-1B`, y siguen existiendo con su
propio `code` fijo aunque nunca se deriven de la configuración viva.

`ensureBadgeCatalogSeeded` se llama únicamente en dos operaciones de
negocio explícitas (nunca en cada arranque de la aplicación): al finalizar
un split y al importar/reintentar `legacy-badges-v1`. Es un `upsert` por
`code`, idempotente: repara nombre/tipo/`kpiCode`/orden si el código fuente
cambia, nunca borra ni duplica una categoría.

La normalización de nombres (`Badge.nameNormalized`, único en base de
datos) reutiliza `normalizeForMatching` (`src/lib/normalize.ts`: sin
mayúsculas, sin tildes, espacios exteriores recortados, espacios internos
colapsados) para impedir duplicados por variaciones de escritura.

## 2. Reglas de concesión

Ver `src/domain/badges/badge-winners.ts` (funciones puras) y
`src/server/services/badge-award.service.ts` (orquestación con acceso a
datos, siempre dentro de la transacción de `finalizeSplit`).

### 2.1. MVP

Al finalizar un split: gana el badge la persona (o personas, en un empate
real) en el rango 1 de la clasificación general individual oficial
(`computeSplitClassification`, `src/server/services/classification.service.ts`).
Se reutiliza exactamente ese ranking y su criterio de empate; el módulo de
badges no reimplementa ningún cálculo.

### 2.2. MVP Team

Al finalizar un split que usa facciones: ganan el badge todas las personas
que **pertenecen actualmente** a la (o las, en empate) facción(es) en el
rango 1 de la clasificación acumulada de facciones
(`computeFactionClassification`). "Actualmente" significa la asignación
viva `SplitParticipant.factionId` releída **dentro** de la misma
transacción serializable que cierra el split (`buildBadgeGrantPlan` se
invoca con `tx`, nunca con datos calculados antes de abrir la
transacción): es la única pieza del cierre de split que puede cambiar hasta
el último instante, a diferencia de las clasificaciones (que leen
publicaciones inmutables y sí se calculan antes de la transacción, igual
que el resto de `finalize-split.service.ts`).

Un split sin ninguna facción creada (`factionClassification.hasFactionData
=== false`) no concede ningún MVP Team.

### 2.3. Badges de categoría KPI

Al finalizar un split: para cada KPI **activo** del split, gana el badge de
esa categoría quien tenga el mayor total acumulado
(`computeSplitKpiClassification(db, splitId, kpiCode, null)`, rango 1). Un
empate exacto concede el badge a todos los empatados. Solo se conceden
badges de los KPI activos en ese split; un KPI histórico conserva su badge
aunque ya no esté activo en los splits actuales (nunca se retira una
concesión ya emitida).

### 2.4. Empates: mismo criterio que el podio de la noticia final

Los tres badges anteriores conceden a **todas** las personas empatadas en
el rango 1, exactamente el mismo criterio que ya usa `buildFinalizationPodium`/
`buildFinalizationFactionWinner`/`buildFinalizationKpiWinner`
(`src/domain/split-finalization.ts`, `1.2.2`) para la noticia final: si el
podio ya trata un empate en el primer puesto como varios "Ganadores", los
badges hacen exactamente lo mismo. No se inventa ningún criterio de
desempate adicional para las medallas.

### 2.5. Momento de concesión e inmutabilidad

- Los badges nuevos se generan **dentro** de la transacción serializable de
  `finalizeSplit` (`src/server/services/finalize-split.service.ts`), justo
  después de la noticia administrativa y antes de cerrar la transacción. Si
  la finalización completa y la concesión de badges no pueden confirmarse
  juntas, toda la transacción falla: nunca queda un split finalizado sin
  sus badges, ni al revés.
- `grantSplitFinalizationBadges` es idempotente por `idempotencyKey`
  (`upsert`, formato `split-finalized-badge:{splitId}:{badgeCode}:{personId}`).
  Como `finalizeSplit` ya es idempotente como un todo (un split `CLOSED`
  hace que un reintento devuelva `{ alreadyFinalized: true }` sin volver a
  entrar en la transacción), un doble clic nunca duplica ni badges ni la
  noticia agregada.
- Una concesión confirmada no se edita ni se borra desde la interfaz.
  Ningún badge de un split ya finalizado se recalcula.
- `BadgeAward.badgeNameSnapshot` y `splitLabelSnapshot` congelan el nombre
  del badge y la etiqueta del split en el momento de conceder: renombrar
  después el split, o (en teoría) el badge, no reescribe una concesión ya
  emitida.

## 3. Modelo de datos

Migración `20260916084749_add_badges`. Tres modelos nuevos, más el valor
`BADGE` añadido a `NewsCategory`.

### 3.1. `Badge` (definición de categoría)

- `code` (único): identificador interno estable.
- `name`, `nameNormalized` (único): nombre visible y su versión normalizada.
- `type`: `MVP` | `TEAM_MVP` | `KPI`.
- `kpiCode`: `KpiCode?`, solo para las categorías que derivan de un KPI
  activo; `null` en MVP, MVP Team y las dos categorías históricas.
- `sortOrder`: orden de presentación (tabla de la sección 1).

### 3.2. `BadgeHistoricalRecipient` (destinatario histórico)

Capa explícita de indirección para no depender de los UUID de `Person`
generados en el pasado (sección 3.3 del encargo):

- `datasetVersion` (por ejemplo `legacy-badges-v1`) + `normalizedName`:
  únicos juntos — un destinatario por nombre normalizado dentro de la
  misma versión del dataset.
- `originalName`: el nombre tal como aparecía en el histórico, conservado
  para auditoría (nunca se muestra el normalizado al administrador).
- `personId` (único, opcional, `onDelete: SetNull`): la persona real
  vinculada, o `null` = "Pendiente de vincular". La unicidad impide que una
  persona quede vinculada a dos destinatarios a la vez; corregir un enlace
  equivocado es una operación explícita (`relinkBadgeHistoricalRecipient`),
  nunca automática.
- `linkedAt`: momento del enlace (o `null`, sin vincular).

### 3.3. `BadgeAward` (concesión individual)

- `badgeId` (`onDelete: Restrict`): categoría concedida.
- `personId` / `recipientId`: **exactamente uno** de los dos (restricción
  `BadgeAward_owner_exclusive_check` en base de datos, mismo patrón que
  `NewsDelivery_recipient_exclusive_check`). Una concesión automática de un
  split real usa siempre `personId` (la persona ya está identificada); una
  concesión importada del histórico usa siempre `recipientId`, y su
  propietario efectivo se resuelve **dinámicamente** vía
  `recipient.personId` en el momento de consultar — enlazar o corregir un
  destinatario nunca reescribe la fila de la concesión.
- `splitId` (opcional, `onDelete: SetNull`) + `splitLabelSnapshot`
  (obligatorio): el split real para una concesión futura, o `null` +
  `"Split N"` para una concesión histórica. Nunca se inventa una fecha
  cuando el origen no la tiene: `grantedAt` es `null` en toda concesión
  histórica.
- `badgeNameSnapshot`, `reason`: texto congelado y motivo legible/auditable.
- `origin`: `LEGACY_IMPORT` | `SPLIT_FINALIZATION`.
- `idempotencyKey` (único): impide duplicados por reintento, doble clic o
  reejecución de la importación.

### 3.4. `NewsCategory.BADGE`

Nueva categoría de noticia (icono `Award`, ver
`src/domain/news-category-display.ts`) para la noticia personal agregada de
badges conseguidos al finalizar un split.

## 4. Histórico inmutable `legacy-badges-v1`

### 4.1. Fuente versionada

`src/domain/badges/legacy-badges-v1.ts` (`LEGACY_BADGE_GRANTS`): las 127
concesiones individuales transcritas literalmente del apéndice del
encargo, como datos TypeScript versionados en el repositorio — nunca un
Excel en tiempo de ejecución. No se guarda ningún contador acumulado: las
127 filas existen todas, porque es necesario poder consultar en qué split
se obtuvo cada medalla. `LEGACY_BADGES_V1_EXPECTED_TOTALS` fija los
controles obligatorios de integridad (18 destinatarios, 127 concesiones, 9
MVP, 30 MVP Team, 88 KPI, y el total exacto de cada una de las catorce
categorías).

`src/domain/badges/legacy-badges-validator.ts` (`validateLegacyBadgeDataset`,
función pura) recalcula todos esos totales a partir de las concesiones
individuales — nunca de un contador aparte que pudiera desincronizarse — y
devuelve la lista de discrepancias, si las hay.

El alias histórico `Team MVP` (nombre del Excel original) se reconoce como
la misma categoría que el nombre canónico visible `MVP Team`
(`resolveBadgeCodeForCategoryLabel`, `src/domain/badges/badge-catalog.ts`,
normaliza mayúsculas/tildes/espacios y compara también contra ese alias
explícito).

### 4.2. Importación transaccional e idempotente

`importLegacyBadgesV1` (`src/server/services/badge-historical.service.ts`):

1. Valida el dataset contra `LEGACY_BADGES_V1_EXPECTED_TOTALS`. Si no
   cuadra, **falla explícitamente sin escribir nada**.
2. Dentro de una única transacción: crea o repara el catálogo
   (`ensureBadgeCatalogSeeded`), crea o reutiliza los 18 destinatarios
   históricos (`upsert` por `datasetVersion` + nombre normalizado) y crea
   las concesiones ausentes (idempotencia por `idempotencyKey`, formato
   `legacy-badges-v1:{split normalizado}:{badgeCode}:{recipientId}`).
   Reejecutarla nunca duplica nada ni reescribe una concesión ya existente.
3. Tras la transacción, ejecuta la vinculación automática
   (`runAutomaticBadgeRecipientLinking`).

Comandos para restaurar el histórico:

- **Administración → Badges → Administración histórica**: botón
  "Importar legacy-badges-v1", disponible en todo momento para ejecutar o
  reintentar la importación de forma segura.
- **Línea de comandos** (`.env` configurado, migraciones ya aplicadas):

  ```powershell
  npm run db:import-legacy-badges
  ```

  Ejecuta `scripts/import-legacy-badges.ts` (mismo patrón que
  `scripts/create-first-admin.ts`) e imprime el resumen (destinatarios y
  concesiones nuevos/ya existentes, personas enlazadas/pendientes).

Deliberadamente **no** se integra como backfill dentro de la propia
`migration.sql` (a diferencia, por ejemplo, del backfill de
`SplitPositionPointRule` en `add_position_points`): el encargo pide
explícitamente un comando explícito y documentado, repetible después de
vaciar la base de datos, y una acción administrativa para reintentarlo; un
dataset fijo de 127 filas no depende además del número de `Split`
existentes, a diferencia de esos otros backfills (ver
`docs/DECISIONS.md`).

### 4.3. Vinculación automática

`runAutomaticBadgeRecipientLinking`: para cada destinatario todavía sin
vincular, busca personas actuales cuyo `fullName` normalizado coincida.
Vincula **solo** cuando hay exactamente una coincidencia inequívoca y esa
persona no está ya vinculada a otro destinatario (protegido también por la
restricción única de base de datos sobre `personId`); con cero o varias
coincidencias, el destinatario queda "Pendiente de vincular". Segura de
reejecutar: nunca sobrescribe un enlace ya confirmado.

### 4.4. Administración histórica (`/badges/administracion`, solo `ADMIN`)

Sección discreta dentro del módulo Badges:

- Resumen: destinatarios totales, enlazados, pendientes, concesiones
  importadas (`listBadgeHistoricalAdminSummary`).
- Botones para (re)ejecutar la importación y para reejecutar la
  vinculación automática.
- Una fila por destinatario histórico, con un selector para vincular,
  corregir o desvincular manualmente (`relinkBadgeHistoricalRecipient`),
  sin alterar ni borrar ninguna concesión ya asociada a ese destinatario.

## 5. Clasificación general y vitrina

### 5.1. Clasificación general (`computeBadgeClassification`)

Agrega **todas** las concesiones ya emitidas por persona en un número
acotado de consultas (nunca una por persona ni una por badge, sección 9 del
encargo): una consulta a `BadgeAward` con su `badge`/`recipient.personId`,
una a `Person` para los nombres. Una concesión histórica todavía sin
vincular (`recipient.personId === null`) **nunca** contamina esta
agregación pública: se cuenta en el resumen administrativo, pero no
aparece atribuida a nadie hasta estar enlazada.

Orden (`sortBadgeClassification`, `src/domain/badges/badge-classification.ts`,
función pura):

- Por defecto (`MVP`): mayor número de MVP → mayor total de badges → mayor
  número de MVP Team → nombre alfabético (desempate visual estable).
- Cualquier otro criterio elegido (`MVP Team`, `Total de badges`, o el
  `code` de cualquier categoría KPI, incluidas las históricas): mayor valor
  del criterio → mayor total de badges → nombre.
- Las personas con cero en la categoría elegida siguen apareciendo, al
  final.

### 5.2. Vitrina de una persona (`getPersonBadgeShowcase`)

Devuelve **todo el catálogo**, no solo lo conseguido: las categorías sin
ninguna concesión aparecen con `count: 0` (la interfaz las muestra
bloqueadas/atenuadas, nunca ocultas). Cada categoría conseguida trae su
lista de apariciones (`splitLabel` + `grantedAt` cuando existe, nunca
inventado para el histórico) para poder abrir "en qué splits se obtuvo".

### 5.3. Sin avatar real en Badges

La clasificación general es pública entre **todos** los usuarios
autenticados, pero la ruta de avatar de ficha
(`/api/fichas/[splitParticipantId]/avatar`, `readAvatarForViewer`) está
pensada para que un `PARTICIPANT` vea únicamente **su propio** avatar.
Badges no amplía esa autorización (afectaría a toda la aplicación, no solo
a este módulo): usa siempre un avatar decorativo por iniciales
(`src/components/InitialsAvatar.tsx`, puramente CSS/texto), tanto en la
clasificación general como en la vitrina. Ver `docs/DECISIONS.md`.

## 6. Navegación y autorización

- **Jugador**: `Noticias · Resultados · Badges · Fichas`.
- **Administrador**: `Resultados · Badges · Analítica avanzada` (con
  `Fichas` al final, solo si tiene `personId`).
- `/badges` (clasificación general y "Mi vitrina"/"Badges de la persona")
  es accesible para cualquier usuario autenticado, protegido en
  `src/middleware.ts` igual que `/resultados`/`/fichas`.
- `/badges/administracion` es exclusivo de `ADMIN`, tanto en middleware
  (`isAdminOnlyPath`) como en la propia página (`requireAdminSession`) y en
  cada acción de servidor (`src/server/actions/badge.actions.ts`).
- Un `PARTICIPANT` nunca elige qué persona ve mediante un parámetro de la
  URL: `/badges/page.tsx` resuelve `personId` siempre desde
  `session.user.personId` cuando el rol no es `ADMIN`, exactamente el mismo
  criterio que `/resultados` y `/fichas` (`docs/DECISIONS.md`).

## 7. Integración con Finalizar Split y noticias

`finalizeSplit` (`1.2.2`, ampliado en `1.2.3`) añade, dentro de su misma
transacción serializable, después de la noticia administrativa y antes de
cerrar:

1. `buildBadgeGrantPlan(tx, splitId, classification, factionClassification, kpiClassifications)`:
   plan de ganadores (MVP, MVP Team, badges KPI), resolviendo `personId`
   con una única consulta a `SplitParticipant` dentro de la transacción.
2. `grantSplitFinalizationBadges(tx, ...)`: concede los badges (`upsert`
   idempotente) y devuelve, por persona premiada, la lista agregada de
   badges conseguidos en este split.
3. Una **única** noticia personal agregada por persona premiada (nunca una
   por badge, para evitar spam): `badgesEarnedNewsTemplate`
   (`src/domain/news-templates.ts`), categoría `BADGE`, clave de
   idempotencia `badges-earned:{splitId}:{personId}`, enlace a "Mi
   vitrina" (`{ kind: "BADGES_SHOWCASE" }`, `src/domain/news-links.ts` →
   `/badges?vista=vitrina`).

La noticia final existente (podio/facción/KPI, `1.2.2`) no cambia: sigue
generándose exactamente igual, con los mismos ganadores. No se conceden
badges al cerrar una semana, únicamente al finalizar el split completo.

## 8. Rendimiento

- Clasificación general: 3 consultas acotadas (concesiones, personas,
  nada más — no hay avatares que resolver, ver sección 5.3), nunca una por
  persona ni una por badge.
- Vitrina de una persona: 2 consultas (catálogo completo + concesiones de
  esa persona).
- Importación histórica: consultas acotadas al tamaño fijo del dataset (18
  destinatarios, 127 concesiones), nunca proporcionales al resto de la base
  de datos.
- Concesión al finalizar: 1 consulta a `SplitParticipant` del split, más un
  `upsert` por badge concedido (acotado al número de ganadores de ese
  split, nunca al total histórico).

## 9. Fuera de alcance de `1.2.3`

- CRUD de categorías de badge (crear, editar o borrar desde la interfaz).
- Recalcular badges de un split ya finalizado.
- Badges por semana (solo se conceden al finalizar el split completo).
- Imagen o icono propio por badge (usa la paleta de tokens existente:
  ámbar/dorado para MVP, violeta para MVP Team, azul para las categorías
  KPI conseguidas).
- Cualquier sistema genérico de logros configurables.

# Asistencia semanal y puntos por hora (`1.1.1`)

Esta entrega sustituye la politica de "posibles ausencias" de `1.1.0`
(un umbral configurable de KPI en `COMPUTED=0`/`VAC`, revisable fila a
fila) por una regla objetiva y unica: la asistencia semanal de una
persona se determina **exclusivamente** por las horas totales trabajadas
esa semana. Ya no hay heuristica, umbral ni excepcion manual: hay un dato
operativo (horas) y una regla (`totalHours > 0` = presente, `= 0` =
ausente).

## 1. El bloque de horas semanales

Las horas semanales viven en la misma tabla que Cronomagia laboral
(`ChronomancyWeeklyEntry`, KPI `WORK_CHRONOMANCY`), pero desde `1.1.1` son
dos conceptos separados:

- **`totalHours`** es ahora obligatorio para **todo** participante
  aplicable de **toda** semana, independientemente de si
  `WORK_CHRONOMANCY` esta activo en el split. Es el unico dato de
  asistencia.
- **`productiveHours`** sigue siendo exclusivo del calculo de puntos de
  Cronomagia laboral: solo se pide y se guarda cuando el KPI esta activo
  **y** aplica al nivel del participante (columna nullable en el esquema
  desde esta version). Cuando no aplica, el campo enviado se ignora y
  nunca se guarda un valor implicito.

`src/domain/attendance.ts` (`resolveWeeklyAttendance`) es la unica funcion
que decide la asistencia, a partir exclusivamente de la fila guardada de
horas. No usa ningun otro KPI, `VAC`, creditos ni el nivel del
participante.

### Matriz de estados del bloque

| Fila guardada | `totalHours` | Asistencia | Cronomagia (si esta activo y aplica) |
| --- | --- | --- | --- |
| No existe | — | Desconocida (`recorded: false`) | Bloquea la publicacion |
| Existe, campo enviado vacio | normalizado a `0` | `ABSENT` | `VAC` |
| Existe, `totalHours = 0` | `0` | `ABSENT` | `VAC` |
| Existe, `totalHours > 0` | `> 0` | `PRESENT` | `COMPUTED`/`VAC` segun `productiveHours` |

Un bloque nunca guardado para un participante aplicable dejo la semana
incompleta: `getChronomancyLoadStatus`/`getChronomancyFormView` calculan
esta cobertura siempre (no solo cuando `WORK_CHRONOMANCY` esta activo), y
`saveChronomancyEntries` acepta guardar solo `totalHours` cuando el KPI
esta inactivo o no aplica al nivel.

## 2. Prioridad absoluta sobre cualquier otro KPI

`computeWeeklyResults` (`src/server/services/weekly-results.service.ts`)
resuelve primero la asistencia de cada participante. Si es ausente,
**ignora** cualquier dato operativo cargado para esa persona esa semana
(Excel, entradas manuales, Cronomagia): cada KPI aplicable a su nivel se
publica como el nuevo estado `ABSENT` (sin puntos), y cada KPI no
aplicable como `NOT_APPLICABLE`, exactamente igual que para una persona
presente. Nunca se lee ni se recalcula el resto de `RawDataContext` para
una persona ausente.

Una ausencia significa, en la misma semana:

- `0` puntos KPI, `0` creditos ganados, ningun bonus (profesion,
  localizacion, objetos): todos los bonus se aplican solo sobre un
  `baseFinalPoints` no nulo, que una ausencia nunca produce.
- Sin posicion numerica (`weeklyRank: null`): el ranking semanal se
  calcula **solo** entre presentes (`rankByScoreDescending` sobre
  `presentWorking`).
- **Si** recibe puntos por posicion (`positionPoints`), iguales a los de
  la ultima posicion efectivamente ocupada por una persona presente esa
  semana (`positionPointsRuleRank`, ver seccion 3). Esos puntos cuentan
  igual que cualquier otro en la clasificacion general y en el top-3 de
  facciones.

## 3. Ranking semanal y "ultima posicion efectiva"

El ranking semanal (`weeklyRank`) usa unicamente a los presentes,
ordenados por `totalKpiPoints` descendente con el mismo ranking de
competicion del resto del proyecto (empates comparten posicion, la
siguiente salta). El numero de presentes es el nuevo denominador de "x de
n" en las vistas semanales (`presentParticipantCount`,
`rankedParticipantCount` congelado); el denominador de vistas
**generales/acumuladas** (clasificacion general, facciones, historico)
sigue siendo el total de participantes del split — ver la decision
registrada en `docs/DECISIONS.md`.

Cada ausente recibe `positionPointsRuleRank` = el `rank` de la ultima
entrada del ranking de presentes (no necesariamente igual al numero de
presentes, si hay empate en el ultimo puesto) y los `positionPoints`
configurados para esa posicion. **Si nadie estuvo presente esa semana**
(caso extremo, valido desde esta version), no hay ninguna posicion
efectiva: todas las ausencias reciben `positionPointsRuleRank: null` y
`positionPoints: 0`. La migracion relaja la restriccion
`rankedParticipantCount >= 1` a `>= 0` precisamente para permitir esta
semana (0 presentes, N ausentes) sin dejar de proteger el resto de
invariantes con `CHECK` en Postgres.

## 4. Bloqueo de publicacion

`computeWeeklyResults` solo considera una semana `isComplete` cuando,
ademas de la cobertura de KPI ya existente, el bloque de horas esta
guardado para **todos** los participantes aplicables
(`hoursRecordedForAll`). Si falta una sola fila de horas, la semana no es
publicable aunque el resto de KPI este completo: `publishWeek` sigue
delegando en `computeWeeklyResults` dentro de su propia transaccion, sin
ninguna comprobacion adicional duplicada.

## 5. Snapshot e historico

`PublishedParticipantWeeklyResult` incorpora cuatro columnas nuevas,
todas nullable y aditivas (sin migrar datos existentes):
`attendanceStatus`, `totalHoursSnapshot`, `productiveHoursSnapshot` y
`positionPointsRuleRank`. `weeklyRank` pasa a ser nullable (`null` para
una ausencia). `PublishedKpiOutcomeStatus` gana el valor `ABSENT`.

Una publicacion **anterior** a `1.1.1` nunca se reinterpreta: sus filas
quedan con `attendanceStatus: null` (compatibilidad legada, distinta de
`ABSENT`), y todas las vistas historicas y de analitica que leen este
campo tratan `null` como "cobertura desconocida", nunca como presente ni
como ausente. En el dominio de Analitica avanzada este concepto legado se
llama `UNKNOWN_LEGACY` (solo en memoria, nunca se persiste ni se
confunde con `ABSENT`).

## 6. Efecto en clasificacion, facciones, creditos e individual

- **Clasificacion general** (`classification.service.ts`): sigue sumando
  `positionPoints` de todas las semanas publicadas de cada persona,
  ausencias incluidas; `weeklyRankByWeek` pasa a `Map<string, number |
  null>` y se anade `attendanceStatusByWeek` para que la vista pueda
  explicar una semana ausente sin inventar una posicion.
- **Facciones**: la suma de los tres mejores de cada semana usa
  `positionPoints`, que ya incluye los de una ausencia con su ultima
  posicion efectiva: una faccion puede seguir contando con esos puntos en
  su top-3 semanal.
- **Creditos**: `creditsEarned = max(0, floor(totalKpiPoints))` sigue
  igual; una ausencia produce siempre `totalKpiPoints = 0`, luego
  `creditsEarned = 0`. No se genera ningun movimiento de credito adicional
  ni deuda por la ausencia.
- **Vista individual y resumen de noticias**: una persona ausente ve su
  fila marcada con el texto unico `Ausencia · Sin datos semanales`
  (`ABSENCE_LABEL`, `src/domain/attendance.ts`), nunca "VAC" ni
  "Vacaciones". El resumen semanal de noticias (`weekPublishedNewsTemplate`)
  distingue este caso; si nadie estuvo presente esa semana, se genera
  ademas un aviso administrativo dedicado
  (`adminWeekAllAbsentNewsTemplate`) que no afirma un ranking inexistente.

## 7. Puntos por hora (PPH)

Nueva medida de rendimiento real, siempre con el mismo numerador y
denominador:

- **Numerador**: puntos KPI (`totalKpiPoints`/`finalPoints`), nunca
  puntos por posicion ni creditos.
- **Denominador**: horas totales trabajadas (`totalHours`), nunca horas
  productivas ni una jornada teorica de 40 horas.

`src/domain/points-per-hour.ts` concentra las tres funciones puras:

- `computeWeeklyPointsPerHour(points, totalHours)`: PPH de una unica
  semana presente. `null` (nunca `0`/`NaN`/infinito) si `totalHours <= 0`.
- `computePeriodPointsPerHour(entries)`: PPH de un periodo como **razon de
  sumas** — `suma(puntos) / suma(horas)` — nunca la media de los PPH
  semanales (una semana de 8 horas no debe pesar igual que una de 40).
  `null` si no hay entradas o la suma de horas es `0`.
- `consolidatePphAcrossSplits(observations)`: consolidacion cuando una
  misma persona tiene varios splits simultaneos la misma semana de
  calendario. Si las horas coinciden entre splits, se usan una sola vez y
  los puntos son la media simple entre splits equivalentes; si las horas
  difieren, se marca la incidencia (`inconsistent_hours`) sin elegir un
  valor arbitrario ni sumar horas duplicadas.

Una ausencia nunca aporta PPH (numerador y denominador ambos ausentes);
una semana sin publicar o con `totalHours` legado desconocido tampoco.

## 8. Analitica avanzada: nuevo selector de medida

La politica de exclusion de posibles ausencias de `1.1.0` se elimina por
completo (`DEFAULT_ZERO_THRESHOLD`, `excludeZeroObservations`,
`zeroThreshold`, `manualOverrides`, el componente `ExclusionsPanel` y los
parametros de URL `exclusion`/`umbral`/`ov_*`): la asistencia objetiva de
esta version la vuelve innecesaria, y mantenerla junto a la nueva regla
habria producido dos criterios de "quien cuenta" contradictorios entre
si.

En su lugar, los bloques 1-4 de `/analitica` incorporan un selector de
medida (`AnalyticsMeasure`, `src/app/analitica/filters.ts`, parametro de
URL `medida`):

- **`% del maximo`** (`percentage`, predeterminado): el mismo calculo
  "sin gamificacion" ya existente.
- **`Puntos KPI`** (`points`): puntos brutos, sin dividir por el maximo.
- **`Puntos por hora`** (`pph`): usa las funciones de la seccion 7 sobre
  las horas totales congeladas de cada observacion
  (`ParticipantWeekObservation.totalHours`).

Una observacion ausente (`attendanceStatus: "ABSENT"`) o con cobertura
legada desconocida (`attendanceStatus: null`, `UNKNOWN_LEGACY`) se
excluye de las estadisticas de rendimiento del periodo bajo cualquier
medida, sin ningun ajuste manual: ya no hace falta, porque la exclusion
ahora refleja un hecho objetivo (no hubo trabajo esa semana, o no se sabe
si lo hubo) en vez de una heuristica revisable.

## 9. Limitaciones conocidas

- No se ha implementado una serie de PPH por KPI individual, solo un
  indice de equipo agregado; el detalle por persona muestra el PPH
  semanal y del periodo pero no un desglose por KPI.
- No hay backfill de asistencia para publicaciones anteriores a esta
  version: quedan permanentemente en `UNKNOWN_LEGACY`.

## 10. Ejemplos numericos de referencia

Casos usados como base de las pruebas automaticas (`tests/points-per-hour.test.ts`,
`tests/weekly-attendance.test.ts`, `tests/publish-week.test.ts`):

- **I5/I6** (ranking de presentes y ultima posicion efectiva): con 3
  presentes rankeados 1/2/3 y 2 ausentes, ambos ausentes reciben
  `positionPointsRuleRank = 3` y los puntos de esa posicion.
- **I7** (todos ausentes): ninguna posicion efectiva; todas las ausencias
  reciben `positionPointsRuleRank: null` y `positionPoints: 0`;
  `rankedParticipantCount = 0` es valido.
- Puntos por hora: `60` puntos / `40` horas = `1.5` PPH semanal; periodo
  de dos semanas `60/40` y `30/20` = `90/60 = 1.5` (razon de sumas), nunca
  la media `(1.5 + 1.5)/2` que en este caso coincide mas por simetria que
  por metodo — con horas distintas (`60/40` y `10/10`) la razon de sumas
  (`70/50 = 1.4`) difiere de la media de ratios (`(1.5 + 1)/2 = 1.25`).

## 11. Pruebas relacionadas

- `tests/points-per-hour.test.ts` — dominio puro de PPH (K1).
- `tests/weekly-attendance.test.ts` — resolucion de asistencia, bloqueo de
  publicacion, ranking/posicion de ausentes, caso "todos ausentes",
  clasificacion y facciones con ausencias (K2/K3).
- `tests/publish-week.test.ts`, `tests/weekly-results.test.ts` — snapshot
  de asistencia al publicar.
- `tests/manual-kpi-entries.test.ts` — bloque de horas independiente de si
  `WORK_CHRONOMANCY` esta activo, cobertura calculada siempre.
- `tests/advanced-analytics-domain.test.ts`,
  `tests/advanced-analytics-access.test.ts` — nuevo selector de medida,
  eliminacion de la politica de exclusion (K4).

## 12. Checklist manual pendiente para Dennis

- [ ] Revisar en un split real que el bloque de horas aparece siempre en
      `/splits/[id]/weeks/[weekId]/kpis/cronomagia/introducir`, incluso con
      `WORK_CHRONOMANCY` inactivo.
- [ ] Publicar una semana con al menos una persona con `totalHours = 0` y
      confirmar el texto `Ausencia · Sin datos semanales` en
      `/splits/[id]/weeks/[weekId]/resultados`, en la clasificacion y en la
      ficha individual.
- [ ] Confirmar en `/analitica` que el selector `% del maximo | Puntos KPI
      | Puntos por hora` funciona y que las ausencias quedan fuera de las
      estadisticas de rendimiento.
- [ ] Confirmar que una publicacion anterior a `1.1.1` se sigue mostrando
      sin errores (sin asistencia, sin PPH, sin selector roto).

# Resultados, publicacion y clasificacion (`0.6.0` / MVP-1C)

Cierra el ciclo semanal: calcular los resultados de una semana completa,
revisarlos, publicarlos de forma irreversible y consultarlos (vista
individual y clasificacion general del split).

## 1. Regla unica de completitud semanal

Una semana esta lista para mostrar/publicar resultados unicamente cuando:

```ts
totalActiveCount > 0 && loadedCount === totalActiveCount
```

`{ loadedCount, totalActiveCount }` viene siempre de
`getWeeklyKpiLoadSummary` (`src/server/services/kpi-load-summary.service.ts`,
ya usado por la columna "KPI cargados" desde `MVP-1C.3`): no existe una
segunda definicion de "semana completa". La condicion se valida otra vez
en servidor antes de calcular o publicar; un boton habilitado en la
interfaz nunca es la unica garantia.

## 2. Motor agregado de resultados semanales

`src/server/services/weekly-results.service.ts` (`computeWeeklyResults`)
construye el resultado completo de una semana:

- llama directamente a los resolvers ya existentes de `src/domain/kpis/*`
  (por ejemplo `resolveSolutionHunterOutcome`,
  `resolveEscalationTamerOutcome`, `resolveWorkChronomancyOutcome`): no
  copia ninguna formula;
- usa `Prisma.Decimal` de principio a fin (nunca `number`) hasta el punto
  en que un valor se sirve para mostrarse;
- ordena los KPI activos segun `KPI_CATALOG_LIST`, no por el orden de la
  base de datos;
- incluye a todos los participantes aplicables a la semana segun
  `startWeekSequenceNumber`/`endWeekSequenceNumber`.

Cuando la semana no esta completa, `computeWeeklyResults` no calcula la
tabla por participante (`participants: []`): la pagina de previsualizacion
explica que falta y enlaza de vuelta a las cargas, en vez de mostrar una
tabla parcial.

### 2.1 Estados funcionales

Para la vista agregada y la instantanea publicada, cada resultado de KPI
por participante se normaliza a uno de tres estados:

- **`COMPUTED`**: existe resultado numerico, incluido un cero real;
- **`VAC`**: vacaciones/sin fila en un origen ya confirmado (Excel o
  entrada manual), conforme a las reglas ya aceptadas, incluido el `vac`
  de Cronomagia laboral;
- **`NOT_APPLICABLE`**: el KPI no aplica a ese nivel (multiplicador
  vacio).

Un `no_data` procedente de una carga de Excel ya confirmada se presenta
como `VAC` (comportamiento ya existente desde `MVP-1C.2`). Dos casos
nuevos de esta entrega, propios del motor agregado (no de los resolvers
individuales, que no cambian):

- **Domador de Escaladas, `Actualizaciones = 0`** (reasignaciones reales o
  inferidas, division no calculable): se trata como `COMPUTED` con ratio
  de escalados `0` (`basePoints x multiplicador`, limitado por el
  maximo).
- **Domador de Escaladas, fila real de Escalados sin Productividad de la
  misma semana**, y **`no_data` inesperado en un KPI manual atomico**
  (deberia tener fila si la semana esta `n/n`): se muestran como `VAC` en
  la tabla, pero se anaden a `blockingIssues` con el alias de la persona
  afectada — no se ocultan como cero, y **impiden publicar** hasta
  resolverse (ver `docs/DECISIONS.md`).

### 2.1.bis Bonus de profesion (`0.8.0` / MVP-2B)

Sobre un resultado ya `COMPUTED` y ya limitado por su maximo base, el motor
agregado aplica el bonus de profesion mediante una unica funcion pura
(`applyProfessionBonus`, ver `docs/PROFESSIONS_AND_PROFILES.md`). Ninguna
formula de KPI cambia: el bonus es una capa estrictamente **posterior** al
maximo.

```text
baseFinalPoints -> +20 % si corresponde -> finalPoints
```

Solo se aplica cuando el split usa profesiones, el participante tiene una
profesion valida para su nivel, el KPI es uno de los dos que potencia y los
puntos tras el maximo son **estrictamente positivos**. `VAC`,
`NOT_APPLICABLE`, cero y negativos nunca reciben bonus. El maximo **no** se
vuelve a aplicar despues, asi que un resultado puede superar su maximo base
hasta un 20 % (`70 -> 84`).

### 2.1.ter Bonus de localizacion semanal (`0.8.5` / MVP-2C)

Igual patron que la profesion, pero como capa **independiente y no
encadenada**: la localizacion (ver `docs/WEEKLY_LOCATIONS.md`) tambien actua
sobre `baseFinalPoints` (los puntos tras el maximo base), nunca sobre el
resultado que ya incluye el bonus de profesion, ni al reves.

```text
baseFinalPoints -> +profesion (si corresponde) -> professionBonusPoints
baseFinalPoints -> +localizacion (si corresponde) -> locationBonusPoints
finalPoints = baseFinalPoints + professionBonusPoints + locationBonusPoints
```

Se aplica mediante `applyLocationBonus`
(`src/domain/location-bonus.ts`), invocada con el mismo
`baseFinalPoints` que `applyProfessionBonus`, nunca con el resultado de
esta. Solo se aplica cuando la semana tiene una localizacion, su KPI
coincide con el de la localizacion, ese KPI sigue activo en el split, el
participante es aplicable esa semana y los puntos tras el maximo son
estrictamente positivos. No depende del nivel tecnico, la faccion ni la
profesion. `VAC`, `NOT_APPLICABLE`, cero y negativos nunca reciben este
bonus tampoco.

Con profesion y localizacion sobre el mismo KPI, `70 + 20 % + 30 %`
produce `105` (`70 + 14 + 21`), nunca `109,20` (que resultaria de
encadenar `70 x 1,20 x 1,30`): cada bonus se calcula sobre la misma base y
se suma una sola vez.

### 2.1.quater Bonus de objetos de equipo (`0.9.0` / MVP-2D)

Tercera capa de bonus, junto a profesion y localizacion (ver
`docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md`): tambien actua sobre
`baseFinalPoints`, de forma independiente y sin encadenarse con las otras
dos.

```text
baseFinalPoints -> +profesion (si corresponde) -> professionBonusPoints
baseFinalPoints -> +localizacion (si corresponde) -> locationBonusPoints
baseFinalPoints -> +cada objeto equipado que potencie este KPI -> equipmentBonusPoints
finalPoints = baseFinalPoints + professionBonusPoints + locationBonusPoints + equipmentBonusPoints
```

Se aplica mediante `applyEquipmentBonuses` (`src/domain/equipment-bonus.ts`),
invocada con el equipo vivo del participante
(`loadEquippedItemsForParticipants`), releido dentro de la propia
transaccion de `publishWeek`. A diferencia de profesion y localizacion
(un unico efecto), varios objetos que potencien el mismo KPI se acumulan
de forma aditiva si ocupan ranuras distintas: `70 + 10 % + 20 % = 91`,
nunca `70 x 1,10 x 1,20`. Solo se aplica cuando el objeto pertenece al
participante, esta equipado, su KPI coincide y sigue activo, y el
resultado tras el maximo es estrictamente positivo; `VAC`/`AVISO`, `No
aplica`, cero y negativos nunca reciben este bonus, igual que los otros
dos.

### 2.2 Totales de la fila

Para cada participante:

- `totalKpiPoints`: suma de `finalPoints` de los KPI `COMPUTED` (puede ser
  negativo; `VAC` y `NOT_APPLICABLE` aportan `0` pero conservan su
  etiqueta, nunca se convierten visualmente en el mismo cero). Desde
  `0.8.0`, ese `finalPoints` ya incluye el bonus de profesion.
- `applicableMaxPoints`: suma de `baseMax` solo de los KPI `COMPUTED`
  (`NOT_APPLICABLE` no infla el denominador; si ninguno esta `COMPUTED`,
  es `null`, mostrado como `—`, nunca `NaN`). Sigue sumando **maximos
  base**, nunca maximos inflados por profesion ni por localizacion: por
  eso el porcentaje mostrado puede superar el `100 %` cuando hubo bonus,
  hasta el `170 %` con ambos a la vez sobre el mismo KPI (`0.8.0` /
  MVP-2B y `0.8.5` / MVP-2C).

No existe una columna de "medallas": el Excel historico la tenia, pero no
es un concepto configurado en la aplicacion.

### 2.3 Ranking semanal y puntos por posicion

Ranking de competicion (equivalente a `RANK.EQ` descendente de Excel:
`100 -> 1`, `90 -> 2`, `90 -> 2`, `80 -> 4`), implementado en
`src/domain/ranking.ts` (`rankByScoreDescending`, funcion pura y probada):

- ordena por `totalKpiPoints` descendente, comparando con precision
  decimal, sin redondeo;
- empates exactos reciben la misma posicion; la siguiente posicion salta
  el numero correspondiente;
- el alias (normalizado) y despues el `id` solo desempatan el **orden
  visual** entre iguales, nunca la posicion asignada;
- todos los participantes aplicables de la semana entran en el ranking,
  aunque tengan KPI en `VAC`/`NOT_APPLICABLE`.

`positionPoints` se lee siempre de `SplitPositionPointRule` del split (los
valores `15, 11, 8, 5, 3, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1` nunca estan
escritos en el codigo del motor). Si una posicion producida por el ranking
no tiene regla configurada, se anade a `blockingIssues` (mensaje con el
numero exacto de posicion que falta) y esa fila queda con
`positionPoints: null` — nunca se concede `0` en silencio.

### 2.4 Ranking por KPI

Tambien con `rankByScoreDescending`, un ranking independiente por cada KPI
activo, solo entre resultados `COMPUTED` de participantes aplicables
(`VAC`/`NOT_APPLICABLE` no tienen posicion). Cada celda guarda `kpiRank` y
`rankedParticipantCount` (el "de n" del "x de n").

### 2.5 Presentacion de `VAC`: `AVISO` en carga, `0` en resultados (hotfix)

El estado interno `VAC` (esta seccion) no cambia: sigue siendo la misma
senal de ausencia justificada en un origen ya confirmado. Solo cambia como
se presenta, con dos funciones compartidas (ver `docs/DECISIONS.md`):

- En las pantallas de carga y comprobacion (`StatusIndicator`, `Comprobar
  Domador de Escaladas`, `Comprobar Cronomagia laboral`, la previsualizacion
  de Escalados), el texto visible es siempre `AVISO` (`n AVISO`, nunca
  `AVISOS`), calculado con `formatAvisoCount`
  (`src/domain/kpi-load-status-display.ts`). Nunca convierte una carga
  completa en `Carga parcial` ni bloquea guardar.
- En resultados, previsualizacion, publicacion, clasificacion e historico
  (esta seccion y las siguientes), un `VAC` se muestra siempre como el
  valor numerico `0`, calculado con `resolveKpiResultDisplayPoints`
  (`src/domain/kpi-outcome-display.ts`), y participa en sumas, medias y
  rankings exactamente como cualquier otro cero. `NOT_APPLICABLE` se
  mantiene siempre diferenciado (`No aplica`) en ambas presentaciones.

## 3. Mapa de color por porcentaje del maximo

`src/domain/color-bands.ts` (`colorBandForPercentage`, funcion pura y
probada) calcula, solo para presentacion, `porcentaje = finalPoints /
baseMax * 100` de una celda `COMPUTED`:

| Resultado sobre maximo | Banda |
|---:|---|
| menor de 0 % | rojo intenso |
| 0 % a < 25 % | rojo suave |
| 25 % a < 50 % | naranja |
| 50 % a < 75 % | amarillo |
| 75 % a < 90 % | verde suave |
| 90 % o mas | verde |

Desde el hotfix `AVISO`/`0` (ver seccion 2.5 y `docs/DECISIONS.md`), una
celda `VAC` se muestra con la misma banda de color que le corresponderia a
un `0` real segun su maximo (ya no existe una banda `vac` propia);
`NOT_APPLICABLE` sigue usando gris con texto `No aplica`. El color nunca es
la unica senal: cada celda lleva tambien texto y `title` accesible. Los
umbrales dependen solo del maximo del KPI (nunca de percentiles entre
companeros), por lo que son reproducibles a partir de una instantanea
publicada.

## 4. Previsualizacion y publicacion (administrador)

- **Resumen en la pantalla de cargas**
  (`/splits/[id]/weeks/[weekId]/kpis`): texto `KPI cargados: n/x` y boton
  `Ver resultados de la semana` (deshabilitado con explicacion mientras
  falte algun KPI, o si no hay ninguno activo); si la semana ya esta
  publicada, se muestra `Semana publicada` con enlace `Ver resultados` en
  vez de una accion de calculo nueva.
- **Columna "Resultados" del calendario de semanas**
  (`/splits/[id]`): `Pendientes (n/x)` deshabilitado, `Mostrar resultados`
  cuando esta completa y sin publicar, o badge `Publicada` + enlace
  cuando ya lo esta.
- **Pagina de revision** (`/splits/[id]/weeks/[weekId]/resultados`, solo
  administrador): antes de publicar, calcula en vivo
  (`computeWeeklyResults`) y muestra badge `Previsualizacion sin
  publicar`, fecha/hora de calculo, resumen (participantes, KPI activos,
  total de `VAC`), la tabla con heatmap y leyenda, y el boton `Publicar
  semana` (con confirmacion explicita de que no podra modificarse ni
  despublicarse en esta version). Si la semana deja de estar completa al
  cargar la ruta, no se muestra la tabla: se explica que falta.

### 4.1 Publicar (accion de dominio)

`publishWeek` (`src/server/services/publish-week.service.ts`):

1. valida en servidor: split `ACTIVE`, semana perteneciente al split,
   semana todavia no publicada;
2. abre una transaccion con aislamiento `Serializable` y, **dentro de
   ella**, **recalcula** con `computeWeeklyResults` usando el propio
   `Prisma.TransactionClient` (`tx`, nunca confia en totales enviados por
   el navegador ni en una previsualizacion previa): vuelve a leer la
   localizacion vigente de la semana (`0.8.5` / MVP-2C, ver
   `docs/WEEKLY_LOCATIONS.md`) y el equipo vivo de cada participante en
   ese instante exacto (`0.9.0` / MVP-2D, ver
   `docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md`), para que una carrera entre
   equipar/desequipar y publicar nunca produzca una instantanea hibrida;
3. exige `isComplete`, al menos un participante y `blockingIssues` vacio;
4. crea, dentro de esa misma transaccion, `WeekPublication` (con el
   nombre, KPI y porcentaje de la localizacion congelados una sola vez, si
   la semana tenia alguna), un `PublishedParticipantWeeklyResult` por
   participante (con `creditsEarned` congelado) y sus `PublishedKpiResult`
   (con el desglose de los bonus de profesion, localizacion y objetos por
   KPI), una fila `PublishedEquippedItem` por objeto equipado, y el
   movimiento `WEEKLY_EARNING` vinculado de forma unica a ese resultado;
5. una carrera concurrente (restriccion unica sobre `splitWeekId`, o
   fallo de serializacion) no se propaga como error: si al comprobar de
   nuevo ya existe una publicacion, se devuelve como resultado idempotente
   (`alreadyPublished: true`), nunca una segunda publicacion.

La autorizacion (`ADMIN`) se comprueba en la accion de servidor
(`src/server/actions/publish.actions.ts`) antes de llamar al servicio.

## 5. Bloqueo real de modificaciones

`assertWeekIsEditable(db, weekId)`
(`src/server/services/shared/week-context.ts`) consulta `WeekPublication`
en servidor y se llama en las nueve acciones de escritura semanal:
confirmacion de las cuatro cargas de Excel (Productividad, Escalados,
Calidad, Llamadas) y guardado de los cinco KPI manuales. Tambien se
rechaza anadir un participante (`addParticipant`) cuya
`startWeekSequenceNumber` caiga en una semana ya publicada (una
participacion nueva si puede empezar en una semana futura no publicada).

En la interfaz, una semana publicada muestra `Semana publicada: los datos
estan bloqueados` en vez de formularios editables, y `Comprobar` sigue
disponible en modo lectura.

**Actualizado en `0.7.0` / MVP-2A:** desde que el split tiene al menos una
semana publicada, la configuracion de KPI y los puntos por posicion quedan
bloqueados por completo (no solo las semanas ya publicadas, tambien las
futuras), mediante `assertSplitConfigurationIsEditable`
(`src/server/services/shared/split-configuration-lock.ts`). Esto sustituye
la frase anterior de esta seccion ("las configuraciones del split siguen
pudiendo editarse para semanas futuras"): ver `docs/DECISIONS.md` para el
detalle completo de esta decision, que sustituye expresamente la
provisional de `MVP-1B`. La instantanea sigue siendo, en cualquier caso, la
unica fuente de verdad para lo ya publicado.

No existe "Despublicar" ni "Reabrir" en esta entrega. `WeekPublication` es
la unica fuente de verdad de que una semana esta publicada; no se mezcla
con `SplitStatus.CLOSED`, que sigue cerrando el split completo.

## 6. Vista individual (`/resultados`)

Ver `docs/AUTHENTICATION.md` para el modelo de permisos completo. Resumen
funcional:

- **Selector de persona** (solo administrador): elige entre personas con
  al menos una publicacion. Un participante nunca ve el selector; siempre
  usa `session.user.personId`.
- **`Por split`**: split entre los que la persona tiene resultados
  publicados; resumen (posicion actual, puntos de posicion acumulados,
  total de puntos KPI, semanas publicadas); evolucion semana a semana (una
  fila por semana publicada, con cada KPI, estado, total, `%` del maximo,
  posicion semanal y puntos por posicion); posicion propia en cada KPI
  como "x de n" (solo entre `COMPUTED`); y la clasificacion general
  limitada del split (ver mas abajo).
- **`Historico general`**: toda la historia publicada de esa persona,
  incluso entre splits y anos distintos, con filtros de ano, split (o
  todos) y agrupacion (`Semana`/`Mes`/`Año`). Cada grupo muestra periodo,
  numero de semanas publicadas, suma y media de puntos KPI, suma de
  puntos por posicion y desglose por KPI (suma/media). Desde el hotfix
  `AVISO`/`0` (ver `docs/DECISIONS.md`), una semana `VAC` de ese KPI
  participa en la suma y la media como un cero real (`includedWeekCount`
  cuenta `COMPUTED` y `VAC`; `NOT_APPLICABLE` sigue excluido por completo);
  no se muestra ya un recuento `VAC` en pantalla. El mes y el ano se
  asignan por `SplitWeek.startDate` como fecha de calendario UTC (nunca
  hora local). **Desde `0.8.0` / MVP-2B**, la agrupacion `Semana` identifica
  el periodo por la **fecha de inicio real** de esa semana (`07/09/2026`),
  no por `Semana 1`; el orden es cronologico descendente por esa fecha y,
  con varios splits en el filtro, el nombre del split aparece como texto
  secundario. Cada celda por KPI anade `+N por profesion` cuando el periodo
  tuvo bonus, sumando exclusivamente los `professionBonusPoints`
  **publicados** (nunca se recalculan con la profesion actual). **Desde
  `0.8.5` / MVP-2C**, cada celda anade tambien `+N localizacion` cuando el
  periodo tuvo ese bonus, sumando exclusivamente los
  `locationBonusPoints` publicados (ver `docs/WEEKLY_LOCATIONS.md`); con
  agrupacion `Mes`/`Año` y varias localizaciones distintas en el periodo,
  el texto sigue siendo solo el importe agregado, nunca el nombre de una
  unica localizacion como si representara todo el periodo. `Mes` y `Año`
  no cambian.

Toda lectura de participante viene exclusivamente de tablas publicadas
(`PublishedParticipantWeeklyResult`/`PublishedKpiResult`): nunca se
recalcula con la configuracion actual.

## 7. Clasificacion general individual del split

**Renombrada en `0.7.0` / MVP-2A** de "Clasificacion general" a
"Clasificacion general individual" (ancla, indice lateral y titulo de la
pagina detallada incluidos), para distinguirla de la nueva "Clasificacion
general facciones" que aparece justo debajo (ver `docs/FACTIONS.md`). Su
calculo no ha cambiado.

Usa **exclusivamente los puntos por posicion semanal publicados**
(`SplitPositionPointRule` consumida al publicar, ver
`docs/POSITION_POINTS_CONFIGURATION.md`); la suma cruda de KPI solo se
muestra como dato secundario y desempate visual.

`src/server/services/classification.service.ts`
(`computeSplitClassification`): por participante, solo con semanas
publicadas, suma puntos por posicion y puntos KPI, cuenta semanas
publicadas y calcula la posicion acumulada con `rankByComparator`
(`src/domain/ranking.ts`): dos criterios (puntos por posicion descendente,
despues puntos KPI descendente) deciden el empate real; el alias
normalizado solo ordena visualmente filas ya empatadas en ambos criterios,
sin conceder ninguna ventaja de negocio.

- **Resumen para administrador** (bajo el calendario de `/splits/[id]`):
  una fila por participante, una columna por semana publicada con sus
  puntos por posicion (`—` si no publicada/no participa), total
  acumulado, posicion actual y enlace a la vista detallada. No limita a
  los primeros N: se puede consultar la clasificacion completa.
- **Vista detallada** (`/splits/[id]/clasificacion`, solo administrador):
  filtro de semana concreta o acumulado, filtro de KPI (todos o uno
  activo); con un KPI seleccionado, la columna de posicion pasa a llamarse
  "Posicion KPI" y muestra el ranking real de ese KPI (nunca la posicion
  general bajo ese titulo), y el orden predeterminado es su suma/resultado
  descendente (`0.7.0` / MVP-2A, ver `docs/DECISIONS.md`). Se puede ordenar
  ademas por puntos de posicion, total KPI y media (acumulado) mediante
  encabezados de columna accesibles (`aria-sort`) que conservan los
  filtros de semana y KPI; columnas de nombre, alias, nivel, semanas
  publicadas y totales; con un KPI seleccionado, tambien suma/media y
  posicion por ese KPI (`computeSplitKpiClassification`). Desde el hotfix
  `AVISO`/`0` (ver `docs/DECISIONS.md`), una semana `VAC` de ese KPI cuenta
  como un cero real en la suma, la media y el ranking (`includedWeekCount`
  incluye `COMPUTED` y `VAC`); `NOT_APPLICABLE` sigue excluido por
  completo, tanto del acumulado como de una semana concreta (se muestra
  `—`, nunca `0`).
- **Vista limitada para participante** (dentro de `/resultados > Por
  split`): alias, posicion semanal/general, total de puntos KPI por
  semana, puntos por posicion de cada semana, sumas acumuladas, y (`0.7.0`
  / MVP-2A) la faccion actual y la clasificacion general de facciones (ver
  `docs/FACTIONS.md`). Nunca incluye nombre real, valores de KPI
  individuales, niveles, estados `VAC` ni maximos de otros participantes;
  la respuesta del servidor no contiene esos campos (no se ocultan solo
  con CSS).

**Denominador unico de "x de n" (`0.7.0` / MVP-2A, ver `docs/DECISIONS.md`):**
toda posicion mostrada en resultados (general, semanal, por KPI, vista
administrativa de una semana publicada y subvista `Por split`) usa como
denominador el numero total de participantes del split
(`countParticipantsForSplit`), no el numero de resultados aplicables de un
KPI concreto. `rankedParticipantCount` se conserva sin cambios como
numerador interno de cada ranking; no se usa como denominador en ninguna
pantalla.

## 8. Integridad y seguridad

- Toda decision sensible (completitud, roles, `personId`, `splitId`,
  `weekId`, reglas de posicion) se repite en servidor.
- Publicar recalcula desde base de datos; las lecturas de participante
  solo incluyen publicaciones.
- Las previsualizaciones no publicadas son exclusivas de administrador.
- `Prisma.Decimal` en resultados persistidos y comparaciones de
  puntuacion; nunca se redondea antes de sumar, rankear o publicar (solo
  al mostrar).

## 9. Fuera de alcance de `0.6.0`

Despublicar, reabrir o editar una semana publicada; exportacion
Excel/PDF de resultados; medallas; API publica; facciones, profesiones,
economia, tienda, objetos o recompensas.

Las facciones se implementaron en `0.7.0` / MVP-2A (ver
`docs/FACTIONS.md`), las profesiones con su bonus del `+20 %` en `0.8.0` /
MVP-2B (ver `docs/PROFESSIONS_AND_PROFILES.md`), las localizaciones
semanales con su bonus configurable en `0.8.5` / MVP-2C (ver
`docs/WEEKLY_LOCATIONS.md`) y la economia de creditos, el mercado, el
inventario y el equipo con su tercer bonus en `0.9.0` / MVP-2D (ver
`docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md`), sin tocar ninguna de las
formulas de KPI descritas en este documento: cada bonus es una capa
posterior al maximo base, independiente de los demas, aplicada una sola
vez por semana y congelada al publicar. `/resultados` incorpora ademas,
desde `0.9.0`, un selector analitico `Con gamificacion`/`Sin
gamificacion` (`src/domain/gamification-view.ts`) que compara el
rendimiento KPI real (`basePointsBeforeProfession`) frente al total
oficial, sin recalcular ni alterar ninguna publicacion, ranking, punto por
posicion, faccion ni credito. El resto de la lista sigue fuera de
alcance.

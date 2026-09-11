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

### 2.2 Totales de la fila

Para cada participante:

- `totalKpiPoints`: suma de `finalPoints` de los KPI `COMPUTED` (puede ser
  negativo; `VAC` y `NOT_APPLICABLE` aportan `0` pero conservan su
  etiqueta, nunca se convierten visualmente en el mismo cero);
- `applicableMaxPoints`: suma de `baseMax` solo de los KPI `COMPUTED`
  (`NOT_APPLICABLE` no infla el denominador; si ninguno esta `COMPUTED`,
  es `null`, mostrado como `—`, nunca `NaN`).

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

`VAC` usa un neutro azulado/gris con texto `VAC`; `NOT_APPLICABLE` usa
gris con texto `No aplica`. El color nunca es la unica senal: cada celda
lleva tambien texto y `title` accesible. Los umbrales dependen solo del
maximo del KPI (nunca de percentiles entre companeros), por lo que son
reproducibles a partir de una instantanea publicada.

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
2. **recalcula** con `computeWeeklyResults` usando el mismo `PrismaClient`
   (nunca confia en totales enviados por el navegador);
3. exige `isComplete`, al menos un participante y `blockingIssues` vacio;
4. crea `WeekPublication`, un `PublishedParticipantWeeklyResult` por
   participante y sus `PublishedKpiResult` dentro de una unica transaccion
   con aislamiento `Serializable`;
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

Las configuraciones del split (KPI, puntos por posicion) siguen pudiendo
editarse para semanas futuras, pero **nunca** alteran una semana ya
publicada: la instantanea es la unica fuente de verdad para lo ya
publicado.

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
  puntos por posicion y desglose por KPI (suma/media de `COMPUTED`, con el
  recuento de `VAC` aparte, sin mezclarlo en la media). El mes y el ano se
  asignan por `SplitWeek.startDate` como fecha de calendario UTC (nunca
  hora local).

Toda lectura de participante viene exclusivamente de tablas publicadas
(`PublishedParticipantWeeklyResult`/`PublishedKpiResult`): nunca se
recalcula con la configuracion actual.

## 7. Clasificacion general del split

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
  activo), orden por puntos de posicion/total KPI/KPI seleccionado,
  columnas de posicion, nombre, alias, nivel, semanas publicadas y
  totales; con un KPI seleccionado, suma/media y posicion por ese KPI
  usando solo `COMPUTED`.
- **Vista limitada para participante** (dentro de `/resultados > Por
  split`): alias, posicion semanal/general, total de puntos KPI por
  semana, puntos por posicion de cada semana, sumas acumuladas. Nunca
  incluye nombre real, valores de KPI individuales, niveles, estados
  `VAC` ni maximos de otros participantes; la respuesta del servidor no
  contiene esos campos (no se ocultan solo con CSS).

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

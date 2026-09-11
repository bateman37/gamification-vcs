# Puntos por posicion semanal — BUGFIX-1 / UX-SPLIT-1 (0.5.1)

Referencia unica de la configuracion "Puntos por posicion semanal" anadida
en `0.5.1`. Pensada para que otra sesion futura no tenga que redescubrir
esta tabla ni confundirla con un KPI o con una clasificacion ya
implementada.

## Que es y que no es todavia

Cada split tiene una tabla propia con los puntos que recibira cada
posicion semanal (1 a 15) cuando exista la clasificacion semanal. Esta
entrega **solo guarda esos quince valores**:

- No calcula ninguna posicion semanal (no hay motor de clasificacion
  todavia, ver `docs/ROADMAP.md`).
- No reparte ni asigna estos puntos a ningun participante.
- No es un KPI: no aparece en `docs/KPI_CONFIGURATION.md`, no se mezcla
  con `SplitKpiConfig` y no cuenta para el contador "KPI cargados" del
  calendario de semanas.
- No es una clasificacion, ranking, sistema de creditos, renombre ni
  ninguna otra capa de juego.

Cuando `MVP-1C` implemente la clasificacion semanal, ese motor leera esta
tabla para saber cuantos puntos otorgar a cada posicion; hasta entonces,
esta seccion es exclusivamente configuracion en espera.

## Valores predeterminados: la tabla exacta de Split 8

Los quince valores predeterminados son los auditados en `Guia!B57:C71` del
Excel historico de Split 8 (ver tambien `docs/DISCOVERY-1-SPLIT-8.md`):

| Posicion | Puntos |
|---:|---:|
| 1 | 15 |
| 2 | 11 |
| 3 | 8 |
| 4 | 5 |
| 5 | 3 |
| 6 | 2 |
| 7 | 1 |
| 8 | 1 |
| 9 | 1 |
| 10 | 1 |
| 11 | 1 |
| 12 | 1 |
| 13 | 1 |
| 14 | 1 |
| 15 | 1 |

Estos valores viven en codigo (`src/domain/position-points.ts`,
`DEFAULT_POSITION_POINTS`), no se leen del Excel original en tiempo de
ejecucion y el fichero no se incluye en el repositorio.

## Modelo de datos

`SplitPositionPointRule` (migracion `add_position_points`):

- `id` (UUID), `splitId` (FK a `Split`, `onDelete: Cascade`).
- `position`: entero. Restriccion SQL `position >= 1 AND position <= 15`.
  En esta primera version existen exactamente las posiciones `1..15`; no
  hay filas dinamicas ni configuracion global.
- `points`: entero. Restriccion SQL `points >= 0`.
- `createdAt`, `updatedAt`.
- Indice unico `(splitId, position)`.

Cada split conserva su propia copia, igual que `SplitKpiConfig`: editar los
puntos de un split no modifica los de otro. La tabla nunca se guarda como
JSON dentro de `Split`.

### Migracion y backfill

La migracion `add_position_points`:

1. Crea la tabla y sus restricciones.
2. Inserta las quince reglas con los valores de Split 8 para **cada split
   que ya existiera** antes de la migracion (backfill, sin modificar
   ningun otro dato ni el estado de ningun split).
3. Al crear un split nuevo, `createSplitWithWeeks`
   (`src/server/services/split.service.ts`) crea tambien sus quince reglas
   predeterminadas dentro de la misma transaccion que crea el split, sus
   semanas y su configuracion de KPI.

## Servicio, validacion y accion

- `src/server/services/position-points.service.ts`:
  `createDefaultPositionPointRules` (backfill/creacion atomica),
  `listPositionPointRules` (ordenada por posicion) y
  `updatePositionPointRules` (sustitucion atomica de las quince filas,
  rechazada si el split esta `CLOSED`).
- `src/server/validation/position-points.ts`: `parsePositionPointsForm`
  valida las quince posiciones esperadas (enteros no negativos), con todos
  los errores detectables devueltos en una sola respuesta, asociados a la
  posicion concreta (`PositionPointsValidationError`).
- `src/server/actions/position-points.actions.ts`: accion de servidor
  `updatePositionPointsAction`, capa fina sobre el servicio y la
  validacion.

### Reglas de edicion

- Editable con el split en `DRAFT` o `ACTIVE`.
- `CLOSED`: solo lectura, protegido tambien en el servicio (no solo en la
  interfaz).
- Un error en una fila no guarda parcialmente las demas: la actualizacion
  sustituye las quince filas dentro de una unica transaccion.
- Esta configuracion nunca es requisito para activar un split: la regla de
  activacion (`docs/DECISIONS.md`) no cambia.

## Interfaz

Seccion "Puntos por posicion semanal" en el detalle del split
(`/splits/[id]`, componente `PositionPointsSection`), con una tabla
compacta de las quince posiciones y un campo "Puntos" por fila, una unica
accion "Guardar puntos por posicion" (oculta en `CLOSED`, donde los
valores se muestran de solo lectura) y una nota explicando que esta
configuracion todavia no modifica ningun resultado.

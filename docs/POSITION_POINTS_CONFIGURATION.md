# Puntos por posicion semanal — BUGFIX-1 / UX-SPLIT-1 (0.5.1), consumida desde 0.6.0 / MVP-1C, rango dinamico desde 1.2.2

Referencia unica de la configuracion "Puntos por posicion semanal" anadida
en `0.5.1`. Desde `0.6.0` / MVP-1C, estos valores se **consumen** al
publicar una semana; el detalle completo de como se usan vive en
`docs/RESULTS_PUBLICATION.md`. Desde `1.2.2`, el rango de posiciones deja de
estar fijo en `1..15` y pasa a ser dinamico por split (ver seccion
"Rango dinamico desde `1.2.2`" mas abajo).

## Que es y que consume desde `0.6.0`

Cada split tiene una tabla propia con los puntos que recibe cada posicion
del ranking de competicion semanal. Desde `0.6.0` / MVP-1C:

- El motor agregado de resultados semanales
  (`src/server/services/weekly-results.service.ts`) lee esta tabla para
  asignar `positionPoints` a cada participante segun su posicion en el
  ranking semanal (`rankByScoreDescending`, ver
  `docs/RESULTS_PUBLICATION.md`).
- Si el ranking produce una posicion sin regla configurada, la
  previsualizacion y la publicacion se bloquean con un mensaje que indica
  exactamente que posicion falta: nunca se concede `0` en silencio. Desde
  `1.2.2` esto ya no puede ocurrir por tener mas de quince participantes: la
  cobertura se garantiza antes de publicar (ver mas abajo).
- Al publicar, el `positionPoints` de cada participante queda **congelado**
  en `PublishedParticipantWeeklyResult`: un cambio posterior de esta
  configuracion nunca altera una semana ya publicada.
- Sigue sin ser un KPI: no aparece en `docs/KPI_CONFIGURATION.md`, no se
  mezcla con `SplitKpiConfig` y no cuenta para el contador "KPI cargados"
  del calendario de semanas.
- Editar esta configuracion sigue permitido para semanas futuras no
  publicadas; la interfaz debe advertir que no recalcula publicaciones
  existentes.

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
ejecucion y el fichero no se incluye en el repositorio. Siguen siendo
exactamente los mismos quince valores tras `1.2.2`: la ampliacion solo
anade posiciones `16..N` con `0` puntos, nunca modifica `1..15`.

## Rango dinamico desde `1.2.2`

Desde `1.2.2`, cada split debe tener reglas individuales y ordenadas
`1, 2, 3, ..., 15, 16, ..., N`, donde:

```text
N = maximo(15, numero actual de participantes del split, mayor posicion ya persistida)
```

(`resolveRequiredPositionCount`, `src/domain/position-points.ts`, funcion
pura). No existe una regla generica "del 16 al ultimo": cada posicion desde
la 16 es una fila individual, editable por separado, que **nace con `0`
puntos**. El limite superior nunca se recorta si el numero de participantes
disminuye despues, y una regla ya guardada nunca se elimina ni se
sobrescribe por un backfill.

`ensurePositionPointRuleCoverage` (`src/server/services/position-points.service.ts`)
es el unico helper que garantiza esta cobertura: crea con `createMany` (y
`skipDuplicates: true`, idempotente ante concurrencia) solo las filas
`1..N` que todavia no existan, sin tocar ninguna ya guardada. Se invoca:

- al anadir un participante (`addParticipant`,
  `src/server/services/participant.service.ts`), si el nuevo total supera
  la mayor posicion ya cubierta — incluso con la configuracion ya
  bloqueada por la primera publicacion, porque es mantenimiento de
  integridad, no una edicion manual;
- al preparar la pantalla del detalle del split
  (`ensureAndListPositionPointRules`, sustituye a `listPositionPointRules`
  como lectura de la pagina), como defensa ante datos legacy incompletos;
- al guardar la configuracion (`updatePositionPointRules`, que ademas usa
  `upsert` en vez de `update` por fila, para no fallar si el rango crecio
  entre la carga del formulario y el guardado);
- justo antes de calcular resultados en `publishWeek`
  (`src/server/services/publish-week.service.ts`), como defensa final.

La validacion (`parsePositionPointsForm`,
`src/server/validation/position-points.ts`) ya no usa un limite fijo: recibe
`totalPositions` como parametro, siempre calculado en servidor
(`resolveRequiredPositionCountForSplit`) a partir del split real, nunca de
un campo oculto o limite enviado por el cliente.

Al publicar, la publicacion resuelve los puntos de cada posicion (tambien
por encima de 15) con su regla exacta: una persona en la posicion 27 usa
siempre la regla de la posicion 27, nunca la de la posicion 15 ni un valor
por compatibilidad legado.

## Modelo de datos

`SplitPositionPointRule` (migracion `add_position_points`, ampliada en
`add_faction_image_and_dynamic_position_points`):

- `id` (UUID), `splitId` (FK a `Split`, `onDelete: Cascade`).
- `position`: entero. Restriccion SQL `position >= 1` (el limite superior
  de `15` se elimino en `1.2.2`: el rango superior es dinamico, calculado
  siempre en servicio, nunca en base de datos).
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
   semanas y su configuracion de KPI (sin participantes todavia, `N = 15`
   en ese momento).

La migracion `add_faction_image_and_dynamic_position_points` (`1.2.2`)
elimina las dos restricciones historicas que limitaban `position <= 15`
(la de la migracion de creacion y la anadida junto a las de publicacion),
conserva `position >= 1` y crea, solo para los splits cuyo numero de
participantes ya superaba 15, las filas `16..N` ausentes con `0` puntos
(`ON CONFLICT DO NOTHING`, reejecutable sin duplicar datos). No toca
ninguna regla `1..15` ni ningun resultado publicado.

## Servicio, validacion y accion

- `src/server/services/position-points.service.ts`:
  `createDefaultPositionPointRules` (creacion de las quince reglas de un
  split nuevo), `listPositionPointRules` (lectura ordenada, sin garantizar
  cobertura), `resolveRequiredPositionCountForSplit` (calcula `N` real),
  `ensurePositionPointRuleCoverage` (crea solo las filas ausentes `1..N`
  con `0`), `ensureAndListPositionPointRules` (lectura de pantalla: primero
  garantiza cobertura, luego lista) y `updatePositionPointRules`
  (sustitucion atomica de las filas `1..N`, rechazada si el split esta
  `CLOSED` o ya tiene una publicacion).
- `src/server/validation/position-points.ts`: `parsePositionPointsForm`
  valida las `totalPositions` posiciones esperadas (enteros no negativos),
  con todos los errores detectables devueltos en una sola respuesta,
  asociados a la posicion concreta (`PositionPointsValidationError`).
- `src/server/actions/position-points.actions.ts`: accion de servidor
  `updatePositionPointsAction`, capa fina que calcula `totalPositions` en
  servidor antes de validar y guardar.

### Reglas de edicion

- Editable con el split en `DRAFT` o `ACTIVE`.
- `CLOSED`: solo lectura, protegido tambien en el servicio (no solo en la
  interfaz).
- Un error en una fila no guarda parcialmente las demas: la actualizacion
  sustituye todas las filas `1..N` dentro de una unica transaccion.
- Esta configuracion nunca es requisito para activar un split: la regla de
  activacion (`docs/DECISIONS.md`) no cambia.
- La ampliacion automatica de cobertura (al anadir un participante) no es
  una edicion de puntos: solo crea filas ausentes con `0` y se aplica
  aunque la configuracion ya este bloqueada por la primera publicacion.

## Interfaz

Seccion "Puntos por posicion semanal" en el detalle del split
(`/splits/[id]`, componente `PositionPointsSection`), con una tabla
compacta de todas las posiciones `1..N` y un campo "Puntos" por fila (las
posiciones ampliadas, superiores a 15, llevan la marca visual "(ampliada)"
sin representar una formula distinta), una unica accion "Guardar puntos
por posicion" (oculta en `CLOSED`, donde los valores se muestran de solo
lectura) y una nota explicando el rango dinamico.

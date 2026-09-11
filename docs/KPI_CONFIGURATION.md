# Configuracion de KPI — MVP-1B

Este documento es la referencia principal sobre el catalogo cerrado de KPI
y su configuracion por split, pensada para que la siguiente entrega
(`MVP-1C`, motor de calculo) no tenga que redescubrir estas reglas. Fuente
de verdad en codigo: `src/domain/kpis/catalog.ts`.

## Que existe y que no existe todavia

`MVP-1B` implementa la **configuracion** de los diez KPI por split:
activarlos o desactivarlos, y editar su maximo base, sus multiplicadores
por nivel y sus parametros propios.

`MVP-1B` **no** implementa el motor de calculo de resultados. Los
"calculos" descritos en este documento son la forma que tendra el futuro
calculo (`MVP-1C`), documentada para que la configuracion actual tenga
sentido, pero ningun resultado se calculaba todavia con estos datos.

**Actualizacion (`IMPORT-1A / MVP-1C.1`):** dos de los diez calculos,
Cazador de soluciones (`SOLUTION_HUNTER`) y Explorador de datos
(`DATA_EXPLORER`), ya estan implementados de verdad a partir de la carga
semanal del Excel de Productividad. La implementacion (funciones puras,
reglas de "No aplica"/"Sin dato" y la pantalla administrativa de carga y
comprobacion) esta documentada en `docs/IMPORT_PRODUCTIVITY.md`.

**Actualizacion (`MVP-1C.2 / IMPORT-1B`):** otros tres calculos, Domador
de Escaladas (`ESCALATION_TAMER`), Maestro Artesano
(`MASTER_CRAFTSMAN`) y Embajador de voz (`VOICE_AMBASSADOR`), tambien
estan implementados de verdad a partir de las cargas semanales de
Escalados, Calidad y Llamadas respectivamente. Domador cruza, ademas, la
Productividad ya persistida de la misma semana y participante
(`ProductivityWeeklyRow.updates`). Documentado en
`docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md`. Los cinco KPI restantes
(Guardian de la Estabilidad, Cronomagia laboral, Redactor estrella,
Estudiante entusiasta, Aprendiz experto) siguen siendo solo
configuracion: su calculo sigue pendiente de `IMPORT-1` y `MVP-1C`.

## El catalogo cerrado

El catalogo es cerrado: el administrador activa o desactiva KPI existentes
y edita sus parametros, pero no puede crear KPI nuevos, cambiar su nombre,
introducir formulas libres ni modificar el orden interno de las
operaciones. Anadir un KPI nuevo en el futuro requerira un cambio de
codigo y una migracion deliberados.

| Orden | Codigo | Nombre visible | Maximo base | N0 | N1 | N2 |
|---:|---|---|---:|---:|---:|---:|
| 1 | `SOLUTION_HUNTER` | Cazador de soluciones | 70 | 2,5 | 1 | 1,85 |
| 2 | `DATA_EXPLORER` | Explorador de datos | 70 | 0,62 | 0,5 | 1,5 |
| 3 | `VOICE_AMBASSADOR` | Embajador de voz | 50 | 1,25 | 1,5 | 2 |
| 4 | `MASTER_CRAFTSMAN` | Maestro Artesano | 100 | 3 | 2 | 2 |
| 5 | `ESCALATION_TAMER` | Domador de Escaladas | 30 | 1 | 1 | 1 |
| 6 | `STABILITY_GUARDIAN` | Guardian de la Estabilidad | 30 | No aplica | No aplica | 1 |
| 7 | `WORK_CHRONOMANCY` | Cronomagia laboral | 60 | 1 | 1 | 1 |
| 8 | `STAR_WRITER` | Redactor estrella | 60 | 4 | 1,5 | 2 |
| 9 | `ENTHUSIASTIC_STUDENT` | Estudiante entusiasta | 50 | 1 | 1 | 1 |
| 10 | `EXPERT_APPRENTICE` | Aprendiz experto | 50 | 1 | 1 | 1,25 |

Estos son los valores predeterminados de Split 8, usados al crear la
configuracion inicial de cada split. Cada split conserva su propia copia y
puede modificarla sin afectar a los demas.

## Forma fija de cada calculo

Cinco de los diez ya estan implementados de verdad (marcados abajo); los
otros cinco describen la forma que tendra su futuro calculo, todavia sin
implementar.

### Cazador de soluciones (`SOLUTION_HUNTER`) — implementado

`tickets resueltos x pointsPerResolvedTicket x multiplicador del nivel`

Parametro: `pointsPerResolvedTicket` (predeterminado `1`).

### Explorador de datos (`DATA_EXPLORER`) — implementado

`tickets actualizados con comentario x pointsPerCommentedTicket x multiplicador del nivel`

Parametro: `pointsPerCommentedTicket` (predeterminado `1`).

### Embajador de voz (`VOICE_AMBASSADOR`) — implementado

`(aceptadas x acceptedWeight - rechazadas x rejectedPenalty - no atendidas x unattendedPenalty) x multiplicador del nivel + salientes x outboundPoints`

El multiplicador solo afecta al bloque de llamadas entrantes, nunca a las
salientes (posicion fija en la formula).

Parametros: `acceptedWeight`, `rejectedPenalty`, `unattendedPenalty`,
`outboundPoints` (todos predeterminados a `1`).

### Maestro Artesano (`MASTER_CRAFTSMAN`) — implementado

`(positivas x positiveWeight - negativas x negativePenalty) x scale x multiplicador del nivel`

Parametros: `positiveWeight` (`1`), `negativePenalty` (`4`), `scale`
(`10`).

### Domador de Escaladas (`ESCALATION_TAMER`) — implementado

`(basePoints - (escalados / tickets gestionados) x ratioPenaltyFactor) x multiplicador del nivel`

Parametros: `basePoints` (`30`), `ratioPenaltyFactor` (`200`). No existe
suelo de cero: no formaba parte de la formula auditada en Split 8.

### Guardian de la Estabilidad (`STABILITY_GUARDIAN`)

`resultados x pointsPerResult x multiplicador del nivel`

Parametro: `pointsPerResult` (`30`). Por defecto solo aplica a N2 (N0 y N1
quedan como "no aplica"), pero la configuracion permite informar tambien
N0 o N1 en otro split.

### Cronomagia laboral (`WORK_CHRONOMANCY`)

`occupancy (fraccion) x pointsAtFullOccupancy x multiplicador del nivel`

Parametro: `pointsAtFullOccupancy` (`60`).

### Redactor estrella (`STAR_WRITER`)

- Si articulos aprobados >= 0: `articulos x approvedArticlePoints x multiplicador del nivel + propuestas x proposalPoints`.
- Si articulos aprobados < 0: `articulos x negativeArticlePoints + propuestas x proposalPoints`.

El multiplicador nunca afecta a las propuestas ni a los articulos
negativos.

Parametros: `approvedArticlePoints` (`10`), `negativeArticlePoints`
(`10`), `proposalPoints` (`5`).

### Estudiante entusiasta (`ENTHUSIASTIC_STUDENT`)

`horas de dedicacion x pointsPerHour x multiplicador del nivel`

Parametro: `pointsPerHour` (`12,5`).

### Aprendiz experto (`EXPERT_APPRENTICE`)

`valor de formacion / targetValue x pointsAtTarget x multiplicador del nivel`

Parametros: `targetValue` (`15`), `pointsAtTarget` (`50`).

## Significado de maximo base y multiplicadores

- **Maximo base**: techo del resultado de ese KPI antes de cualquier
  efecto posterior de capas de juego (profesiones, localizaciones,
  objetos...) que en el Excel historico podian superarlo. Esas capas no
  se implementan todavia (ver `docs/ROADMAP.md`).
- **Multiplicador por nivel** (`N0`, `N1`, `N2`): factor aplicado segun el
  nivel tecnico del participante. Un multiplicador **vacio** (`null`)
  significa que ese nivel **no es aplicable** a ese KPI, no que valga
  cero. Por ejemplo, Guardian de la Estabilidad solo aplica por defecto a
  N2.

## Reglas de validacion

Aplicadas en `src/server/validation/kpi.ts` (usa el catalogo de
`src/domain/kpis/catalog.ts`), y reforzadas con restricciones de base de
datos en la migracion `add_kpi_configuration`:

- El maximo base es obligatorio y debe ser un numero finito mayor que
  cero.
- Cada multiplicador de nivel es opcional (vacio = no aplicable) y, si se
  informa, debe ser un numero finito mayor o igual que cero.
- Los parametros propios de cada KPI son siempre numeros finitos mayores
  que cero; no se aceptan `NaN`, infinitos, cadenas no numericas ni
  campos desconocidos (se rechazan con un error de validacion).
- Si un KPI se activa, debe tener informado al menos un multiplicador de
  nivel aplicable.
- La entrada acepta coma o punto como separador decimal; se normaliza a
  punto antes de guardarse.
- Los errores de validacion se devuelven en castellano y asociados al
  campo concreto del formulario.
- `parameters` nunca se acepta tal cual desde el navegador: la accion de
  servidor construye el objeto leyendo unicamente los campos que el
  catalogo declara para ese `kpiCode`, y lo valida contra su esquema antes
  de guardarlo.

## Estados del split y edicion de KPI

- **`DRAFT`**: se puede activar/desactivar cada KPI y editar todos sus
  parametros.
- **`ACTIVE`**: tambien se permite editar la configuracion de KPI en esta
  entrega, porque todavia no existen resultados calculados ni semanas
  publicadas. Es una decision provisional: `MVP-1C` debera definir el
  bloqueo, versionado o recalculo quando existan resultados (ver
  `docs/DECISIONS.md`).
- **`CLOSED`**: la configuracion de KPI se muestra en modo solo lectura;
  no se permite editarla.

Un split solo puede activarse (`DRAFT` -> `ACTIVE`) cuando tiene al menos
un participante **y** al menos un KPI activo. Esta regla se protege en el
servicio de dominio (`activateSplit`, en
`src/server/services/split.service.ts`), no solo en la interfaz.

## Ejemplo: dos splits con configuraciones distintas (datos ficticios)

**Split "Temporada de prueba A"**: Cazador de soluciones activo, maximo
base 70, multiplicadores 2,5 / 1 / 1,85, `pointsPerResolvedTicket = 1`
(valores predeterminados de Split 8, sin cambios).

**Split "Temporada de prueba B"**: el mismo KPI, Cazador de soluciones,
tambien activo pero con maximo base 90, multiplicadores 3 / 1,5 / 2 y
`pointsPerResolvedTicket = 2` (el administrador decidio puntuar el doble
por ticket resuelto en esta edicion). Ambas configuraciones conviven sin
interferir: cambiar la del split B no modifica la del split A.

## Migracion y backfill

La migracion `add_kpi_configuration` crea el enum `KpiCode` y la tabla
`SplitKpiConfig`, y ademas crea, para cada split que ya existiera antes de
esta entrega, sus diez configuraciones inactivas con los valores
predeterminados de Split 8 (ver `docs/DATA_MODEL.md`). No cambia el estado
de ningun split existente: un split `ACTIVE` que quede con sus diez KPI
inactivos debe mostrar un aviso en la interfaz para que el administrador
los configure.

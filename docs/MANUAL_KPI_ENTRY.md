# Entrada manual de KPI y contador semanal — MVP-1C.3 / INPUT-1C

Referencia principal de la tercera entrega de `IMPORT-1`: el hotfix de
Domador de Escaladas, los cinco formularios manuales que completan los diez
KPI activos de Split 8, y el contador `KPI cargados` del calendario de
semanas. Pensada para que otra sesion continue sin depender de la
conversacion original. Complementa `docs/IMPORT_PRODUCTIVITY.md` y
`docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md`.

Fuente de verdad en codigo:

- Calculo: `src/domain/kpis/{stability,chronomancy,writer,student,apprentice}.ts`
  y el hotfix en `src/domain/kpis/escalation.ts`.
- Validacion de formularios: `src/server/validation/manual-entry.ts`.
- Servicios: `src/server/services/{stability,chronomancy,writer,student,apprentice}-entry.service.ts`,
  helpers compartidos en `src/server/services/shared/manual-entries.ts`, y el
  contador semanal en `src/server/services/kpi-load-summary.service.ts`.
- Acciones de servidor: `src/server/actions/{stability,chronomancy,writer,student,apprentice}.actions.ts`.
- Pantallas: `src/app/splits/[id]/weeks/[weekId]/kpis/{estabilidad,cronomagia,articulos,dedicacion,formaciones}/{introducir,comprobar}`,
  con el bloque de exito compartido en
  `src/app/splits/[id]/weeks/[weekId]/kpis/ManualEntrySuccessPanel.tsx`.

## 1. Hotfix: cero implicito de Domador de Escaladas

### Problema corregido

El Excel de Escalados no siempre incluye a una persona cuando sus
`Reasignaciones de grupo` son cero. Antes de esta entrega, la ausencia de
fila de Escalados se trataba siempre como "Sin dato de Escalados", incluso
cuando ya existia una carga de Escalados confirmada para la semana y la
persona si tenia Productividad. Esto ocultaba el calculo real.

### Regla corregida

La inferencia de cero **solo** se aplica cuando ya existe una carga de
Escalados confirmada (`EscalationImport`) para esa semana. Si no existe
ninguna carga de Escalados, el comportamiento no cambia.

| Carga/fila de Escalados | Fila de Productividad | Resultado |
|---|---|---|
| No existe la carga semanal de Escalados | Cualquiera | `Sin dato de Escalados`; Domador sigue `Carga parcial` si Productividad existe |
| Existe la carga, la persona no tiene fila | Fila con `updates > 0` | `groupReassignments = 0` implicito; se calcula normalmente (`inferred: true`) |
| Existe la carga, la persona no tiene fila | Fila con `updates = 0` | Reasignaciones implicitas `0`, pero `No calculable: Actualizaciones es 0` |
| Existe la carga y existe fila de la persona | No existe Productividad | `Falta Productividad`; no es VAC |
| Existen ambas cargas, la persona no tiene fila en ninguna | No existe fila | `VAC`; no otorga puntos |
| Existen ambas filas reales | Existe fila | Se calcula con los valores reales |

Implementacion: `resolveEscalationTamerOutcome` (`src/domain/kpis/escalation.ts`)
recibe ahora `{ hasEscalationImport, groupReassignments, updates }` en vez de
los dos ultimos valores sueltos. Nunca se inserta una fila artificial en
`EscalationWeeklyRow`: la inferencia pertenece solo al resultado calculado.

### Presentacion en Comprobar

- Un cero explicito del Excel se muestra como `0`.
- Un cero inferido se muestra como `0 (inferido)`, con un `title` accesible:
  "El fichero de Escalados esta cargado y la persona no aparece; se
  interpreta como cero reasignaciones."
- La ausencia en ambos origenes se muestra como `AVISO` (hotfix
  `AVISO`/`0`, ver `docs/DECISIONS.md`; el estado interno sigue siendo
  `vac`). En resultados/publicacion/clasificacion/historico ese mismo
  resultado se muestra como `0` (ver `docs/RESULTS_PUBLICATION.md`).

### Correccion del contador `vacCount`

Con ambos archivos confirmados, `vacCount` de Domador cuenta unicamente a
los participantes aplicables que no tienen fila **ni** en Escalados **ni**
en Productividad (antes usaba una condicion "o", contando erroneamente
tambien a quien tenia solo uno de los dos). El estado global del grupo
(`Pendiente`/`Carga parcial`/`Cargado`) no cambia.

## 2. Los cinco formularios manuales

Los cinco KPI restantes no se cargan mediante Excel: el administrador
consulta otros origenes (Power BI, otros ficheros) y escribe los valores
directamente en la aplicacion. En la pantalla semanal
(`/splits/[id]/weeks/[weekId]/kpis`), cada grupo manual muestra
`Introducir datos` (en vez de `Cargar`) cuando esta activo, con su propia
ruta bajo `.../kpis/<slug>/{introducir,comprobar}`:

| KPI | Codigo | Participantes | Ruta |
|---|---|---|---|
| Guardian de la Estabilidad | `STABILITY_GUARDIAN` | Solo N2 aplicables | `.../kpis/estabilidad` |
| Cronomagia laboral | `WORK_CHRONOMANCY` | Todos los aplicables | `.../kpis/cronomagia` |
| Redactor estrella | `STAR_WRITER` | Todos los aplicables | `.../kpis/articulos` |
| Estudiante entusiasta | `ENTHUSIASTIC_STUDENT` | Todos los aplicables | `.../kpis/dedicacion` |
| Aprendiz experto | `EXPERT_APPRENTICE` | Todos los aplicables | `.../kpis/formaciones` |

No hay Excel, previsualizacion ni paso de "Analizar": una unica accion de
servidor valida y guarda (o sustituye) el conjunto completo. Si ya existen
datos guardados, la pantalla los precarga y el boton final dice
`Actualizar datos`; si no, `Guardar datos`. El enlace "Volver a introducir
datos" de la pantalla de exito usa una navegacion HTML completa (no
`next/link`), para forzar la recarga del Server Component y volver a
mostrar el formulario precargado en vez de quedarse en la pantalla de
exito (bug corregido en `BUGFIX-1 / UX-SPLIT-1`, ver `docs/DECISIONS.md`).

### Reglas comunes

- En los cinco KPI manuales, un campo vacio, ausente o solo con espacios se
  interpreta y persiste como `0` (`parseNonNegativeNumberDefaultZero`, ver
  `docs/DECISIONS.md`): ningun campo se rechaza ya como "obligatorio" por
  estar en blanco. Esta regla se amplio a Guardian de la Estabilidad y
  Cronomagia laboral en `0.6.0` / MVP-1C, sustituyendo la decision anterior
  de `BUGFIX-1 / UX-SPLIT-1` que los mantenia como obligatorios; Redactor
  estrella, Estudiante entusiasta y Aprendiz experto no cambian. En
  Cronomagia laboral, un vacio en "Horas totales" sigue exigiendo que
  "Horas productivas" tambien sea `0` o este vacio (ver su seccion mas
  abajo). Texto no numerico, negativos y valores no finitos siguen
  rechazandose siempre.
- Se acepta coma o punto como separador decimal en los campos que admiten
  decimales.
- Todos los errores detectables se devuelven en una sola respuesta,
  asociados a persona y campo (`ManualEntryValidationError`,
  `src/server/validation/manual-entry.ts`).
- El servidor vuelve a validar siempre split, semana y participantes
  aplicables; nunca confia en el HTML del formulario ni en `min`/`max` del
  navegador.
- El guardado es atomico: dentro de una unica transaccion se sustituye por
  completo el conjunto anterior de ese modelo y esa semana (se borran todas
  las filas existentes y se crean las nuevas); si algo falla, no se guarda
  nada.
- Una actualizacion de un KPI manual nunca modifica los otros KPI, los
  importadores de Excel ni la configuracion.
- Estados del split: `ACTIVE` permite introducir/actualizar; `DRAFT`
  deshabilita la entrada con una explicacion; `CLOSED` deja `Comprobar` en
  solo lectura y prohibe cualquier escritura en servidor, aunque se invoque
  la accion directamente.
- **Semana publicada (`0.6.0` / MVP-1C):** ademas del estado del split, si
  la semana ya tiene una publicacion (`WeekPublication`), el guardado se
  rechaza en servidor (`assertWeekIsEditable`) aunque el split siga
  `ACTIVE`; `Comprobar` sigue disponible en modo lectura. Ver
  `docs/RESULTS_PUBLICATION.md`.

### Estado de carga (`Pendiente`/`Cargado`, nunca `Carga parcial`)

- `Pendiente` (rojo) mientras falte al menos una fila requerida.
- `Cargado` (verde) cuando todos los participantes requeridos tienen su
  fila guardada.
- Si posteriormente cambia la participacion aplicable (por ejemplo, se
  incorpora un participante nuevo a esa semana) y falta su fila, el grupo
  vuelve a `Pendiente` hasta que se actualice el formulario.
- Guardian de la Estabilidad sin ningun N2 aplicable esa semana se
  considera `Cargado` (`No aplica esta semana`): de lo contrario nunca se
  podria alcanzar `X/X`.
- Ninguno de los cinco KPI manuales muestra `AVISO` de grupo. Guardian,
  Redactor, Estudiante y Aprendiz nunca muestran `AVISO` en absoluto (el
  cero es un dato normal y completo). Cronomagia es la unica excepcion: una
  fila con `totalHours = 0` se muestra como `AVISO` **por fila** (hotfix
  `AVISO`/`0`, ver `docs/DECISIONS.md`; internamente sigue siendo el
  estado `vac`), pero cuenta como guardada y no afecta al estado
  `Cargado`/`Pendiente` del grupo.

## 3. Guardian de la Estabilidad (`STABILITY_GUARDIAN`)

**Participantes:** solo N2 aplicables a la semana.

**Campo:** `Resultados de estabilidad` — decimal mayor o igual que cero. El
cero es un resultado real, nunca vacaciones. Un campo vacio, ausente o solo
con espacios se guarda tambien como `0` (`0.6.0` / MVP-1C, ver
`docs/DECISIONS.md`); texto no numerico y negativos se siguen rechazando.

**Formula** (`src/domain/kpis/stability.ts`):

```
puntos sin limite = resultados x pointsPerResult x multiplicador del nivel
puntos finales = minimo(puntos sin limite, baseMax)
```

Si el multiplicador N2 es `null`, el resultado es `No aplica`.

## 4. Cronomagia laboral (`WORK_CHRONOMANCY`)

**Participantes:** todos los aplicables.

> **Desde `1.1.1`** (ver `docs/WEEKLY_ATTENDANCE_AND_HOURS.md`): el campo
> `Horas totales de la semana` deja de ser exclusivo de este KPI. Es
> **obligatorio guardarlo para todo participante aplicable de toda
> semana**, exista o no `WORK_CHRONOMANCY` activo en el split: es el
> unico dato que determina la asistencia semanal
> (`totalHours > 0` = presente, `= 0` = ausente), con prioridad absoluta
> sobre cualquier otro KPI. `Horas productivas` sigue siendo exclusivo
> del calculo de este KPI: solo se pide y se guarda cuando esta activo
> **y** aplica al nivel del participante (columna nullable desde esta
> version; `null` significa "no aplica", nunca "vacaciones" ni cero
> implicito). Con el KPI inactivo o no aplicable, el formulario y
> `getChronomancyFormView`/`saveChronomancyEntries` solo piden y guardan
> `totalHours`; la cobertura de carga (`getChronomancyLoadStatus`) se
> calcula siempre sobre este mismo campo.

**Campos:** `Horas productivas` y `Horas totales de la semana` (ambos
decimales, mayores o iguales que cero). Desde `0.6.0` / MVP-1C, un campo
vacio, ausente o solo con espacios en cualquiera de los dos se interpreta y
persiste como `0` (ver `docs/DECISIONS.md`). La pantalla de introduccion
calcula el occupancy en vivo para ayudar a revisar antes de guardar
(tratando tambien un campo vacio como `0`, igual que el servidor); el
servidor vuelve a calcular con `Prisma.Decimal` al guardar y al comprobar.

**Reglas:**

- Si `Horas totales` es `0` o esta vacia (equivale a `0`), `Horas
  productivas` debe ser tambien `0` o estar vacia (vacaciones toda la
  semana). Esa combinacion se rechaza en cualquier otro caso (`productivas
  > 0` con `total` en `0`/vacio es un error de validacion).
- La fila `0/0` (incluida `vacio/vacio`) se guarda igual, se muestra en
  carga/comprobar como `AVISO` con `0 %` de occupancy (hotfix `AVISO`/`0`,
  ver `docs/DECISIONS.md`; internamente sigue siendo el estado `vac`), y no
  recibe puntos, pero cuenta como fila completa (no impide `Cargado`). En
  resultados/publicacion/clasificacion/historico este mismo resultado se
  muestra como `0` puntos (ver `docs/RESULTS_PUBLICATION.md`).
- `vacio/40` guarda las productivas como `0` y calcula normalmente
  (`0 %`), sin marcarse como `AVISO`.
- Las horas productivas pueden superar las horas totales (ocurre en los
  datos reales): no es un error.
- El grupo muestra `n AVISO` (a nivel de grupo de estado de carga,
  `vacCount` siempre es `0` para el resto de KPI manuales; para
  Cronomagia, `AVISO` es una senal por fila en Comprobar, no un contador de
  cobertura).

**Formula** (`src/domain/kpis/chronomancy.ts`), solo si no es VAC:

```
occupancy limitado = minimo(horas productivas / horas totales, 1)
puntos sin limite = occupancy limitado x pointsAtFullOccupancy x multiplicador
puntos finales = minimo(puntos sin limite, baseMax)
```

`VAC` (por `totalHours = 0`) tiene prioridad sobre el calculo: nunca se
convierte en cero puntos como si hubiese occupancy cero (se muestra como
`AVISO` en carga/comprobar y como `0` en resultados, nunca un occupancy
cero disfrazado de calculo real).

Ejemplos verificados: `38,5 / 40` -> `96,25 %`; `46,7 / 40` -> `100 %` (sin
error); `0 / 0` -> `AVISO` en carga/comprobar, `0` puntos en resultados.

## 5. Redactor estrella (`STAR_WRITER`)

**Participantes:** todos los aplicables.

**Campos:** `Articulos entregados`, `Articulos no entregados` y `Articulos
propuestos` — tres conteos enteros mayores o iguales que cero. Los no
entregados se escriben como un conteo **positivo**: el calculo aplica la
resta. Los tres ceros son una entrada valida y completa. **Desde
`BUGFIX-1 / UX-SPLIT-1`**: cualquiera de los tres campos, vacio o con solo
espacios, se interpreta y persiste como `0` (`parseNonNegativeNumberDefaultZero`,
ver `docs/DECISIONS.md`); una pantalla con combinaciones de campos rellenos
y vacios se guarda sin mensajes de "es obligatorio". Se mantienen las
reglas de solo enteros, no negativos y guardado atomico; un texto no
numerico o un valor negativo siguen siendo un error.

**Formula** (`src/domain/kpis/writer.ts`):

```
puntos sin limite = entregados x approvedArticlePoints x multiplicador
                     - no entregados x negativeArticlePoints
                     + propuestos x proposalPoints
puntos finales = minimo(puntos sin limite, baseMax)
```

El multiplicador solo afecta a los articulos entregados; nunca a los no
entregados ni a las propuestas. Sin suelo de cero: un resultado negativo es
valido (ejemplo verificado: entregado `1`, no entregado `1`, propuesto `2`,
valores `10/10/5`, multiplicador `2` -> `1x10x2 - 1x10 + 2x5 = 20`).

## 6. Estudiante entusiasta (`ENTHUSIASTIC_STUDENT`)

**Participantes:** todos los aplicables.

**Campo:** `Horas dedicadas` — decimal mayor o igual que cero. El cero es
valido y completo. **Desde `BUGFIX-1 / UX-SPLIT-1`**: el campo vacio o con
solo espacios tambien se interpreta y persiste como `0`, conservando el
parseo decimal con coma o punto y el rechazo de valores negativos o no
numericos. Una vez guardado el formulario completo, todos los
participantes aplicables quedan con fila (incluidos los que se dejaron en
blanco), y el grupo puede quedar `Cargado`.

**Formula** (`src/domain/kpis/student.ts`):

```
puntos sin limite = horas dedicadas x pointsPerHour x multiplicador
puntos finales = minimo(puntos sin limite, baseMax)
```

## 7. Aprendiz experto (`EXPERT_APPRENTICE`)

**Participantes:** todos los aplicables.

**Campo:** `Formaciones completadas` — entero mayor o igual que cero, con
ayuda visible "**Máximo configurado**: `targetValue`" (con tilde, ver
`docs/DECISIONS.md`). El valor no puede superar `targetValue`
**de forma inclusiva**: si `targetValue = 15`, los valores de `0` a `15`
son validos y solo un valor `> 15` se rechaza (validado en servidor, no
solo con el atributo `max` del campo). El cero, explicito o por campo
vacio, es valido: **desde `BUGFIX-1 / UX-SPLIT-1`** un campo vacio o con
solo espacios se interpreta y persiste como `0`
(`parseNonNegativeNumberDefaultZero`), y un `0` escrito explicitamente
nunca se confunde con ausencia por ser un valor falsy.

Si `targetValue` cambia despues de guardar una entrada y un valor
historico queda por encima del nuevo maximo, la pantalla de introduccion
lo senala (`exceedsTarget`) y exige corregirlo antes de poder guardar de
nuevo: los datos no se tocan ni se recortan automaticamente.

**Formula** (`src/domain/kpis/apprentice.ts`):

```
puntos sin limite = formaciones completadas / targetValue x pointsAtTarget x multiplicador
puntos finales = minimo(puntos sin limite, baseMax)
```

`targetValue` ausente o invalido produce un error de configuracion claro,
nunca una division silenciosa.

## 8. Reglas comunes de calculo

Igual que Productividad/Escalados/Calidad/Llamadas: funciones puras y
tipadas en `src/domain/kpis/*`, aritmetica `Prisma.Decimal`, parametros y
multiplicadores de `SplitKpiConfig`, `No aplica` con prioridad cuando el
multiplicador del nivel es `null`, el maximo se aplica sobre el resultado
completo como techo superior, sin suelo de cero, sin redondear antes del
maximo. Los puntos se calculan siempre al consultar (no se persisten).

## 9. Modelo de datos

Cinco entidades nuevas, sin fichero ni cabecera de carga (ver
`docs/DATA_MODEL.md` para el detalle completo):

- `StabilityWeeklyEntry` (`resultValue: Decimal`)
- `ChronomancyWeeklyEntry` (`productiveHours`, `totalHours: Decimal`; sin
  columna `occupancy`, se calcula al consultar)
- `WriterWeeklyEntry` (`deliveredArticles`, `undeliveredArticles`,
  `proposedArticles: Int`)
- `StudentWeeklyEntry` (`dedicatedHours: Decimal`)
- `ApprenticeWeeklyEntry` (`completedTrainings: Int`)

Todas comparten la misma forma: `id`, `splitWeekId` (`onDelete: Cascade`),
`splitParticipantId` (`onDelete: Restrict`), timestamps, restriccion unica
`[splitWeekId, splitParticipantId]` y restricciones SQL de no negatividad.
Migracion `add_manual_kpi_entries`.

## 10. Contador `KPI cargados` del calendario de semanas

Nueva columna independiente en "Calendario de semanas"
(`src/server/services/kpi-load-summary.service.ts`), junto a la columna
existente "Carga de KPI": `numero de KPI activos completos / numero total
de KPI activos` (por ejemplo `4/10`), calculada siempre al consultar, nunca
persistida.

### Como cuenta cada KPI

| KPI activo | Se considera cargado cuando... |
|---|---|
| Cazador de soluciones / Explorador de datos | Existe `ProductivityImport` para la semana (cada uno cuenta individualmente) |
| Embajador de voz | Existe `VoiceImport` |
| Maestro Artesano | Existe `QualityImport` |
| Domador de Escaladas | Existen `EscalationImport` **y** `ProductivityImport` (cuenta como un unico KPI) |
| Guardian de la Estabilidad | Todas las filas N2 requeridas estan guardadas, o no hay N2 aplicable |
| Cronomagia laboral | Todas las filas requeridas estan guardadas (incluidas las `0/0 = VAC`) |
| Redactor estrella / Estudiante entusiasta / Aprendiz experto | Todas las filas requeridas estan guardadas |

- El denominador incluye unicamente KPI activos del split; sin KPI activos,
  `0/0` en tono neutro.
- Un mismo `ProductivityImport` puede sumar dos al numerador si ambos KPI
  (Cazador y Explorador) estan activos.
- Que falte una persona en un Excel no resta KPI cargados (la carga
  confirmada sigue completa, con su propio `n AVISO` en la pantalla
  semanal).
- Con `X/X`, el indicador se muestra en verde con el texto accesible
  "Carga semanal completa".

### Sin N+1

El servicio hace un numero acotado de consultas para todo el calendario
(participantes, KPI activos, y una consulta por cada uno de los nueve
origenes de datos), nunca una consulta por KPI y semana.

## 11. Recorrido de prueba manual

1. Split activo con los diez KPI activos y participantes N0/N1/N2.
2. Cargar Productividad y Escalados dejando fuera de Escalados a alguien
   que si tenga Productividad: debe verse `0 (inferido)`, calcular puntos y
   no sumar `AVISO`. Dejar a otra persona fuera de ambos ficheros: debe
   aparecer como `AVISO` en Comprobar y como `0` en la previsualizacion de
   resultados.
3. Introducir Guardian: solo N2, un cero se conserva como resultado real.
4. Introducir Cronomagia con un ratio normal, uno superior al 100 % y un
   `0/0`: porcentaje correcto, limite al 100 % y `AVISO` respectivamente en
   Comprobar (`0` puntos en resultados).
5. Introducir Redactor con entregados, no entregados y propuestas.
6. Introducir horas de Estudiante, incluido el cero.
7. Introducir formaciones de Aprendiz y comprobar que no permite superar el
   maximo configurado.
8. Editar de nuevo cada formulario: precarga sus propios datos y sustituye
   sin tocar otros KPI.
9. Observar el calendario avanzar de `0/X` a `X/X`, quedando verde al
   completar todos los KPI activos.
10. Cerrar el split: las pantallas de comprobacion siguen siendo
    consultables, pero ninguna accion de servidor permite modificar datos.

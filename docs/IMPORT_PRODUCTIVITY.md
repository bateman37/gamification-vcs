# Carga de Productividad — IMPORT-1A / MVP-1C.1

Referencia principal de la primera carga semanal implementada: el Excel de
Productividad, que alimenta el calculo administrativo de **Cazador de
soluciones** (`SOLUTION_HUNTER`) y **Explorador de datos** (`DATA_EXPLORER`).
Pensada para que otra sesion continue sin depender de la conversacion
original. Fuente de verdad en codigo:
`src/server/services/productivity/excel-reader.ts`,
`src/server/services/productivity/matching.ts`,
`src/domain/kpis/productivity.ts` y
`src/server/services/productivity-import.service.ts`.

## Proposito

Desde el detalle administrativo de un split `ACTIVE`, cada fila del
calendario de semanas tiene una accion `Introducir KPI` que abre una
pantalla independiente para esa semana. Ahi, el grupo `Productividad`
permite analizar (sin guardar), confirmar o sustituir un unico archivo
Excel semanal que alimenta a la vez los dos KPI anteriores, y comprobar los
resultados persistidos. La configuracion de los KPI (maximos,
multiplicadores, parametros) sigue viviendo exclusivamente en el panel
administrativo existente (`docs/KPI_CONFIGURATION.md`); esta pantalla solo
carga y consulta datos.

## Contrato del Excel

- Formato `.xlsx` unicamente, procesado en memoria y solo en servidor.
  Nunca se guarda en disco, PostgreSQL, Git ni ningun servicio externo.
- Limite de tamano: 1024 KB (1 MB).
- Limite de lectura: 500 filas de datos y 50 columnas.
- Lee siempre la **primera hoja** del libro, sin depender de su nombre.
- Encabezados en la fila 1. Su orden puede variar y puede haber columnas
  adicionales: solo importan los ocho encabezados obligatorios siguientes.
- Para reconocer un encabezado se normaliza (mayusculas/minusculas,
  espacios exteriores e interiores, diacriticos), pero el texto original se
  conserva para los mensajes de error.
- Ignora filas completamente vacias al final del rango de datos.
- **No contiene la fecha ni la semana del periodo.** La semana elegida en
  la interfaz (la fila del calendario desde la que se entro) es la unica
  fuente de verdad del periodo: nunca se deduce del archivo ni de su
  nombre.

### Los ocho encabezados y su uso

| Encabezado | Uso |
|---|---|
| `Nombre del actualizador` | Identificacion de la persona (nombre real, no alias) |
| `Actualizaciones` | Conservado para el futuro calculo de Domador de Escaladas (`ESCALATION_TAMER`); no se usa en este MVP |
| `Comentarios` | Dato fuente y trazabilidad |
| `Comentarios públicos` | Dato fuente y trazabilidad |
| `Comentarios internos` | Dato fuente y trazabilidad |
| `Tickets actualizados con comentario` | Valor de entrada de Explorador de datos |
| `Tickets resueltos` | Valor de entrada de Cazador de soluciones |
| `Tickets creados` | Dato fuente y trazabilidad |

Los siete conteos (todos menos el nombre) deben ser enteros mayores o
iguales que cero. El lector acepta una celda numerica de Excel o un texto
compuesto solo por digitos tras recortar espacios; rechaza negativos,
decimales, formulas, booleanos, fechas y texto arbitrario. Un valor vacio
nunca se convierte en cero: se marca como error ("falta el valor"). Si dos
filas coinciden en `Nombre del actualizador` tras normalizar, la carga se
bloquea entera (no se suman silenciosamente). Todos los errores
detectables (encabezados ausentes, celdas invalidas, nombres duplicados)
se reunen en una sola respuesta, en vez de exigir corregirlos uno a uno.

## Acceso desde el calendario y pantalla semanal

- En la tabla "Calendario de semanas" del detalle del split
  (`/splits/[id]`) hay una columna final "Carga de KPI". En un split
  `ACTIVE` muestra el boton `Introducir KPI`, que abre
  `/splits/[id]/weeks/[weekId]/kpis`, identificando la semana por su `id`
  real (nunca por un numero sin validar). En `DRAFT` se muestra deshabilitado
  con el texto "Activa el split para introducir KPI". En `CLOSED` se
  muestra `Ver KPI`, que abre la misma pantalla en modo consulta.
- La pantalla semanal (`WeeklyKpisPage`) no tiene selector de semana: la
  semana ya viene fijada por la fila desde la que se entro, y se vuelve a
  validar en servidor que pertenece a ese split (`getSplitWeek`).
- Esa pantalla agrupa los KPI activos del split por origen de carga
  (`src/domain/kpis/loadGroups.ts`). El grupo `Productividad` aparece si
  `SOLUTION_HUNTER` o `DATA_EXPLORER` (o ambos) estan activos, con un unico
  boton `Cargar`, un unico `Comprobar` y un unico indicador de estado. El
  resto de KPI activos aparecen, uno por grupo, como `Pendiente` con sus
  botones deshabilitados y el texto "Carga todavia no implementada": no
  forman parte del alcance de esta entrega.
- El indicador de estado muestra **un solo** color y texto a la vez (nunca
  los tres juntos):
  - `Pendiente` (rojo): no existe `ProductivityImport` para esa semana.
  - `Carga parcial` (ambar): existe la carga, pero falta al menos un
    participante aplicable.
  - `Cargado` (verde): existe la carga y todos los participantes
    aplicables tienen fila persistida.
  El estado se calcula siempre al consultar (no se guarda una copia que
  pueda desincronizarse), y solo tiene en cuenta si existen filas por
  participante aplicable, no si Cazador o Explorador esta activo
  individualmente.
- `Comprobar` esta deshabilitado en `Pendiente` y se habilita en `Carga
  parcial` o `Cargado`.

## Emparejamiento por nombre real

La identidad del Excel es el nombre real (`Person.fullName`), nunca el
alias del split. Para la semana elegida:

1. Se obtienen los participantes cuya vigencia incluye esa semana segun
   `startWeekSequenceNumber` y `endWeekSequenceNumber`
   (`listApplicableParticipantsForWeek`).
2. Se compara `Nombre del actualizador` con `Person.fullName` usando la
   normalizacion comun del proyecto (`normalizeForMatching` en
   `src/lib/normalize.ts`): recorte de espacios exteriores, colapso de
   espacios interiores consecutivos, minusculas y eliminacion de
   diacriticos. Esta misma funcion normaliza tambien los encabezados de
   columna.
3. El alias del split se usa solo para **mostrar** el resultado, nunca
   para emparejar.

Estados de la previsualizacion y de la carga (`ProductivityRowMatch`):

- **Encontrado**: una fila corresponde de forma inequivoca a un
  participante aplicable. Se persiste.
- **Ignorado**: la persona del Excel no participa en el split o no es
  aplicable en esa semana. Se muestra en la previsualizacion, pero nunca
  se persiste.
- **Sin dato**: un participante aplicable no aparece (de forma no
  ambigua) en el Excel. No recibe cero puntos ni genera fila de
  productividad.
- **Ambiguo**: mas de un participante aplicable comparte el mismo nombre
  normalizado que una fila del Excel. Bloquea la confirmacion hasta que se
  resuelva (cambiando el split o corrigiendo los datos): esta entrega no
  incluye una pantalla de mapeo manual.

Debe existir al menos una fila encontrada para poder confirmar.

## Formulas y orden del maximo

Funciones puras en `src/domain/kpis/productivity.ts`, con aritmetica
decimal (`Prisma.Decimal`) para no depender de errores de coma flotante.

**Cazador de soluciones:**

```
puntos sin limite = tickets resueltos x pointsPerResolvedTicket x multiplicador del nivel
puntos finales = minimo(puntos sin limite, baseMax)
```

**Explorador de datos:**

```
puntos sin limite = tickets actualizados con comentario x pointsPerCommentedTicket x multiplicador del nivel
puntos finales = minimo(puntos sin limite, baseMax)
```

El maximo (`baseMax`) se aplica siempre **despues** de calcular el
resultado sin limite: nunca se redondea ni se limita antes. La
configuracion (parametro propio, multiplicador por nivel y maximo) es la
misma `SplitKpiConfig` de `MVP-1B`; como los puntos se calculan al
consultar y no se guardan como instantanea, un cambio permitido en esa
configuracion o en el nivel del participante se refleja automaticamente
sin reimportar el Excel (ver `docs/DECISIONS.md`).

### Cero, sin dato y no aplica

Estos tres estados se distinguen siempre, nunca se confunden con cero:

- **Cero real**: existe fila importada y el valor fuente es `0`. El KPI
  aplica y el resultado es `0` puntos.
- **Sin dato** (`no_data`): no existe fila importada para ese participante
  en esa semana.
- **No aplica** (`not_applicable`): el multiplicador de ese nivel esta
  vacio en la configuracion del KPI (por ejemplo, Guardian de la
  Estabilidad con N0/N1 vacios). Tiene prioridad sobre "sin dato": si el
  nivel no aplica, el resultado es "No aplica" aunque tampoco haya fila.

### Ejemplos verificados (sinteticos)

- Cazador: 23 resueltos, `pointsPerResolvedTicket = 1`, N1 con
  multiplicador `1`, maximo `70` -> `23` puntos (sin limite).
- Explorador: 49 tickets, `pointsPerCommentedTicket = 1`, N1 con
  multiplicador `0,5`, maximo `70` -> `24,5` puntos (sin limite).
- Explorador: 55 tickets, N2 con multiplicador `1,5`, maximo `70` ->
  puntos sin limite `82,5`, puntos finales `70` (maximo aplicado).

## Persistencia y sustitucion

- `ProductivityImport` (cabecera) guarda como mucho una carga **vigente**
  por `splitWeekId` (indice unico). Nunca guarda el binario del Excel:
  `fileSha256` solo identifica el archivo procesado (para depuracion
  administrativa), no se usa para deducir la semana.
- `ProductivityWeeklyRow` guarda los siete conteos fuente por participante
  encontrado, mas `sourceAgentName` para trazabilidad. Los puntos de
  Cazador y Explorador **no** se guardan: se calculan siempre al consultar.
- `previewProductivityImport` (accion "Analizar archivo") nunca escribe en
  la base de datos.
- `confirmProductivityImport` (acciones "Confirmar carga" / "Sustituir
  carga") **vuelve a leer y validar el archivo en servidor**: nunca confia
  en los datos de la previsualizacion enviados por el navegador. Comprueba
  de nuevo que el split este `ACTIVE` y que la semana pertenezca a ese
  split.
- Si ya existia una carga para esa semana, la sustitucion elimina la carga
  vigente y sus filas y crea la nueva dentro de una **unica transaccion**
  (`db.$transaction`); si cualquier paso falla, la carga anterior queda
  intacta. La sustitucion nunca toca personas, participantes,
  configuracion de KPI ni datos de otros KPI.
- Tras confirmar, la interfaz no permite reenviar el mismo formulario: se
  muestra un estado de exito con un enlace a "Comprobar".
- No se conserva el historial de archivos sustituidos en esta entrega.

## Estados del split y de la semana

- Solo un split `ACTIVE` permite analizar, confirmar o sustituir una carga
  (`assertSplitAcceptsLoads`). Se comprueba en el servicio, no solo en la
  interfaz.
- En `DRAFT`, la pantalla semanal se puede alcanzar pero el acceso normal
  (boton del calendario) esta deshabilitado; `Cargar` no esta disponible.
- En `CLOSED`, la accion es `Ver KPI`: se puede `Comprobar` (si hay datos),
  pero no analizar, confirmar ni sustituir.
- La semana debe pertenecer al split indicado (`getSplitWeek` en
  `split.service.ts`); nunca se acepta un `splitWeekId` sin comprobar esa
  relacion.
- No se deduce la semana por la fecha actual, el nombre del archivo ni
  metadatos del Excel: el administrador la elige conscientemente al pulsar
  la fila del calendario, y se puede cargar una semana futura del propio
  split (esta entrega no incluye apertura/cierre semanal).

## Privacidad y datos que no se guardan

- El Excel se procesa unicamente en servidor y solo en memoria.
- Nunca se guarda el archivo subido en disco, `public`, carpetas
  temporales persistentes ni Git.
- No se registran en logs los nombres ni el contenido del archivo.
- Los tests usan nombres y cifras sinteticos; no se incluyen datos
  personales reales en fixtures, documentacion ni capturas.

## Limitaciones de esta entrega

- Solo Productividad (Cazador de soluciones y Explorador de datos) tiene
  carga y comprobacion funcional. El resto de KPI activos se muestran como
  `Pendiente` y deshabilitados.
- No hay mapeo manual de nombres: una ambiguedad bloquea la confirmacion
  hasta corregir los datos de origen (split o Excel).
- No hay historial de versiones de una misma carga (solo la vigente).
- No se implementan Domador de Escaladas, clasificacion general, vista
  individual, publicacion/cierre semanal, autenticacion, ni ningun otro
  origen de carga (Calidad, Llamadas, Articulos, Formaciones...): siguen
  pendientes en `docs/ROADMAP.md`.

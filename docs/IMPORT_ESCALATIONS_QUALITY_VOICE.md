# Carga de Escalados, Calidad y Llamadas — MVP-1C.2 / IMPORT-1B

Referencia principal de la segunda y tercera cargas semanales implementadas:
los Excel de Escalados, Calidad y Llamadas, que alimentan **Domador de
Escaladas** (`ESCALATION_TAMER`), **Maestro Artesano** (`MASTER_CRAFTSMAN`)
y **Embajador de voz** (`VOICE_AMBASSADOR`). Pensada para que otra sesion
continue sin depender de la conversacion original. Complementa
`docs/IMPORT_PRODUCTIVITY.md`, cuyo recorrido seguro (analizar sin guardar,
confirmar con revalidacion en servidor, sustitucion atomica, emparejamiento
por nombre real) se reutiliza tal cual para estos tres origenes.

Fuente de verdad en codigo:

- Lectura y validacion: `src/server/services/shared/xlsx.ts` (recorrido
  comun) y `src/server/services/{escalation,quality,voice}/excel-reader.ts`
  (encabezados y reglas propias de cada origen).
- Emparejamiento: `src/server/services/shared/matching.ts` (compartido
  tambien por Productividad).
- Calculo: `src/domain/kpis/shared.ts` (helpers comunes) y
  `src/domain/kpis/{escalation,quality,voice}.ts`.
- Persistencia, previsualizacion y comprobacion:
  `src/server/services/{escalation,quality,voice}-import.service.ts`.

## Proposito

En la misma pantalla semanal (`/splits/[id]/weeks/[weekId]/kpis`) aparecen
ahora, si su KPI esta activo, tres grupos adicionales:

| Grupo visible | KPI | Ruta |
|---|---|---|
| `Domador de Escaladas` | `ESCALATION_TAMER` | `.../kpis/escalados/{cargar,comprobar}` |
| `Maestro Artesano` | `MASTER_CRAFTSMAN` | `.../kpis/calidad/{cargar,comprobar}` |
| `Embajador de voz` | `VOICE_AMBASSADOR` | `.../kpis/llamadas/{cargar,comprobar}` |

Cada grupo tiene su propio boton `Cargar` (abre el importador de su propio
origen, nunca el de otro grupo) y su propio `Comprobar`. La configuracion de
los KPI (maximos, multiplicadores, parametros) sigue viviendo
exclusivamente en el panel administrativo existente; estas pantallas solo
cargan y consultan datos.

## Contrato comun de los tres Excel

Confirmado por auditoria (sin datos personales en este repositorio):

- Formato `.xlsx` unicamente, procesado en memoria y solo en servidor.
  Nunca se guarda el binario.
- Limite de tamano 1024 KB (1 MB), 500 filas de datos y 50 columnas (los
  mismos limites que Productividad, ver `src/server/services/shared/xlsx.ts`).
- Lee siempre la **primera hoja**, sin depender de su nombre ni del nombre
  de una posible tabla de Excel dentro de ella.
- Encabezados en la fila 1, en cualquier orden, con columnas adicionales
  permitidas. Se normalizan (mayusculas/minusculas, espacios, diacriticos)
  para reconocerlos; el texto original se conserva en los mensajes de
  error.
- Ninguno de los tres contiene fecha ni semana: la semana elegida en la
  pantalla (`Introducir KPI`) es la unica fuente de verdad del periodo.
- El nombre del archivo puede cambiar sin afectar a la carga: ningun
  importador decide el origen por el nombre del fichero.
- Cero es un valor valido; un vacio nunca se convierte en cero.

## 1. Domador de Escaladas — Excel de Escalados

### Encabezados obligatorios

| Encabezado | Tipo | Uso |
|---|---|---|
| `Nombre del actualizador` | Texto | Identificacion de la persona |
| `Reasignaciones de grupo` | Entero >= 0 | Numerador del KPI |

La segunda dependencia del calculo, "tickets gestionados", **no viene en
este Excel**: se lee de `ProductivityWeeklyRow.updates`, ya persistido para
la misma semana y el mismo participante. Analizar o confirmar Escalados
**nunca** crea ni modifica Productividad.

### Modelo de datos

`EscalationImport` (cabecera, una carga vigente por `splitWeekId`) y
`EscalationWeeklyRow` (`groupReassignments` por participante encontrado).
Ver `docs/DATA_MODEL.md`.

### Calculo

```
puntos sin limite = (basePoints - (groupReassignments / updates) x ratioPenaltyFactor) x multiplicador del nivel
puntos finales = minimo(puntos sin limite, baseMax)
```

Parametros existentes desde `MVP-1B`: `basePoints` (30), `ratioPenaltyFactor`
(200). Sin suelo de cero: un resultado negativo es valido.

Estados especiales, en este orden de prioridad (actualizado por el hotfix
`MVP-1C.3 / INPUT-1C`, ver `docs/MANUAL_KPI_ENTRY.md`):

1. **No aplica**: el multiplicador del nivel esta vacio.
2. **Sin dato de Escalados**: no existe ninguna carga de Escalados
   confirmada para esa semana.
3. **VAC**: existe la carga de Escalados, pero el participante no tiene
   fila ni en Escalados ni en Productividad.
4. **Falta Productividad**: hay fila **real** de Escalados pero no de
   Productividad (misma semana, mismo participante).
5. **No calculable: Actualizaciones es 0**: se conocen las reasignaciones
   (reales o inferidas) pero `updates` es `0` (no se divide por cero, no se
   otorgan puntos).
6. **Calculado**: se conocen ambos valores y `updates > 0`. Si la fila de
   Escalados no existia y se infirio `groupReassignments = 0` porque la
   carga de Escalados ya existe y hay Productividad, el resultado incluye
   `inferred: true` y se muestra en Comprobar como `0 (inferido)`.

**Cero implicito (hotfix):** si la carga de Escalados de la semana existe
pero la persona no tiene fila en ella, y esa persona **si** tiene fila de
Productividad, sus reasignaciones se interpretan como cero implicito (no se
inserta ninguna fila artificial en `EscalationWeeklyRow`: la inferencia
pertenece solo al resultado calculado). Si tampoco tiene Productividad, es
`VAC`. Esta inferencia nunca se aplica si la carga de Escalados no existe
todavia para la semana.

Ejemplo verificado (sintetico, configuracion predeterminada de Split 8):
`groupReassignments = 3`, `updates = 192`, `basePoints = 30`,
`ratioPenaltyFactor = 200`, multiplicador `1`, `baseMax = 30` ->
`26,875` -> mostrado como `26,88`.

### Estado del grupo (unico caso con amarillo en esta entrega)

| Situacion | Estado |
|---|---|
| No existe ni Escalados ni Productividad | Rojo — `Pendiente` |
| Existe exactamente uno de los dos origenes | Amarillo — `Carga parcial` |
| Existen ambos origenes | Verde — `Cargado`, con `n VAC` si falta la pareja completa de filas para algun participante aplicable |

El amarillo nunca se debe a que falten participantes dentro de un origen
ya presente: eso se expresa con `n VAC` en verde, igual que en
Productividad, Calidad y Llamadas (ver `docs/DECISIONS.md`).

**Correccion de `vacCount` (hotfix `MVP-1C.3 / INPUT-1C`):** con ambos
origenes confirmados, `vacCount` cuenta unicamente a los participantes
aplicables que no tienen fila **ni** en Escalados **ni** en Productividad.
Quien tiene fila en uno de los dos origenes nunca cuenta como VAC: su
ausencia en el otro se resuelve como cero implicito o como "Falta
Productividad", nunca como VAC.

### Dependencia visible en pantalla

El grupo (y su pantalla `Comprobar`) muestran por separado
`Escalados: pendiente/cargado` y `Productividad: pendiente/cargado`. Si
falta Productividad, se ofrece un enlace directo a
`.../kpis/productividad/cargar` de la misma semana. Esto funciona incluso
si Cazador de soluciones y Explorador de datos estan inactivos: no se
activan ni se muestran esos KPI, pero la carga de Productividad sigue
disponible como dependencia de Domador.

## 2. Maestro Artesano — Excel de Calidad

### Encabezados obligatorios

| Encabezado | Tipo | Uso |
|---|---|---|
| `Nombre del agente asignado` | Texto | Identificacion de la persona |
| `Tickets con satisfacción buena` | Entero >= 0 | Valoraciones positivas |
| `Tickets con satisfacción mala` | Entero >= 0 | Valoraciones negativas |

### Modelo de datos

`QualityImport` / `QualityWeeklyRow` (`goodSatisfactionTickets`,
`badSatisfactionTickets`), misma forma que Productividad.

### Calculo

```
puntos sin limite = (buenas x positiveWeight - malas x negativePenalty) x scale x multiplicador del nivel
puntos finales = minimo(puntos sin limite, baseMax)
```

Parametros existentes desde `MVP-1B`: `positiveWeight` (1),
`negativePenalty` (4), `scale` (10). Sin suelo de cero.

Ejemplos verificados: 2 buenas, 0 malas, pesos 1/4, escala 10,
multiplicador 2, maximo 100 -> `40`. 0 buenas, 1 mala, misma configuracion
-> `-80` (no se limita a cero).

### Estado del grupo

`Pendiente` (rojo) sin `QualityImport`; `Cargado` (verde) con carga
confirmada, con `n VAC` si faltan participantes aplicables. Nunca queda en
`Carga parcial`.

## 3. Embajador de voz — Excel de Llamadas

### Encabezados obligatorios

| Encabezado | Tipo | Uso |
|---|---|---|
| `Agente del segmento - Nombre` | Texto | Identificacion de la persona |
| `Segmentos de llamada aceptados` | Entero >= 0 | Calculo |
| `Segmentos de llamada rechazados` | Entero >= 0 | Calculo |
| `Segmentos de llamada no atendidos` | Entero >= 0 | Calculo |
| `Llamadas salientes` | Entero >= 0 | Calculo |
| `Duración de segmento (h)` | Decimal >= 0 | Trazabilidad |
| `Tiempo de conversación de segmento (h)` | Decimal >= 0 | Trazabilidad |
| `Tiempo de conclusión de segmento (h)` | Decimal >= 0 | Trazabilidad |
| `Segmento - Tiempo de conversación (min)` | Decimal >= 0 | Trazabilidad |
| `Segmento - Tiempo de conclusión (min)` | Decimal >= 0 | Trazabilidad |

Las cinco columnas de tiempo se conservan para trazabilidad, aunque no
puntuan en esta entrega. Acepta un unico separador decimal `.` o `,`, sin
separadores de miles; se persisten con `Prisma.Decimal` construido
directamente desde el texto de la celda (nunca desde `Number` de
JavaScript), para no depender del redondeo binario.

### Modelo de datos

`VoiceImport` / `VoiceWeeklyRow`: cuatro conteos enteros
(`acceptedCallSegments`, `rejectedCallSegments`, `unattendedCallSegments`,
`outboundCalls`) y cinco `Decimal(14,6)` de tiempo.

### Calculo

```
bloque entrante = aceptadas x acceptedWeight - rechazadas x rejectedPenalty - no atendidas x unattendedPenalty
puntos sin limite = bloque entrante x multiplicador del nivel + salientes x outboundPoints
puntos finales = minimo(puntos sin limite, baseMax)
```

Las llamadas salientes se suman **despues** del multiplicador: no forman
parte del bloque multiplicado. Parametros existentes desde `MVP-1B`:
`acceptedWeight`, `rejectedPenalty`, `unattendedPenalty`, `outboundPoints`
(todos 1 por defecto).

Ejemplo verificado: 14 aceptadas, 0 rechazadas, 6 no atendidas, 10
salientes, pesos 1, multiplicador 2, maximo 50 ->
`(14 - 0 - 6) x 2 + 10 = 26`.

### Estado del grupo

Igual que Calidad: `Pendiente` / `Cargado` con `n VAC`, nunca `Carga
parcial`.

## Emparejamiento, previsualizacion y confirmacion

Los tres origenes reutilizan exactamente las reglas de
`docs/IMPORT_PRODUCTIVITY.md`:

- Emparejamiento por `Person.fullName` normalizado
  (`src/lib/normalize.ts`), nunca por alias; distingue **encontrado**,
  **ignorado**, **sin dato** y **ambiguo** (bloquea la confirmacion).
- `Analizar archivo` nunca escribe en la base de datos.
- Confirmar vuelve a leer y validar el archivo en servidor (nunca confia en
  la previsualizacion del navegador), comprueba que el split este `ACTIVE`
  y que la semana pertenezca a el.
- Si ya existe una carga vigente de ese origen, se exige `Sustituir carga`.
  La sustitucion (borrar + crear) ocurre dentro de una unica transaccion:
  si falla, la carga anterior queda intacta.
- Sustituir un origen nunca toca los demas origenes, participantes ni
  configuracion. Los tres son completamente independientes entre si
  (y de Productividad, salvo la lectura de solo consulta que hace Domador).
- No se guarda historial de versiones sustituidas, ni el binario del
  Excel, en esta entrega.

## Significado de `n VAC` (no medico)

`VAC` es una abreviatura visual de "participantes aplicables sin datos en
este fichero: posible vacaciones o baja". No afirma ni persiste una
ausencia real: es un contador calculado al consultar, comparando los
participantes aplicables de la semana con las filas realmente encontradas
en la carga vigente de ese origen. Un participante puede faltar por estar
de vacaciones, de baja, o simplemente por no haber tenido actividad esa
semana; esta entrega no distingue esos motivos ni guarda ningun estado de
ausencia. La interfaz incluye un `title` con esta explicacion junto al
contador. El color amarillo (`Carga parcial`) nunca se usa para expresar
esta cobertura: se reserva para la dependencia de Domador (ver arriba).

## Estados que deben quedar inequivocos

| Caso | Resultado |
|---|---|
| Participante no aparece en un fichero confirmado (Calidad, Llamadas) | `Sin dato` |
| Participante con todos sus conteos a cero | `0` puntos si el KPI aplica |
| Multiplicador del nivel vacio | `No aplica` |
| Domador: no existe ninguna carga de Escalados para la semana | `Sin dato de Escalados` |
| Domador: carga de Escalados existe, fila real de Escalados sin Productividad | `Falta Productividad` |
| Domador: carga de Escalados existe, sin fila real de Escalados ni de Productividad | `VAC` |
| Domador: carga de Escalados existe, sin fila real de Escalados, con Productividad `updates > 0` | Cero inferido, calculado (`0 (inferido)` en Comprobar) |
| Domador: reasignaciones (reales o inferidas) conocidas con `updates = 0` | `No calculable: Actualizaciones es 0` |
| Excel con una persona ajena al split | `Ignorado` en previsualizacion; no se persiste |
| Nombre que coincide con mas de un participante aplicable | `Ambiguo`; bloquea confirmacion |

## Recorrido de prueba manual

Con la migracion aplicada y la aplicacion en marcha, en un split `ACTIVE`
con Domador, Maestro Artesano y Embajador de voz activos (con o sin
Cazador de soluciones/Explorador de datos activos):

1. Entra en `Introducir KPI` de una semana: Domador debe verse amarillo si
   falta Escalados o Productividad, y mostrar el enlace a
   `Cargar Productividad` cuando falte esta ultima.
2. Carga Productividad de esa semana (aunque Cazador/Explorador esten
   inactivos).
3. Carga Escalados: Domador debe pasar a verde; revisa `groupReassignments`,
   `updates`, puntos sin limite y finales en `Comprobar`.
4. Carga Calidad y comprueba Maestro Artesano en verde con sus puntos.
5. Carga Llamadas y comprueba Embajador de voz en verde con sus puntos y
   el detalle de metricas de tiempo.
6. Deja un participante aplicable sin fila en alguno de los tres ficheros:
   el grupo debe seguir en verde, con `n VAC` visible.
7. Sustituye cada origen una vez y comprueba que los otros dos (y
   Productividad) permanecen intactos.
8. Cierra el split: `Comprobar` sigue disponible en los tres grupos, pero
   `Cargar` queda deshabilitado.

## Limitaciones de esta entrega

- No hay mapeo manual de nombres ni historial de versiones sustituidas
  (igual que Productividad).
- No se persiste ningun estado de vacaciones o baja: `n VAC` es siempre
  calculado al consultar.
- Quedan pendientes el resto de origenes de `IMPORT-1` (Estabilidad,
  Cronomagia, Articulos, Dedicacion, Formaciones), la clasificacion
  general y la vista individual (ver `docs/ROADMAP.md`).

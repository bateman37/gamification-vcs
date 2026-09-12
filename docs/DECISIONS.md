# Decisiones

Registro de decisiones tecnicas y de producto tomadas durante el
desarrollo. Cualquier sesion futura que quiera contradecir una decision
aqui registrada debe explicar por que.

## Monolito Next.js frente a frontend/backend separados

**Decision:** una unica aplicacion Next.js (App Router) contiene la
interfaz, las rutas de servidor y la logica de negocio. No se crea un
backend independiente ni una API publica.

**Motivo:** la arquitectura acordada para el producto es deliberadamente
simple (una aplicacion, una base de datos, un repositorio y despliegue).
Separar frontend y backend anadiria complejidad de despliegue y de
contrato de API sin ningun beneficio para el alcance actual.

## PostgreSQL y Prisma

**Decision:** PostgreSQL como base de datos relacional y Prisma ORM con
migraciones versionadas en Git.

**Motivo:** requisito explicito del encargo. Prisma da migraciones
declarativas y un cliente tipado que encaja bien con TypeScript en modo
estricto.

## Alias ubicado en la participacion del split, no en la persona

**Decision:** el campo `alias` (y su version normalizada
`aliasNormalized`) vive en `SplitParticipant`, no en `Person`.

**Motivo:** una misma persona puede necesitar alias distintos en splits
distintos, y el alias solo debe ser unico dentro de un split, no de forma
global. Modelarlo en `Person` obligaria a duplicar personas o a inventar
una relacion adicional innecesaria.

## Semanas con identidad secuencial dentro del split

**Decision:** la identidad funcional de una semana es
`splitId + sequenceNumber` (1, 2, 3...), no el numero de semana ISO del
calendario. El numero ISO no se guarda.

**Motivo:** el numero de semana ISO depende del ano y no es estable entre
splits ni facil de razonar para el administrador. El numero secuencial
dentro del split es la unidad natural del negocio ("semana 3 del split").

## Semana inicial del participante como clave foranea compuesta

**Decision:** `SplitParticipant.startWeekSequenceNumber` se modela como
parte de una clave foranea compuesta hacia `SplitWeek`
(`splitId + sequenceNumber`), en lugar de una simple columna entera sin
restriccion o de una relacion directa por `id` de semana.

**Motivo:** garantiza a nivel de base de datos que la semana inicial de
un participante pertenece siempre al mismo split, sin depender solo de
validaciones de aplicacion.

## Edicion de fechas/duracion de un split en borrador

**Decision:** mientras un split esta en `DRAFT`, se puede cambiar su
fecha de inicio y su numero de semanas. Las semanas existentes se
actualizan in situ (mismo `sequenceNumber`, nuevas fechas); si se reduce
el numero de semanas, se eliminan las semanas sobrantes del final, pero
la operacion se rechaza si algun participante ya tiene su semana inicial
en una semana que dejaria de existir.

**Motivo:** es la solucion mas sencilla que no destruye datos, valida
dado que en `DRAFT` normalmente no hay resultados dependientes de las
semanas. Rechazar la reduccion en lugar de reasignar automaticamente la
semana inicial de un participante evita cambios silenciosos de sus datos.

## Catalogo cerrado de KPI para el siguiente incremento

**Decision:** `MVP-1B` implementa un catalogo cerrado de 10 KPI con
tipos de calculo conocidos y parametros configurables, sin permitir crear
KPI nuevos ni introducir formulas libres.

**Motivo:** limita el riesgo de un motor de calculo generico mal
definido y se ajusta al comportamiento auditado del Split 8 (ver
`docs/DISCOVERY-1-SPLIT-8.md`).

## Catalogo tipado en codigo, sin tabla global editable

**Decision:** el catalogo de los diez KPI (nombre, descripcion, orden,
explicacion del calculo, valores predeterminados y esquema de validacion
de parametros) vive como una unica fuente de verdad tipada en
`src/domain/kpis/catalog.ts`, no en una tabla de base de datos editable
desde la interfaz.

**Motivo:** el catalogo es cerrado por decision de producto (ver
decision anterior). Guardarlo en codigo evita construir una pantalla de
administracion de KPI genericos que no se necesita todavia; anadir un KPI
nuevo en el futuro sera un cambio de codigo y una migracion deliberados,
no una operacion desde la interfaz.

## Copia estable de configuracion de KPI por split

**Decision:** cada split guarda su propia copia editable de la
configuracion de cada KPI (`SplitKpiConfig`), creada a partir de los
valores predeterminados del catalogo en el momento de crear el split.

**Motivo:** un cambio futuro en los valores predeterminados del catalogo
no debe modificar silenciosamente la configuracion de splits ya creados.
Cada edicion de la gamificacion puede necesitar valores distintos (por
ejemplo, mas puntos por ticket resuelto) sin afectar a las demas.

## Parametros propios de cada KPI como JSON validado por esquema conocido

**Decision:** los parametros propios del tipo de calculo de cada KPI
(`SplitKpiConfig.parameters`) se guardan como JSON, pero nunca se aceptan
tal cual desde el navegador: la accion de servidor construye el objeto
leyendo unicamente los campos que el catalogo declara para ese `kpiCode`,
y lo valida contra el esquema de ese KPI concreto antes de guardarlo.

**Motivo:** los distintos KPI tienen distintos parametros (por ejemplo,
Embajador de voz tiene cuatro parametros y Cazador de soluciones solo
uno). Un JSON validado por esquema evita tanto una tabla con una columna
por cada posible parametro de cualquier KPI como aceptar JSON arbitrario
del cliente, que abriria la puerta a formulas o campos no previstos.

## Multiplicador vacio como nivel no aplicable

**Decision:** un multiplicador de nivel (`N0`, `N1`, `N2`) vacio
(`NULL`) significa que ese nivel no es aplicable a ese KPI, no que el
multiplicador valga cero.

**Motivo:** es el comportamiento observado en Split 8 (por ejemplo,
Guardian de la Estabilidad solo aplicaba a N2). Tratar "vacio" como
"cero" habria sido incorrecto: un multiplicador cero anularia el
resultado del KPI para ese nivel en lugar de indicar que ese nivel
sencillamente no participa en el calculo.

## Edicion de KPI en splits activos permitida provisionalmente

**Decision:** en `MVP-1B` se permite editar la configuracion de KPI de un
split en estado `ACTIVE`, ademas de `DRAFT`. Solo un split `CLOSED` es de
solo lectura.

**Motivo:** todavia no existen resultados calculados ni semanas
publicadas, asi que no hay nada que una edicion de KPI pueda dejar
inconsistente. Es una decision explicitamente provisional: `MVP-1C`
debera definir el bloqueo, versionado o recalculo de KPI cuando ya
existan resultados dependientes de esa configuracion.

## Activacion de un split exige participante y KPI activo

**Decision:** a partir de `MVP-1B`, un split solo puede activarse
(`DRAFT` -> `ACTIVE`) cuando tiene al menos un participante **y** al
menos un KPI activo. La regla se protege en el servicio de dominio
(`activateSplit`), no solo en la interfaz.

**Motivo:** un split activo sin ningun KPI activo no podria producir
ningun resultado en `MVP-1C`. La regla anterior (solo participante) queda
ampliada, no sustituida por otra distinta.

**Nota de migracion:** esta regla no se aplica retroactivamente. Los
splits que ya estuvieran `ACTIVE` antes de esta migracion no cambian de
estado aunque queden con sus diez KPI inactivos; la interfaz les muestra
un aviso para que el administrador los configure.

## PostgreSQL local en Windows como entorno del usuario, Docker opcional

**Decision:** el recorrido principal documentado en `README.md` es
PostgreSQL instalado directamente en Windows, con `DATABASE_URL` apuntando
a esa instancia. `docker-compose.yml` se conserva como alternativa
opcional; nada en pruebas, migraciones o desarrollo depende
obligatoriamente de Docker.

**Motivo:** es el entorno que el usuario ha decidido usar realmente en su
maquina. Mantener Docker como alternativa no le anade coste y evita
romper el flujo de quien si lo prefiera.

## Autenticacion aplazada

**Decision:** no se implementa autenticacion, autorizacion ni cuentas de
usuario en `MVP-1A`.

**Motivo:** fuera del alcance explicito de esta entrega. El modelo de
datos ya prepara el campo `Person.email` para una futura cuenta de
participante.

## Modulos de juego aplazados

**Decision:** facciones, profesiones, localizaciones, objetos, economia
de creditos, renombre y misiones no se implementan ni se disenan en
tablas todavia.

**Motivo:** fuera de alcance explicito. Se documentan en
`docs/DISCOVERY-1-SPLIT-8.md` y `docs/ROADMAP.md` para no perder el
contexto funcional de cara a cuando llegue su turno.

## Sin borrado fisico de personas ni de participantes

**Decision:** no se implementa eliminacion fisica de `Person` ni de
`SplitParticipant` en esta entrega.

**Motivo:** el encargo pide explicitamente no disenar todavia reglas
complejas de borrado. Introducir borrado fisico ahora obligaria a decidir
prematuramente que ocurre con historico y referencias.

## Normalizacion de alias: solo espacios exteriores y mayusculas/minusculas

**Decision:** `aliasNormalized` se calcula recortando unicamente los
espacios exteriores (inicio/fin) y pasando a minusculas. No se colapsan
espacios internos ni se eliminan acentos u otros caracteres.

**Motivo:** es literalmente lo que pide el encargo ("sin distinguir
mayusculas y minusculas ni espacios exteriores"). Ampliar la
normalizacion mas alla de eso seria una decision de producto no pedida
todavia.

## Acceso a la carga semanal desde el calendario, no desde un selector propio

**Decision:** la pantalla de cargas de KPI de una semana
(`/splits/[id]/weeks/[weekId]/kpis`) no incluye un selector de semana. Se
accede desde la fila correspondiente del "Calendario de semanas" del
detalle del split, que identifica la semana por su `id` real (nunca por un
numero aceptado sin validar), y el servidor vuelve a comprobar que esa
semana pertenece al split indicado.

**Motivo:** evita que el administrador elija una semana incorrecta a mano
y evita aceptar un `splitWeekId` arbitrario sin verificar su relacion con
el split, un requisito explicito de seguridad de esta entrega.

## Pantalla de cargas separada de la configuracion de KPI

**Decision:** la carga y comprobacion de datos de KPI vive en una pantalla
independiente (`/splits/[id]/weeks/[weekId]/kpis`), distinta de la seccion
"KPI del split" del detalle del split, que sigue siendo la unica que
permite editar maximos, multiplicadores, parametros y activacion.

**Motivo:** mantiene separadas dos responsabilidades distintas
(configurar el calculo frente a introducir y consultar datos de una semana
concreta) y evita que la pantalla de cargas se convierta en un segundo
lugar desde el que cambiar la configuracion.

## Agrupacion de KPI activos por origen de carga

**Decision:** la pantalla semanal agrupa los KPI activos por origen de
carga (`src/domain/kpis/loadGroups.ts`), no uno por fila independiente. El
grupo `Productividad` reune Cazador de soluciones y Explorador de datos
mientras esten activos; el resto de KPI activos aparecen, de momento, uno
por grupo, hasta que se audite que comparten origen con otro.

**Motivo:** un unico Excel de Productividad alimenta dos KPI a la vez;
mostrarlos como cargas independientes obligaria a subir el mismo archivo
dos veces y duplicaria el estado de cobertura.

## Un unico indicador de estado por grupo de carga

**Decision:** cada grupo de carga muestra un unico indicador (`Pendiente`,
`Carga parcial` o `Cargado`), nunca los tres colores a la vez, calculado
siempre al consultar (no se guarda una copia que pueda desincronizarse).

**Motivo:** el encargo pide explicitamente que el color no sea la unica
forma de transmitir el estado y que no se construya un semaforo con tres
luces simultaneas; calcularlo al vuelo evita un estado redundante que
pudiera quedar desactualizado tras cambiar la configuracion de KPI o los
participantes.

## Un unico Excel de Productividad alimenta dos KPI

**Decision:** una sola confirmacion del Excel de Productividad guarda los
datos fuente necesarios para Cazador de soluciones y Explorador de datos a
la vez (`ProductivityWeeklyRow` conserva los siete conteos completos,
aunque solo dos se usen en los calculos de esta entrega).

**Motivo:** el archivo real solo existe una vez por semana; pedirlo dos
veces (una por KPI) seria una carga redundante para el administrador y
podria producir datos inconsistentes entre ambos KPI de la misma semana.

## Emparejamiento por nombre real, nunca por alias

**Decision:** el Excel de Productividad se empareja con los participantes
usando `Person.fullName` normalizado (`normalizeForMatching`: recorte,
colapso de espacios, minusculas y eliminacion de diacriticos), nunca el
alias del split. Una ambiguedad (mas de un participante aplicable con el
mismo nombre normalizado) bloquea la confirmacion; no se introduce todavia
una pantalla de mapeo manual.

**Motivo:** el alias es un dato de juego pensado para mostrarse, no una
identidad estable; el Excel de origen solo conoce el nombre real de la
persona. Bloquear en caso de ambiguedad, en lugar de adivinar, evita
asignar datos de productividad a la persona equivocada.

## Los puntos de Productividad se calculan al consultar, no se guardan

**Decision:** `ProductivityWeeklyRow` guarda unicamente los conteos fuente
del Excel (tickets, comentarios, actualizaciones...). Los puntos de
Cazador de soluciones y Explorador de datos no se persisten: se calculan
en el momento de mostrarlos, a partir de esos conteos, el nivel del
participante y `SplitKpiConfig`.

**Motivo:** en este MVP los puntos no son una instantanea historica. Un
cambio permitido en la configuracion del KPI o en el nivel del participante
debe reflejarse automaticamente sin reimportar el Excel. Esta decision
puede revisarse cuando exista publicacion/cierre de semana (`MVP-1C`), que
podria requerir congelar un resultado en el momento de publicarlo.

## Una unica carga de Productividad vigente por semana

**Decision:** `ProductivityImport` tiene un indice unico sobre
`splitWeekId`: como mucho existe una carga vigente por semana. Corregir un
archivo exige una sustitucion explicita (`Sustituir carga`) que borra la
carga anterior y sus filas y crea la nueva dentro de una unica transaccion;
no se conserva el historial de versiones sustituidas en esta entrega.

**Motivo:** simplifica el modelo y la interfaz (un unico estado por
semana, sin tener que elegir "la carga vigente" entre varias). El encargo
pide explicitamente sustitucion atomica y explicita, no un historial de
versiones todavia.

## El binario del Excel nunca se guarda

**Decision:** el Excel de Productividad se procesa unicamente en memoria y
en servidor. Ni el archivo original ni ninguna copia se guardan en disco,
`public`, PostgreSQL ni Git. `ProductivityImport.fileSha256` identifica el
archivo procesado (util para depuracion administrativa), pero no permite
reconstruirlo ni se usa para deducir la semana.

**Motivo:** requisito explicito de privacidad y seguridad del encargo:
evita acumular archivos con datos personales reales fuera de su ciclo de
vida natural (la carga puntual de la semana).

## Cero, sin dato y no aplica quedan siempre diferenciados

**Decision:** el calculo de Cazador de soluciones y Explorador de datos
distingue explicitamente tres estados que nunca se convierten en el mismo
"cero": un valor fuente `0` real (el KPI aplica y el resultado es `0`),
"Sin dato" (`no_data`, no existe fila importada para ese participante en
esa semana) y "No aplica" (`not_applicable`, el multiplicador de ese nivel
esta vacio en la configuracion del KPI). "No aplica" tiene prioridad sobre
"Sin dato" cuando ambas condiciones coinciden.

**Motivo:** confundir estos estados ocultaria informacion real (por
ejemplo, un participante que sencillamente no tiene fila esa semana frente
a uno cuyo nivel no participa en ese KPI), un error observado como riesgo
explicito en la auditoria de Split 8 (ver `docs/DISCOVERY-1-SPLIT-8.md`).

## Cobertura de personas separada del estado de carga (correccion de `MVP-1C.1`)

**Decision:** el color/texto de un grupo de carga (Productividad, Calidad,
Llamadas) depende exclusivamente de si existe una carga confirmada para
esa semana, no de cuantos participantes aplicables tiene una fila. Una
carga confirmada es siempre verde (`Cargado`), aunque falten
participantes.

**Motivo:** `IMPORT-1A / MVP-1C.1` trataba la cobertura incompleta como
`Carga parcial` (amarillo), lo cual es incorrecto: una persona puede faltar
en el Excel por vacaciones, baja o simplemente por no haber tenido
actividad esa semana, sin que eso invalide la carga ni la deje "a medias".
Mezclar "cobertura de personas" con "estado de la carga" ocultaba
informacion real detras de un color pensado para otra cosa.

## `n VAC` como senal informativa calculada, nunca una ausencia persistida

**Decision:** cuando una carga confirmada (Productividad, Escalados,
Calidad o Llamadas) no cubre a todos los participantes aplicables, la
interfaz muestra `n VAC` junto al verde, calculado siempre al consultar
(participantes aplicables menos participantes con fila). No se guarda
ningun campo de vacaciones, baja o ausencia, y `VAC` nunca afirma que la
ausencia este confirmada: es solo una abreviatura visual con un `title`
explicativo.

**Motivo:** el encargo pide explicitamente no disenar todavia un estado
real de vacaciones/bajas, pero tampoco ocultar que faltan datos de
alguien. Un contador calculado, no persistido, informa sin comprometerse a
una interpretacion que el sistema no puede confirmar por si solo.

## El amarillo (`Carga parcial`) queda reservado para una dependencia de carga incompleta

**Decision:** desde `MVP-1C.2 / IMPORT-1B`, el unico grupo que puede
mostrar `Carga parcial` (amarillo) es Domador de Escaladas, cuando existe
exactamente uno de sus dos origenes (Excel de Escalados o Productividad de
la misma semana). Productividad, Calidad y Llamadas nunca usan ese color.

**Motivo:** el amarillo debe significar siempre lo mismo en toda la
pantalla semanal: una dependencia de carga realmente pendiente, no una
cobertura de personas incompleta (ver decision anterior). Domador es el
unico KPI de esta entrega que depende de dos archivos distintos para
calcularse.

## Domador de Escaladas se une a Productividad por semana y participante, nunca por archivo

**Decision:** el calculo de Domador de Escaladas lee
`ProductivityWeeklyRow.updates` de la misma `splitWeekId` y el mismo
`splitParticipantId` que la fila de Escalados, en el momento de calcular
(preview, confirmacion o comprobacion). Analizar o confirmar el Excel de
Escalados nunca crea, modifica ni exige modificar Productividad.

**Motivo:** es el comportamiento auditado en Split 8 (Escalados se
comparaba contra las actualizaciones de Productividad de la misma
persona y semana) y evita construir una copia redundante de `updates`
dentro de `EscalationWeeklyRow`, que quedaria desincronizada si
Productividad se sustituye despues.

## Helpers compartidos de lectura y emparejamiento, sin motor generico

**Decision:** los tres nuevos lectores de Excel (Escalados, Calidad,
Llamadas) comparten el recorrido seguro de bajo nivel (limite de tamano,
carga de la primera hoja, resolucion de encabezados, recorte de filas
vacias finales, parseo de celdas numericas y decimales, deteccion de
nombres duplicados) mediante `src/server/services/shared/xlsx.ts`, y los
cuatro origenes de carga comparten el algoritmo de emparejamiento por
nombre real mediante `src/server/services/shared/matching.ts`. El lector y
el emparejamiento de Productividad, ya validados manualmente, no se han
tocado: siguen con su propia copia equivalente para no arriesgar una
regresion en codigo que ya funciona.

**Motivo:** el encargo permite extraer helpers pequenos y puros cuando
eliminan duplicacion real, pero prohibe explicitamente construir un motor
generico de Excel o de reglas. La auditoria de los tres Excel confirmo que
comparten exactamente esa estructura de bajo nivel (formato, cabecera en
fila 1, orden libre, limites de tamano); factorizar solo esa capa, dejando
las columnas, mensajes y reglas de negocio de cada origen en su propio
lector y servicio, evita triplicar ~150 lineas casi identicas sin caer en
un constructor generico de importaciones.

## Reglas criticas protegidas en servidor y en base de datos

**Decision:** ademas de la validacion en los servicios de dominio
(`src/server/services/*`), las reglas mas criticas se protegen tambien
con restricciones de base de datos: unicidad de correo, unicidad de
persona por split, unicidad de alias normalizado por split, semana
inicial perteneciente al mismo split (clave foranea compuesta), lunes de
inicio de split y de semana, domingo de fin de semana, rango de numero
de semanas (1-52), y (desde `IMPORT-1A / MVP-1C.1`, ampliado en
`MVP-1C.2 / IMPORT-1B`) que los conteos y metricas de tiempo de
`ProductivityWeeklyRow`, `EscalationWeeklyRow`, `QualityWeeklyRow` y
`VoiceWeeklyRow`, y los contadores de sus cuatro cabeceras de carga, sean
siempre no negativos.

**Motivo:** el encargo pide explicitamente proteger las reglas criticas
tambien mediante restricciones de base de datos "cuando sea viable". Esto
evita que un futuro cambio en la capa de servicios (o un acceso directo a
la base de datos) rompa invariantes de negocio sin que nadie lo note.

## Cero implicito de Escalados condicionado a que exista la carga (`MVP-1C.3 / INPUT-1C`)

**Decision:** la ausencia de fila de Escalados para un participante se
interpreta como reasignaciones `0` (cero implicito) solo cuando ya existe
una carga de Escalados confirmada (`EscalationImport`) para esa semana **y**
el participante tiene fila de Productividad. Si no existe la carga de
Escalados, el resultado sigue siendo "Sin dato de Escalados", exactamente
como antes de este hotfix. Nunca se inserta una fila artificial en
`EscalationWeeklyRow`: la inferencia pertenece solo al resultado calculado
(`resolveEscalationTamerOutcome`, con `inferred: true`).

**Motivo:** el Excel de Escalados real no siempre incluye a una persona
cuando sus reasignaciones son cero, y tratar esa ausencia como "sin dato"
ocultaba el calculo real para la mayoria de las personas de una carga ya
confirmada. Condicionar la inferencia a que la carga exista evita
inventar datos antes de que el administrador haya cargado nada.

## VAC de Domador de Escaladas solo cuando faltan ambas filas (`MVP-1C.3 / INPUT-1C`)

**Decision:** con ambos origenes (Escalados y Productividad) confirmados
para la semana, un participante solo se considera `VAC` (sin puntos, y
solo el contribuye al `vacCount` del grupo) cuando no tiene fila ni en
Escalados ni en Productividad. Quien tiene fila real de Escalados sin
Productividad sigue siendo "Falta Productividad" (dependencia incompleta),
nunca VAC.

**Motivo:** el `vacCount` anterior usaba una condicion "o" (faltar en
Escalados o en Productividad), lo que contaba erroneamente como VAC a
quien solo le faltaba uno de los dos origenes pero cuya situacion ya tenia
un estado propio y mas preciso ("Falta Productividad" o cero implicito).

## Formularios manuales completos, atomicos y sin motor generico (`MVP-1C.3 / INPUT-1C`)

**Decision:** los cinco KPI que se introducen a mano (Guardian de la
Estabilidad, Cronomagia laboral, Redactor estrella, Estudiante entusiasta,
Aprendiz experto) se guardan mediante una unica accion de servidor por
KPI y semana, sin paso de "Analizar". El guardado sustituye por completo,
dentro de una transaccion, el conjunto anterior de ese modelo y esa
semana; todos los campos visibles son obligatorios, y un campo vacio nunca
se convierte en cero. Se comparten solo helpers pequenos y tipados
(`src/server/services/shared/manual-entries.ts`,
`src/server/validation/manual-entry.ts`), nunca un motor generico de
formularios.

**Motivo:** el encargo pide explicitamente permitir helpers pequenos para
formularios manuales, pero prohibe un constructor generico. Cada KPI
manual sigue declarando sus propios campos, validaciones y calculo en su
propio dominio y servicio, igual que los origenes de Excel.

## `0/0` de Cronomagia como VAC, nunca como occupancy cero

**Decision:** en Cronomagia laboral, una fila con `totalHours = 0`
significa vacaciones toda la semana: se muestra como `VAC`, no recibe
puntos y tiene prioridad sobre el calculo (nunca se convierte en occupancy
`0`). La fila se guarda igual y cuenta como completa para el estado
`Cargado` del grupo. Es el unico de los cinco KPI manuales que usa `VAC`
(por fila, no como contador de grupo); los otros cuatro nunca lo muestran,
porque en ellos el cero es un dato normal y completo.

**Motivo:** dividir productivas entre unas horas totales de cero no tiene
sentido matematico, y tratarlo como "0 % de ocupacion" ocultaria que la
persona no trabajo esa semana. Es el comportamiento explicito pedido por
el encargo para este KPI concreto.

## Contador semanal de "KPI cargados" calculado, nunca persistido (`MVP-1C.3 / INPUT-1C`)

**Decision:** la columna "KPI cargados" del calendario de semanas
(`getWeeklyKpiLoadSummary`) se calcula siempre al consultar, con un numero
acotado de consultas para todo el calendario del split (participantes, KPI
activos, y una consulta por cada uno de los nueve origenes de datos).
Nunca se guarda un campo `loadedKpiCount` en `SplitWeek` ni en ninguna otra
tabla.

**Motivo:** el numero de KPI activos, la participacion aplicable y las
cargas existentes cambian con frecuencia (activar/desactivar un KPI,
anadir un participante, sustituir una carga). Persistir un contador se
volveria obsoleto en cualquiera de esos casos sin que nadie lo notara; el
encargo pide explicitamente no persistirlo y evitar una consulta por KPI y
semana.

## Navegacion completa (no client-side) para "Volver a introducir datos" (`BUGFIX-1 / UX-SPLIT-1`)

**Decision:** el enlace "Volver a introducir datos" de los cinco
formularios manuales usa una etiqueta `<a>` HTML normal hacia la misma
URL, en vez de `next/link`. Se extrae a un componente compartido
(`ManualEntrySuccessPanel`) para no duplicar el bloque de exito en los
cinco formularios.

**Motivo:** una navegacion client-side de Next.js hacia la misma ruta no
desmonta el Client Component ni reinicia `useFormState`, dejando la
pantalla de exito visible para siempre (bug corregido en esta entrega). Una
navegacion HTML completa fuerza la recarga del Server Component (que
recupera los datos ya guardados desde PostgreSQL) y reinicia el estado
local. Un `router.refresh()` no habria sido suficiente: no elimina el
`state.saved` que mantiene visible la pantalla de exito.

## Vacio como cero solo en tres KPI manuales concretos (`BUGFIX-1 / UX-SPLIT-1`)

**Decision:** un campo vacio o compuesto solo por espacios se interpreta y
persiste como `0` unicamente en Redactor estrella (`STAR_WRITER`),
Estudiante entusiasta (`ENTHUSIASTIC_STUDENT`) y Aprendiz experto
(`EXPERT_APPRENTICE`), mediante un helper explicito
(`parseNonNegativeNumberDefaultZero`,
`src/server/validation/manual-entry.ts`) que reutiliza las mismas
validaciones numericas sin duplicarlas. Guardian de la Estabilidad y
Cronomagia laboral **no** cambian: sus campos vacios se siguen rechazando
como obligatorios (`parseRequiredNonNegativeNumber`).

**Motivo:** el encargo audito que, en el uso real de estos tres
formularios, un campo dejado en blanco significaba sistematicamente "cero
articulos/horas/formaciones", y exigirlo como obligatorio bloqueaba
guardar cargas semanales completas y validas. Guardian y Cronomagia no
presentaban ese problema y su contrato (incluido el `VAC` por fila de
Cronomagia) no debia tocarse.

## Maximo configurado de Aprendiz experto: inclusivo (`BUGFIX-1 / UX-SPLIT-1`)

**Decision:** `completedTrainings` acepta cualquier valor entre `0` y
`targetValue` **incluido**; solo un valor estrictamente mayor que
`targetValue` se rechaza. La validacion compartida
(`src/server/validation/manual-entry.ts`) usa `value > options.max` (no
`>=`) para reflejarlo, y queda cubierto por una prueba de regresion
especifica del limite exacto.

**Motivo:** un maximo configurado exclusivo habria rechazado
incorrectamente el caso mas comun (alcanzar exactamente el objetivo). El
encargo pide explicitamente que el maximo sea inclusivo.

## Puntos por posicion semanal: configuracion por split, todavia sin aplicar (`BUGFIX-1 / UX-SPLIT-1`)

**Decision:** cada split tiene su propia tabla `SplitPositionPointRule`
con las quince posiciones (`1..15`) y sus puntos, con los valores
predeterminados exactos de Split 8 (ver
`docs/POSITION_POINTS_CONFIGURATION.md`), creada dentro de la misma
transaccion que el split (splits nuevos) o mediante backfill (splits
existentes). No es un KPI, no se guarda como JSON dentro de `Split` y esta
entrega no calcula ninguna posicion ni reparte estos puntos.

**Motivo:** la clasificacion semanal (`MVP-1C`) necesitara esta tabla, pero
construir el motor de calculo esta fuera del alcance de esta entrega. Dejar
la configuracion lista y validada de antemano evita mezclar dos cambios
grandes (configuracion y calculo) en una misma entrega, siguiendo la regla
de entregas pequenas del proyecto.

## Vacio como cero tambien en Guardian de la Estabilidad y Cronomagia laboral (`0.6.0` / MVP-1C)

**Decision:** desde `0.6.0`, un campo vacio, ausente o solo con espacios en
"Resultados de estabilidad" (Guardian de la Estabilidad) y en "Horas
productivas"/"Horas totales de la semana" (Cronomagia laboral) se
interpreta y persiste como `0`, usando el mismo helper compartido
(`parseNonNegativeNumberDefaultZero`) ya usado por Redactor estrella,
Estudiante entusiasta y Aprendiz experto. Esta decision sustituye
expresamente la de `BUGFIX-1 / UX-SPLIT-1` que mantenia estos dos KPI como
obligatorios.

**Motivo:** el mismo patron de uso real detectado en los otros tres KPI
manuales (un campo en blanco significa sistematicamente "cero") aplica
tambien aqui, y exigir el campo bloqueaba publicar semanas completas y
validas. El comportamiento especial de Cronomagia (`totalHours = 0` implica
`productiveHours = 0`, estado `VAC`) no cambia: solo cambia como se
interpreta un campo vacio antes de esa regla.

## Motor agregado semanal como capa de lectura sobre los resolvers existentes

**Decision:** `weekly-results.service.ts` no recalcula ninguna formula: para
cada KPI activo llama directamente a los mismos resolvers de
`src/domain/kpis/*` que ya usan las pantallas de "Comprobar" (por ejemplo
`resolveSolutionHunterOutcome`, `resolveEscalationTamerOutcome`), leyendo
las mismas tablas de origen (`ProductivityWeeklyRow`,
`StabilityWeeklyEntry`, etc.) en un numero acotado de consultas por semana
(una por origen necesario, nunca una por participante). Los resultados de
cada resolver se normalizan a tres estados funcionales (`COMPUTED`, `VAC`,
`NOT_APPLICABLE`) solo para la vista agregada y la instantanea publicada;
los estados internos de cada KPI (`no_data`, `no_escalation_data`,
`zero_updates`, etc.) no cambian ni se duplican.

**Motivo:** el encargo exige explicitamente reutilizar los calculos
existentes y prohibe copiar formulas en un "motor generico". Construir el
agregado como una capa fina sobre los resolvers evita divergencias futuras
entre lo que muestra "Comprobar" KPI a KPI y lo que muestra la
previsualizacion o la semana publicada.

## Interpretacion de "Actualizaciones es 0" y de "Falta Productividad" en el agregado semanal

**Decision:** dentro del motor agregado (no en `resolveEscalationTamerOutcome`,
que no cambia), dos estados de Domador de Escaladas que no son directamente
"computado" se resuelven asi para la suma semanal y la instantanea:

- `zero_updates` (reasignaciones reales o inferidas, pero `updates = 0`,
  division no calculable): se trata como `COMPUTED` con ratio de escalados
  `0` (nadie puede escalar sobre cero actualizaciones), es decir
  `basePoints x multiplicador`, limitado por el maximo. Se calcula con el
  mismo helper `applyBaseMax` que el resto de KPI, sin duplicar
  `calculateEscalationTamerPoints` (que deliberadamente no admite
  denominador cero).
- `no_productivity_data` (fila real de Escalados sin fila de Productividad
  de la misma semana): se muestra como `VAC` en la tabla, pero se anade a
  `blockingIssues` con el alias de la persona afectada: es una
  inconsistencia entre dos archivos ya cargados, no una ausencia normal, y
  debe resolverse (recargando Productividad o Escalados) antes de publicar.

**Motivo:** ninguna de las dos situaciones estaba contemplada en `MVP-1C.2`
porque hasta ahora solo se mostraban en pantallas de "Comprobar" sin
bloquear ninguna accion. El encargo pide explicitamente no publicar una
inconsistencia real "oculta como cero" ni bloquear silenciosamente sin
explicar el motivo exacto.

## `no_data` inesperado en un KPI manual atomico bloquea publicar, no se oculta como cero

**Decision:** los cinco KPI manuales se guardan de forma atomica (todo el
conjunto de una semana o nada), por lo que, si la semana esta marcada como
`n/n` completa, todo participante aplicable deberia tener fila. Si el
motor agregado encuentra de todas formas una fila ausente (por ejemplo, un
participante anadido despues del ultimo guardado, con una semana inicial
anterior a la actual), la muestra como `VAC` en la tabla pero anade un
mensaje a `blockingIssues` identificando al participante y el KPI, y la
publicacion se rechaza hasta que se corrija.

**Motivo:** es exactamente el caso "inesperado" que el encargo pide no
ocultar como cero. Mostrarlo como `VAC` mantiene la previsualizacion
legible sin fingir que hay un resultado calculado; el bloqueo evita
publicar una instantanea con un hueco real sin que el administrador lo note.

## Ranking de competicion y clasificacion acumulada como funciones puras genericas

**Decision:** `src/domain/ranking.ts` expone dos funciones puras:
`rankByScoreDescending` (una sola puntuacion `Prisma.Decimal`, usada por el
ranking semanal y el ranking por KPI) y `rankByComparator` (comparador
generico que decide tanto orden como empate, usado por la clasificacion
acumulada del split, que empata solo cuando puntos por posicion **y**
puntos KPI coinciden). Ambas reciben un `tiebreak` separado que solo decide
el orden visual entre empatados (alias normalizado y despues id), sin
alterar nunca la posicion asignada. `src/domain/color-bands.ts` expone una
unica funcion pura `colorBandForPercentage` para las bandas de color,
reutilizada por la previsualizacion, la semana publicada y la vista
individual.

**Motivo:** el encargo pide explicitamente una funcion pura y probada para
el ranking y otra para las bandas de color, en vez de comparaciones
dispersas por las vistas. Separar "criterio de empate" de "orden visual"
evita el error de que el alias conceda una ventaja de negocio.

## `zero_updates` de Domador tratado como ratio 0 en el agregado: alcance de la decision

**Nota:** esta interpretacion (ver mas arriba, "Interpretacion de
'Actualizaciones es 0'...") solo aplica dentro de `weekly-results.service.ts`
y de la instantanea publicada. Las pantallas de "Comprobar" y de
confirmacion de Escalados siguen mostrando el estado `zero_updates` tal
cual (`No calculable: Actualizaciones es 0`), sin puntos, exactamente como
en `MVP-1C.3`; no se ha tocado `resolveEscalationTamerOutcome`.

## Publicacion como instantanea inmutable con `splitId` desnormalizado

**Decision:** publicar una semana (`publishWeek`) recalcula todo con el
motor agregado usando el mismo `PrismaClient` (nunca datos enviados por el
navegador) y escribe `WeekPublication`, `PublishedParticipantWeeklyResult` y
`PublishedKpiResult` dentro de una unica transaccion con aislamiento
`Serializable`. `PublishedParticipantWeeklyResult.splitId` se guarda
desnormalizado (ademas de la relacion real via `publicationId ->
splitWeekId -> splitId`) para poder consultar la clasificacion de un split
completo indexando directamente por `splitId`, sin recorrer esa cadena de
relaciones por cada fila. Una carrera concurrente (violacion de la
restriccion unica sobre `splitWeekId`, o fallo de serializacion) no se
propaga como error: si al comprobar de nuevo ya existe una publicacion para
esa semana, se devuelve como resultado idempotente (`alreadyPublished:
true`), nunca como una segunda publicacion.

**Motivo:** el encargo exige explicitamente que la publicacion sea correcta
bajo peticiones concurrentes y que las consultas de clasificacion esten
acotadas. `Serializable` es el nivel de aislamiento que Postgres/Prisma
documentan como apropiado quejandose (en vez de corrompiendo datos) ante
una carrera real; desnormalizar `splitId` es la misma tecnica ya usada en
otras tablas del proyecto para evitar N+1 en listados por split.

## Publicar bloquea la escritura con una guarda centralizada, no con `disabled`

**Decision:** `assertWeekIsEditable(db, weekId)`
(`src/server/services/shared/week-context.ts`) consulta `WeekPublication`
en el mismo `db`/transaccion que va a escribir, y se llama al principio de
las nueve acciones de escritura semanal (cuatro confirmaciones de Excel:
Productividad, Escalados, Calidad, Llamadas; cinco guardados manuales:
Guardian, Cronomagia, Redactor, Estudiante, Aprendiz), justo despues de la
comprobacion de que el split esta `ACTIVE`. Anadir un participante con
`startWeekSequenceNumber` en una semana ya publicada tambien se rechaza en
`addParticipant`, comprobando la publicacion de esa semana antes de crear
la fila.

**Motivo:** el encargo prohibe explicitamente confiar en `disabled` de la
interfaz para una regla de negocio critica. Centralizar la comprobacion
evita que una novena mutacion futura olvide añadirla.

## Autenticacion local con Auth.js/NextAuth (credenciales) y JWT

**Decision:** `next-auth` v4 con `CredentialsProvider` (correo + contrasena
con `bcryptjs`) y sesion `JWT` (sin tabla de sesiones en base de datos).
`src/middleware.ts` protege por prefijo de ruta (`/personas`, `/splits`
-> solo `ADMIN`; `/resultados`, `/cuenta` -> cualquier usuario autenticado)
en cada peticion, incluida una URL escrita a mano; `src/lib/session.ts`
(`requireSession`, `requireAdminSession`) es la segunda capa dentro de
paginas y acciones de servidor. Cuando `mustChangePassword` esta activo, el
middleware redirige a `/cuenta/cambiar-contrasena` sin importar la ruta
solicitada (salvo esa misma ruta), y esa pagina cierra la sesion tras
guardar la nueva contrasena para forzar un JWT limpio (la sesion `JWT` de
NextAuth no relee la base de datos en cada peticion, asi que un campo como
`mustChangePassword` solo se refresca con un nuevo inicio de sesion).

**Motivo:** requisito explicito de usar una libreria mantenida en vez de
criptografia o cookies caseras. JWT evita una tabla de sesiones adicional
sin sacrificar seguridad para este alcance (cookies `HttpOnly`,
`SameSite`, firmadas con `AUTH_SECRET`). Cerrar sesion tras cambiar la
contrasena es la forma mas simple de mantener el JWT consistente con el
nuevo estado sin anadir un mecanismo de revalidacion de sesion.

## El participante nunca decide que persona ve mediante un parametro de URL

**Decision:** en `/resultados`, un usuario `PARTICIPANT` siempre usa
`session.user.personId` (resuelto en servidor a partir del JWT) para
decidir que datos leer; el parametro `?persona=` de la URL solo se lee
cuando `session.user.role === "ADMIN"`. Los servicios de lectura
(`getPersonSplitDetail`, `listSplitsWithPublishedResultsForPerson`,
`getPersonHistory`) siempre filtran por `personId` en la consulta a base de
datos, nunca devuelven ni filtran en memoria datos de otra persona.

**Motivo:** requisito explicito de seguridad del encargo: un participante
no debe poder ver el detalle de otro cambiando la URL o manipulando un
payload. Ignorar el parametro por completo (en vez de validarlo) es la
forma mas simple de no depender de que la validacion se acuerde de
comprobar todos los casos.

## Hotfix `AVISO`/`0`: `VAC` se divide en dos presentaciones segun la pantalla

**Decision:** el estado interno `VAC` (`KpiResultStatus`/`PublishedKpiOutcomeStatus`,
`resolveEscalationTamerOutcome`, `resolveWorkChronomancyOutcome`, etc.) no
cambia de nombre ni de semantica en ningun servicio ni resolver: sigue
siendo la misma senal tecnica de "ausencia justificada de datos en un
origen ya confirmado" descrita mas arriba. Lo que cambia es exclusivamente
la presentacion, dividida en dos funciones compartidas segun el tipo de
pantalla:

- **Pantallas de carga y comprobacion** (`StatusIndicator`, `Comprobar
  Domador de Escaladas`, `Comprobar Cronomagia laboral`, la previsualizacion
  de Escalados): el texto visible `VAC` se sustituye por la palabra fija
  `AVISO`, y el contador de grupo `n VAC` pasa a `n AVISO` (`formatAvisoCount`,
  `src/domain/kpi-load-status-display.ts`), siempre en singular (`1 AVISO`,
  `2 AVISO`, `3 AVISO`; nunca `AVISOS`). Un `AVISO` no convierte una carga
  completa en `Carga parcial` ni bloquea guardar: sigue siendo la misma
  senal puramente informativa que `VAC` ya era.
- **Resultados, previsualizacion, publicacion, clasificacion e historico**
  (`WeeklyResultsTable`, `PorSplitSection`, `/splits/[id]/clasificacion`,
  `HistoricoSection`): un resultado `VAC` se muestra siempre como el valor
  numerico `0` (`resolveKpiResultDisplayPoints`,
  `src/domain/kpi-outcome-display.ts`), participando en sumas, medias y
  rankings exactamente como cualquier otro cero. `NOT_APPLICABLE` se
  mantiene siempre diferenciado (`No aplica`) y nunca se convierte en `0`
  en ninguna de las dos presentaciones.

Como consecuencia directa de que `VAC` ahora participa en sumas y medias
como un cero real (no como una ausencia excluida), dos agregados que antes
excluian las semanas `VAC` del denominador cambian de comportamiento:
`computeSplitKpiClassification` (clasificacion detallada acumulada, seccion
9.4 de `docs/RESULTS_PUBLICATION.md`) y `getPersonHistory` (desglose por KPI
del historico general, seccion 6) ahora incluyen las semanas `VAC` en su
recuento (`includedWeekCount`, antes `computedWeekCount`/`computedCount`) y,
por tanto, en la media resultante; `NOT_APPLICABLE` sigue excluido por
completo de ambos agregados, como ya lo estaba.

**Motivo:** encargo explicito del hotfix. Ninguna formula de KPI cambia
(`src/domain/kpis/*` no se ha tocado, solo se reutiliza), ni la logica de
publicacion, instantaneas o bloqueo de semanas (`weekly-results.service.ts`
y `publish-week.service.ts` no se han tocado): solo cambia como se presenta
un resultado ya calculado. Centralizar la conversion en dos funciones
compartidas (`formatAvisoCount` y `resolveKpiResultDisplayPoints`) evita
duplicar la misma condicion en cada componente, como pedia explicitamente
el encargo.

## Facciones opcionales por split, no obligatorias de forma retroactiva (`0.7.0` / MVP-2A)

**Decision:** las reglas obligatorias de facciones (al menos dos,
participantes asignados, al menos tres aplicables por faccion desde la
primera semana) solo se exigen para activar o publicar un split **que ya
tiene alguna faccion creada**. Un split que nunca ha tenido ninguna
faccion se comporta exactamente igual que antes de `0.7.0`: `activateSplit`,
`publishWeek` y todos los servicios de participante no imponen ningun
requisito de facciones. `SplitParticipant.factionId` y las columnas de
snapshot de `PublishedParticipantWeeklyResult` son nullable precisamente
para sostener este comportamiento sin migracion destructiva.

**Motivo:** el encargo describe la regla de activacion/publicacion en
terminos absolutos, pero aplicarla sin condicion habria exigido reescribir
la practica totalidad de la suite de pruebas existente (unos cien puntos
en nueve ficheros que crean splits de prueba con uno o dos participantes
para verificar reglas de KPI y empates ajenas a facciones, ya validadas
manualmente), con riesgo real de alterar aserciones exactas de ranking sin
relacion con esta entrega. Condicionar el requisito a que el split ya
tenga alguna faccion configurada cumple la letra del encargo para el uso
real (el checklist manual crea las facciones antes de activar) sin tocar
ni un solo test existente. Decision acordada explicitamente con el usuario
antes de implementar.

## Renombre = puntos por posicion, sin segundo sistema (`0.7.0` / MVP-2A)

**Decision:** no se crea una moneda, tabla, contador ni calculo
independiente de "renombre". El aporte de un participante a su faccion es
siempre `PublishedParticipantWeeklyResult.positionPoints`, ya calculado por
el motor agregado a partir de `SplitPositionPointRule`. "Renombre" es
unicamente una etiqueta de interfaz, siempre aclarada como equivalente a
los puntos por posicion.

**Motivo:** requisito explicito del encargo, para evitar dos fuentes de
verdad que puedan desincronizarse.

## Suma de los tres mejores, nunca promedio, para la puntuacion de facciones (`0.7.0` / MVP-2A)

**Decision:** la puntuacion semanal de una faccion es la suma de los tres
`positionPoints` mas altos entre sus participantes aplicables
(`selectFactionTopThree`, `src/domain/faction-ranking.ts`). Corrige y
sustituye la nota anterior de `docs/ROADMAP.md` que hablaba de "promedio de
los tres mejores renombres".

**Motivo:** decision de producto explicita en el encargo `0.7.0`/MVP-2A,
que corrige una referencia desactualizada del roadmap anterior a que se
disenara realmente esta capa.

## Bloqueo de configuracion tras la primera publicacion sustituye la decision provisional de `MVP-1B` (`0.7.0` / MVP-2A)

**Decision:** desde que un split tiene al menos una `WeekPublication`,
`updateKpiConfig` y `updatePositionPointRules` rechazan cualquier cambio
(activacion/desactivacion de KPI, maximos, multiplicadores, parametros y
puntos por posicion), ademas del bloqueo ya existente para `CLOSED`. La
comprobacion (`assertSplitConfigurationIsEditable`,
`src/server/services/shared/split-configuration-lock.ts`) se ejecuta
dentro de la misma transaccion que la escritura, igual que
`assertWeekIsEditable` para las cargas semanales.

**Motivo:** sustituye expresamente la decision provisional de `MVP-1B`
("Edicion de KPI en splits activos permitida provisionalmente"), que
asumia que no existian resultados dependientes de esa configuracion. Desde
`0.6.0` existen semanas publicadas e instantaneas inmutables; permitir
editar la configuracion de KPI o puntos por posicion despues de publicar
podia dejar la configuracion de semanas futuras inconsistente con lo ya
publicado, sin ningun beneficio: el encargo pide expresamente este bloqueo
mas estricto.

## Denominador unico de "x de n": total de participantes del split (`0.7.0` / MVP-2A)

**Decision:** todas las posiciones mostradas en resultados (general,
semanal, por KPI, vista administrativa de una semana publicada y subvista
`Por split`) usan como denominador `n` el numero total de participantes
del split (`countParticipantsForSplit`), nunca el numero de resultados
aplicables de un KPI concreto (`rankedParticipantCount`, que se conserva
sin cambios como numerador interno de cada ranking).

**Motivo:** el encargo detecto que denominadores distintos por KPI dentro
de la misma pantalla ("6 de 10" junto a "2 de 8") resultaban confusos; un
unico denominador por split, calculado en servidor, es mas legible sin
alterar ninguna formula de ranking ni republicar datos ya publicados.

## Clasificacion filtrada por KPI: orden predeterminado por el KPI seleccionado (`0.7.0` / MVP-2A)

**Decision:** en `/splits/[id]/clasificacion`, cuando se selecciona un KPI
sin indicar explicitamente un orden, la tabla se ordena por la suma (o el
resultado semanal) de ese KPI descendente, y la columna de posicion pasa a
llamarse "Posicion KPI" mostrando el ranking real del KPI seleccionado
(nunca la posicion general individual bajo ese titulo). El orden se
controla mediante encabezados de columna accesibles (`aria-sort`) que
conservan los filtros de semana y KPI en la URL, en vez de un segundo
selector "Ordenar por" independiente.

**Motivo:** el encargo permite explicitamente convertir los encabezados en
controles ordenables en vez de (o ademas de) un selector; encabezados con
enlaces `GET` evitan un componente cliente adicional y conservan filtros de
forma natural a traves de la propia URL.

## Profesiones opcionales por split, con el mismo criterio que las facciones (`0.8.0` / MVP-2B)

**Decision:** las profesiones son una capa opcional por split. Un split que
nunca ha tenido ninguna profesion creada se comporta exactamente igual que
antes de `0.8.0`: no se exige nada para activarlo ni publicarlo, no aparece
ningun selector y no se aplica ningun bonus. En cuanto existe la primera
profesion, ese split "usa profesiones" y se le aplica el conjunto completo
de reglas (asignacion obligatoria antes de publicar, bloqueo desde la
primera publicacion, profesion obligatoria en altas posteriores).

**Motivo:** es exactamente el mismo criterio ya acordado y documentado para
las facciones en `0.7.0` ("Facciones opcionales por split, no obligatorias
de forma retroactiva"). Mantener los dos modulos de juego con la misma
semantica evita que un split existente quede bloqueado por una capa nueva y
evita reescribir la suite de pruebas ya validada, que crea splits sin
profesiones para verificar reglas ajenas a esta entrega.

## Las reglas historicas de profesiones del Split 8 no se implementan (`0.8.0` / MVP-2B)

**Decision:** `docs/DISCOVERY-1-SPLIT-8.md` describe profesiones concretas
del antiguo Split 8 (Mecanico, Arreglador, Mercenario, Cientifico, Piloto)
con efectos propios y distintos entre si. Esas reglas **no** se
implementan. Esta entrega usa exclusivamente el modelo simplificado y
configurable: nombre libre, dos KPI cualesquiera del catalogo cerrado y un
unico bonus fijo del `20 %` despues del maximo base, igual para todas.

**Motivo:** requisito explicito del encargo `0.8.0` / MVP-2B. Un catalogo
cerrado de profesiones con efectos especiales por nombre habria significado
reglas de negocio duplicadas y no configurables, justo lo contrario de la
configuracion por split que el producto ya usa para KPI, puntos por
posicion y facciones.

## El porcentaje del bonus es una constante del dominio, no una columna (`0.8.0` / MVP-2B)

**Decision:** el `20 %` vive como una unica constante tipada
(`PROFESSION_BONUS_PERCENT`, `src/domain/profession-bonus.ts`), de la que
se derivan el factor decimal (`PROFESSION_BONUS_RATE`) y el texto visible
(`PROFESSION_BONUS_LABEL`). No se guarda en `SplitProfession`, no se repite
como `1.2`, `0.2` ni `20` en servicios ni componentes, y el administrador
no puede editarlo. En la instantanea publicada si se congela
(`professionBonusPercent`), porque una publicacion debe poder explicarse
por si sola aunque la constante cambie en el futuro.

**Motivo:** el encargo fija el porcentaje y prohibe explicitamente hacerlo
configurable. Una constante unica evita que una futura pantalla o un
resolver apliquen un valor divergente, y congelarla al publicar mantiene la
instantanea autoexplicativa sin convertirla en configuracion.

## Una unica funcion pura aplica el bonus, despues del maximo base (`0.8.0` / MVP-2B)

**Decision:** `applyProfessionBonus` es la unica funcion que decide y
calcula el bonus. Los diez resolvers de `src/domain/kpis/*` no se han
tocado: siguen produciendo el resultado base con su formula y su maximo. El
motor agregado (`weekly-results.service.ts`) llama a `applyProfessionBonus`
justo despues de `applyBaseMax`, solo para resultados `COMPUTED`, y el
maximo **no** se vuelve a aplicar despues del bonus (un resultado puede
superar el maximo base hasta un 20 %). `applicableMaxPoints` sigue sumando
maximos base, no maximos inflados, de modo que el porcentaje mostrado puede
superar el `100 %`.

**Motivo:** requisito explicito del encargo, y coherente con la decision ya
existente "Motor agregado semanal como capa de lectura sobre los resolvers
existentes": repartir condiciones `x 1.2` entre diez resolvers habria
duplicado la regla diez veces y habria hecho imposible probarla de forma
aislada. Volver a aplicar el maximo despues del bonus habria anulado el
efecto justo en el caso mas interesante (un KPI ya al tope).

## El bonus no se aplica a `VAC`, `No aplica`, cero ni negativos (`0.8.0` / MVP-2B)

**Decision:** `applyProfessionBonus` solo actua cuando los puntos tras el
maximo base son **estrictamente positivos**. Un `VAC` (que sigue mostrando
y aportando `0`, hotfix `AVISO`/`0`), un `NOT_APPLICABLE`, un cero real y
un resultado negativo quedan exactamente igual.

**Motivo:** requisito explicito del encargo. Bonificar un negativo lo
empeoraria (un `-10` pasaria a `-12`), que es justo lo contrario de lo que
significa un bonus; y bonificar un `VAC` o un `No aplica` inventaria un
resultado donde el sistema afirma que no lo hay.

## El historico suma los `professionBonusPoints` publicados, nunca los recalcula (`0.8.0` / MVP-2B)

**Decision:** el desglose de bonus de un periodo agregado del historico
general suma exclusivamente los `professionBonusPoints` ya congelados en
`PublishedKpiResult`. Nunca se recalcula el bonus con la profesion actual
del participante, y ninguna publicacion se recalcula retroactivamente.

**Motivo:** es la misma regla de inmutabilidad ya aplicada a facciones y a
la configuracion de KPI: una semana publicada se explica siempre con su
propia instantanea. Recalcular habria hecho que el historico cambiara solo
por editar una definicion viva.

## El avatar vive en PostgreSQL, en una entidad separada, no en `public/` (`0.8.0` / MVP-2B)

**Decision:** la imagen se guarda ya procesada en
`SplitParticipantAvatar.imageData` (`bytea`), una entidad uno-a-uno
separada de `SplitParticipant` con `onDelete: Cascade`. No se guarda en
`public/`, ni en una ruta local del servidor, ni como base64 dentro de una
columna de texto, ni en ningun servicio externo de imagenes. Los bytes solo
se seleccionan en `readAvatarForViewer`, la unica funcion que sirve la
imagen; ningun listado de participantes, fichas o resultados los carga.

**Motivo:** el encargo exige que el fichero sobreviva al reinicio de la
aplicacion y no dependa de disco efimero, y prohibe introducir un servicio
externo. Separar la tabla es lo que permite cumplir a la vez la exigencia
de persistencia y la de rendimiento (no cargar binarios en consultas
normales), sin renunciar al monolito con una unica base de datos.

## Un avatar solo lo ve su duena o un administrador (`0.8.0` / MVP-2B)

**Decision:** `GET /api/fichas/[splitParticipantId]/avatar` exige sesion.
Un `PARTICIPANT` solo puede leer la ficha vinculada a su propio
`session.user.personId`; un `ADMIN` puede leer cualquiera. Un intento de
leer una ficha ajena devuelve `404`, exactamente igual que una ficha
inexistente.

**Motivo:** el encargo pide que la lectura del avatar no exponga otra ficha
sin autorizacion, pero no define un caso de uso publico de la imagen (las
clasificaciones y los resultados compartidos siguen mostrando solo alias).
La regla mas restrictiva compatible con las pantallas existentes es
"propietaria o administrador". Devolver `404` en vez de `403` evita
confirmar la existencia de fichas ajenas. La gestion administrativa de
avatares queda explicitamente fuera de alcance.

## Operaciones de autoservicio separadas de la administracion (`0.8.0` / MVP-2B)

**Decision:** la ficha privada no reutiliza `updateParticipant`. Cada
intencion tiene su propia operacion de entrada minima
(`updateOwnAlias`, `chooseOwnProfession`, `saveOwnAvatar`,
`deleteOwnAvatar`), que resuelve la identidad desde la sesion y comprueba
`splitParticipant.personId === session.user.personId`. Ademas,
`addParticipantAction`, `updateParticipantAction` y las tres acciones de
profesion vuelven a exigir `requireAdminSession()` dentro de la propia
Server Action.

**Motivo:** requisito explicito del encargo (seccion 29). Ampliar la accion
administrativa generica con un permiso de participante habria permitido que
un formulario de ficha cambiase nivel, faccion, persona o semana inicial.
Repetir la comprobacion de rol dentro de cada Server Action cierra el hueco
de que una Server Action es una ruta invocable directamente, no solo el
destino de un formulario ya renderizado por una pagina protegida.

## El historico semanal se identifica por la fecha de inicio real (`0.8.0` / MVP-2B)

**Decision:** con agrupacion `Semana`, el historico general muestra la
fecha del primer dia de la semana (`SplitWeek.startDate`, formateada como
`DD/MM/AAAA` con el helper UTC `formatCalendarDateEs`) en vez de
`Semana 1 (2026)`. La clave interna sigue siendo `splitId + sequenceNumber`
para no fusionar dos semanas de splits distintos que empiecen el mismo dia,
el orden pasa a ser cronologico descendente por la fecha real (no
alfabetico por la etiqueta) y, cuando el filtro incluye varios splits, el
nombre del split se muestra como texto secundario. `Mes` y `Año` no
cambian.

**Motivo:** correccion pedida explicitamente en el encargo. El numero
secuencial de semana solo tiene sentido dentro de un split concreto, asi
que en un historico que puede mezclar splits resultaba ambiguo. Formatear
en UTC evita el error clasico de mostrar el domingo anterior; ordenar por
la fecha real evita que `10/09` aparezca antes que `07/09` por comparacion
de texto.

## Snapshot de localizacion una sola vez por semana, no por participante (`0.8.5` / MVP-2C)

**Decision:** `WeekPublication` congela `locationId`,
`locationNameSnapshot`, `locationKpiCodeSnapshot` y
`locationBonusPercentSnapshot` una unica vez por semana publicada.
`PublishedKpiResult` solo anade el desglose que si varia por participante
y KPI (`locationBonusPoints`, `locationApplied`): nunca repite nombre, KPI
ni porcentaje de la localizacion en cada fila.

**Motivo:** la localizacion es unica y comun a toda la semana (a
diferencia de la profesion, que es propia de cada participante). Repetir
esos tres campos en cada `PublishedKpiResult` habria sido una
denormalizacion sin ningun beneficio de consulta: ninguna pantalla
necesita filtrar o agrupar por ellos a nivel de fila, todas los leen desde
la publicacion de la semana. Sigue el mismo principio ya aplicado a
`SplitParticipant.factionId` frente al snapshot de faccion (que si es por
participante, porque la faccion **si** varia por persona).

## Composicion de profesion y localizacion: independiente, no encadenada (`0.8.5` / MVP-2C)

**Decision:** `applyProfessionBonus` y `applyLocationBonus` se invocan
ambas con el mismo `baseFinalPoints` (los puntos tras el maximo base).
Ninguna recibe el resultado de la otra como entrada; sus dos importes se
suman una sola vez en el punto unico de composicion de
`weekly-results.service.ts`.

**Motivo:** requisito explicito y vinculante del encargo, con ejemplo
numerico exacto: `70 + 20 % + 30 %` debe dar `105`
(`70 + 14 + 21`), nunca `109,20` (que resultaria de encadenar
`70 x 1,20 x 1,30`). Encadenar los bonus tambien haria que el orden de
aplicacion importase (un efecto no deseado para dos capas que el encargo
declara explicitamente independientes), y complicaria cualquier futura
tercera capa de bonus, que tendria que decidir en que punto de la cadena
insertarse.

## Ventana temporal de la localizacion: funcion pura con fecha inyectada (`0.8.5` / MVP-2C)

**Decision:** `resolveWeekLocationWindow(now, week, isPublished)`
(`src/domain/location-window.ts`) recibe siempre la fecha actual como
argumento; los servicios la llaman con `currentCalendarDate()` (reloj
real), pero la funcion en si nunca lee el reloj. `findNextWeek` sigue el
mismo patron.

**Motivo:** el encargo exige explicitamente que la logica temporal sea
comprobable sin `sleep` ni depender del dia real de ejecucion de las
pruebas. Separar "que hora es" (una unica llamada al reloj, en el borde de
los servicios) de "que decide la hora" (funcion pura) es el mismo patron
ya usado por `generateSplitWeeks`/`isMonday` desde `MVP-1A`, aplicado
ahora a una decision que si depende de la fecha de ejecucion.

## El bloqueo de KPI por localizacion solo mira semanas futuras (`0.8.5` / MVP-2C)

**Decision:** `updateKpiConfig` solo rechaza desactivar un KPI cuando
existe una localizacion en una semana **todavia no comenzada**
(`findFutureLocationsUsingKpi`). Una localizacion de una semana ya
iniciada (pero sin publicaciones en el split todavia) no bloquea la
desactivacion del KPI: si ocurriera esa combinacion infrecuente, el motor
de calculo simplemente no aplica el bonus a ningun KPI inactivo (no hay
fila de resultado para un codigo fuera de `activeKpiCodes`), sin lanzar
ningun error ni dejar datos inconsistentes.

**Motivo:** el encargo pide explicitamente el bloqueo para "una
localizacion futura" (seccion 8), no para cualquier localizacion
existente. Bloquear tambien semanas ya en curso habria ampliado el
alcance pedido y habria entrado en conflicto con la regla, tambien
explicita, de que la localizacion de una semana que ya comenzo queda
bloqueada para **editarse**, pero no convierte en inmutable el resto de la
configuracion del split mientras no haya publicaciones. Es una
combinacion de fechas deliberadamente rara (requiere desactivar el KPI
manualmente en esa ventana concreta) y su peor consecuencia posible es que
el bonus de localizacion simplemente no se aplique esa semana, nunca un
error ni una fila corrupta.

## Nota del asterisco de "Semana inicial" siempre visible (`0.8.5` / MVP-2C)

**Decision:** la nota `* En un split activo, indica desde que semana
empieza a competir esta persona.` de `AddParticipantForm.tsx` se muestra
siempre que se presenta el formulario, sin condicionarla ni al modo de
alta (`Persona existente`/`Nueva persona`) ni al estado del split.

**Motivo:** correccion de una minicorreccion explicita del encargo: el
label `Semana inicial *` ya mostraba el asterisco en cualquier estado del
split y en los dos modos, pero la nota que lo explica solo aparecia con
`splitStatus === "ACTIVE"`, una condicion sin relacion con lo que
realmente hacia visible o no la nota. Mostrarla siempre es la solucion mas
simple que no oculta informacion util (el alta en un split en borrador
tambien puede beneficiarse de saber para que sirve el campo) y elimina la
inconsistencia observada.

## Libro de movimientos como unica fuente del saldo, sin campo materializado (`0.9.0` / MVP-2D)

**Decision:** `CreditLedgerEntry` es la unica fuente de verdad del saldo
de un participante (`balance = suma de todos los movimientos`,
`getParticipantBalance`, `src/server/services/ledger.service.ts`). No se
anade ningun campo `balance` cacheado en `SplitParticipant` ni en ninguna
otra tabla.

**Motivo:** el encargo permite explicitamente una proyeccion materializada
"si se necesita", pero exige que sea comprobable contra el libro y advierte
de complejidad innecesaria para el tamano actual del equipo. Sumar el
libro en cada lectura (acotado por participante, nunca por todo el split a
la vez salvo en el resumen administrativo, que ya usa dos consultas para
todo el split) evita el riesgo de que un saldo cacheado se desincronice
del libro, sin necesidad de mantener sincronizado un segundo dato.

## `creditsEarned` se congela en la fila publicada ademas de vivir en el libro (`0.9.0` / MVP-2D)

**Decision:** `PublishedParticipantWeeklyResult.creditsEarned` guarda el
mismo entero que el movimiento `WEEKLY_EARNING` vinculado, aunque el libro
siga siendo la fuente economica.

**Motivo:** el encargo lo pide explicitamente ("amplia el resultado
publicado para guardar `creditsEarned`... aunque el movimiento del libro
continue siendo la fuente economica"), para poder leer el credito de una
semana sin tener que unir con `CreditLedgerEntry` en cada pantalla de
resultados o historico, siguiendo el mismo patron ya usado por otros
campos "snapshot" (`aliasSnapshot`, `professionNameSnapshot`...).

## Conjunto de porcentajes de bonus compartido entre localizaciones y objetos (`0.9.0` / MVP-2D)

**Decision:** `src/domain/bonus-percent.ts` declara la unica lista tipada
`ALLOWED_BONUS_PERCENTS = [10, 20, 30, 40, 50]`. `LOCATION_BONUS_PERCENTS`
(`src/domain/location-bonus.ts`) y `EQUIPMENT_BONUS_PERCENTS`
(`src/domain/equipment-bonus.ts`) la reexportan tal cual, en vez de
declarar cada uno su propia copia literal.

**Motivo:** el encargo pide explicitamente centralizar estos valores en
una lista tipada compartida "sin acoplar entidades ni duplicar reglas
divergentes". Reexportar la misma constante cumple ambas cosas: una unica
fuente de verdad para el conjunto de porcentajes, mientras que
`applyLocationBonus` y `applyEquipmentBonuses` siguen siendo funciones de
dominio completamente independientes (localizacion: un unico efecto por
semana, no acumulable; objetos: varios efectos acumulables por ranura),
cada una con su propia restriccion de base de datos.

## `computeWeeklyResults` se amplia para aceptar `Prisma.TransactionClient` (`0.9.0` / MVP-2D)

**Decision:** `computeWeeklyResults` (`src/server/services/weekly-results.service.ts`)
y las funciones que consulta internamente (`getWeeklyKpiLoadSummary`,
`loadEquippedItemsForParticipants`...) aceptan ahora
`PrismaClient | Prisma.TransactionClient` en vez de solo `PrismaClient`.
`publishWeek` invoca el motor agregado **dentro** de su propia transaccion
serializable, en vez de calcular fuera y solo escribir dentro (el diseno
anterior a `0.9.0`).

**Motivo:** requisito explicito del encargo (seccion 22): el equipo de
cada participante debe releerse en el instante exacto de publicar, dentro
de la misma transaccion que crea la instantanea, para que una carrera
entre equipar/desequipar y publicar nunca produzca una semana con un
equipo "mitad viejo, mitad nuevo". Ampliar el tipo del parametro es la
refactorizacion minima que permite reutilizar exactamente el mismo motor
para la previsualizacion (fuera de transaccion, con `prisma`) y para la
publicacion (dentro de ella, con `tx`), sin duplicar la logica de calculo.

## Instantanea de equipo por objeto, nunca un JSON opaco (`0.9.0` / MVP-2D)

**Decision:** `PublishedEquippedItem` congela una fila por objeto
equipado al publicar (nombre, ranura, KPI y porcentaje), con referencias
vivas opcionales (`storeItemId`/`equipmentSlotId`, `onDelete: SetNull`)
solo como enlace de conveniencia, nunca como fuente de verdad. El
desglose de bonus de equipo por KPI en una vista publicada se obtiene
filtrando estas filas por `kpiCodeSnapshot`, sin guardar un JSON con todo
el equipo en `PublishedKpiResult` ni en `PublishedParticipantWeeklyResult`.

**Motivo:** el encargo prohibe explicitamente un "JSON opaco con todo el
equipo" y pide una estructura normalizada, en linea con el resto del
modelo de instantaneas ya existente (`PublishedKpiResult`,
`factionNameSnapshot`...). Una fila por objeto tambien permite indices,
restricciones de base de datos sobre el porcentaje congelado, y contar o
listar objetos sin deserializar JSON en la capa de aplicacion.

## `basePointsBeforeProfession` sigue siendo la unica base persistida para los tres bonus (`0.9.0` / MVP-2D)

**Decision:** no se anade una columna nueva para "puntos antes de
objetos": `PublishedKpiResult.basePointsBeforeProfession`, que desde
`0.8.5` ya representaba la base anterior a profesion y a localizacion,
sigue siendo tambien la base anterior al bonus de objetos. Es exactamente
el mismo numero para los tres, porque los tres se calculan sobre el mismo
`baseFinalPoints` sin encadenarse.

**Motivo:** evita una migracion destructiva o una tercera columna
redundante para representar un valor que ya es identico para las tres
capas de bonus, siguiendo la misma decision ya tomada en `0.8.5` cuando se
anadio la localizacion sobre el campo existente de profesion.

## El selector "Con/Sin gamificacion" se deriva restando los bonus ya persistidos (`0.9.0` / MVP-2D)

**Decision:** la vista "sin gamificacion" de `/resultados` no anade
ninguna columna nueva de agregados: se calcula siempre como
`total oficial - (bonus de profesion + bonus de localizacion + bonus de
objetos)`, usando los mismos `professionBonusPoints`/`locationBonusPoints`/`equipmentBonusPoints`
ya publicados que alimentan el desglose "Con gamificacion". Por celda de
KPI se usa directamente `basePointsBeforeProfession` (con `finalPoints`
como fallback en publicaciones anteriores a `0.8.0`, ver decision
anterior); para sumas agregadas (semana, periodo del historico) se resta
la suma de esos mismos tres bonus del total oficial ya publicado.

**Motivo:** matematicamente ambos caminos coinciden siempre (el total
oficial es por definicion `base + profesion + localizacion + objetos`), y
en publicaciones anteriores a `0.8.0`/`0.8.5`/`0.9.0` esos bonus son `0`
por definicion, asi que la resta no necesita ningun caso especial para
datos historicos: reproduce automaticamente el mismo valor que
`basePointsBeforeProfession` habria dado. Evita persistir un agregado
adicional (`realBasePoints`) que solo duplicaria informacion ya calculable
a partir de columnas existentes.

## No se bloquea la desactivacion de un KPI por un objeto retirado y sin propietarios (`0.9.0` / MVP-2D)

**Decision:** `findStoreItemsUsingKpi` (usado por `updateKpiConfig` para
impedir desactivar un KPI en uso) solo considera un objeto "en uso" si
esta `isForSale` o si algun participante ya lo posee
(`ownedCount > 0`). Un objeto retirado de la venta (`isForSale: false`) y
que nadie ha comprado todavia no bloquea la desactivacion del KPI que
potencia.

**Motivo:** ese objeto concreto no tiene ningun efecto vivo que proteger
(nadie lo posee, nadie puede comprarlo): si el administrador quiere
liberar el KPI, puede simplemente eliminar ese objeto en su lugar. Bloquear
tambien ese caso habria sido mas estricto de lo que el encargo pide
("a la venta, comprado o equipado") sin ningun beneficio de integridad.

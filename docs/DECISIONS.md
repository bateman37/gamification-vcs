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

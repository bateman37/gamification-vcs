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

## Reglas criticas protegidas en servidor y en base de datos

**Decision:** ademas de la validacion en los servicios de dominio
(`src/server/services/*`), las reglas mas criticas se protegen tambien
con restricciones de base de datos: unicidad de correo, unicidad de
persona por split, unicidad de alias normalizado por split, semana
inicial perteneciente al mismo split (clave foranea compuesta), lunes de
inicio de split y de semana, domingo de fin de semana, rango de numero
de semanas (1-52), y (desde `IMPORT-1A / MVP-1C.1`) que los siete conteos
de `ProductivityWeeklyRow` y los contadores de `ProductivityImport` sean
siempre no negativos.

**Motivo:** el encargo pide explicitamente proteger las reglas criticas
tambien mediante restricciones de base de datos "cuando sea viable". Esto
evita que un futuro cambio en la capa de servicios (o un acceso directo a
la base de datos) rompa invariantes de negocio sin que nadie lo note.

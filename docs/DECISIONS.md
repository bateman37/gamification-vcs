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

**Decision:** `MVP-1B` implementara un catalogo cerrado de 10 KPI con
tipos de calculo conocidos y parametros configurables, sin permitir crear
KPI nuevos ni introducir formulas libres.

**Motivo:** limita el riesgo de un motor de calculo generico mal
definido y se ajusta al comportamiento auditado del Split 8 (ver
`docs/DISCOVERY-1-SPLIT-8.md`).

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

## Reglas criticas protegidas en servidor y en base de datos

**Decision:** ademas de la validacion en los servicios de dominio
(`src/server/services/*`), las reglas mas criticas se protegen tambien
con restricciones de base de datos: unicidad de correo, unicidad de
persona por split, unicidad de alias normalizado por split, semana
inicial perteneciente al mismo split (clave foranea compuesta), lunes de
inicio de split y de semana, domingo de fin de semana, y rango de numero
de semanas (1-52).

**Motivo:** el encargo pide explicitamente proteger las reglas criticas
tambien mediante restricciones de base de datos "cuando sea viable". Esto
evita que un futuro cambio en la capa de servicios (o un acceso directo a
la base de datos) rompa invariantes de negocio sin que nadie lo note.

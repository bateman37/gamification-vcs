# Contexto del producto

## Objetivo

Gamification VCS es la aplicacion que sustituye al libro Excel usado
historicamente para gestionar las gamificaciones periodicas del equipo de
Customer Service. El objetivo no es replicar la estructura visual de ese
Excel, sino representar correctamente sus conceptos de negocio en una
aplicacion web sencilla.

En su vision completa, un administrador podra:

- crear un split (una edicion de la gamificacion);
- seleccionar sus participantes;
- configurar los KPI activos para ese split;
- cargar resultados mediante Excel o formularios manuales;
- revisar los resultados antes de publicarlos;
- consultar la clasificacion general acumulada.

Cada participante podra, mas adelante, acceder a su propio resultado
individual y a la clasificacion general.

La arquitectura es deliberadamente simple: una unica aplicacion web, una
base de datos relacional, un unico repositorio y despliegue. Sin
microservicios ni infraestructura distribuida.

## Roles futuros

Esta entrega (MVP-1A) no implementa autenticacion ni cuentas. El modelo
de datos y la interfaz ya se preparan para dos roles futuros:

- **Administrador**: crea y gestiona splits, personas, KPI y cargas de
  resultados; revisa y publica resultados.
- **Participante**: accede unicamente a su resultado individual y a la
  clasificacion general, una vez existan cuentas de participante.

## Vocabulario

| Termino | Significado |
|---|---|
| **Persona** | Registro global y estable de alguien que puede participar en gamificaciones. Existe independientemente de si participa en algun split. |
| **Split** | Una edicion de la gamificacion periodica, con sus propias fechas, duracion y estado (`DRAFT`, `ACTIVE`, `CLOSED`). |
| **Semana** | Cada uno de los tramos de calendario (de lunes a domingo) en los que se divide un split. Se identifica por su numero secuencial dentro del split (1, 2, 3...), nunca por el numero de semana ISO del calendario. |
| **Participante** | La relacion entre una persona y un split concreto: incluye el alias y el nivel tecnico que esa persona tiene en ese split, y desde que semana participa. |
| **Alias** | Nombre visible de un participante dentro de un split concreto. No pertenece a la persona global: la misma persona puede tener alias distintos en splits diferentes. |
| **KPI** | Indicador de rendimiento configurable por split (pendiente de `MVP-1B`). Cada KPI tiene un calculo conocido y parametros propios; el catalogo de tipos de calculo es cerrado. |
| **Resultado** | El valor calculado de los KPI de un participante en una semana o en el acumulado del split (pendiente de `MVP-1C`). |
| **Clasificacion** | El orden de los participantes segun sus resultados acumulados (pendiente de `MVP-1C`). |

## Persona global frente a participante de un split

Una **persona** es un registro estable y reutilizable: existe una sola
vez en el sistema, con su nombre completo y (opcionalmente) su correo.
Una persona puede no participar en ningun split, participar en uno solo,
o participar en varios a la vez o a lo largo del tiempo.

Un **participante** es la relacion entre esa persona y un split concreto.
Cada participacion tiene su propio alias y su propio nivel tecnico, que
son datos del split, no de la persona. Esto permite, por ejemplo, que
"Ana Garcia" participe en el Split 8 como "AnaGamer" con nivel `N1`, y en
el Split 9 como "LaReina" con nivel `N2`, sin que esos alias se mezclen ni
se pisen entre si.

Esta distincion se confirmo auditando el Split 8 real: su hoja maestra de
personas tenia 13 registros, mientras que su hoja de resultados (los
participantes de esa edicion concreta) tenia 12. Ver
`docs/DISCOVERY-1-SPLIT-8.md` para el detalle completo.

## Alias por split

El alias se decidio modelar dentro de la participacion (`SplitParticipant`),
no dentro de `Person`, precisamente para permitir alias distintos por
split sin duplicar personas. Ver `docs/DECISIONS.md`.

## Incorporacion de participantes durante un split activo

El Split 8 auditado tuvo, historicamente, participantes que se
incorporaron en semanas posteriores a la semana 1. Por eso el modelo
exige una semana inicial de participacion para cada participante, y
permite anadir participantes tanto mientras el split esta en borrador
como una vez ya esta activo, indicando en ese caso desde que semana
compiten. Una persona incorporada durante el split no cuenta como
participante en las semanas anteriores a su incorporacion.

## Principio de construccion: nucleo primero, capas de juego despues

El sistema se construye por incrementos, empezando por el nucleo
funcional (personas, splits, semanas, participantes, KPI, resultados y
clasificacion) antes de anadir cualquier capa de gamificacion adicional
(facciones, profesiones, localizaciones, objetos, economia de creditos,
renombre, misiones...). Estas capas son parte de la vision del producto,
pero se documentan para el futuro y no se construyen antes de tiempo. Ver
`docs/ROADMAP.md` y `docs/DISCOVERY-1-SPLIT-8.md` (apartado de
funcionalidades historicas aplazadas).

## Comunicacion y presentacion (`1.0.0` / MVP-3)

Con el nucleo y las cuatro capas de juego (facciones, profesiones,
localizaciones, economia) ya construidas, la `1.0.0` cierra la primera
version estable con dos bloques de comunicacion y usabilidad, no de
mecanica de juego: un **centro de noticias** interno que informa de los
eventos reales de cada split (ver `docs/NEWS_CENTER.md`) y una
**renovacion visual** unica llamada "Prisma competitivo" (ver
`docs/DESIGN_SYSTEM.md`), aplicada a toda la aplicacion existente sin
alterar ninguna regla de negocio. `Noticias` pasa a ser el punto de
entrada tras iniciar sesion.

## Resumen funcional del Split 8

El Split 8 es la campana real que se ha auditado para disenar el nucleo
del sistema y el futuro catalogo de KPI. Tuvo 10 semanas operativas (del
06/10/2025 al 14/12/2025), 12 participantes activos y 13 personas en su
hoja maestra. Confirmo, entre otras cosas, la necesidad de separar persona
y participante, la necesidad de una semana inicial de participacion, y el
catalogo inicial de 10 KPI que se implementara en `MVP-1B`. El detalle
completo de esta auditoria — calculos observados, multiplicadores,
maximos, origenes de datos y funcionalidades historicas aplazadas — esta
en `docs/DISCOVERY-1-SPLIT-8.md`.

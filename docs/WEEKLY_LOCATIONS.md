# Localizaciones semanales (`0.8.5` / MVP-2C)

Tercera capa de juego real, tras facciones (`0.7.0` / MVP-2A, ver
`docs/FACTIONS.md`) y profesiones (`0.8.0` / MVP-2B, ver
`docs/PROFESSIONS_AND_PROFILES.md`). Los documentos historicos solo decian
que Split 8 tuvo localizaciones con bonus semanales; no describian nombres,
reglas ni efectos concretos (ver `docs/DISCOVERY-1-SPLIT-8.md`). La unica
definicion funcional valida es la de este documento: no se ha inventado ni
recuperado ningun dato historico de localizaciones.

## 1. Carácter opcional y una por semana

- Cada `SplitWeek` tiene **cero o una** localizacion.
- Nunca puede haber dos localizaciones simultaneas en la misma semana: la
  identidad funcional es siempre `splitWeekId` (restriccion unica de base
  de datos), nunca un numero de semana ISO ni un texto libre.
- Una semana sin localizacion se calcula y publica exactamente igual que
  en `0.8.0`: la ausencia no es un error, no crea un aviso y no bloquea la
  publicacion.
- El mismo nombre puede repetirse en semanas o splits diferentes: no existe
  un catalogo global de localizaciones ni una entidad reutilizable
  compartida entre semanas.
- Afecta por igual a **todos los participantes aplicables** de esa semana,
  sin distinguir nivel tecnico, faccion ni profesion.

## 2. Modelo y restricciones

`SplitWeekLocation` (`prisma/schema.prisma`,
migracion `prisma/migrations/20260912003932_add_weekly_locations`):

- `id`, `splitWeekId` (unico: relacion uno-a-uno con `SplitWeek`,
  `onDelete: Cascade` desde la semana, igual que las entradas manuales
  semanales), `name`, `kpiCode` (enum cerrado `KpiCode`), `bonusPercent`
  (`Int`), `createdAt`, `updatedAt`.
- El split se deduce siempre a traves de `splitWeek.splitId`: no se
  duplica `splitId` en esta tabla, porque no existe ninguna consulta que
  lo necesite directamente (siempre se llega por semana).
- El nombre es obligatorio, se recorta de espacios exteriores y debe
  quedar con contenido visible tras normalizarlo; limite de **80**
  caracteres (`weekLocationFormSchema`,
  `src/server/validation/location.ts`).
- `kpiCode` debe pertenecer al catalogo cerrado y estar **activo en el
  split** en el momento de crear o editar la localizacion (comprobado en
  `location.service.ts`, nunca solo por las opciones visibles del
  selector).
- `bonusPercent` solo puede ser `10`, `20`, `30`, `40` o `50`
  (`LOCATION_BONUS_PERCENTS`, `src/domain/location-bonus.ts`, unica lista
  tipada que alimenta validacion, selector y pruebas) y esta reforzado en
  PostgreSQL con la restriccion `SplitWeekLocation_bonusPercent_allowed_check`.
  No se acepta un porcentaje libre, decimal, ni datos de otro split.
- No se guardan formulas, factores, JavaScript ni JSON libre del
  navegador: solo nombre, un codigo de KPI y un porcentaje cerrado.

## 3. Seleccion entre KPI activos y porcentajes permitidos

El formulario administrativo
(`/splits/[id]/weeks/[weekId]/localizacion`,
`WeekLocationForm.tsx`) solo ofrece los KPI **activos** del split (en el
orden del catalogo, con su nombre visible) y el selector `Bonus` con
exactamente `10 %`/`20 %`/`30 %`/`40 %`/`50 %`. Antes de guardar se
muestra un resumen con el mismo formato que en el encargo:

```text
Nebulosa de Andrómeda
Semana: 14/09/2026 — 20/09/2026
Potencia: Explorador de datos
Bonus para todos los participantes: +30 % después del máximo base
```

## 4. Preparacion para una semana futura

`resolveWeekLocationWindow(now, week, isPublished)`
(`src/domain/location-window.ts`) es la unica funcion que decide si una
localizacion es editable: funcion pura, recibe siempre la fecha actual
como argumento (nunca lee el reloj real por su cuenta), para que sea
comprobable con una fecha inyectada sin `sleep` ni depender de cuando se
ejecutan las pruebas.

Regla exacta:

- se puede **crear, editar o eliminar** la localizacion de una semana
  **antes de que llegue su `startDate`** (estado `PROXIMA`);
- desde el primer dia de la semana queda **bloqueada** (`ACTIVA` mientras
  dura, `FINALIZADA` despues), aunque todavia no se haya publicado;
- una semana **publicada** es siempre de solo lectura (`PUBLICADA`),
  incluso si por un error de fechas se intentara editar antes de
  `startDate` (la comprobacion de publicacion tiene prioridad);
- una semana que comienza sin localizacion continua sin ella: no se puede
  anadir una a mitad de semana;
- el split debe estar `DRAFT` o `ACTIVE` (nunca `CLOSED`) para preparar
  una localizacion futura.

El **miercoles** es la operativa habitual esperada (decidir entre semana
la localizacion de la siguiente), pero no es una restriccion tecnica por
dia de la semana: el formulario no comprueba que dia es hoy, solo que la
semana elegida no haya comenzado.

`findNextWeek(orderedWeeks, now)` (mismo fichero) identifica la primera
`SplitWeek` cuya `startDate` es posterior a la fecha actual, dentro de las
semanas ya creadas del split (nunca inventa una semana nueva). El
calendario administrativo la destaca como la accion principal, sin dejar
de permitir preparar cualquier otra semana futura existente.

`location.service.ts` (`upsertWeekLocation`, `deleteWeekLocation`,
`getWeekLocation`) comprueba siempre, con el mismo `db`/transaccion que va
a escribir: sesion `ADMIN` (en la accion de servidor, no en el servicio),
existencia de split y semana, pertenencia de la semana al split, estado
del split, la ventana temporal anterior, ausencia de publicacion, nombre
valido, KPI activo del mismo split y porcentaje del conjunto cerrado.
Nunca confia en botones deshabilitados, campos ocultos, ids de URL ni
datos precalculados en el navegador.

## 5. Bloqueo desde `startDate` y consistencia con la configuracion de KPI

Desde el primer dia de la semana, la localizacion queda bloqueada
aunque la semana todavia no se haya publicado: `upsertWeekLocation` y
`deleteWeekLocation` rechazan la operacion con un mensaje claro. Una
semana ya publicada es siempre de solo lectura, sin excepcion.

Antes de la primera publicacion del split, la configuracion de KPI
todavia puede editarse (ver `docs/KPI_CONFIGURATION.md`). Para no dejar
una localizacion apuntando a un KPI inactivo,
`updateKpiConfig` (`src/server/services/kpi.service.ts`) rechaza
desactivar un KPI cuando existe una localizacion **futura** (semana
todavia no comenzada) que lo potencia, identificando en el mensaje la
semana afectada (`findFutureLocationsUsingKpi`,
`src/server/services/location.service.ts`). La localizacion no se borra
ni se cambia en silencio: el administrador debe editarla o eliminarla
primero. Desde la primera publicacion del split, el bloqueo global de
configuracion de KPI ya existente (`docs/DECISIONS.md`) continua igual.

## 6. Composicion no encadenada con la profesion

Ver el detalle completo en `docs/RESULTS_PUBLICATION.md` (seccion
2.1.ter) y `docs/PROFESSIONS_AND_PROFILES.md` (seccion 8). Resumen:

```text
1. rawPoints con la formula existente del KPI.
2. Maximo base existente -> baseFinalPoints.
3. Bonus de profesion sobre baseFinalPoints, si corresponde.
4. Bonus de localizacion sobre el mismo baseFinalPoints, si corresponde.
5. finalPoints = baseFinalPoints + professionBonusPoints + locationBonusPoints.
```

`applyLocationBonus` (`src/domain/location-bonus.ts`) es la unica funcion
de dominio que decide y calcula este bonus; no se reparten condiciones de
porcentaje dentro de los diez resolvers de `src/domain/kpis/*`. El punto
unico de composicion vive en
`src/server/services/weekly-results.service.ts`: invoca
`applyProfessionBonus` y `applyLocationBonus` con el mismo
`baseFinalPoints`, nunca pasa el resultado de uno como base del otro, y
suma ambos importes una sola vez.

Aplica unicamente cuando: la semana tiene localizacion; el KPI del
resultado coincide con el de la localizacion; ese KPI sigue activo en el
split; el KPI aplica al nivel del participante; el participante es
aplicable esa semana segun sus semanas inicial/final; el resultado es
`COMPUTED`; y los puntos tras el maximo son estrictamente positivos.
`VAC`/`AVISO`, `NOT_APPLICABLE`, cero y negativos nunca reciben este
bonus, igual que la profesion.

Ejemplos vinculantes (los mismos del encargo):

| Caso | Tras maximo | Profesion | Localizacion | Final |
|---|---:|---:|---:|---:|
| Solo localizacion 30 % | 50 | 0 | 15 | 65 |
| Solo localizacion 30 % al tope | 70 | 0 | 21 | 91 |
| Profesion 20 % + localizacion 30 %, mismo KPI | 70 | 14 | 21 | **105** (nunca `109,20`) |
| Profesion en otro KPI + localizacion 50 % | 70 | 0 | 35 | 105 |

`applicableMaxPoints` sigue sumando maximos base sin inflar: el
porcentaje mostrado puede superar el `100 %`, hasta el `170 %` con ambos
bonus a la vez sobre el mismo KPI. Todo el calculo usa `Prisma.Decimal`,
sin redondeo prematuro.

**Composicion con objetos de equipo (`0.9.0` / MVP-2D, ver
docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md):** los objetos equipados son una
tercera capa de bonus, igual de independiente y no encadenada, tambien
calculada sobre `baseFinalPoints`. A diferencia de la localizacion (un
unico efecto por semana), varios objetos que potencien el mismo KPI se
acumulan de forma aditiva entre si. Con profesion `20 %`, localizacion
`30 %` y un objeto `10 %` sobre el mismo KPI de base `70`, el resultado es
`112`, nunca un producto de factores.

## 7. Efecto sobre rankings, puntos por posicion y facciones

`finalPoints` (ya con ambos bonus) alimenta el total KPI semanal, el
ranking de ese KPI, el ranking individual semanal, los puntos por
posicion y la clasificacion individual acumulada, exactamente igual que
cualquier otro resultado. Las facciones solo reciben el efecto **de forma
indirecta**, porque su clasificacion sigue sumando los puntos por
posicion ya publicados de sus tres mejores participantes (ver
`docs/FACTIONS.md`): no se aplica un porcentaje directo a la faccion, no
se multiplican los puntos por posicion, y no existe una puntuacion
paralela para la localizacion.

## 8. Snapshots y compatibilidad historica

La publicacion (`publishWeek`,
`src/server/services/publish-week.service.ts`) vuelve a consultar la
semana y su localizacion en servidor, recalcula todo desde los datos
fuente, y congela dentro de la misma transaccion:

- en `WeekPublication`: `locationId`, `locationNameSnapshot`,
  `locationKpiCodeSnapshot`, `locationBonusPercentSnapshot` — una sola vez
  por semana, porque la localizacion es unica y comun a todos los
  participantes (no se repite su nombre/KPI/porcentaje en cada fila);
- en cada `PublishedKpiResult`: `locationBonusPoints` y `locationApplied`
  — el desglose por KPI y participante.

`PublishedKpiResult.basePointsBeforeProfession` ya representaba, desde
`0.8.0`, el resultado tras el maximo base y antes del bonus de profesion;
desde `0.8.5` es tambien la base anterior a la localizacion (no se ha
hecho ninguna migracion destructiva para renombrarlo: sigue siendo la
unica fuente numerica persistida para ese concepto).

Las publicaciones anteriores a `0.8.5` se siguen leyendo sin errores: sus
campos de localizacion son `null`/`false` (nunca se completan
retroactivamente, nunca se recalculan). Una semana ya publicada nunca se
vuelve a calcular al leerla.

## 9. Visibilidad en administracion

- **Calendario de semanas** (`/splits/[id]`): columna `Localizacion` con
  `Sin localizacion` o nombre/KPI/porcentaje, accion `Configurar`/`Editar`
  cuando la semana es futura, indicador `Activa` o `Bloqueada`, y
  presentacion de solo lectura para semanas pasadas o splits cerrados
  (`WeekLocationCell.tsx`). La tabla conserva su contenedor ancho con
  `overflow-x-auto` existente: la columna nueva no rompe el diseno en
  movil ni en pantallas panoramicas.
- **Pantalla semanal de KPI** (`/splits/[id]/weeks/[weekId]/kpis`):
  tarjeta compacta con nombre, KPI potenciado, porcentaje, estado
  (`Proxima`/`Activa`/`Finalizada`/`Publicada`) y enlace para
  configurar/editar cuando esta permitido; `Esta semana no tiene
  localizacion` de forma neutra si no existe (nunca un aviso de error).
- **Previsualizacion y publicacion**
  (`/splits/[id]/weeks/[weekId]/resultados`): tarjeta superior con la
  localizacion de la semana (`WeekLocationSummaryCard.tsx`); las celdas
  del KPI afectado muestran un borde e indicador `+N % localizacion`
  (violeta cuando coincide con el KPI de la profesion, para distinguir
  visualmente ambos bonus a la vez) y el desglose completo (`Resultado
  tras maximo`/`Bonus profesion`/`Bonus localizacion`/`Resultado final`)
  en la ayuda accesible de la celda. Una semana publicada usa siempre el
  snapshot, nunca una configuracion viva distinta.

## 10. Fichas y resultados del participante

- **`/fichas`**: si el split esta `ACTIVE`, la semana actual tiene
  localizacion y el participante es aplicable esa semana (segun sus
  semanas inicial/final), se muestra la tarjeta `Localizacion activa esta
  semana` con nombre, KPI potenciado, porcentaje y fechas. Es de solo
  lectura: la ficha no permite crearla, editarla ni votarla. No se
  muestra como activa una localizacion futura, pasada, de otro split, ni
  a un participante que todavia no se ha incorporado esa semana.
  `listActiveWeekLocationsForSplits` (`location.service.ts`) resuelve la
  localizacion activa de todos los splits de la persona en una sola
  consulta (nunca N+1 por ficha, ni carga bytes de avatar).
- **`/resultados` > Por split**: cada semana publicada muestra su
  localizacion congelada (nombre, KPI, porcentaje) junto a la fecha de la
  semana, y el KPI afectado muestra el mismo desglose e indicador que en
  administracion. Una semana sin localizacion no muestra huecos ni
  etiquetas enganosas.
- **`/resultados` > Historico general**: cada celda por KPI y el total del
  periodo anaden `+N localizacion` cuando el periodo tuvo ese bonus,
  sumando exclusivamente `locationBonusPoints` **publicados** (nunca se
  recalcula con la localizacion actual). Con agrupacion mensual o anual y
  varias localizaciones distintas en el periodo, el texto sigue siendo
  solo el importe agregado.

## 11. Permisos

Ver la matriz completa en `docs/AUTHENTICATION.md`. Resumen: solo `ADMIN`
crea, edita o elimina localizaciones (con `requireAdminSession()` repetido
dentro de la propia Server Action); un participante solo puede consultar
la localizacion vinculada a sus propias fichas y resultados autorizados,
nunca mutarla ni ver la de otra persona o de otro split.

## 11.bis Noticias automaticas (`1.0.0` / MVP-3)

Crear, actualizar o eliminar una localizacion notifica a los participantes
aplicables a esa semana **solo si el split ya esta `ACTIVE`** (en `DRAFT`
la configuracion es preparacion y no debe inundar bandejas) y solo si el
`upsert` cambia realmente nombre, KPI o porcentaje (un guardado identico
no notifica). El administrador no recibe una noticia de jugador por esto,
pero si vera la "proxima localizacion pendiente" que genera `publishWeek`
cuando corresponda. Ver `docs/NEWS_CENTER.md`.

## 12. Minicorreccion: nota del asterisco en "Anadir participante"

`AddParticipantForm.tsx` mantenia el label `Semana inicial *` en los dos
modos de alta, pero la nota inferior (`* En un split activo, indica desde
que semana empieza a competir esta persona.`) solo se mostraba cuando
`splitStatus === "ACTIVE"`, sin relacion real con el modo de alta
(`Persona existente`/`Nueva persona`). Desde `0.8.5` la nota se muestra
siempre que se presenta el formulario, en ambos modos, conservando
`aria-describedby` entre el selector `Semana inicial` y la nota.

## 13. Fuera de alcance de esta entrega

Mas de una localizacion por semana; localizaciones globales reutilizables
o catalogo predeterminado; seleccion aleatoria o rotacion automatica;
obligar a configurar una localizacion todas las semanas; porcentaje libre
o superior a `50 %`; mas de un KPI por localizacion; restricciones por
nivel, profesion, faccion o jugador; multiplicacion encadenada de bonus;
bonus sobre puntos por posicion; edicion por participantes; votaciones;
imagenes, mapas, iconos o descripciones enriquecidas; notificaciones
programadas de los miercoles; misiones, cartas, hechizos, consumibles,
ajustes manuales de juego, PDF, correo, Power BI o un motor generico de
plugins o formulas. Los objetos permanentes, el inventario, el equipo y la
economia de creditos se implementaron en `0.9.0` / MVP-2D (ver
`docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md`).

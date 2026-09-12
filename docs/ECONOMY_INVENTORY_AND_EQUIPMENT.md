# Economia, inventario y equipo (`0.9.0` / MVP-2D)

Cuarta capa de juego real, tras facciones (`0.7.0` / MVP-2A, ver
`docs/FACTIONS.md`), profesiones (`0.8.0` / MVP-2B, ver
`docs/PROFESSIONS_AND_PROFILES.md`) y localizaciones semanales (`0.8.5` /
MVP-2C, ver `docs/WEEKLY_LOCATIONS.md`). Anade una economia de creditos por
split, un mercado administrable, un catalogo de objetos, inventario
personal, ranuras de equipo configurables, un tercer bonus de resultados
(objetos), configuracion privada ampliada del personaje y una vista
analitica "con/sin gamificacion" en `Resultados`. No modifica ninguna regla
ya asentada de facciones, profesiones ni localizaciones, y no recalcula
ninguna semana historica.

## 1. Economia separada por split

- El monedero pertenece a `SplitParticipant`, no a `Person`: una misma
  persona puede tener saldos e inventarios distintos en splits diferentes.
- Los creditos, objetos, compras, inventario, ranuras y equipo de un split
  nunca se mezclan con los de otro.
- La economia existe aunque el mercado este cerrado: un split puede tener
  creditos generados sin tener todavia ranuras u objetos.
- Cerrar el split conserva saldo, inventario, equipo, compras e historico en
  modo de solo lectura; no existe una economia global ni una tesoreria de
  faccion en esta release.

## 2. Equivalencia entre puntos y creditos

```text
1 credito = 1 punto KPI completo publicado
creditsEarned = max(0, floor(totalKpiPoints))
```

`computeCreditsEarned` (`src/domain/credits.ts`) es la unica funcion de
dominio que decide este calculo. Los creditos son siempre enteros; los
puntos KPI conservan su precision decimal (nunca se redondea al entero mas
proximo). Se conceden creditos unicamente por puntos completos y nunca se
genera una deuda por un resultado negativo:

| Total KPI oficial publicado | Creditos ganados |
|---:|---:|
| 248,04 | 248 |
| 248,99 | 248 |
| 1 | 1 |
| 0,99 | 0 |
| 0 | 0 |
| -12,50 | 0 |

Los bonus de profesion, localizacion y objetos aumentan los creditos porque
forman parte de `totalKpiPoints` ya publicado: un objeto que ayuda a ganar
mas creditos es intencionado.

## 3. Solo la publicacion genera creditos

La previsualizacion muestra una estimacion (`creditsEarned` en
`WeeklyResultsComputation`, seccion 5) pero no modifica saldos. Cargar o
editar KPI, ni equipar un objeto, generan creditos por si mismos. Los
creditos se generan exactamente una vez al publicar la semana
(`publishWeek`, ver seccion 8): cada `PublishedParticipantWeeklyResult`
origina como maximo un movimiento de ganancia, protegido por un indice
unico sobre `publishedResultId`. Reintentar, refrescar o sufrir una carrera
de publicacion no puede duplicar creditos (ver `docs/RESULTS_PUBLICATION.md`,
seccion 4.1).

## 4. Libro de movimientos como fuente de verdad

`CreditLedgerEntry` es un libro inmutable por participante:

- `id`, `splitParticipantId`, `type` (`WEEKLY_EARNING` | `PURCHASE`),
  `amount` (entero con signo), `description`, `createdAt`.
- `publishedResultId` (unico, opcional): presente solo en `WEEKLY_EARNING`.
- `purchaseId` (unico, opcional): presente solo en `PURCHASE`.

```text
balance = suma de todos los movimientos del participante
```

`getParticipantBalance`/`listLedgerEntriesForParticipant`/`listEconomySummaryForSplit`
(`src/server/services/ledger.service.ts`) son las unicas lecturas: no existe
un campo `balance` materializado ni cacheado. Restricciones de base de
datos:

- `CreditLedgerEntry_amount_sign_check`: `WEEKLY_EARNING` siempre
  `amount >= 0`; `PURCHASE` siempre `amount < 0`.
- `CreditLedgerEntry_source_ref_check`: cada movimiento tiene exactamente
  una referencia de origen coherente con su tipo (nunca las dos, nunca
  ninguna).
- `onDelete: Restrict` hacia `SplitParticipant`, `PublishedParticipantWeeklyResult`
  e `ItemPurchase`: ningun movimiento desaparece por borrar accidentalmente
  la entidad a la que hace referencia. Los movimientos publicados no se
  editan ni se eliminan.

## 5. Backfill de semanas publicadas antes de `0.9.0`

La migracion `add_economy_inventory_equipment` genera, dentro de la propia
migracion (no en un comando manual olvidable), un movimiento
`WEEKLY_EARNING` por cada `PublishedParticipantWeeklyResult` ya existente:

- usa exclusivamente `totalKpiPoints` ya publicado, nunca recalcula KPI,
  bonus ni posiciones;
- aplica `max(0, floor(totalKpiPoints))`, incluido un movimiento de
  importe `0` cuando corresponde;
- es idempotente (`WHERE NOT EXISTS`, ademas del indice unico sobre
  `publishedResultId`): repetir la migracion nunca duplica movimientos;
- sincroniza el campo congelado `creditsEarned` de cada fila con el mismo
  calculo;
- inicializa `SplitEconomySettings` en `CLOSED` para todo split existente
  (`INSERT ... ON CONFLICT DO NOTHING`);
- no inventa efectos de objetos para semanas antiguas ni toca `Person`,
  `Split`, `SplitParticipant`, publicaciones, profesiones, localizaciones ni
  avatares.

Validado manualmente sobre una base `0.8.5` con publicaciones reales
(`248,04 -> 248`, `248,99 -> 248`, `0 -> 0`, `-12,50 -> 0`) y sobre una base
limpia.

## 6. Mercado del split

`SplitEconomySettings` (uno-a-uno con `Split`) guarda `marketStatus`
(`CLOSED` | `OPEN`). Todo split, nuevo o migrado, empieza `CLOSED`
(`economy.service.ts`).

- Solo `ADMIN` puede abrir o cerrar (`openMarket`/`closeMarket`, cada uno en
  su propia transaccion serializable).
- En `DRAFT` nunca puede abrirse (el administrador prepara ranuras y
  objetos primero). En `ACTIVE` puede abrirse y cerrarse las veces que haga
  falta. En `CLOSED` (el split, no el mercado) queda bloqueado por
  completo: ni abrir ni cerrar.
- Abrir exige (`collectMarketOpenIssues`, devuelve la lista completa de
  problemas, nunca se detiene en el primero): split `ACTIVE`; al menos una
  `SplitEquipmentSlot`; al menos un `SplitStoreItem` con `isForSale`; cada
  uno de esos objetos con su KPI activo en el split, su porcentaje dentro
  del conjunto cerrado y su precio positivo. Si falta algo, no se abre
  parcialmente ni se limpia nada en silencio.
- Abrir o cerrar nunca modifica inventarios, equipo ni objetos ya
  comprados. Cerrar bloquea nuevas compras, pero **no** impide equipar o
  desequipar objetos ya propiedad del participante mientras el split siga
  `ACTIVE`: sus bonus siguen aplicandose aunque el mercado este cerrado.
- La comprobacion existe siempre en servidor (`purchase.service.ts` vuelve
  a leer el estado dentro de su propia transaccion serializable, ver
  seccion 10): un boton deshabilitado o una peticion manipulada nunca
  compran con el mercado cerrado.
- Abrir o cerrar el mercado genera, dentro de la misma transaccion, una
  unica noticia por participante (nunca una por objeto) con el numero de
  objetos disponibles, y un unico aviso administrativo (`1.0.0` / MVP-3,
  ver `docs/NEWS_CENTER.md`). Un `OPEN -> OPEN` o `CLOSED -> CLOSED` (sin
  cambio real) no genera ninguna noticia.

## 7. Ranuras de equipo configurables

`SplitEquipmentSlot` (`src/server/services/equipment-slot.service.ts`): sin
numero ni nombres codificados. El administrador decide cuantas ranuras
existen y como se llaman.

- `id`, `splitId`, `name`, `nameNormalized` (unico por split, valido
  repetido en otro split), `displayOrder` (entero no negativo).
- Limite tecnico de `MAX_EQUIPMENT_SLOTS_PER_SPLIT = 12` (evita abuso
  accidental de la interfaz; no es un limite funcional de tres ni de
  ningun otro numero).
- Solo se crean, renombran, reordenan o eliminan mientras el mercado esta
  **cerrado** y el split no esta `CLOSED`.
- No se elimina una ranura con objetos del catalogo asociados, con equipo
  actual o con referencias historicas (`PublishedEquippedItem`): hay que
  retirar o reasignar los objetos legales primero. Nunca se desequipa a
  nadie ni se borra inventario en silencio.
- Renombrar cambia el nombre vivo hacia el futuro; las publicaciones
  anteriores conservan el nombre congelado (`equipmentSlotNameSnapshot`).
  Anadir una ranura nueva tras publicaciones anteriores es valido con el
  mercado cerrado: queda vacia hasta que existan objetos para ella.

## 8. Catalogo de objetos

`SplitStoreItem` (`src/server/services/store-item.service.ts`): sin
catalogo global ni objetos predeterminados.

- `id`, `splitId`, `name`, `nameNormalized` (unico por split), `description`
  opcional, `priceCredits` (entero positivo), `equipmentSlotId` (misma
  split), `kpiCode` (debe estar activo en el split al crear/editar),
  `bonusPercent` (10/20/30/40/50, `EQUIPMENT_BONUS_PERCENTS`, ver seccion
  9), `isForSale`.
- Cada objeto afecta exactamente a un KPI y pertenece a una unica ranura.
  No hay stock limitado: cualquier participante que cumpla las condiciones
  puede comprarlo, pero como maximo una unidad de cada objeto
  (`@@unique([splitParticipantId, storeItemId])` tanto en `ItemPurchase`
  como en `SplitParticipantItem`).
- Solo se administra con el mercado **cerrado**. Antes de la primera
  compra, el administrador puede editar cualquier campo o eliminarlo.
  **Despues de la primera compra:** no puede eliminarse; no pueden
  cambiarse ranura, KPI, porcentaje, nombre ni descripcion; el precio no
  se modifica retroactivamente para una compra ya realizada. Puede
  retirarse de nuevas compras (`isForSale = false`): quien ya lo posee lo
  conserva y sigue equipandolo. Una variante distinta se crea como un
  objeto nuevo.
- `updateKpiConfig` (`src/server/services/kpi.service.ts`) rechaza
  desactivar un KPI usado por un objeto a la venta, comprado o equipado
  (`findStoreItemsUsingKpi`), identificando los objetos afectados en el
  mensaje: nunca se desactivan objetos ni se desequipa a nadie en
  silencio.

## 9. Porcentaje de bonus compartido con localizaciones

`src/domain/bonus-percent.ts` centraliza el conjunto cerrado
`ALLOWED_BONUS_PERCENTS = [10, 20, 30, 40, 50]`. `LOCATION_BONUS_PERCENTS`
(`src/domain/location-bonus.ts`) y `EQUIPMENT_BONUS_PERCENTS`
(`src/domain/equipment-bonus.ts`) reexportan esa misma lista: una unica
fuente de verdad para validacion y selectores, sin acoplar las dos
entidades entre si (cada una conserva su propia funcion de bonus y su
propia restriccion de base de datos).

## 10. Compra atomica

`purchaseStoreItem` (`src/server/services/purchase.service.ts`), dentro de
una unica transaccion serializable:

1. vuelve a leer participante, split, mercado, objeto, propiedad previa y
   el libro de movimientos (nunca confia en un estado calculado antes de
   entrar);
2. exige sesion de participante (o administrador consultando su propia
   ficha vinculada) sobre su propia participacion, split `ACTIVE`, mercado
   `OPEN`, objeto del mismo split y a la venta, sin poseerlo ya, y saldo
   suficiente;
3. crea `ItemPurchase` con snapshots de nombre, precio, ranura, KPI y
   bonus; crea `SplitParticipantItem` (inventario); crea el movimiento
   `PURCHASE` con importe negativo.

Nunca se acepta precio, bonus, saldo o importe de debito enviados por el
navegador. Un doble clic o dos compras concurrentes no duplican el objeto
ni gastan el mismo saldo dos veces: la restriccion unica y el fallo de
serializacion se traducen en un `DomainError` legible, nunca en un estado
parcial.

La misma transaccion crea, ademas, la noticia de compra (`1.0.0` / MVP-3,
categoria `PURCHASE`) con el nombre del objeto, el precio exacto y el
saldo posterior; si la compra falla, no existe ni compra, ni debito, ni
noticia (ver `docs/NEWS_CENTER.md`).

## 11. Inventario permanente

`SplitParticipantItem` + `ItemPurchase` (`src/server/services/inventory.service.ts`):
una compra confirmada es permanente. Sin reventa, devolucion, regalo,
intercambio ni destruccion en esta release. Retirar un objeto del mercado
no lo elimina del inventario; cerrar el mercado no afecta a los objetos
poseidos. El inventario de un split no aparece en otro, y un participante
solo consulta el suyo (`assertOwnParticipation`).

## 12. Equipo actual del personaje

`SplitParticipantEquippedItem` (`src/server/services/equipment.service.ts`):
como mucho un objeto equipado por ranura y participante
(`@@id([splitParticipantId, equipmentSlotId])`), y el mismo objeto nunca
equipado dos veces (`ownedItemId` unico). El objeto debe pertenecer al
inventario del participante y corresponde siempre a su propia ranura:
`equipOwnedItem` resuelve la ranura a partir del objeto, nunca acepta una
ranura arbitraria del cliente.

- Mientras el split este `ACTIVE`, el participante puede equipar, sustituir
  o desequipar cualquier objeto que ya posea, sin que el mercado tenga que
  estar abierto.
- En `DRAFT` el participante todavia no compra ni equipa; en `CLOSED` el
  equipo queda de solo lectura.
- La accion tiene efecto inmediato sobre la previsualizacion de cualquier
  semana todavia no publicada; no existe un equipo de "la proxima semana"
  separado del actual, ni una fecha limite semanal de equipamiento.

**El instante que cuenta:** la verdad definitiva es el equipo que el
participante tiene puesto en el momento exacto en que el administrador
pulsa "Publicar semana". Si lo equipa despues de publicar, esa semana ya
publicada no cambia; si lo desequipa antes de publicar, no cuenta para
ella. `equippedAt` nunca se usa para reconstruir retroactivamente que
llevaba durante los dias de la semana.

## 13. Concurrencia entre equipamiento y publicacion

`computeWeeklyResults` (`src/server/services/weekly-results.service.ts`)
acepta ahora `PrismaClient | Prisma.TransactionClient`. `publishWeek`
(`src/server/services/publish-week.service.ts`) abre su transaccion
serializable y, **dentro de ella**, invoca `computeWeeklyResults` con `tx`:
el equipo de cada participante (`loadEquippedItemsForParticipants`) se
relee en ese mismo instante, nunca fuera de la transaccion ni a partir de
una previsualizacion previa. Una carrera entre equipar/desequipar y
publicar siempre produce el equipo anterior completo o el posterior
completo, nunca una mezcla parcial.

## 14. Bonus de objetos: composicion no encadenada

Tercera fuente de bonus, junto a profesion y localizacion. Orden exacto del
calculo (`src/domain/equipment-bonus.ts`, invocada desde
`weekly-results.service.ts`):

```text
1. Formula original del KPI.
2. Maximo base -> baseFinalPoints.
3. Bonus de profesion sobre baseFinalPoints, si corresponde.
4. Bonus de localizacion sobre el mismo baseFinalPoints, si corresponde.
5. Bonus de cada objeto equipado sobre el mismo baseFinalPoints, si corresponde.
6. finalPoints = baseFinalPoints + professionBonusPoints + locationBonusPoints + equipmentBonusPoints.
```

Ningun bonus se calcula sobre el resultado de otro. Varios objetos que
afecten al mismo KPI se acumulan de forma **aditiva** siempre que ocupen
ranuras distintas:

| Caso | Tras maximo | Profesion | Localizacion | Objetos | Final |
|---|---:|---:|---:|---:|---:|
| Solo un objeto `+10 %` | 70 | 0 | 0 | 7 | 77 |
| Profesion `20 %` + localizacion `30 %` + objeto `10 %`, mismo KPI | 70 | 14 | 21 | 7 | **112** |
| Dos objetos `10 %` y `20 %`, mismo KPI, ranuras distintas | 70 | 0 | 0 | 21 | 91 |

`70 x 1,20 x 1,30 x 1,10` (`120,12`) nunca es el resultado correcto. Un
objeto no aplica cuando: no pertenece al participante; no esta equipado en
una semana aplicable; su KPI no coincide o esta inactivo; el resultado no
es `COMPUTED` o no es estrictamente positivo (`VAC`/`AVISO`, `No aplica`,
cero y negativos nunca reciben bonus, igual que profesion y localizacion).
Que el objeto ya no este a la venta o que el mercado este cerrado **no**
desactiva su efecto si el jugador lo posee y lo tiene equipado.

`applicableMaxPoints` sigue sumando maximos base sin inflar: el porcentaje
visual puede superar ampliamente el `100 %`. Todo el calculo usa
`Prisma.Decimal`, sin redondeo prematuro; solo la conversion final a
creditos usa `floor`.

## 15. Publicacion: snapshots e instantaneas

`publishWeek`, dentro de su transaccion serializable:

1. recalcula todo (incluido el equipo, ver seccion 13);
2. crea `WeekPublication`, `PublishedParticipantWeeklyResult` (con
   `creditsEarned` congelado) y `PublishedKpiResult` (con
   `equipmentBonusPoints`/`equipmentApplied`, ademas de los ya existentes
   de profesion y localizacion);
3. crea una fila `PublishedEquippedItem` por objeto equipado en ese
   instante (independientemente de si su KPI produjo bonus esa semana),
   con nombre, ranura, KPI y porcentaje congelados
   (`itemNameSnapshot`/`equipmentSlotNameSnapshot`/`kpiCodeSnapshot`/`bonusPercentSnapshot`)
   y referencias vivas opcionales (`storeItemId`/`equipmentSlotId`,
   `onDelete: SetNull`, nunca fuente de verdad);
4. crea el movimiento `WEEKLY_EARNING` vinculado de forma unica a ese
   resultado.

Si cualquier paso falla, no queda publicacion, snapshot ni credito
parcial (transaccion unica). El detalle por objeto de una semana publicada
se obtiene siempre de `PublishedEquippedItem` (filtrado por
`kpiCodeSnapshot` para asociarlo a un KPI concreto), nunca de un JSON
opaco. Publicaciones anteriores a `0.9.0` no tienen `PublishedEquippedItem`
y se muestran sin objetos, con `equipmentApplied: false` y
`equipmentBonusPoints: 0`; sus creditos llegan por el backfill (seccion 5).
Cambiar el catalogo o el equipo actual nunca altera un resultado ya
publicado.

## 16. Configuracion privada del personaje

`/fichas/[splitParticipantId]` (`src/server/services/character-config.service.ts`),
enlazada desde un boton `Configurar personaje` junto a `Ver resultados` en
cada tarjeta de `/fichas`, al mismo nivel visual. Resuelve siempre la
participacion desde `session.user.personId`: nunca acepta un `personId` ni
un `splitParticipantId` ajeno (comprobado en el servicio, no solo en la
interfaz). Un `ADMIN` vinculado a una persona solo usa su propia
participacion en esta ruta; la auditoria general de inventarios se hace
desde el split (`/splits/[id]/economia`), nunca simulando la sesion de
otro jugador.

Secciones (por bloques en la misma pagina, no es obligatorio usar
pestañas):

- **Resumen:** avatar, alias, split y su estado, nivel, faccion, profesion
  y sus dos KPI, moneda actual (`getParticipantBalance`), total oficial de
  puntos KPI publicados, total de puntos de posicion, numero de semanas
  publicadas, localizacion activa y enlace a resultados.
- **Equipo:** todas las ranuras del split en su orden, con el objeto
  equipado (o "Ranura vacia"), un selector con los objetos del inventario
  compatibles con esa ranura, y la accion de equipar/sustituir/desequipar.
  Mensaje explicito de que el equipo que cuenta es el existente al
  publicar la semana.
- **Inventario:** objetos comprados, con fecha y precio de compra, KPI y
  bonus, e indicador `Equipado`; sin botones de vender, regalar ni
  destruir.
- **Mercado:** estado abierto/cerrado, saldo, catalogo con precio, ranura,
  KPI y bonus, y un estado por objeto (`Ya lo tienes`, `Saldo
  insuficiente`, `Disponible`, `Mercado cerrado`), con compra confirmada.
  Con el mercado cerrado, el catalogo se muestra en modo de solo lectura.
- **Historial:** movimientos de creditos (mas reciente primero) y
  localizaciones por semana del split (snapshot publicado cuando la semana
  ya esta publicada, configuracion viva en caso contrario).

Un participante solo ve y gestiona su propio personaje: no puede indicar
otro participante, modificar precio/bonus/ranuras/mercado, regalar
creditos u objetos, cambiar movimientos, comprar con saldo de otro split ni
equipar un objeto que no posee. Las operaciones de autoservicio (comprar,
equipar, desequipar) son acciones de servidor separadas y minimas
(`src/server/actions/purchase.actions.ts`,
`src/server/actions/equipment.actions.ts`), siguiendo el mismo patron que
alias/profesion/avatar (`profile.actions.ts`).

## 17. Administracion dentro del split

Entrada `Economia y mercado` en el indice lateral de `/splits/[id]`, con un
resumen compacto (badge de estado, contadores) y enlace a
`/splits/[id]/economia` para la vista detallada: badge visible, boton de
abrir/cerrar con confirmacion explicita, configuracion de ranuras,
catalogo de objetos y resumen de compras/creditos por participante
(`listEconomySummaryForSplit`). Cada Server Action administrativa repite
`requireAdminSession()`, y las de participante resuelven siempre el
`personId` desde la sesion (`0.9.0` sigue el mismo patron de seguridad ya
usado por profesiones y localizaciones, ver `docs/AUTHENTICATION.md`).

## 18. Vista "Con/Sin gamificacion" en Resultados

Control de dos estados en `/resultados` (`src/app/resultados/GamificationToggle.tsx`),
predeterminado `Con gamificacion`, persistido en la URL
(`?gamificacion=con|sin`, `src/domain/gamification-view.ts`) y conservado
al cambiar de persona, split, pestaña, año, agrupacion o filtros (cada
selector/formulario existente propaga el parametro mediante un input
oculto o un enlace que preserva el resto de la URL).

- **Con gamificacion** (oficial): `finalPoints` con profesion +
  localizacion + objetos ya incluidos; rankings, puntos por posicion,
  facciones y creditos oficiales.
- **Sin gamificacion**: el rendimiento KPI real, `basePointsBeforeProfession`
  (resultado tras el maximo base, antes de cualquier bonus de juego), con
  fallback a `finalPoints` en publicaciones anteriores a `0.8.0` (donde
  ese campo es `null` porque entonces no existia ningun bonus).
  `resolveGamificationDisplayPoints`/`resolveGamificationDisplayTotal`
  (`src/domain/gamification-view.ts`) son las unicas funciones que deciden
  esta conversion, tanto por celda de KPI como para sumas y medias
  agregadas (por split e historico general). `VAC` sigue en `0` y `No
  aplica` sigue diferenciado en ambos modos.
- El selector es puramente analitico: nunca reescribe publicaciones,
  bonus, creditos, inventario, ranking oficial ni clasificacion de
  facciones. Esos datos se muestran siempre etiquetados como oficiales
  (`Clasificacion oficial calculada con gamificacion`).
- `Impacto de gamificacion` (`computeGamificationImpact`) se muestra como
  dato secundario cuando aporta informacion: coincide siempre con la suma
  de los tres bonus publicados.
- La previsualizacion administrativa de una semana (`/splits/[id]/weeks/[weekId]/resultados`)
  mantiene su desglose completo oficial sin este selector: es exclusivo de
  la pantalla `Resultados` de las personas.

## 19. Restricciones de base de datos

Ademas de las ya citadas: una `SplitEconomySettings` por split (clave
primaria = `splitId`); nombre normalizado de ranura y de objeto unicos por
split; precio entero positivo; porcentaje de objeto dentro del conjunto
cerrado; inventario unico por participante y objeto; equipo unico por
participante y ranura (mas `ownedItemId` unico); una compra asociada a un
unico objeto poseido; un movimiento de credito por resultado semanal
publicado; un movimiento de debito por compra; `onDelete: Restrict` para no
borrar objetos, ranuras, compras o resultados con historia; `Cascade` solo
donde el agregado completo sigue siendo eliminable sin destruir historia
(por ejemplo, `SplitEconomySettings` con el split).

## 20. Rendimiento

- `loadEquippedItemsForParticipants` carga el equipo de todos los
  participantes aplicables en una sola consulta (nunca una por KPI ni por
  participante).
- Los bytes de avatar nunca se cargan en las consultas de economia.
- El resumen de mercado (`listEconomySummaryForSplit`) usa dos consultas
  acotadas para todo el split, nunca una por participante.

## 21. Fuera de alcance de esta entrega

Dinero real o pasarelas de pago; transferencias de creditos entre personas
o splits; economia o inventario compartido por faccion; regalos; reventa,
devolucion o destruccion de objetos; stock limitado; subastas o mercado
entre jugadores; cofres, loot o compras aleatorias; consumibles de un solo
uso; cartas, hechizos o misiones; objetos con mas de un KPI; efectos
negativos; formulas libres; porcentajes fuera de `10/20/30/40/50`; objetos
por nivel o profesion; una fecha semanal de bloqueo del equipo distinta de
la publicacion; equipamiento retroactivo; clasificacion alternativa
oficial sin gamificacion; creditos alternativos al cambiar el selector de
resultados; edicion manual de saldo por administrador; imagenes subidas
para objetos; PDF, correo, Teams o Power BI; motor generico de plugins o
reglas.

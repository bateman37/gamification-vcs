# CLAUDE.md

Instrucciones permanentes para cualquier sesion futura de Claude Code que
trabaje en este repositorio.

## Lectura obligatoria antes de tocar nada

Antes de proponer o realizar cualquier cambio, lee en este orden:

1. `README.md`
2. `docs/PROJECT_CONTEXT.md`
3. `docs/ROADMAP.md`
4. `docs/DATA_MODEL.md`
5. `CHANGELOG.md`

Ademas, revisa `docs/DECISIONS.md` para no contradecir decisiones ya
tomadas sin justificarlo explicitamente, y `docs/DISCOVERY-1-SPLIT-8.md`,
`docs/KPI_CONFIGURATION.md`, `docs/IMPORT_PRODUCTIVITY.md`,
`docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md`, `docs/MANUAL_KPI_ENTRY.md` y
`docs/POSITION_POINTS_CONFIGURATION.md` si vas a trabajar en KPI, cargas de
datos, motor de calculo o en la configuracion de puntos por posicion, y
`docs/FACTIONS.md` y `docs/PROFESSIONS_AND_PROFILES.md` si vas a trabajar en
facciones, profesiones, bonus de KPI, fichas de participante o avatares, y
`docs/WEEKLY_LOCATIONS.md` si vas a trabajar en localizaciones semanales o
en la composicion de sus bonus con la profesion, y
`docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md` si vas a trabajar en economia de
creditos, mercado, ranuras de equipo, catalogo de objetos, inventario,
equipo, el selector con/sin gamificacion o su composicion con profesion y
localizacion, y `docs/NEWS_CENTER.md` si vas a trabajar en noticias
(automaticas o envio manual), la campana, la bandeja `/noticias` o
cualquier enlace interno de una noticia, `docs/DESIGN_SYSTEM.md` si vas
a tocar tokens de color, tipografia, el app shell, la navegacion o
cualquier componente de `src/components/ui.tsx`, y
`docs/UX_AND_RESULTS_PRESENTATION_1_0_1.md` si vas a trabajar en la barra
lateral, el orden de navegacion, el submenu del detalle del split, el
historico general, las fichas, el guardado (individual o conjunto) de KPI,
el formulario de alta de participante o la presentacion de resultados.

## Estado real de las cargas semanales (no romper sin justificarlo)

A fecha de `MVP-1C.3 / INPUT-1C`, los diez KPI de Split 8 tienen ya
introduccion de datos funcional: cuatro origenes de carga por Excel
(Productividad, Escalados, Calidad, Llamadas) y cinco entradas manuales
(Guardian de la Estabilidad, Cronomagia laboral, Redactor estrella,
Estudiante entusiasta, Aprendiz experto). Ver `docs/IMPORT_PRODUCTIVITY.md`,
`docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md` y `docs/MANUAL_KPI_ENTRY.md`.
Reglas ya asentadas que una sesion futura no debe deshacer sin registrar el
motivo en `docs/DECISIONS.md`:

- Una carga confirmada de Productividad, Calidad o Llamadas es siempre
  verde (`Cargado`), aunque falten participantes aplicables; la ausencia
  se expresa con `n VAC` (calculado al consultar, nunca persistido), no
  con amarillo. No reintroduzcas `Carga parcial` para estos tres grupos.
- El amarillo (`Carga parcial`) esta reservado exclusivamente para Domador
  de Escaladas, cuando existe exactamente uno de sus dos origenes
  (Excel de Escalados o Productividad de la misma semana).
- Domador de Escaladas se calcula uniendo `EscalationWeeklyRow` con
  `ProductivityWeeklyRow.updates` por `splitWeekId` + `splitParticipantId`
  al consultar; nunca dupliques `updates` en `EscalationWeeklyRow`, y
  nunca hagas que analizar o confirmar Escalados cree o modifique
  Productividad.
- **Cero implicito de Escalados (hotfix `MVP-1C.3 / INPUT-1C`):** la
  ausencia de fila de Escalados para un participante se interpreta como
  reasignaciones `0` solo cuando ya existe una carga de Escalados
  confirmada para la semana **y** el participante tiene Productividad; si
  no existe la carga, sigue siendo "Sin dato de Escalados". Nunca insertes
  una fila artificial en `EscalationWeeklyRow`: la inferencia pertenece
  solo al resultado calculado (`resolveEscalationTamerOutcome`). El
  `vacCount` de Domador solo cuenta a quien falta en **ambos** origenes a
  la vez (nunca uses una condicion "o").
- Cada origen de Excel (Productividad, Escalados, Calidad, Llamadas) tiene
  su propia ruta bajo `.../kpis/<origen>/{cargar,comprobar}`; cada KPI
  manual (Guardian de la Estabilidad, Cronomagia laboral, Redactor
  estrella, Estudiante entusiasta, Aprendiz experto) tiene su propia ruta
  bajo `.../kpis/<origen>/{introducir,comprobar}`. No reutilices la ruta de
  un origen para el boton de otro.
- El recorrido de bajo nivel de lectura de Excel
  (`src/server/services/shared/xlsx.ts`) y de emparejamiento por nombre
  real (`src/server/services/shared/matching.ts`) es un helper compartido,
  no un motor generico: cada origen sigue declarando sus propios
  encabezados, mensajes y reglas de persistencia en su propio lector y
  servicio. Lo mismo aplica a los helpers de entrada manual
  (`src/server/services/shared/manual-entries.ts`,
  `src/server/validation/manual-entry.ts`): cada KPI manual sigue
  declarando sus propios campos, validaciones y calculo.
- Los cinco KPI manuales se guardan de forma atomica (sustituyen por
  completo el conjunto anterior de esa semana dentro de una transaccion) y
  usan solo los estados `Pendiente`/`Cargado` (nunca `Carga parcial`).
  Ninguno muestra `VAC` de grupo; Cronomagia es la unica excepcion que
  muestra `VAC` por fila (`totalHours = 0`), sin que eso afecte al estado
  del grupo.
- La columna `KPI cargados` del calendario de semanas
  (`src/server/services/kpi-load-summary.service.ts`) se calcula siempre
  al consultar, con un numero acotado de consultas para todo el
  calendario. Nunca persistas un contador de KPI cargados en `SplitWeek`
  ni en ninguna otra tabla.
- **Vacio como cero (`BUGFIX-1 / UX-SPLIT-1`):** solo en Redactor
  estrella, Estudiante entusiasta y Aprendiz experto un campo vacio se
  interpreta y persiste como `0` (`parseNonNegativeNumberDefaultZero`,
  `src/server/validation/manual-entry.ts`). Guardian de la Estabilidad y
  Cronomagia laboral siguen exigiendo el campo (`parseRequiredNonNegativeNumber`).
  No amplies esta excepcion a otros KPI ni a otros formularios sin
  registrarlo en `docs/DECISIONS.md`.
- **Maximo de Aprendiz experto inclusivo:** un valor igual a `targetValue`
  es valido; solo se rechaza al superarlo. No cambies esa comparacion a
  exclusiva.
- **"Volver a introducir datos" usa navegacion HTML completa
  (`<a>`), nunca `next/link`,** en los cinco formularios manuales
  (`ManualEntrySuccessPanel.tsx`): una navegacion client-side a la misma
  ruta no reinicia `useFormState` y deja la pantalla de exito bloqueada.
  No reintroduzcas `next/link` en ese enlace concreto.
- **Puntos por posicion semanal (`SplitPositionPointRule`,
  `BUGFIX-1 / UX-SPLIT-1`) no es un KPI ni una clasificacion.** Es una
  configuracion aparte, con sus propias quince filas (`1..15`) por split y
  los valores predeterminados exactos de Split 8 (ver
  `docs/POSITION_POINTS_CONFIGURATION.md`). No la mezcles con
  `SplitKpiConfig`, no la cuentes como KPI cargado, y no implementes
  calculo de posiciones ni reparto de estos puntos hasta que le toque su
  turno en el roadmap (`MVP-1C`).

## Profesiones, bonus y fichas (`0.8.0` / MVP-2B, no romper sin justificarlo)

Reglas asentadas que una sesion futura no debe deshacer sin registrar el
motivo en `docs/DECISIONS.md` (detalle completo en
`docs/PROFESSIONS_AND_PROFILES.md`):

- Las profesiones son **opcionales por split**, con el mismo criterio que
  las facciones: un split sin ninguna profesion creada se comporta
  exactamente como en `0.7.0`. No crees profesiones predeterminadas, seeds
  ni catalogos globales.
- **No implementes las reglas historicas de profesiones del Split 8**
  (Mecanico, Arreglador, Mercenario, Cientifico, Piloto) que describe
  `docs/DISCOVERY-1-SPLIT-8.md`. El modelo vigente es el simplificado:
  nombre libre, dos KPI distintos del catalogo cerrado y un unico bonus
  fijo del `20 %`, igual para todas.
- El `+20 %` es una **unica constante tipada del dominio**
  (`PROFESSION_BONUS_PERCENT`, `src/domain/profession-bonus.ts`) y una
  **unica funcion pura** (`applyProfessionBonus`). No repartas `1.2`,
  `0.2` ni `20` por resolvers, servicios o componentes, y no hagas el
  porcentaje configurable.
- Orden del calculo: formula del KPI -> maximo base -> bonus. El maximo
  **nunca** se vuelve a aplicar despues del bonus (un resultado puede
  superar su maximo base hasta un 20 %), y `applicableMaxPoints` sigue
  sumando maximos base, no maximos inflados: el porcentaje mostrado puede
  superar el 100 %.
- El bonus no se aplica nunca a `VAC`/`AVISO`, `NOT_APPLICABLE`, cero ni
  negativos, ni a KPI ajenos a la profesion o inactivos. Todo el calculo
  usa `Prisma.Decimal` sin redondeo prematuro.
- La primera publicacion del split bloquea definiciones **y** asignaciones
  de profesion, para administrador y participante, sin accion de
  desbloqueo. El alias y el avatar **no** forman parte de ese bloqueo:
  siguen editables mientras el split no este `CLOSED`.
- Las vistas historicas explican una semana publicada **siempre** con su
  snapshot (`professionNameSnapshot`, `basePointsBeforeProfession`,
  `professionBonusPoints`...), nunca con la definicion actual de la
  profesion. No recalcules retroactivamente ninguna publicacion.
- `/fichas` resuelve la persona **siempre** desde `session.user.personId`.
  Nunca aceptes un `personId` del navegador, y no reutilices la accion
  administrativa de participante para el autoservicio: cada intencion
  (alias propio, profesion propia, avatar propio) tiene su propia
  operacion de entrada minima.
- El avatar vive en `SplitParticipantAvatar` (PostgreSQL, entidad
  uno-a-uno separada). Nunca lo guardes en `public/`, en disco ni como
  base64 en una columna de texto, no introduzcas un servicio externo de
  imagenes, y no selecciones `imageData` en ningun listado: solo al servir
  la imagen. El formato real se valida decodificando el contenido con
  `sharp`, nunca por extension o `File.type`.

## Localizaciones semanales (`0.8.5` / MVP-2C, no romper sin justificarlo)

Reglas asentadas que una sesion futura no debe deshacer sin registrar el
motivo en `docs/DECISIONS.md` (detalle completo en
`docs/WEEKLY_LOCATIONS.md`):

- Como mucho **una localizacion por `SplitWeek`**, opcional: una semana
  sin ella se comporta exactamente como en `0.8.0`. No crees un catalogo
  global de localizaciones ni una entidad reutilizable entre semanas.
- Editable (crear, editar, eliminar) **solo antes de `startDate`**
  (`resolveWeekLocationWindow`, `src/domain/location-window.ts`, funcion
  pura con la fecha inyectada). Bloqueada desde el primer dia de la
  semana, y siempre de solo lectura en una semana publicada, aunque por
  un error de fechas se intentara editar antes. No introduzcas ninguna
  restriccion por dia de la semana (el miercoles es la operativa
  habitual, no una regla tecnica).
- El bonus (`applyLocationBonus`, `src/domain/location-bonus.ts`) es
  **independiente y no encadenado** con el de profesion: ambos se
  calculan sobre el mismo `baseFinalPoints` y se suman una sola vez en
  `weekly-results.service.ts`. Nunca pases `professionOutcome.finalPoints`
  como base de la localizacion ni al reves; `70 + 20 % + 30 %` debe dar
  `105`, nunca `109,20`.
- El porcentaje solo puede ser `10`, `20`, `30`, `40` o `50`
  (`LOCATION_BONUS_PERCENTS`, unica lista tipada): no lo hagas libre ni
  amplies el conjunto sin que el usuario lo pida.
- El bonus no se aplica nunca a `VAC`/`AVISO`, `NOT_APPLICABLE`, cero ni
  negativos, ni a un KPI que no sea el de la localizacion o que este
  inactivo. `applicableMaxPoints` sigue sumando maximos base, sin
  inflarlos.
- No se puede desactivar un KPI usado por una localizacion **futura**
  (`findFutureLocationsUsingKpi`): el mensaje debe identificar la semana
  afectada, y la localizacion nunca se borra ni se cambia en silencio.
- La publicacion congela nombre, KPI y porcentaje **una sola vez por
  semana** en `WeekPublication` (no por participante, a diferencia de la
  profesion): nunca dupliques esos tres campos en cada
  `PublishedKpiResult`. Las vistas historicas explican una semana
  publicada siempre con ese snapshot, nunca con la configuracion viva.
- En `/fichas`, la tarjeta de localizacion activa se resuelve siempre
  desde `session.user.personId` y respeta las semanas inicial/final del
  participante; nunca la muestres para una semana futura, pasada, de otro
  split, o a alguien todavia no incorporado esa semana.

## Economia, inventario y equipo (`0.9.0` / MVP-2D, no romper sin justificarlo)

Reglas asentadas que una sesion futura no debe deshacer sin registrar el
motivo en `docs/DECISIONS.md` (detalle completo en
`docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md`):

- El monedero, el inventario y el equipo pertenecen a `SplitParticipant`,
  nunca a `Person`: no crees una economia global ni una tesoreria de
  faccion.
- `creditsEarned = max(0, floor(totalKpiPoints))`
  (`computeCreditsEarned`, `src/domain/credits.ts`), calculado solo al
  publicar; nunca redondees al entero mas proximo ni generes una deuda por
  un resultado negativo.
- `CreditLedgerEntry` es la **unica** fuente de verdad del saldo
  (`balance = suma de los movimientos`). No anadas un campo `balance`
  materializado sin explicacion; un `WEEKLY_EARNING` se genera exactamente
  una vez por `PublishedParticipantWeeklyResult` (indice unico sobre
  `publishedResultId`) y un `PURCHASE` exactamente una vez por
  `ItemPurchase`.
- Todo split, nuevo o migrado, empieza con el mercado `CERRADO`
  (`SplitEconomySettings`). Solo `ADMIN` lo abre o lo cierra; abrir exige
  split `ACTIVE`, al menos una `SplitEquipmentSlot` y al menos un
  `SplitStoreItem` a la venta con configuracion valida. Cerrar el mercado
  bloquea nuevas compras, pero **nunca** impide equipar o desequipar
  objetos ya propiedad del participante.
- El numero y el nombre de las ranuras de equipo los decide el
  administrador (`SplitEquipmentSlot`): no codifiques ranuras fijas
  (`Arma`/`Armadura`/`Accesorio` o cualquier otro nombre) ni un numero fijo
  de ranuras.
- Un objeto (`SplitStoreItem`) afecta exactamente a un KPI activo y
  pertenece a una unica ranura, con un bonus del conjunto cerrado
  `10/20/30/40/50 %` (`EQUIPMENT_BONUS_PERCENTS`,
  `src/domain/bonus-percent.ts`, misma lista tipada que las
  localizaciones). Ranuras y objetos solo se administran con el mercado
  **cerrado**; un objeto ya comprado por alguien queda inmutable en
  nombre, descripcion, ranura, KPI, porcentaje y precio, salvo retirarlo
  de la venta.
- Como maximo un objeto de cada tipo por participante
  (`@@unique([splitParticipantId, storeItemId])`) y como maximo un objeto
  equipado por ranura (`SplitParticipantEquippedItem`, clave primaria
  compuesta). Sin reventa, regalo, intercambio ni destruccion en esta
  release.
- El equipo que cuenta para una semana es siempre el existente en el
  instante exacto en que se pulsa "Publicar semana": `publishWeek` debe
  releer el equipo **dentro** de su propia transaccion serializable
  (`computeWeeklyResults` acepta `PrismaClient | Prisma.TransactionClient`
  precisamente por esto). No calcules el equipo fuera de esa transaccion
  ni confies en una previsualizacion anterior.
- El bonus de objetos (`applyEquipmentBonuses`,
  `src/domain/equipment-bonus.ts`) es una tercera capa **independiente y
  no encadenada** con profesion y localizacion: los tres actuan sobre el
  mismo `baseFinalPoints` y se suman una sola vez
  (`finalPoints = baseFinalPoints + professionBonusPoints + locationBonusPoints + equipmentBonusPoints`).
  A diferencia de profesion y localizacion, varios objetos sobre el mismo
  KPI se acumulan de forma **aditiva** si ocupan ranuras distintas: nunca
  multipliques factores entre si.
- La publicacion congela una fila `PublishedEquippedItem` por objeto
  equipado (nunca un JSON opaco con todo el equipo) y el desglose agregado
  en `PublishedKpiResult` (`equipmentBonusPoints`/`equipmentApplied`).
  `basePointsBeforeProfession` sigue siendo la unica base persistida para
  los tres bonus: no anadas una columna nueva equivalente.
- El selector `Con gamificacion`/`Sin gamificacion` de `/resultados`
  (`src/domain/gamification-view.ts`) es puramente analitico: nunca debe
  alterar clasificacion, puntos por posicion, facciones ni creditos
  oficiales. "Sin gamificacion" se deriva siempre de
  `basePointsBeforeProfession` (con fallback a `finalPoints` en
  publicaciones anteriores a `0.8.0`), nunca de un recalculo con la
  configuracion actual.

## Centro de noticias y renovacion visual (`1.0.0` / MVP-3, no romper sin justificarlo)

Reglas asentadas que una sesion futura no debe deshacer sin registrar el
motivo en `docs/DECISIONS.md` (detalle completo en
`docs/NEWS_CENTER.md` y `docs/DESIGN_SYSTEM.md`):

- `Noticias` (nombre visible; `NewsItem`/`NewsDelivery` en ingles en el
  codigo) es el punto de entrada autenticado: `/` redirige siempre a
  `/noticias`. No elimines los accesos directos existentes.
- Las noticias de jugador se entregan siempre a `Person`
  (`recipientPersonId`), nunca solo a `User`, para que lleguen aunque la
  cuenta todavia no exista. Las de administracion se entregan a
  `recipientUserId`. No mezcles ambas bandejas ni inventes un tercer tipo
  de destinatario.
- Un `NewsItem` es una instantanea de texto plano inmutable: nunca se
  edita, retira ni borra fisicamente desde la interfaz despues de
  enviarse. Una `NewsDelivery` solo cambia `readAt`/`archivedAt`.
- No existe backfill de noticias historicas y no debe anadirse: la
  bandeja registra eventos solo desde el despliegue de `1.0.0`.
- Cada evento automatico vive en el servicio de negocio que ya realiza esa
  operacion (alta de participante, activacion, facciones, profesiones,
  localizaciones, mercado, compra, publicacion), llamando a
  `createNewsWithDeliveries` (`src/server/services/news.service.ts`) con
  texto ya redactado (`src/domain/news-templates.ts`) y un
  `actionPath` construido solo por `src/domain/news-links.ts`. No crees un
  motor generico de eventos ni de plantillas.
- La noticia se escribe dentro de la misma transaccion que el hecho de
  negocio cuando ese hecho ya abre una. Los eventos repetibles (facciones,
  profesiones, localizaciones, mercado) usan un UUID de operacion generado
  una sola vez como parte del `eventKey`; los no repetibles usan un
  identificador estable. Nunca uses solo `updatedAt` como clave de
  idempotencia.
- Publicar una semana genera **una unica** noticia personalizada por
  participante (nunca una por dato) y, si hay administradores, los avisos
  administrativos correspondientes, todo dentro de la transaccion de
  `publishWeek`.
- El sistema visual "Prisma competitivo" es una identidad global unica:
  los colores fisicos viven solo en `src/app/globals.css`
  (`tailwind.config.ts` solo expone nombres semanticos). Los colores de
  facciones siguen siendo datos del split (chips, puntos, avatares) y
  nunca cambian la navegacion, el fondo general, los botones ni los
  formularios. No implementes modo oscuro, temas por split ni un editor de
  branding en esta release.
- `SubmitButton`/`Badge`/`ErrorMessage`/`SuccessMessage`/`EmptyState`/
  `FieldError` (`src/components/ui.tsx`) mantienen su firma anterior a
  proposito (los usan mas de setenta componentes): si necesitas un
  componente nuevo, anadelo junto a los existentes en vez de romper su API.

## UX y presentación de resultados (`1.0.1`, no romper sin justificarlo)

Reglas asentadas que una sesión futura no debe deshacer sin registrar el
motivo en `docs/DECISIONS.md` (detalle completo en
`docs/UX_AND_RESULTS_PRESENTATION_1_0_1.md`):

- La barra lateral de escritorio (`AppShell.tsx`) es `sticky` con `h-dvh`:
  nunca vuelvas a dejar que crezca con el contenido de la página. Solo la
  zona de enlaces centrales puede tener scroll propio en alturas/zoom
  extremos; el pie ("Mi cuenta"/"Cerrar sesión") siempre visible.
- `buildNavItems` (`src/components/nav-items.ts`) sigue siendo la única
  fuente del orden de navegación para escritorio y móvil: Noticias es
  siempre la primera opción del administrador.
- El historico general (`/resultados`) no vuelve a mostrar la media por
  KPI, la columna de media total ni "Semanas publicadas" con agrupación
  `Semana` (siempre coincidirían con la suma/serían `1`): esa decisión
  vive únicamente en `resolveHistoryDisplayConfig`
  (`src/domain/history-display.ts`), nunca repartida en el componente.
- La edición de alias, avatar y profesión vive **solo** en
  `/fichas/[splitParticipantId]`: no la dupliques de vuelta en el listado
  `/fichas`, que es un resumen con botones reales
  (`groupAndOrderProfileCards`, `src/domain/profile-order.ts`, decide su
  único orden).
- El guardado individual y el guardado conjunto de KPI comparten
  `applyKpiConfigUpdate` (`src/server/services/kpi.service.ts`) y
  `parseAllKpiConfigsFromFormData` (`src/server/validation/kpi.ts`): no
  dupliques el bloqueo de primera publicación ni las restricciones de
  localizaciones/objetos en un tercer lugar.
- "Presentar resultados" (`src/server/services/results-presentation.service.ts`)
  es una lectura pura sobre `computeSplitClassification`/
  `computeFactionClassification` y sobre la última `WeekPublication`:
  nunca le añadas persistencia de estado, cálculo propio de ranking, ni
  datos de un participante ajenos al DTO ya definido (nunca `fullName`,
  `email` ni `imageData`). `buildRevealGroups`
  (`src/domain/results-presentation-reveal.ts`) sigue siendo la única
  función que decide el orden de revelación.

## Reglas de trabajo

- **Comprueba el codigo real** antes de proponer cambios. La documentacion
  describe la intencion, pero el codigo y las migraciones de Prisma son la
  fuente de verdad sobre lo que existe hoy.
- **Trabaja por entregas pequenas.** No implementes de una vez varias
  entregas del roadmap. Cada entrega debe ser pequena, ejecutable y
  comprobable por separado.
- **No amplies el alcance** de una entrega sin una peticion explicita del
  usuario. Si detectas una ambiguedad menor, aplica la solucion mas
  sencilla compatible con lo ya construido y registrala en
  `docs/DECISIONS.md`. Si el bloqueo es sustancial (cambia el alcance o
  puede destruir datos), pregunta antes de continuar.
- **Manten sincronizados** en cada cambio: el esquema de Prisma, las
  migraciones versionadas, la documentacion (`docs/*.md`) y
  `CHANGELOG.md`. Un cambio de modelo o de reglas de negocio sin su
  migracion y su documentacion correspondiente no esta completo.
- **Registra las decisiones nuevas** en `docs/DECISIONS.md` y no
  contradigas decisiones existentes sin explicar por que.
- **Manten la aplicacion como un monolito web sencillo:** una unica
  aplicacion Next.js, una base de datos relacional, un unico repositorio y
  despliegue. No introduzcas microservicios, colas, cache distribuida ni
  un backend independiente.
- **No implementes funcionalidades futuras de forma preventiva.** Todo lo
  marcado como "pendiente" en `docs/ROADMAP.md` se construye cuando llegue
  su turno, no antes.
- **No uses datos personales reales** en seeds, fixtures, pruebas ni
  capturas de pantalla.
- **Ejecuta solo pruebas acotadas y relevantes** para la entrega en curso.
  No conviertas esto en una suite exhaustiva ni anadas pruebas de
  navegador de extremo a extremo salvo que se pida explicitamente.
- **No fusiones ramas ni Pull Requests** sin aprobacion explicita del
  usuario. Deja el trabajo listo en su rama y en su PR, y espera
  confirmacion.

## Convenciones del proyecto

- Idioma de la interfaz de usuario: castellano.
- Idioma del codigo (identificadores, comentarios tecnicos): ingles.
- Idioma de la documentacion de producto (`docs/`, changelog, decisiones):
  castellano.
- Las fechas de negocio (inicio de split, semanas) se tratan siempre como
  fechas de calendario en UTC (ver `src/lib/dates.ts`). Nunca uses horas
  locales para estos calculos.
- La logica de negocio vive en `src/server/services/*`, no en componentes
  de React ni directamente en acciones de servidor. Las acciones de
  servidor (`src/server/actions/*`) son una capa fina de validacion y
  adaptacion a formularios.

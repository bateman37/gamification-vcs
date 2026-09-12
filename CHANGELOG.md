# Changelog

Formato inspirado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).
La primera version publicada es `0.1.0`; `1.0.0` cierra la primera version
estable del producto (nucleo funcional y las cuatro capas de juego, mas
comunicacion y renovacion visual).

## [1.0.2] - Hotfix de ranuras de equipo, bonus de objetos y submenu de presentacion

Hotfix puntual sobre `1.0.1`. **Sin migracion de Prisma:** no cambia el
modelo de datos, ninguna formula de KPI (incluida `applyEquipmentBonuses`),
ningun bonus, el momento en que se congela el equipo al publicar, ni
ninguna regla de la presentacion en vivo ya existente. Los tres cambios son
de sincronizacion de estado en cliente, transporte/presentacion de un dato
ya calculado, y navegacion.

### Corregido

- **Ranuras de equipo invisibles tras crearlas** (`EquipmentSlotsPanel.tsx`,
  `/splits/[id]/economia`): el estado local usado para el reordenamiento
  optimista (`useState(slots)`) solo tomaba el valor inicial de las props
  en el primer render y nunca se resincronizaba tras un `revalidatePath`
  (crear, renombrar, eliminar o navegar). Ahora un efecto sincroniza ese
  estado con las props del servidor en cada cambio real; una ranura ya
  persistida pero invisible (por ejemplo, una "Arma" creada antes de este
  hotfix) aparece automaticamente, sin ningun paso manual. El campo del
  formulario de creacion tambien se limpia al guardar con exito, siguiendo
  el mismo patron ya usado en "Nueva persona".
- **Bonus de objetos ausente en la tabla administrativa de resultados
  semanales** (`WeeklyResultsTable.tsx`, `/splits/[id]/weeks/[weekId]/resultados`):
  el bonus de objetos (`equipmentBonusPoints`/`equipmentApplied`) ya se
  calculaba correctamente (previsualizacion) y ya se congelaba al publicar,
  pero el DTO de celda de esa tabla nunca lo transportaba, a diferencia del
  bonus de profesion y de localizacion. Ahora cada celda incluye ese dato,
  leido del calculo en vivo en una semana sin publicar y **siempre** de la
  instantanea congelada de `PublishedKpiResult` en una semana publicada
  (nunca recalculado a partir del equipo actual). Una celda con bonus de
  objetos muestra el badge ambar "Objetos: +N puntos", su borde y su
  desglose accesible se combinan correctamente con profesion y
  localizacion en cualquier subconjunto, y la leyenda de la tabla explica
  el nuevo badge. Una publicacion anterior a `0.9.0` sigue abriendo sin
  error y sin mostrar ningun badge. La vista individual (`/resultados`)
  no cambia: ya mostraba este bonus correctamente.
- **"Presentar resultados" ausente del submenu del detalle del split**: la
  funcionalidad de `1.0.1` existia y funcionaba, pero no tenia entrada en
  el submenu lateral (ni en su version movil "Secciones del split"). El
  tipo de item del submenu (`SplitDetailNavItem`) distingue ahora
  explicitamente enlaces de seccion (ancla de la misma pagina, con
  resaltado por `IntersectionObserver`) de enlaces de ruta real (navegan
  con `Link`, nunca alteran el hash ni participan en el resaltado por
  scroll). "Presentar resultados" aparece como enlace de ruta justo
  despues de "Calendario de semanas" y antes de "Clasificación general
  individual", en escritorio y en movil, para `ADMIN`, exista o no ya
  alguna semana publicada; su estado vacio ("Publica una semana para
  presentar sus resultados") no cambia.

## [1.0.1] - Hotfix de UX y presentacion de resultados

Hotfix de experiencia de usuario sobre `1.0.0`. Detalle completo en
`docs/UX_AND_RESULTS_PRESENTATION_1_0_1.md`. **Sin migracion de Prisma:**
no cambia el modelo de datos, ninguna formula de KPI, ningun bonus ni
ninguna regla de clasificacion; la media existente del historico general
no cambia de formula, solo se oculta donde era redundante y se rotula
mejor donde aporta informacion; "Presentar resultados" usa exclusivamente
datos ya publicados y no introduce ninguna clasificacion nueva ni ningun
cambio retroactivo.

### Corregido

- Barra lateral de escritorio: pasa de crecer con el contenido a ser
  `sticky` con `h-dvh` (alto exacto del viewport), con el pie ("Mi
  cuenta"/"Cerrar sesion") siempre visible; el menu movil aplica el mismo
  patron.
- Orden de navegacion del administrador: Noticias pasa a ser la primera
  opcion (antes quedaba al final).
- Auditoria ortografica de todo el texto visible (navegacion, titulos,
  botones, columnas de tabla, mensajes de exito/error, mensajes de
  validacion de servidor, plantillas de noticias automaticas), sin
  renombrar ninguna ruta, identificador, enum de Prisma ni clave de
  formulario.
- Formulario "Anadir participante": los campos se alinean en una franja
  horizontal de altura comun con el boton de accion en una columna
  exterior estable (antes quedaba bajo la nota de "Semana inicial");
  los textos de asterisco se trasladan a una franja de ayuda unica,
  asociada por campo mediante `aria-describedby`.

### Mejorado

- Historico general (`/resultados`): con agrupacion `Semana` se ocultan la
  media redundante por KPI, la columna de media total y "Semanas
  publicadas" (siempre coincidian con la suma/eran siempre `1`); con
  `Mes`/`Año` se mantienen, rotuladas "Media semanal"/"Media semanal total
  KPI", con una nota de ayuda accesible sobre el divisor.
- `/fichas`: rediseño completo en tarjetas horizontales agrupadas en
  Splits activos/Proximos/Finalizados (orden por fecha, puro y probado),
  con botones reales del sistema de diseño; la edicion de alias, avatar y
  profesion se centraliza en `/fichas/[splitParticipantId]`.
- Detalle del split: nuevo submenu lateral con seccion activa (por hash y
  por scroll) y version movil ("Secciones del split"), sustituyendo el
  indice de enlaces subrayados anterior.
- Configuracion de KPI del split: maquetacion panoramica por zonas
  estables y nuevo boton "Guardar todos los KPI" (atomico, valida los diez
  KPI antes de persistir cualquiera, comparte la misma logica que el
  guardado individual).

### Añadido

- **"Presentar resultados"**: nuevo modo de proyeccion a pantalla completa
  (`/splits/[id]/presentacion-resultados`, solo `ADMIN`) para revelar en
  vivo la clasificacion semanal individual, general individual, semanal de
  facciones y general de facciones de la ultima semana publicada de un
  split, mas un resumen final con la tabla completa. Reutiliza
  integramente `computeSplitClassification`/`computeFactionClassification`
  (sin reimplementar ningun ranking), agrupa la revelacion con una funcion
  pura y probada (`buildRevealGroups`), incluye controles manuales y
  automaticos, teclado, `aria-live` y una animacion sobria que
  `prefers-reduced-motion` ya reduce a instantanea. Es puramente de
  lectura: no persiste estado, no genera noticias, no modifica ninguna
  semana.

## [1.0.0] - MVP-3 — Centro de noticias y renovacion visual

### Anadido

- **Centro de noticias interno** (`NewsItem`/`NewsDelivery`,
  migracion `20260912143314_add_news_center`): bandeja privada
  `/noticias` para cualquier usuario autenticado (pestañas `Todas`/`No
  leídas`/`Archivadas`, filtro de split y categoria, paginacion por
  cursor de 20), campana global con contador (`99+`) y vista previa de
  las cinco mas recientes, acciones de leer/no leer/archivar/restaurar y
  "marcar todas como leidas".
- **Noticias automaticas** generadas desde los servicios de negocio reales
  dentro de la misma transaccion que el hecho que notifican: alta de
  participante, activacion de split, facciones (reasignada/renombrada),
  profesion elegida/cambiada, localizaciones (solo en split `ACTIVE`),
  mercado abierto/cerrado, compra completada y publicacion semanal (un
  unico resumen personalizado por participante, mas los avisos
  administrativos de "semana lista para revisar", "semana publicada" y
  "proxima localizacion pendiente"). Claves idempotentes que impiden
  duplicados por reintento o carrera; sin backfill historico.
- **Envio manual segmentado** (`/noticias/administrar`, solo `ADMIN`): todo
  el split, una faccion o una persona, con prioridad normal/importante,
  destino cerrado (sin enlace, Resultados, Ficha o Mercado), previsualizacion
  del numero de destinatarios, historico de envios (sin recibos
  individuales de lectura) y proteccion de doble envio por clave de
  idempotencia.
- **Sistema visual "Prisma competitivo"**: paleta y tipografia
  centralizadas en tokens semanticos (`tailwind.config.ts`,
  `src/app/globals.css`, tipografia `Inter` autoalojada), sistema de
  componentes ampliado (`src/components/ui.tsx`: `Button`/`LinkButton`/
  `IconButton` con variantes, `Card`/`StatCard`, `PageHeader`/
  `SectionHeader`, `Alert`, `TableContainer`, `Skeleton`...), app shell
  con barra lateral en escritorio y cabecera+menu en movil
  (`src/components/AppShell.tsx`), marca abstracta en SVG (`BrandMark.tsx`).
  Aplicado a toda la aplicacion existente sin alterar ninguna regla de
  negocio, ruta ni formula.
- El acceso raiz `/` redirige a `/noticias` para cualquier usuario
  autenticado.
- Dependencia nueva: `lucide-react` (iconografia estructural).

Detalle completo en `docs/NEWS_CENTER.md` y `docs/DESIGN_SYSTEM.md`.

## [0.9.0] - MVP-2D — Economia, inventario y equipo

### Anadido

- **Economia de creditos por split** (`CreditLedgerEntry`, libro de
  movimientos inmutable): `1 credito = 1 punto KPI completo publicado`
  (`creditsEarned = max(0, floor(totalKpiPoints))`,
  `src/domain/credits.ts`), generados exactamente una vez al publicar una
  semana (un unico movimiento `WEEKLY_EARNING` por
  `PublishedParticipantWeeklyResult`, protegido por indice unico). Backfill
  idempotente para toda semana publicada antes de esta version, usando
  exclusivamente su `totalKpiPoints` ya publicado.
- **Mercado administrable por split** (`SplitEconomySettings`): siempre
  `CERRADO` al crear o migrar un split; solo `ADMIN` lo abre (exige split
  `ACTIVE`, al menos una ranura y un objeto valido a la venta, con la lista
  completa de problemas si falta algo) o lo cierra, las veces que haga
  falta; cerrarlo bloquea compras pero no equipar objetos ya poseidos.
- **Ranuras de equipo configurables** (`SplitEquipmentSlot`, sin numero ni
  nombres codificados, limite tecnico de doce) y **catalogo de objetos**
  (`SplitStoreItem`, un unico KPI activo por objeto y un bonus del
  conjunto cerrado `10/20/30/40/50 %`, `EQUIPMENT_BONUS_PERCENTS`,
  reexportando la misma lista tipada que las localizaciones,
  `src/domain/bonus-percent.ts`). Solo se administran con el mercado
  cerrado; un objeto queda inmutable en nombre, descripcion, ranura, KPI,
  porcentaje y precio desde su primera compra, salvo retirarlo de la
  venta. `updateKpiConfig` rechaza desactivar un KPI usado por un objeto a
  la venta, comprado o equipado.
- **Compra atomica, inventario permanente y equipo actual**
  (`ItemPurchase`/`SplitParticipantItem`/`SplitParticipantEquippedItem`):
  transaccion serializable que vuelve a leer mercado, objeto, propiedad
  previa y saldo; nunca acepta precio, bonus o saldo del navegador; un
  doble clic o dos compras concurrentes no duplican el objeto ni gastan el
  mismo saldo dos veces. Como maximo un objeto de cada tipo por
  participante y un objeto equipado por ranura; sin reventa, regalo,
  intercambio ni destruccion.
- **Tercer bonus de resultados, independiente y no encadenado**
  (`applyEquipmentBonuses`, `src/domain/equipment-bonus.ts`): calculado
  sobre el mismo `baseFinalPoints` que profesion y localizacion; varios
  objetos sobre el mismo KPI se acumulan de forma aditiva
  (`70 + 20 % profesion + 30 % localizacion + 10 % objeto = 112`, nunca un
  producto de factores).
- **`computeWeeklyResults` acepta `Prisma.TransactionClient`**: `publishWeek`
  lo invoca dentro de su propia transaccion serializable para releer el
  equipo de cada participante en el instante exacto de publicar (nunca una
  previsualizacion anterior), evitando una instantanea hibrida ante una
  carrera con equipar/desequipar.
- **Instantanea publicada ampliada:** `PublishedEquippedItem` congela una
  fila por objeto equipado (nombre, ranura, KPI, porcentaje), y
  `PublishedKpiResult` anade `equipmentBonusPoints`/`equipmentApplied`;
  `PublishedParticipantWeeklyResult` anade `creditsEarned`. Las
  publicaciones anteriores a esta version se siguen leyendo sin
  `PublishedEquippedItem` y con estos campos en `null`/`false`/`0`, sin
  recalculo retroactivo.
- **Configuracion privada del personaje** (`/fichas/[splitParticipantId]`,
  boton `Configurar personaje` junto a `Ver resultados` en `/fichas`,
  resuelta siempre desde `session.user.personId`): Resumen, Equipo (con
  selector de objetos del inventario compatibles por ranura),
  Inventario, Mercado (con estado `Ya lo tienes`/`Saldo
  insuficiente`/`Disponible`/`Mercado cerrado` por objeto) e Historial
  (movimientos de creditos y localizaciones por semana).
- **Administracion "Economia y mercado"** en `/splits/[id]`: resumen
  compacto con enlace a `/splits/[id]/economia` (badge de estado, boton de
  abrir/cerrar con confirmacion, ranuras, catalogo y resumen de compras y
  creditos por participante).
- **Selector `Con gamificacion` / `Sin gamificacion`** en `/resultados`
  (`src/domain/gamification-view.ts`), persistido en la URL
  (`?gamificacion=con|sin`, predeterminado `con`) y conservado al cambiar
  de persona, split, pestaña, año, agrupacion o filtros. "Sin
  gamificacion" usa `basePointsBeforeProfession` (con fallback a
  `finalPoints` en publicaciones anteriores a `0.8.0`) para KPI, sumas y
  medias; nunca altera clasificacion, puntos por posicion, facciones ni
  creditos oficiales, que se muestran siempre etiquetados como tales, con
  un indicador de impacto de gamificacion cuando aporta informacion.
- **76 pruebas Vitest nuevas** cubriendo economia y backfill, mercado,
  ranuras y objetos, compra e inventario, equipamiento, composicion de
  bonus y publicacion/snapshots (357/357 en total).

## [0.8.5] - MVP-2C — Localizaciones semanales

### Anadido

- **Localizaciones semanales configurables (`SplitWeekLocation`):**
  opcionales, cero o una por `SplitWeek`, con nombre, un unico KPI
  potenciado (debe estar activo en el split) y un porcentaje de bonus
  cerrado (`10`/`20`/`30`/`40`/`50 %`, `LOCATION_BONUS_PERCENTS`,
  `src/domain/location-bonus.ts`). Sin catalogo global ni entidad
  reutilizable entre semanas; el mismo nombre puede repetirse en semanas
  o splits distintos.
- **Ventana temporal editable solo antes de `startDate`**
  (`resolveWeekLocationWindow`, funcion pura que recibe siempre la fecha
  actual como argumento, `src/domain/location-window.ts`): bloqueada
  desde el primer dia de la semana, y siempre de solo lectura en una
  semana publicada o en un split `CLOSED`. El miercoles es la operativa
  habitual esperada, nunca una restriccion tecnica por dia de la semana.
  `findNextWeek` identifica la proxima semana sin localizacion como
  accion principal del calendario administrativo.
- **Bloqueo de consistencia con la configuracion de KPI:** no se puede
  desactivar un KPI usado por una localizacion futura
  (`findFutureLocationsUsingKpi`); el mensaje identifica la semana
  afectada y la localizacion nunca se borra ni se cambia en silencio.
- **Bonus independiente y no encadenado con la profesion**
  (`applyLocationBonus`, `src/domain/location-bonus.ts`): ambos se
  calculan sobre el mismo `baseFinalPoints` tras el maximo base y se
  suman una sola vez en `weekly-results.service.ts`
  (`70 + 20 % + 30 % = 105`, nunca `109,20`). No depende del nivel
  tecnico, la faccion ni la profesion; nunca se aplica a `VAC`/`AVISO`,
  `No aplica`, cero ni negativos. `applicableMaxPoints` sigue sumando
  maximos base, sin inflarlos (hasta `170 %` visual con ambos bonus).
- **Instantanea publicada ampliada:** localizacion de la semana congelada
  una sola vez en `WeekPublication` (`locationId`,
  `locationNameSnapshot`, `locationKpiCodeSnapshot`,
  `locationBonusPercentSnapshot`, porque es unica y comun a toda la
  semana) y desglose del bonus por KPI en `PublishedKpiResult`
  (`locationBonusPoints`, `locationApplied`). Las publicaciones
  anteriores a esta version se siguen leyendo sin errores, con estos
  campos `null`/`false`, sin recalculo retroactivo.
- **Administracion:** columna `Localizacion` en el calendario de semanas
  de `/splits/[id]`, ruta dedicada
  `/splits/[id]/weeks/[weekId]/localizacion` con formulario (nombre, KPI
  activo, bonus y resumen antes de guardar) y opcion de eliminar mientras
  sea editable, y tarjeta con estado
  (`Proxima`/`Activa`/`Finalizada`/`Publicada`) en la pantalla semanal de
  KPI.
- **Previsualizacion y publicacion:** tarjeta superior con la
  localizacion de la semana, indicador y borde distintivo en la celda del
  KPI afectado (combinado con el de profesion cuando coinciden en el
  mismo KPI) y desglose completo en la ayuda accesible de la celda.
- **Fichas y resultados:** tarjeta `Localizacion activa esta semana` en
  `/fichas` (solo lectura, resuelta siempre desde
  `session.user.personId`, sin N+1 por ficha), desglose en
  `/resultados > Por split` y agregado `+N localizacion` en
  `/resultados > Historico general`, sumando exclusivamente los
  `locationBonusPoints` publicados.
- **Minicorreccion:** la nota del asterisco de `Semana inicial *` en
  `Añadir participante` (`AddParticipantForm.tsx`) se muestra siempre,
  con `Persona existente` y con `Nueva persona`, en vez de solo cuando el
  split estaba `ACTIVE`.

### Documentacion

- Nuevo `docs/WEEKLY_LOCATIONS.md` con el detalle funcional completo.
- Actualizados `docs/DATA_MODEL.md`, `docs/RESULTS_PUBLICATION.md`,
  `docs/PROFESSIONS_AND_PROFILES.md`, `docs/AUTHENTICATION.md`,
  `docs/ROADMAP.md`, `docs/DECISIONS.md`, `README.md` y `CLAUDE.md`.

## [0.8.0] - MVP-2B — Profesiones, bonus de KPI y fichas de participante

### Anadido

- **Profesiones configurables por split (`SplitProfession`):** opcionales
  igual que las facciones (un split sin ninguna profesion creada se
  comporta exactamente como en `0.7.0`, sin selectores ni bonus). Cada
  profesion tiene nombre unico normalizado dentro del split, exactamente
  dos KPI **distintos** del catalogo cerrado y disponibilidad por nivel
  `N0`/`N1`/`N2`, con administracion completa en el detalle del split. No
  se implementan las reglas historicas de Mecanico, Arreglador, Mercenario,
  Cientifico ni Piloto del antiguo Split 8 (ver `docs/DECISIONS.md`).
- **Bonus fijo del `+20 %` despues del maximo base**, en una unica funcion
  pura del dominio (`applyProfessionBonus`,
  `src/domain/profession-bonus.ts`), con el porcentaje como constante
  tipada e ineditable. Se aplica solo a resultados `COMPUTED`
  estrictamente positivos de los dos KPI de la profesion, con
  `Prisma.Decimal` y sin redondeo prematuro; el maximo **no** se vuelve a
  aplicar despues, asi que un resultado puede superar su maximo base hasta
  un 20 % (`70 -> 84`). Nunca se aplica a `VAC`/`AVISO`, `No aplica`, cero
  ni negativos, ni a KPI ajenos a la profesion o inactivos.
- **Asignacion y bloqueo:** el administrador asigna la profesion al anadir
  o editar un participante (`Profesión (opcional hasta publicar)`, filtrada
  por nivel, con badge `Sin elegir` en la tabla) y el propio participante
  puede elegirla desde su ficha. Desde la primera publicacion del split,
  definiciones y asignaciones quedan bloqueadas para ambos, un cambio de
  nivel incompatible con la profesion congelada se rechaza sin borrarla, y
  un alta posterior exige profesion en el propio formulario.
- **Instantanea publicada ampliada:** profesion congelada por participante
  (`professionId`, `professionNameSnapshot`, sus dos KPI,
  `professionBonusPercent` y `splitUsedProfessions`) y desglose del bonus
  por KPI (`basePointsBeforeProfession`, `professionBonusPoints`,
  `professionApplied`, `professionNameSnapshot`).
- **Fichas privadas (`/fichas`)**, junto a `Resultados` en la navegacion
  superior: una ficha por participacion de split con avatar, alias
  editable, profesion, y nivel y faccion de solo lectura, ordenadas
  `ACTIVE` / `DRAFT` / `CLOSED`. La persona se resuelve **siempre** desde
  `session.user.personId`; las operaciones son de autoservicio y de
  intencion limitada, y no pueden tocar nivel, faccion, persona ni semana
  inicial.
- **Avatar por split (`SplitParticipantAvatar`)** guardado en PostgreSQL en
  una entidad uno-a-uno separada (los bytes nunca se cargan en listados),
  validado y normalizado en servidor con `sharp`: JPEG/PNG/WebP
  comprobados decodificando el contenido real, maximo 5 MB de entrada,
  correccion de orientacion EXIF, redimension a 512 px como maximo por
  lado y salida WebP sin metadatos. Ruta de servicio autorizada por sesion,
  con MIME final real, `X-Content-Type-Options: nosniff`, cache privada y
  `ETag`.
- **Presentacion del bonus** en la tabla administrativa de participantes,
  en la previsualizacion y en la semana publicada (borde y badge
  `+20 % profesion`, nunca solo color, con el desglose completo accesible),
  en `/resultados > Por split` (siempre desde el snapshot de esa semana) y
  en el historico general (`+N por profesion` por KPI y
  `Bonus profesion: N` en el total del periodo).
- Migracion `add_professions_and_participant_profiles` y documento nuevo
  `docs/PROFESSIONS_AND_PROFILES.md`.
- Dependencia directa fijada: `sharp@0.33.5` (procesamiento de avatares).

### Corregido

- **Rotulo semanal del historico general:** con agrupacion `Semana`, el
  periodo se identifica por la **fecha de inicio real** de esa semana
  (`07/09/2026`) en vez de `Semana 1 (2026)`, formateada con el helper UTC
  de fechas para no desplazarla un dia. El orden pasa a ser cronologico
  descendente por la fecha real (no alfabetico por la etiqueta), dos
  semanas de splits distintos que empiecen el mismo dia no se fusionan, y
  el nombre del split se muestra como texto secundario cuando el filtro
  incluye varios. `Mes` y `Año` no cambian.

### Seguridad

- Las Server Actions administrativas de participante y de profesion vuelven
  a exigir `requireAdminSession()` dentro de la propia accion, porque una
  Server Action es una ruta invocable directamente.
- La lectura de un avatar exige sesion y solo la autoriza para su
  propietaria o para un administrador; una ficha ajena devuelve `404`,
  igual que una inexistente.

### Compatibilidad

- Los campos nuevos son `nullable` o tienen un valor predeterminado seguro:
  las publicaciones anteriores a `0.8.0` conservan `null`/`false`, se
  siguen leyendo sin errores y **no se recalculan**. Una semana publicada
  en `0.7.0` aparece sin profesion y sin bonus, sin datos inventados. La
  migracion no crea profesiones ni bonuses retroactivos y no borra
  personas, publicaciones, facciones ni resultados.

## [0.7.0] - MVP-2A — Facciones, clasificacion de facciones y consolidacion de UX

### Anadido

- **Facciones por split (`SplitFaction`):** administracion completa
  (crear/editar/eliminar segun el estado del split), asignacion
  obligatoria de participantes en cuanto el split ya tiene alguna faccion
  creada, y activacion/publicacion condicionadas al conjunto completo de
  reglas (al menos dos facciones, todos los participantes asignados, al
  menos tres aplicables por faccion) solo cuando el split usa facciones
  (un split sin facciones se comporta igual que antes de esta version, ver
  `docs/DECISIONS.md`).
- **Renombre = puntos por posicion**, sin segunda formula ni tabla
  independiente: el aporte de cada participante a su faccion es siempre
  `positionPoints` ya publicado.
- **Regla semanal de facciones:** suma de los tres mejores `positionPoints`
  (nunca una media), con desempate por mejor/segundo/tercer participante y
  ranking de competicion en empate real
  (`src/domain/faction-ranking.ts`).
- **Instantanea de faccion** congelada en cada publicacion semanal
  (`PublishedParticipantWeeklyResult.factionId`/`factionNameSnapshot`/
  `factionColorSnapshot`), clasificacion de facciones semanal y acumulada
  calculada al consultar (`faction-classification.service.ts`), resumen
  bajo la clasificacion individual y vista detallada
  (`/splits/[id]/clasificacion-facciones`).
- **Visibilidad de facciones para el participante** en `/resultados > Por
  split`: faccion actual, clasificacion general de facciones de solo
  lectura y detalle de los tres alias que puntuaron cada semana, sin
  revelar datos privados de otras personas.
- Detalle completo en `docs/FACTIONS.md`.

### Cambiado

- **Bloqueo de configuracion tras la primera publicacion:** la activacion
  y desactivacion de KPI, sus maximos/multiplicadores/parametros y los
  puntos por posicion quedan bloqueados en cuanto el split tiene al menos
  una semana publicada (`assertSplitConfigurationIsEditable`), sustituyendo
  la decision provisional de `MVP-1B` que permitia editar KPI en un split
  activo sin limite.
- **Clasificacion individual detallada filtrada por KPI:** con un KPI
  seleccionado, el orden predeterminado pasa a ser su suma/resultado
  descendente y la columna de posicion se renombra a "Posicion KPI"
  (mostrando el ranking real de ese KPI, nunca la posicion general bajo
  ese titulo); se puede ordenar tambien por puntos de posicion, total KPI
  y media mediante encabezados de columna accesibles (`aria-sort`) que
  conservan los filtros de semana y KPI.
- **Denominador unico "x de n":** todas las posiciones de resultados de un
  split (general, semanal, por KPI, vista administrativa de una semana
  publicada y subvista `Por split`) usan como denominador el numero total
  de participantes del split, no el numero de resultados aplicables de
  cada KPI.
- **Historico general** (`/resultados > Historico general`): sustituye el
  bloque de texto "Desglose por KPI (suma / media)" por una columna
  compacta por cada KPI presente (ordenadas segun el catalogo), con la
  suma como valor principal y la media como texto secundario, y bandas de
  color basadas en un porcentaje agregado reproducible.
- **KPI del split** en una sola linea por tarjeta en todos los anchos de
  pantalla, con la configuracion distribuida horizontalmente.
- **Layout general** mas ancho en pantallas panoramicas (hasta 1920 px).
- **Formulario "Anadir participante"** reorganizado en rejilla, con la
  nota de "Semana inicial" en su propia linea y asociada de forma
  accesible al selector (`aria-describedby`).
- La seccion "Clasificacion general" del detalle del split se renombra a
  "Clasificacion general individual", para distinguirla de la nueva
  "Clasificacion general facciones".

### Documentacion

- Nuevo `docs/FACTIONS.md`.
- `docs/DATA_MODEL.md`, `docs/RESULTS_PUBLICATION.md`, `docs/ROADMAP.md`,
  `docs/DECISIONS.md` y `README.md` actualizados; corrige la referencia
  anterior del roadmap a "promedio de los tres mejores renombres" (la
  regla vigente es suma).

## [0.6.2] - Hotfix `AVISO`/`0` — Avisos de carga y ceros en resultados

### Corregido

- **Sustitucion de `VAC` por `AVISO` en pantallas de carga y comprobacion:**
  el texto visible `VAC` (y el contador de grupo `n VAC`) se sustituye
  siempre por la palabra fija `AVISO` (`1 AVISO`, `2 AVISO`, `3 AVISO`;
  nunca `AVISOS`), centralizado en `formatAvisoCount`/`AVISO_LABEL`
  (`src/domain/kpi-load-status-display.ts`). Afecta al indicador de grupo
  de la pantalla semanal de KPI (`StatusIndicator`), a `Comprobar Domador
  de Escaladas`, a la previsualizacion de carga de Escalados y a
  `Introducir`/`Comprobar Cronomagia laboral`. Un `AVISO` sigue sin
  convertir una carga completa en `Carga parcial` ni impedir guardar: el
  estado interno `VAC` y todas las reglas de completitud/bloqueo no
  cambian.
- **Ceros en resultados, previsualizacion, publicacion, clasificacion e
  historico:** un resultado `VAC` (ausencia justificada en un origen ya
  confirmado, incluido `totalHours = 0` de Cronomagia laboral) se muestra
  siempre como el valor numerico `0`, centralizado en
  `resolveKpiResultDisplayPoints` (`src/domain/kpi-outcome-display.ts`) y
  reutilizado por `WeeklyResultsTable`, `PorSplitSection`,
  `/splits/[id]/clasificacion` e `HistoricoSection`. Ese `0` participa en
  sumas, medias y rankings exactamente como cualquier otro cero: en
  consecuencia, `computeSplitKpiClassification` (clasificacion detallada
  acumulada) y `getPersonHistory` (desglose por KPI del historico general)
  ahora incluyen las semanas `VAC` en su recuento (`includedWeekCount`,
  antes `computedWeekCount`/`computedCount`) y en la media resultante, en
  vez de excluirlas. `NOT_APPLICABLE` (`No aplica`) se mantiene siempre
  diferenciado y nunca se convierte en `0` en ninguna pantalla. Ninguna
  formula de KPI, ni la logica de publicacion/instantaneas/bloqueo de
  semanas, cambia: solo la presentacion de un resultado ya calculado.

### Documentacion

- `docs/RESULTS_PUBLICATION.md` (nueva seccion 2.5 y actualizacion de las
  secciones 3, 6 y 7), `docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md`,
  `docs/MANUAL_KPI_ENTRY.md`, `docs/DECISIONS.md` y `README.md`: reflejan
  que `AVISO` es la presentacion en pantallas de carga/comprobacion y `0`
  la presentacion en resultados/publicacion/clasificacion/historico para el
  mismo estado interno `VAC`.

### Anadido

- Pruebas de servicio (Vitest) acotadas a este hotfix
  (`tests/aviso-zero-display.test.ts`): `formatAvisoCount` para 1/2/3
  (siempre `AVISO`, nunca `AVISOS`); `resolveKpiResultDisplayPoints` para
  `VAC` (-> `0`), `NOT_APPLICABLE` (-> diferenciado, nunca `0`) y un
  resultado negativo (se mantiene negativo); Cronomagia `0/0` y Guardian
  sin dato como `0`; Domador con actualizaciones y reasignaciones ausentes
  calculado con normalidad (no `AVISO`); y, contra PostgreSQL real, que una
  semana `VAC` ahora participa como cero real en la media de
  `computeSplitKpiClassification` y `getPersonHistory`, mientras que
  `NOT_APPLICABLE` sigue excluido por completo de ambos agregados.

## [0.6.1] - Hotfix — Cambio de contrasena

### Corregido

- **Cambio de contrasena en el primer acceso:** `src/server/actions/auth.actions.ts`
  (archivo `"use server"`) exportaba ademas de sus Server Actions el valor
  `initialSimpleActionState` (y la interfaz `SimpleActionState`), lo que
  Next.js rechaza en tiempo de compilacion con "A use server file can only
  export async functions, found object." y dejaba inutilizable el
  formulario de cambio de contrasena. El estado inicial compartido
  (`SimpleActionState`/`initialSimpleActionState`) se traslada a un modulo
  normal sin `"use server"`, `src/server/actions/action-state.ts`, siguiendo
  el mismo patron ya usado por `productivity-action-state.ts`. Los
  formularios cliente (`ChangePasswordForm.tsx`, `PersonAccountCell.tsx`,
  `PublishWeekButton.tsx`) y `publish.actions.ts` importan ahora el estado
  inicial desde ese modulo en vez de reexportarlo desde una accion de
  servidor. Sin cambios de comportamiento: `changeOwnPasswordAction` sigue
  comprobando la sesion, validando la contrasena actual y la nueva, y
  desactivando `mustChangePassword` tras el cambio.

## [0.6.0] - MVP-1C — Resultados, publicacion y clasificacion

### Corregido

- **Guardian de la Estabilidad** (`STABILITY_GUARDIAN`): un campo vacio,
  ausente o solo con espacios en "Resultados de estabilidad" se interpreta
  y persiste ahora como `0`, reutilizando el mismo helper que ya usaban
  Redactor estrella, Estudiante entusiasta y Aprendiz experto. Sustituye
  la decision de `BUGFIX-1 / UX-SPLIT-1` que lo mantenia obligatorio.
- **Cronomagia laboral** (`WORK_CHRONOMANCY`): un campo vacio, ausente o
  solo con espacios en "Horas productivas" o "Horas totales de la semana"
  se interpreta y persiste ahora como `0`. `vacio/vacio` se guarda como
  `0/0` (`VAC`, `0 %`, sin puntos); `vacio/40` guarda productivas `0` y
  calcula normalmente; un valor positivo de productivas con total en `0`
  o vacio se sigue rechazando. La pantalla de introduccion y la de
  comprobar muestran `0 %`/`VAC · 0 %` en vez de una celda vacia.

### Anadido

- **Motor agregado de resultados semanales**
  (`src/server/services/weekly-results.service.ts`): reutiliza los
  resolvers existentes de `src/domain/kpis/*` (sin duplicar formulas) para
  calcular, por cada participante aplicable, el resultado de cada KPI
  activo normalizado a tres estados (`COMPUTED`, `VAC`, `NOT_APPLICABLE`),
  la suma semanal (sin perder negativos), el maximo aplicable (excluyendo
  `NOT_APPLICABLE`), el ranking semanal y los puntos por posicion. Solo
  calcula participantes cuando la semana esta completa
  (`totalActiveCount > 0 && loadedCount === totalActiveCount`, la misma
  regla que ya usaba el contador "KPI cargados").
- Dos funciones puras y probadas: `src/domain/ranking.ts`
  (`rankByScoreDescending`/`rankByComparator`, ranking de competicion
  `1, 2, 2, 4`) y `src/domain/color-bands.ts` (`colorBandForPercentage`,
  bandas de color por porcentaje del maximo).
- **Previsualizacion en vivo y publicacion**
  (`/splits/[id]/weeks/[weekId]/resultados`): tabla ordenable con mapa de
  calor accesible, leyenda de estados/colores, resumen (participantes, KPI
  activos, total de `VAC`) y boton `Publicar semana` con confirmacion
  explicita, visible solo para administrador y solo cuando no hay
  bloqueantes.
- **Publicacion inmutable**: nuevas entidades `WeekPublication`,
  `PublishedParticipantWeeklyResult` y `PublishedKpiResult` (migraciones
  `add_results_publication_and_auth` y
  `add_publication_check_constraints`). `publishWeek`
  (`src/server/services/publish-week.service.ts`) recalcula en servidor y
  escribe la instantanea completa dentro de una transaccion serializable;
  una carrera concurrente no crea una segunda publicacion.
- **Bloqueo real de una semana publicada**: guarda centralizada
  `assertWeekIsEditable` (`src/server/services/shared/week-context.ts`),
  aplicada a las nueve acciones de escritura semanal (cuatro cargas de
  Excel, cinco entradas manuales) y a la incorporacion de un participante
  con semana inicial en una semana ya publicada.
- Nuevas columnas y bloques: `Resultados` en el calendario de semanas
  (`/splits/[id]`), resumen `KPI cargados: n/x` + `Ver resultados de la
  semana` en la pantalla de cargas, y bloque `Clasificacion general` bajo
  el calendario con enlace a la vista detallada
  (`/splits/[id]/clasificacion`).
- **Clasificacion general del split**
  (`src/server/services/classification.service.ts`): usa exclusivamente
  los puntos por posicion de semanas publicadas (la suma de KPI solo
  desempata visualmente); resumen para administrador, vista detallada con
  filtros (semana/acumulado, KPI, orden) y version limitada para
  participante (alias, posiciones, totales; nunca nombre real, KPI
  individuales, niveles ni `VAC` de otros).
- **Autenticacion local** (Auth.js/NextAuth v4 + `bcryptjs`): nueva
  entidad `User` (`ADMIN`/`PARTICIPANT`, vinculado opcionalmente uno a uno
  con `Person`), `src/middleware.ts` (proteccion de rutas por rol en cada
  peticion), `/login`, cierre de sesion, cambio de contrasena propia
  (`/cuenta/cambiar-contrasena`, obligatorio en el primer acceso), gestion
  de cuentas de participante integrada en `/personas`, y script
  `npm run db:create-admin` para el primer administrador.
- **Vista individual** (`/resultados`): selector de persona (solo
  administrador; el participante siempre usa su propia sesion), subvistas
  `Por split` (resumen, evolucion semana a semana, posicion por KPI,
  clasificacion limitada) e `Historico general` (filtros de ano/split/
  agrupacion semana-mes-ano, con desglose por KPI y `VAC` aparte).
- Documentacion nueva: `docs/RESULTS_PUBLICATION.md` (referencia
  principal de resultados/publicacion/clasificacion) y
  `docs/AUTHENTICATION.md`; actualizacion de `README.md`,
  `docs/ROADMAP.md`, `docs/DECISIONS.md`, `docs/DATA_MODEL.md`,
  `docs/MANUAL_KPI_ENTRY.md`, `docs/IMPORT_PRODUCTIVITY.md`,
  `docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md`,
  `docs/POSITION_POINTS_CONFIGURATION.md` y `.env.example`.
- Pruebas de servicio (Vitest, contra PostgreSQL real) sobre las reglas
  criticas de esta entrega: los dos bugfixes de vacio-como-cero; el motor
  agregado con VAC/negativos/ranking `1,2,2,4`/bloqueo por posicion sin
  regla/interpretacion de "Actualizaciones es 0" y "Falta Productividad";
  ranking de competicion y bandas de color como funciones puras; la
  publicacion (instantanea completa, no duplicacion, config posterior sin
  efecto, bloqueo de las nueve mutaciones, participante nuevo en semana
  publicada rechazado); y el ciclo de cuenta y la privacidad de la vista
  individual (contrasena nunca en claro, cuenta duplicada rechazada,
  `getPersonSplitDetail` filtra siempre por persona).

### Fuera de alcance en esta entrega

Despublicar, reabrir o editar una semana publicada; exportacion Excel/PDF
de resultados; medallas; recuperacion de contrasena por correo; SSO/OAuth;
importacion automatica de los cinco KPI manuales; facciones, profesiones,
economia, tienda, objetos o recompensas; integracion con Power BI; API
publica; despliegue en la nube; Docker como requisito; y actualizacion
general de dependencias. Ver `docs/ROADMAP.md`.

## [0.5.1] - BUGFIX-1 / UX-SPLIT-1 — Correcciones de formularios manuales y configuracion compacta del split

### Corregido

- **"Volver a introducir datos"** en los cinco formularios manuales
  (Guardian de la Estabilidad, Cronomagia laboral, Redactor estrella,
  Estudiante entusiasta, Aprendiz experto) ahora vuelve realmente al
  formulario precargado con los datos ya guardados en PostgreSQL, y el
  boton pasa a decir "Actualizar datos". El bloque de exito compartido
  (`ManualEntrySuccessPanel`) usa una navegacion HTML completa (`<a>`) en
  vez de `next/link`: una navegacion client-side hacia la misma URL no
  reiniciaba `useFormState`, dejando la pantalla de exito visible para
  siempre.
- **Redactor estrella** (`STAR_WRITER`): `deliveredArticles`,
  `undeliveredArticles` y `proposedArticles`, vacios o con solo espacios,
  se interpretan y persisten ahora como `0`. Una pantalla con
  combinaciones de campos rellenos y vacios se guarda sin mensajes de "es
  obligatorio"; los tres campos vacios de una persona se guardan como tres
  ceros y el resultado se calcula como cero. Se mantiene el rechazo de
  negativos, decimales y texto no numerico.
- **Estudiante entusiasta** (`ENTHUSIASTIC_STUDENT`): `dedicatedHours`
  vacio se interpreta y persiste como `0`, conservando el parseo decimal
  con coma o punto. Todos los participantes aplicables quedan con fila
  (incluidos los dejados en blanco) y el grupo puede quedar `Cargado`.
- **Aprendiz experto** (`EXPERT_APPRENTICE`): `completedTrainings` vacio se
  interpreta y persiste como `0` (el `0` explicito ya funcionaba
  correctamente y sigue sin confundirse con ausencia). El maximo
  configurado (`targetValue`) es **inclusivo**: un valor igual al maximo es
  valido, solo se rechaza al superarlo. Los textos visibles afectados usan
  ahora "Máximo"/"máximo"/"válido" con tilde.

### Anadido

- Helper explicito `parseNonNegativeNumberDefaultZero`
  (`src/server/validation/manual-entry.ts`), que reutiliza las mismas
  validaciones numericas de `parseRequiredNonNegativeNumber` pero
  interpreta un campo vacio o ausente como `0`. Se usa unicamente en
  Redactor estrella, Estudiante entusiasta y Aprendiz experto; Guardian de
  la Estabilidad y Cronomagia laboral no cambian.
- Nueva configuracion **"Puntos por posicion semanal"** por split
  (`SplitPositionPointRule`, migracion `add_position_points`): quince
  posiciones (`1..15`) con los valores predeterminados exactos de Split 8
  (`1→15, 2→11, 3→8, 4→5, 5→3, 6→2, 7..15→1`), con backfill para splits
  existentes y creacion automatica (misma transaccion que el split, sus
  semanas y su configuracion de KPI) para splits nuevos. Servicio,
  validacion y accion de servidor propios
  (`src/server/services/position-points.service.ts`,
  `src/server/validation/position-points.ts`,
  `src/server/actions/position-points.actions.ts`), con guardado atomico
  de las quince filas y solo lectura en splits `CLOSED` (protegido tambien
  en servidor). Nueva seccion en el detalle del split
  (`PositionPointsSection`). Esta entrega **solo guarda la
  configuracion**: no calcula ninguna posicion semanal, no reparte estos
  puntos y no es un KPI (no cuenta como "KPI cargado"). Documentacion
  principal: `docs/POSITION_POINTS_CONFIGURATION.md`.
- Mejora responsive del detalle del split: el contenedor global pasa de
  `max-w-5xl` a `max-w-screen-2xl`; `/splits/[id]` incorpora un indice
  lateral de secciones `sticky` en escritorio (`SplitDetailNav`) y una
  navegacion compacta al principio de la pagina en movil, con anclas HTML
  y `scroll-margin`; `AddParticipantForm` y `KpiConfigSection` usan
  rejillas horizontales en pantallas grandes y vuelven a una columna en
  movil, sin scroll horizontal de pagina a 360 px.
- Pruebas de servicio (Vitest) sobre las reglas criticas de esta entrega:
  Redactor estrella con los tres campos vacios como tres ceros, con
  combinaciones de campos vacios y rellenos, y con rechazo persistente de
  negativos/decimales/texto no numerico; Estudiante entusiasta con vacio y
  decimal con coma; Aprendiz experto con el limite exacto de `targetValue`
  aceptado y `targetValue + 1` rechazado, y con vacio/`0` guardados como
  cero; creacion de las quince reglas de puntos por posicion con los
  valores exactos de Split 8; aislamiento entre splits; guardado atomico
  ante un valor invalido; y proteccion de un split cerrado en el servicio.

### Fuera de alcance en esta entrega

Calculo de posicion semanal, reparto efectivo de los puntos configurados,
resultados agregados o panel de publicacion, clasificacion general o vista
individual, renombre/creditos/economia/objetos/profesiones/facciones/
localizaciones, vacaciones/bajas como entidad, cambios en la semantica
`VAC`/`Carga parcial` ya documentada, cambios en importadores Excel o
formulas de los diez KPI (salvo las tres correcciones manuales descritas),
autenticacion, permisos, API publica, Docker como requisito, actualizacion
general de dependencias, rediseno visual completo y refactors amplios no
necesarios para estos criterios. Ver `docs/ROADMAP.md`.

## [0.5.0] - MVP-1C.3 / INPUT-1C — Cargas manuales y completitud semanal

### Corregido

- **Cero implicito de Domador de Escaladas:** la ausencia de fila de
  Escalados para un participante se interpreta ahora como reasignaciones
  `0` (no como "Sin dato") cuando ya existe una carga de Escalados
  confirmada para la semana y el participante tiene Productividad; se
  muestra en `Comprobar` como `0 (inferido)`, con ayuda accesible. Si
  tampoco tiene Productividad, se muestra `VAC` sin puntos. La inferencia
  nunca se aplica si la carga de Escalados no existe todavia para la
  semana, y nunca inserta una fila artificial en `EscalationWeeklyRow`.
- **`vacCount` de Domador de Escaladas:** ahora cuenta unicamente a los
  participantes aplicables que no tienen fila ni en Escalados ni en
  Productividad (antes contaba tambien, incorrectamente, a quien le
  faltaba solo uno de los dos origenes).

### Anadido

- Entrada manual de los cinco KPI restantes: **Guardian de la
  Estabilidad** (`STABILITY_GUARDIAN`, solo participantes N2),
  **Cronomagia laboral** (`WORK_CHRONOMANCY`, con `totalHours = 0` como
  `VAC`), **Redactor estrella** (`STAR_WRITER`, con entregados/no
  entregados/propuestos en tres campos separados), **Estudiante
  entusiasta** (`ENTHUSIASTIC_STUDENT`) y **Aprendiz experto**
  (`EXPERT_APPRENTICE`, con `targetValue` validado en servidor). **Los diez
  KPI de Split 8 tienen ya introduccion de datos funcional.**
- Nuevas entidades `StabilityWeeklyEntry`, `ChronomancyWeeklyEntry`,
  `WriterWeeklyEntry`, `StudentWeeklyEntry` y `ApprenticeWeeklyEntry`
  (migracion `add_manual_kpi_entries`), sin fichero ni cabecera de carga:
  una fila semanal tipada por participante, con restricciones de base de
  datos de no negatividad y `onDelete: Restrict` desde `SplitParticipant`.
  La migracion conserva integramente los datos existentes.
- Pantallas de introduccion y comprobacion para cada KPI manual
  (`.../kpis/<origen>/{introducir,comprobar}`, con `<origen>` en
  `estabilidad`, `cronomagia`, `articulos`, `dedicacion` y `formaciones`),
  con guardado atomico (sustituye por completo el conjunto anterior de esa
  semana), validacion en servidor asociada a persona y campo, y estados
  `Pendiente`/`Cargado` (nunca `Carga parcial`; ninguno de los cinco
  muestra `VAC` de grupo, salvo Cronomagia por fila).
- Nueva columna `KPI cargados` en el "Calendario de semanas" del detalle
  del split (`src/server/services/kpi-load-summary.service.ts`): `n/X` de
  los KPI activos completos por semana, calculada siempre al consultar con
  un numero acotado de consultas para todo el calendario (nunca una
  consulta por KPI y semana), sin persistir el contador.
- Helpers pequenos y tipados, no un motor generico:
  `src/server/services/shared/manual-entries.ts` (estado
  `Pendiente`/`Cargado` y comprobacion de split activo) y
  `src/server/validation/manual-entry.ts` (parseo y validacion de
  formularios con errores por persona y campo).
- Documentacion: `docs/MANUAL_KPI_ENTRY.md` (referencia principal), y
  actualizacion de `README.md`, `docs/ROADMAP.md`, `docs/DATA_MODEL.md`,
  `docs/DECISIONS.md`, `docs/KPI_CONFIGURATION.md`,
  `docs/DISCOVERY-1-SPLIT-8.md`,
  `docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md` y `CLAUDE.md`.
- Pruebas de servicio (Vitest) sobre las reglas criticas de esta entrega:
  caso de regresion sintetico del hotfix de Domador (cero inferido sin
  contar como VAC, ausencia en ambos origenes como VAC); guardado manual
  atomico con rechazo en `DRAFT`/`CLOSED` y sin persistir filas parciales;
  Guardian solo N2 con cero valido y maximo aplicado, y completado sin
  ningun N2 aplicable; Cronomagia con ratio normal, ratio limitado al
  100 %, `0/0` como `VAC` y rechazo de `productivas > 0` con `total = 0`;
  Redactor con entregados/no entregados/propuestas y resultado negativo
  sin suelo de cero; Estudiante con horas decimales, cero y maximo;
  Aprendiz con rechazo al superar `targetValue` y calculo dentro del
  limite; estados manuales pendiente/cargado al cambiar la participacion
  aplicable; y el contador semanal completo (Productividad sumando dos
  KPI, Domador exigiendo ambos origenes, KPI inactivos sin contar y
  `X/X` con los diez KPI completos).

### Fuera de alcance en esta entrega

Nuevos importadores Excel, pegado masivo desde portapapeles, conexion con
Power BI, cierre irreversible/publicacion/reapertura de semana,
clasificacion general o individual, portal o autenticacion de
participantes, PDF o correo, historial de versiones de las entradas
manuales, vacaciones/bajas como entidad general, motor generico de
formularios/importaciones/reglas, formulas editables libremente,
profesiones, objetos, cartas, creditos, renombre, misiones u otros efectos
de juego, API publica, colas, almacenamiento cloud, microservicios,
rediseno global y actualizacion general de dependencias. Ver
`docs/ROADMAP.md`.

## [0.4.0] - MVP-1C.2 / IMPORT-1B — Escaladas, Calidad y Llamadas

### Anadido

- Carga semanal de los Excel de **Escalados**, **Calidad** y **Llamadas**
  en la misma pantalla de KPI de una semana, con el mismo recorrido de
  Productividad (analizar sin guardar, confirmar con revalidacion en
  servidor, sustitucion atomica e independiente por origen) y rutas
  propias (`.../kpis/escalados`, `.../kpis/calidad`, `.../kpis/llamadas`).
- Calculo administrativo, con funciones puras y aritmetica decimal, de
  **Domador de Escaladas** (`ESCALATION_TAMER`, cruzando
  `groupReassignments` del Excel de Escalados con
  `ProductivityWeeklyRow.updates` de la misma semana y participante),
  **Maestro Artesano** (`MASTER_CRAFTSMAN`) y **Embajador de voz**
  (`VOICE_AMBASSADOR`, con las llamadas salientes sumadas siempre despues
  del multiplicador de nivel). Los tres respetan el maximo base como techo
  unico, sin suelo de cero, usando la configuracion ya existente de
  `MVP-1B` sin cambiar sus valores predeterminados.
- Nuevas entidades `EscalationImport`/`EscalationWeeklyRow`,
  `QualityImport`/`QualityWeeklyRow` y `VoiceImport`/`VoiceWeeklyRow`
  (migracion `add_escalations_quality_voice_import`), con la misma forma
  que `ProductivityImport`/`ProductivityWeeklyRow`: una carga vigente por
  origen y semana, sin guardar el binario del Excel, con restricciones de
  base de datos para que todos los conteos y metricas de tiempo sean no
  negativos. La migracion preserva integramente los datos existentes.
- Dependencia visible de Domador de Escaladas: la pantalla semanal y su
  `Comprobar` muestran por separado si Escalados y Productividad de esa
  semana estan cargados, con un enlace directo para cargar Productividad
  si falta, incluso cuando Cazador de soluciones y Explorador de datos
  estan inactivos.
- Helpers compartidos y puros (no un motor generico) para el recorrido
  seguro de lectura de `.xlsx` (`src/server/services/shared/xlsx.ts`) y el
  emparejamiento por nombre real (`src/server/services/shared/matching.ts`),
  reutilizados por los tres nuevos origenes; el lector y el emparejamiento
  de Productividad, ya validados manualmente, no se han tocado.
- Documentacion: `docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md` (referencia
  principal), y actualizacion de `README.md`, `docs/ROADMAP.md`,
  `docs/DATA_MODEL.md`, `docs/DECISIONS.md`, `docs/KPI_CONFIGURATION.md`,
  `docs/DISCOVERY-1-SPLIT-8.md`, `docs/IMPORT_PRODUCTIVITY.md` y
  `CLAUDE.md`.
- Pruebas de servicio (Vitest) sobre las reglas criticas de esta entrega:
  lectura de los tres formatos sinteticos con columnas reordenadas y una
  columna extra; validaciones parametrizadas del lector de Escalados
  (encabezado ausente, vacio, negativo, decimal donde se exige entero,
  formula, nombre duplicado, cero conservado); validacion y persistencia
  decimal de las metricas de tiempo de Llamadas con `Prisma.Decimal`;
  calculos de los tres KPI (maximo aplicado, sin suelo de cero, orden de
  llamadas salientes); union de Domador con Productividad por semana y
  participante (dependencia ausente en ambos sentidos, denominador cero);
  matriz de estados de Domador (rojo, amarillo, verde); confirmacion y
  sustitucion atomica e independiente de cada origen conservando la carga
  anterior ante un fallo; y restricciones de estado del split y la semana
  para los tres origenes nuevos.

### Corregido

- **Estado de cobertura de Productividad (introducido en `0.3.0`):** una
  carga confirmada de Productividad, Calidad o Llamadas ahora es siempre
  verde (`Cargado`), aunque falten participantes aplicables; antes se
  mostraba como `Carga parcial` (amarillo), lo cual sugeria incorrectamente
  que la carga estaba incompleta. La ausencia de un participante se
  expresa ahora con un contador informativo `n VAC` (nunca persistido, sin
  afirmar vacaciones o baja reales). El amarillo queda reservado
  exclusivamente para Domador de Escaladas, cuando falta uno de sus dos
  origenes.

### Fuera de alcance en esta entrega

El resto de origenes de `IMPORT-1` (Estabilidad, Cronomagia, Articulos,
Dedicacion, Formaciones), clasificacion general, vista individual,
publicacion/cierre de semana, autenticacion, mapeo manual persistente de
nombres, historial de versiones de una misma carga, estado real de
vacaciones o bajas, motor generico de importaciones o de reglas, y
actualizacion general de dependencias. Ver `docs/ROADMAP.md`.

## [0.3.0] - IMPORT-1A / MVP-1C.1 — Carga semanal de Productividad

### Anadido

- Pantalla independiente de cargas de KPI para cada semana de un split
  (`/splits/[id]/weeks/[weekId]/kpis`), accesible desde una accion
  `Introducir KPI` (o `Ver KPI` en splits cerrados) anadida al calendario
  de semanas del detalle del split. La semana se identifica siempre por su
  `id` real, y el servidor comprueba que pertenece al split indicado.
- Lectura y validacion en servidor, en memoria y sin guardar el binario,
  del Excel real de Productividad (`.xlsx`, ocho encabezados fijos, orden
  libre, hasta 500 filas y 50 columnas), con previsualizacion sin
  persistencia (`Analizar archivo`) que reune todos los errores
  detectables en una sola respuesta.
- Emparejamiento por nombre real (`Person.fullName`, normalizado sin
  distinguir mayusculas, espacios ni diacriticos), nunca por alias, contra
  los participantes aplicables de la semana segun
  `startWeekSequenceNumber`/`endWeekSequenceNumber`; distingue encontrado,
  ignorado, sin dato y ambiguo (esto ultimo bloquea la confirmacion).
- Calculo administrativo, con funciones puras y aritmetica decimal, de
  **Cazador de soluciones** (`SOLUTION_HUNTER`) y **Explorador de datos**
  (`DATA_EXPLORER`) a partir de la productividad cargada, aplicando el
  parametro propio, el multiplicador de nivel y el maximo base de
  `SplitKpiConfig` (`MVP-1B`); los puntos se calculan siempre al consultar
  y distinguen "cero real" de "Sin dato" (sin fila importada) y "No
  aplica" (multiplicador de nivel vacio).
- Nuevas entidades `ProductivityImport` (cabecera: una carga vigente por
  semana, sin guardar el binario del Excel) y `ProductivityWeeklyRow`
  (fila por participante encontrado, con los siete conteos fuente
  incluida `updates`, conservada para el futuro calculo de Domador de
  Escaladas). Migracion `add_productivity_import`, compatible con los
  datos existentes de `MVP-1A`/`MVP-1B`, con restricciones de base de
  datos para que los conteos sean siempre no negativos.
- Sustitucion explicita (`Sustituir carga`) de una carga anterior de la
  misma semana, atomica dentro de una unica transaccion: si algo falla, la
  carga anterior queda intacta y no se duplican filas.
- Pantalla semanal con los KPI activos agrupados por origen de carga
  (`src/domain/kpis/loadGroups.ts`): el grupo `Productividad` reune
  Cazador de soluciones y Explorador de datos con un unico boton `Cargar`,
  un unico `Comprobar` y un unico indicador de estado (`Pendiente` /
  `Carga parcial` / `Cargado`, calculado al consultar); el resto de KPI
  activos aparecen pendientes y deshabilitados con el texto "Carga
  todavia no implementada".
- Accion `Comprobar`: muestra todos los participantes aplicables de la
  semana (incluidos los que no tienen fila, como "Sin dato"), con su
  alias, nombre real, nivel y los valores y puntos de los KPI activos.
- Documentacion: `docs/IMPORT_PRODUCTIVITY.md` (referencia principal), y
  actualizacion de `README.md`, `docs/ROADMAP.md` (marca `MVP-1B` como
  validado manualmente y esta entrega como completada), `docs/DATA_MODEL.md`,
  `docs/DECISIONS.md`, `docs/KPI_CONFIGURATION.md`,
  `docs/DISCOVERY-1-SPLIT-8.md` y `CLAUDE.md`.
- Dependencia anadida: `exceljs` (lectura de `.xlsx` en servidor).
- Pruebas de servicio (Vitest) sobre las reglas criticas de esta entrega:
  lectura de un `.xlsx` sintetico con columnas reordenadas y una columna
  extra; validacion parametrizada (cero conservado, encabezado ausente,
  vacio, negativo, decimal, formula y nombre duplicado normalizado);
  emparejamiento (encontrado, ignorado, sin dato, ambiguo); calculo de los
  dos KPI con parametro, multiplicador, maximo y "No aplica"/"Sin dato";
  confirmacion de una carga valida y transicion de estado; sustitucion sin
  duplicar datos y conservacion de la carga anterior ante un fallo; y
  restricciones de estado del split (`DRAFT`, `CLOSED`, semana de otro
  split) frente a `ACTIVE`.

### Fuera de alcance en esta entrega

El resto de origenes de `IMPORT-1` (Escalados, Calidad, Llamadas,
Estabilidad, Cronomagia, Articulos, Dedicacion, Formaciones),
clasificacion general, vista individual, publicacion/cierre de semana,
autenticacion, mapeo manual persistente de nombres, historial de versiones
de una misma carga, motor generico de importaciones o de reglas,
actualizacion general de dependencias y cualquier capa de juego adicional.
Ver `docs/ROADMAP.md`.

## [0.2.0] - MVP-1B — KPI activos y configuracion

### Anadido

- Catalogo cerrado y tipado en codigo de los diez KPI de Split 8
  (`src/domain/kpis/catalog.ts`), con nombre visible, descripcion, orden
  de presentacion, explicacion legible de su calculo futuro, valores
  predeterminados y esquema de validacion de sus parametros propios.
- Nueva entidad `SplitKpiConfig` (una por `KpiCode` y split): activacion
  individual, maximo base (`Decimal`, mayor que cero), multiplicadores
  opcionales por nivel `N0`/`N1`/`N2` (`Decimal`, un valor vacio significa
  "nivel no aplicable", no multiplicador cero) y parametros propios en
  JSON validado por el esquema del KPI correspondiente.
- Migracion `add_kpi_configuration`: crea el enum `KpiCode` y la tabla
  `SplitKpiConfig`, con restricciones de base de datos para las reglas
  criticas (maximo base positivo, multiplicadores no negativos, un KPI
  activo necesita al menos un multiplicador aplicable), y hace backfill
  de las diez configuraciones inactivas con valores de Split 8 para todos
  los splits que ya existieran, sin modificar personas, semanas,
  participantes ni el estado de ningun split.
- Creacion de un split nuevo: ahora crea tambien sus diez
  `SplitKpiConfig` iniciales (inactivas, valores de Split 8) dentro de la
  misma transaccion que el split y sus semanas.
- Activacion de un split: ahora exige, ademas de al menos un participante,
  al menos un KPI activo. La regla se protege en el servicio de dominio.
- Pantalla administrativa "KPI del split", integrada en el detalle
  existente del split: resumen de KPI activos sobre diez con aviso si no
  hay ninguno, y un formulario por KPI para activarlo/desactivarlo y
  editar su maximo, multiplicadores y parametros, con validacion y
  mensajes en castellano. En splits `CLOSED` se muestra en solo lectura;
  en `DRAFT` y `ACTIVE` es editable (decision provisional, ver
  `docs/DECISIONS.md`).
- Documentacion: `docs/KPI_CONFIGURATION.md` (referencia principal del
  catalogo y su configuracion), y actualizacion de `docs/DATA_MODEL.md`,
  `docs/DECISIONS.md`, `docs/ROADMAP.md`, `docs/DISCOVERY-1-SPLIT-8.md`,
  `README.md` y `CLAUDE.md`.
- Pruebas de servicio (Vitest) sobre las reglas criticas de `MVP-1B`:
  integridad del catalogo, creacion de las diez configuraciones al crear
  un split, aislamiento entre splits, conservacion de parametros al
  desactivar/reactivar un KPI, validacion de valores invalidos y de
  multiplicador vacio como no aplicable, regla de activacion con
  participante y KPI activo, y edicion de KPI segun el estado del split.

### Fuera de alcance en esta entrega

Motor de calculo de resultados, carga manual de valores, importacion o
lectura de Excel, apertura/cierre/publicacion de semanas, resultados
semanales, clasificacion, vista individual, autenticacion, facciones,
profesiones, efectos que aumenten el maximo, localizaciones, objetos,
cartas, mercado, creditos, renombre, misiones, conexion con Power BI,
formulas libres, constructor generico de KPI, motor generico de reglas o
plugins, API publica y actualizacion general de dependencias. Ver
`docs/ROADMAP.md`.

## [0.1.0] - MVP-1A — Personas y creacion de splits

### Anadido

- Base del proyecto web: Next.js (App Router) con TypeScript en modo
  estricto, Tailwind CSS, ESLint y Vitest.
- Conexion a PostgreSQL mediante Prisma ORM, con migracion inicial
  versionada (`prisma/migrations/20260910133815_init`).
- Gestion de personas: alta, edicion de nombre y correo, listado con el
  numero de splits en los que participa cada una. Correo opcional,
  normalizado y unico.
- Gestion de splits: creacion en borrador (nombre, descripcion opcional,
  lunes de inicio, numero de semanas entre 1 y 52), edicion mientras
  esta en borrador, y listado con sus datos principales.
- Generacion automatica de las semanas de un split (identidad
  `splitId + sequenceNumber`, siempre de lunes a domingo).
- Incorporacion de participantes a un split: alias propio del split,
  nivel tecnico (`N0`/`N1`/`N2`) y semana inicial de participacion.
  Permitido tanto con el split en borrador como ya activo.
- Edicion de alias y nivel de un participante ya incorporado.
- Activacion de un split cuando tiene al menos un participante.
- Restricciones de base de datos para las reglas criticas: correo unico,
  persona unica por split, alias unico (normalizado) por split, semana
  inicial perteneciente al mismo split, fechas de inicio en lunes y
  semanas de lunes a domingo, y numero de semanas entre 1 y 52.
- Interfaz administrativa en castellano (personas y splits) con estados
  de carga, exito, formulario invalido, error de servidor y lista vacia.
- Pruebas de servicio (Vitest) sobre las reglas de negocio criticas:
  generacion de semanas, rechazo de fecha inicial no valida, alias
  distintos por split para la misma persona, alias duplicado dentro de un
  split, persona duplicada en un split, semana inicial fuera del split,
  activacion sin participantes, e incorporacion de un participante a un
  split ya activo.
- Documentacion del proyecto: `CLAUDE.md`, `README.md`,
  `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`, `docs/DATA_MODEL.md`,
  `docs/DISCOVERY-1-SPLIT-8.md` y `docs/DECISIONS.md`.

### Fuera de alcance en esta entrega

KPI, motor de calculo, importacion de Excel, formularios de resultados,
clasificacion, ficha individual, autenticacion, y cualquier capa de juego
(facciones, profesiones, localizaciones, objetos, economia, renombre).
Ver `docs/ROADMAP.md`.

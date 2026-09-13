# Roadmap

Estados usados: **pendiente**, **en curso**, **completado**. Una entrega
solo se marca como completada cuando se cumplen todos sus criterios de
aceptacion.

## MVP-1A — Personas y creacion de splits

**Estado: completado y validado manualmente por el usuario.** Sus
pruebas funcionales (creacion y edicion de personas, creacion de splits y
semanas, incorporacion de participantes, alias por split, niveles,
activacion del split y altas durante un split activo) han sido
satisfactorias.

- Base del proyecto web (Next.js + TypeScript + PostgreSQL + Prisma +
  Tailwind CSS).
- Gestion de personas: alta, edicion de nombre y correo, listado con
  numero de splits en los que participan.
- Creacion de splits en borrador (nombre, descripcion opcional, lunes de
  inicio, numero de semanas) y generacion automatica de sus semanas.
- Edicion de un split mientras esta en borrador.
- Incorporacion de participantes (persona + alias + nivel + semana
  inicial), tanto en borrador como con el split activo.
- Edicion de alias y nivel de un participante.
- Activacion de un split cuando tiene al menos un participante.
- Documentacion del proyecto y descubrimiento funcional del Split 8.

## MVP-1B — KPI activos y configuracion

**Estado: completado y validado manualmente por el usuario.**

- Catalogo cerrado de los 10 KPI descritos en
  `docs/DISCOVERY-1-SPLIT-8.md` y documentado en
  `docs/KPI_CONFIGURATION.md`.
- Activar o desactivar KPI por split, con conservacion de sus parametros
  al desactivar y reactivar.
- Configurar los parametros de cada KPI activado (multiplicadores por
  nivel, maximos base, parametros propios de su tipo de calculo),
  validados en servidor.
- Creacion automatica de la configuracion inicial (diez KPI inactivos con
  valores de Split 8) al crear un split nuevo, y migracion de backfill
  para los splits ya existentes.
- Activacion de un split ahora exige al menos un participante y al menos
  un KPI activo.
- Todavia no se permite crear KPI nuevos ni introducir formulas o codigo
  libre: los tipos de calculo son fijos y conocidos por el sistema. No
  incluye todavia motor de calculo de resultados, carga de datos,
  importacion de Excel ni clasificacion (ver `IMPORT-1` y `MVP-1C`).

## IMPORT-1A / MVP-1C.1 — Carga semanal de Productividad

**Estado: completado.**

- Pantalla independiente de cargas de KPI para cada semana de un split
  (`/splits/[id]/weeks/[weekId]/kpis`), accesible desde una accion
  `Introducir KPI` (o `Ver KPI` en splits cerrados) en cada fila del
  calendario de semanas.
- Lectura y validacion en servidor, en memoria, del Excel real de
  Productividad (`.xlsx`, ocho encabezados fijos), con previsualizacion
  sin persistencia (`Analizar archivo`).
- Emparejamiento por nombre real (`Person.fullName`, no alias) con los
  participantes aplicables de la semana, distinguiendo encontrado,
  ignorado, sin dato y ambiguo.
- Calculo administrativo de **Cazador de soluciones** (`SOLUTION_HUNTER`)
  y **Explorador de datos** (`DATA_EXPLORER`) a partir de esa
  productividad, aplicando el parametro propio, el multiplicador de nivel
  y el maximo base configurados en `MVP-1B`; los puntos se calculan al
  consultar, no se guardan como instantanea.
- Persistencia de una carga vigente por semana (`ProductivityImport` /
  `ProductivityWeeklyRow`), con sustitucion explicita y atomica.
- Agrupacion de KPI activos por origen de carga, con un unico indicador de
  estado (`Pendiente` / `Carga parcial` / `Cargado`) para el grupo de
  Productividad; el resto de KPI activos aparecen pendientes y
  deshabilitados hasta su propia entrega.
- Detalle completo en `docs/IMPORT_PRODUCTIVITY.md`.
- Fuera de alcance en esta entrega: el resto de origenes de datos
  (implementados en `MVP-1C.2 / IMPORT-1B` y `MVP-1C.3 / INPUT-1C`),
  clasificacion general y vista individual (`MVP-1C`).

## MVP-1C.2 / IMPORT-1B — Carga semanal de Escalados, Calidad y Llamadas

**Estado: completado.**

- Carga, previsualizacion, confirmacion y sustitucion de los Excel de
  Escalados, Calidad y Llamadas en la misma pantalla semanal, con rutas
  propias (`.../kpis/escalados`, `.../kpis/calidad`, `.../kpis/llamadas`)
  siguiendo el convenio ya usado por Productividad.
- Calculo administrativo de **Domador de Escaladas**
  (`ESCALATION_TAMER`, cruzado con `ProductivityWeeklyRow.updates` de la
  misma semana y participante), **Maestro Artesano**
  (`MASTER_CRAFTSMAN`) y **Embajador de voz** (`VOICE_AMBASSADOR`), con
  los mismos principios de Productividad: funciones puras, aritmetica
  decimal, maximo aplicado despues del calculo, sin suelo de cero.
- Nuevas entidades `EscalationImport`/`EscalationWeeklyRow`,
  `QualityImport`/`QualityWeeklyRow` y `VoiceImport`/`VoiceWeeklyRow`
  (migracion `add_escalations_quality_voice_import`), con las mismas
  reglas de una carga vigente por origen y semana, sustitucion atomica y
  restricciones de no negatividad.
- **Correccion del estado de cobertura introducido en `MVP-1C.1`**: una
  carga confirmada de Productividad, Calidad o Llamadas es verde
  (`Cargado`) aunque falten participantes aplicables, con un contador
  informativo `n VAC` (no persistido, no confirma vacaciones ni bajas).
  El amarillo (`Carga parcial`) queda reservado para Domador de Escaladas,
  cuando falta uno de sus dos origenes.
- Detalle completo en `docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md`.
- Fuera de alcance en esta entrega: los cinco origenes manuales
  (implementados en `MVP-1C.3 / INPUT-1C`), clasificacion general y vista
  individual (`MVP-1C`).

## MVP-1C.3 / INPUT-1C — Cargas manuales y completitud semanal

**Estado: completado.**

- Hotfix del cero implicito de Domador de Escaladas: la ausencia de fila
  de Escalados se infiere como cero solo cuando ya existe una carga de
  Escalados confirmada para la semana y el participante tiene
  Productividad; si falta tambien Productividad, es `VAC`. Corrige ademas
  el `vacCount` de Domador (solo cuenta a quien falta en ambos origenes).
- Entrada manual de los cinco KPI restantes: Guardian de la Estabilidad,
  Cronomagia laboral, Redactor estrella, Estudiante entusiasta y Aprendiz
  experto, con formulario y comprobacion propios (sin Excel), guardado
  atomico y estados `Pendiente`/`Cargado`.
- **Los diez KPI de Split 8 tienen ya introduccion de datos funcional.**
- Nueva columna `KPI cargados` en el calendario de semanas: `n/X` de los
  KPI activos completos para cada semana, calculada al consultar.
- Detalle completo en `docs/MANUAL_KPI_ENTRY.md`.
- Fuera de alcance: cierre irreversible o publicacion de semana,
  clasificacion general, vista individual, autenticacion, historial de
  versiones de las entradas manuales (ver mas abajo).

## BUGFIX-1 / UX-SPLIT-1 — Correcciones de formularios manuales y configuracion compacta del split

**Estado: completado.**

- Correccion de "Volver a introducir datos" en los cinco formularios
  manuales: ahora vuelve realmente al formulario precargado (navegacion
  HTML completa en vez de `next/link` hacia la misma ruta).
- Redactor estrella, Estudiante entusiasta y Aprendiz experto: un campo
  vacio o con solo espacios se interpreta y persiste como `0` (excepcion
  explicita; Guardian de la Estabilidad y Cronomagia laboral no cambian).
- Aprendiz experto: el maximo configurado (`targetValue`) es inclusivo, y
  los textos visibles afectados usan "Máximo"/"máximo"/"válido" con tilde.
- Nueva configuracion "Puntos por posicion semanal" por split
  (`SplitPositionPointRule`, quince posiciones con los valores exactos de
  Split 8), migracion con backfill y creacion automatica al crear un split
  nuevo. Todavia no calcula ninguna posicion ni reparte estos puntos: ver
  `docs/POSITION_POINTS_CONFIGURATION.md`.
- Mejora responsive del detalle del split: contenedor global mas ancho,
  indice lateral `sticky` en escritorio / navegacion compacta en movil,
  `AddParticipantForm` y `KpiConfigSection` en rejilla horizontal.
- Fuera de alcance (sin cambios): calculo de posicion semanal, reparto de
  los puntos configurados, resultados agregados, clasificacion, vista
  individual y cualquier capa de juego adicional (ver `MVP-1C` mas abajo).

## MVP-1C — Resultados agregados, publicacion y clasificacion

**Estado: completado.**

- Bugfixes previos: Guardian de la Estabilidad y Cronomagia laboral
  aceptan ya un campo vacio como `0`, igual que los otros tres KPI
  manuales (ver `docs/DECISIONS.md`).
- Motor agregado de resultados semanales (`weekly-results.service.ts`),
  que reutiliza los resolvers existentes de `src/domain/kpis/*` sin
  duplicar formulas, con tres estados funcionales (`COMPUTED`, `VAC`,
  `NOT_APPLICABLE`), ranking de competicion semanal y por KPI, y puntos
  por posicion leidos de `SplitPositionPointRule`.
- Previsualizacion en vivo (`/splits/[id]/weeks/[weekId]/resultados`) con
  tabla, mapa de calor accesible por porcentaje del maximo y boton
  `Publicar semana` con confirmacion explicita.
- Publicacion inmutable (`WeekPublication`, `PublishedParticipantWeeklyResult`,
  `PublishedKpiResult`): recalcula en servidor dentro de una transaccion
  serializable, bloquea cualquier modificacion posterior de las entradas
  de esa semana (`assertWeekIsEditable`, aplicada a los nueve servicios de
  escritura semanal) y no permite anadir un participante que empiece en
  una semana ya publicada.
- Autenticacion local (Auth.js/NextAuth con credenciales + `bcryptjs`),
  con administrador y participante, cuentas vinculadas uno a uno con una
  `Person`, cambio de contrasena obligatorio en el primer acceso y
  proteccion de rutas en `src/middleware.ts`.
- Vista individual `/resultados` (subvistas `Por split` e `Historico
  general`, con filtros de ano/split/agrupacion), y clasificacion general
  del split (resumen bajo el calendario, vista detallada para
  administrador y version limitada dentro de `/resultados` para
  participante).
- Detalle completo en `docs/RESULTS_PUBLICATION.md` y
  `docs/AUTHENTICATION.md`.
- Fuera de alcance en esta entrega: despublicar/reabrir una semana,
  exportacion Excel/PDF, medallas y cualquier capa de juego adicional
  (facciones, profesiones, economia...).

## `0.7.0` / MVP-2A — Facciones, clasificacion de facciones y consolidacion de UX

**Estado: completado.**

- Primera capa de juego real: facciones por split (`SplitFaction`), con
  administracion (crear/editar/eliminar segun el estado del split),
  asignacion obligatoria de participantes en cuanto el split ya tiene
  alguna faccion creada, y activacion/publicacion condicionadas al
  conjunto completo de reglas solo quando el split usa facciones (splits
  sin facciones se comportan igual que antes, ver `docs/DECISIONS.md`).
- Renombre = puntos por posicion (`positionPoints`), sin segunda formula ni
  tabla independiente.
- Regla semanal de facciones: suma de los tres mejores `positionPoints`
  (nunca promedio, corrige la nota anterior de este documento), con
  desempate por mejor/segundo/tercer participante y ranking de competicion
  en empate real (`src/domain/faction-ranking.ts`).
- Instantanea de faccion congelada en cada publicacion semanal
  (`PublishedParticipantWeeklyResult.factionId`/`factionNameSnapshot`/
  `factionColorSnapshot`), clasificacion semanal y acumulada calculada al
  consultar (`faction-classification.service.ts`), resumen y vista
  detallada (`/splits/[id]/clasificacion-facciones`), y visibilidad segura
  para el participante en `/resultados`.
- Bloqueo de KPI y puntos por posicion desde la primera publicacion del
  split, sustituyendo la decision provisional de `MVP-1B`.
- Correcciones de UX: KPI del split en una sola linea por tarjeta, layout
  panorámico mas ancho, formulario "Anadir participante" reorganizado,
  clasificacion individual filtrada por KPI con orden y "Posicion KPI"
  correctos, denominador unico "x de n" (total de participantes del
  split) y rediseno del historico general con columnas KPI compactas.
- Detalle completo en `docs/FACTIONS.md`.
- Fuera de alcance: profesiones (implementadas en `0.8.0` / MVP-2B),
  localizaciones, objetos, economia de creditos y misiones (ver mas abajo).

## `0.8.0` / MVP-2B — Profesiones, bonus de KPI y fichas de participante

**Estado: completado.**

- **Profesiones configurables por split** (`SplitProfession`), opcionales
  igual que las facciones: un split sin ninguna profesion creada se
  comporta exactamente como en `0.7.0`. Cada profesion tiene nombre unico
  dentro del split, exactamente dos KPI **distintos** del catalogo cerrado
  y disponibilidad por nivel `N0`/`N1`/`N2`. No se implementan las reglas
  historicas de Mecanico, Arreglador, Mercenario, Cientifico ni Piloto del
  antiguo Split 8 (ver `docs/DECISIONS.md`).
- **Bonus fijo del `+20 %` despues del maximo base**, en una unica funcion
  pura del dominio (`applyProfessionBonus`,
  `src/domain/profession-bonus.ts`): se aplica solo a resultados
  `COMPUTED` estrictamente positivos de los dos KPI de la profesion, con
  `Prisma.Decimal` y sin redondeo prematuro, y el maximo no se vuelve a
  aplicar despues (`70 -> 84`). Nunca se aplica a `VAC`/`AVISO`,
  `No aplica`, cero ni negativos. `applicableMaxPoints` sigue sumando
  maximos base, por lo que el porcentaje mostrado puede superar el 100 %.
- **Asignacion y bloqueo:** el administrador asigna la profesion al anadir
  o editar un participante y el propio participante puede elegirla desde su
  ficha, siempre antes de la primera publicacion. Desde esa primera
  publicacion, definiciones y asignaciones quedan bloqueadas, y un alta
  posterior exige profesion en el propio formulario.
- **Instantanea publicada ampliada:** profesion congelada por participante
  (`professionId`, nombre, sus dos KPI, porcentaje y
  `splitUsedProfessions`) y desglose del bonus por KPI
  (`basePointsBeforeProfession`, `professionBonusPoints`,
  `professionApplied`, `professionNameSnapshot`). Ninguna publicacion
  anterior se recalcula.
- **Fichas privadas (`/fichas`)**, junto a `Resultados` en la navegacion:
  una ficha por participacion de split con avatar, alias editable,
  profesion, nivel y faccion de solo lectura. Operaciones de autoservicio
  de intencion limitada, resueltas siempre desde `session.user.personId`.
- **Avatar por split** (`SplitParticipantAvatar`) guardado en PostgreSQL en
  una entidad separada, validado y normalizado en servidor con `sharp`
  (JPEG/PNG/WebP comprobados sobre el contenido real, maximo 5 MB,
  correccion EXIF, 512 px maximo por lado, salida WebP sin metadatos), con
  ruta de servicio autorizada por sesion.
- **Correccion del rotulo semanal del historico general:** fecha de inicio
  real de la semana (`07/09/2026`) en vez de `Semana 1`, con orden
  cronologico y nombre del split como texto secundario cuando el filtro
  incluye varios. `Mes` y `Año` no cambian.
- Detalle completo en `docs/PROFESSIONS_AND_PROFILES.md`.
- Fuera de alcance: localizaciones, objetos, economia de creditos,
  misiones, fichas en PDF y cualquier otra capa de juego (ver mas abajo).

## `0.8.5` / MVP-2C — Localizaciones semanales

**Estado: completado.**

- **Localizaciones semanales configurables** (`SplitWeekLocation`),
  opcionales igual que facciones y profesiones: cero o una por
  `SplitWeek`, con nombre, un unico KPI potenciado (debe estar activo en
  el split) y un bonus entre `10 %`/`20 %`/`30 %`/`40 %`/`50 %`. Sin
  catalogo global ni entidad reutilizable entre semanas.
- **Ventana temporal editable solo antes de `startDate`**
  (`resolveWeekLocationWindow`, funcion pura con fecha inyectada,
  `src/domain/location-window.ts`): bloqueada desde que la semana
  comienza, y siempre de solo lectura en una semana publicada o en un
  split `CLOSED`. El miercoles es la operativa habitual esperada, nunca
  una restriccion tecnica por dia de la semana. `findNextWeek` destaca la
  proxima semana sin localizacion como accion principal del calendario.
- **Bloqueo de consistencia con KPI:** no se puede desactivar un KPI
  usado por una localizacion futura; el mensaje identifica la semana
  afectada y la localizacion no se borra ni se cambia en silencio.
- **Bonus independiente y no encadenado con la profesion**
  (`applyLocationBonus`, `src/domain/location-bonus.ts`): ambos actuan
  sobre el mismo `baseFinalPoints` y se suman una sola vez
  (`70 + 20 % + 30 % = 105`, nunca `109,20`). Nunca se aplica a
  `VAC`/`AVISO`, `No aplica`, cero ni negativos; `applicableMaxPoints`
  sigue sumando maximos base (hasta `170 %` visual con ambos bonus).
- **Instantanea publicada ampliada:** localizacion de la semana congelada
  una sola vez en `WeekPublication` (nombre, KPI, porcentaje) y desglose
  por KPI en `PublishedKpiResult` (`locationBonusPoints`,
  `locationApplied`). Ninguna publicacion anterior se recalcula.
- **Visibilidad completa:** columna `Localizacion` en el calendario de
  semanas, tarjeta en la pantalla semanal de KPI, desglose en
  previsualizacion/publicacion, tarjeta `Localizacion activa esta semana`
  en `/fichas` (solo lectura, resuelta desde `session.user.personId`) y
  desglose en `/resultados` (por split e historico general).
- **Minicorreccion:** la nota del asterisco de `Semana inicial *` en
  `Añadir participante` se muestra siempre, en los dos modos de alta.
- Detalle completo en `docs/WEEKLY_LOCATIONS.md`.
- Fuera de alcance: objetos, economia de creditos, misiones y cualquier
  otra capa de juego (implementados en `0.9.0` / MVP-2D, ver mas abajo).

## `0.9.0` / MVP-2D — Economia, inventario y equipo

**Estado: completado.**

- **Economia de creditos por split** (`SplitEconomySettings` no; el saldo
  vive en el libro `CreditLedgerEntry`, uno por `SplitParticipant`):
  `1 credito = 1 punto KPI completo publicado`,
  `creditsEarned = max(0, floor(totalKpiPoints))`, generados exactamente
  una vez al publicar una semana (`publishWeek`, dentro de la misma
  transaccion que crea la publicacion) y con backfill idempotente de todas
  las semanas publicadas antes de esta version.
- **Mercado administrable** (`SplitEconomySettings.marketStatus`), siempre
  `CERRADO` al crear un split o al migrar uno existente; solo `ADMIN` lo
  abre (exige split `ACTIVE`, al menos una ranura y un objeto valido a la
  venta) o lo cierra, las veces que haga falta mientras el split este
  activo. Cerrarlo bloquea nuevas compras, pero no equipar objetos ya
  poseidos.
- **Ranuras de equipo configurables** (`SplitEquipmentSlot`, sin numero ni
  nombres codificados, limite tecnico de doce) y **catalogo de objetos**
  (`SplitStoreItem`, un unico KPI activo por objeto y un bonus de
  `10/20/30/40/50 %`, misma lista tipada que las localizaciones), ambos
  administrados solo con el mercado cerrado; un objeto queda inmutable
  desde su primera compra salvo retirarlo de la venta.
- **Compra atomica, inventario permanente y equipo actual**
  (`ItemPurchase`/`SplitParticipantItem`/`SplitParticipantEquippedItem`):
  como maximo un objeto de cada tipo por participante, como maximo un
  objeto equipado por ranura, sin reventa, regalo ni destruccion. El
  equipo que cuenta para una semana es siempre el existente en el instante
  exacto en que se publica (`publishWeek` relee el equipo dentro de su
  propia transaccion serializable, nunca fuera de ella).
- **Tercer bonus de resultados** (`applyEquipmentBonuses`,
  `src/domain/equipment-bonus.ts`), independiente y no encadenado con
  profesion ni localizacion, calculado sobre el mismo `baseFinalPoints`;
  varios objetos sobre el mismo KPI se acumulan de forma aditiva. Snapshot
  publicado por objeto (`PublishedEquippedItem`) y desglose agregado en
  `PublishedKpiResult` (`equipmentBonusPoints`/`equipmentApplied`).
- **Configuracion privada del personaje** (`/fichas/[splitParticipantId]`,
  boton `Configurar personaje` junto a `Ver resultados`): resumen, equipo,
  inventario, mercado e historial de movimientos y localizaciones.
- **Vista `Con gamificacion` / `Sin gamificacion`** en `/resultados`,
  persistida en la URL y conservada entre pestañas/filtros, que compara el
  rendimiento KPI real (`basePointsBeforeProfession`) frente al oficial
  publicado, sin alterar clasificaciones, puntos por posicion, facciones ni
  creditos oficiales.
- Detalle completo en `docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md`.
- Fuera de alcance: dinero real, transferencias entre personas o splits,
  economia compartida por faccion, regalos, reventa, stock limitado,
  subastas, cofres o loot, consumibles, misiones, y cualquier otra capa de
  juego (ver mas abajo).

## `1.0.0` / MVP-3 — Centro de noticias y renovacion visual

**Estado: completado.**

- **Centro de noticias interno** (`NewsItem`/`NewsDelivery`,
  `prisma/migrations/20260912143314_add_news_center`): bandeja privada
  `/noticias` para cualquier usuario autenticado, campana global con
  contador y vista previa, envio manual segmentado desde administracion
  (`/noticias/administrar`) y noticias automaticas generadas por los
  servicios de negocio reales (alta de participante, activacion de split,
  facciones, profesiones, localizaciones, mercado, compra y publicacion
  semanal). Detalle completo en `docs/NEWS_CENTER.md`.
- Noticias de jugador entregadas siempre a `Person` (llegan aunque la
  cuenta todavia no exista); noticias de administracion entregadas a
  `User`. Sin backfill historico: la bandeja empieza a registrar eventos
  desde el despliegue de esta version.
- Atomicidad e idempotencia: la noticia se escribe en la misma transaccion
  que el hecho de negocio cuando ese hecho ya abre una, con claves
  idempotentes que impiden duplicados por reintento o carrera.
- **Renovacion visual "Prisma competitivo"**: tokens de color y tipografia
  centralizados (`tailwind.config.ts`, `src/app/globals.css`), sistema de
  componentes ampliado (`src/components/ui.tsx`), app shell con barra
  lateral en escritorio y cabecera+menu en movil
  (`src/components/AppShell.tsx`), aplicada a toda la aplicacion existente
  sin alterar ninguna regla de negocio. Detalle completo en
  `docs/DESIGN_SYSTEM.md`.
- El acceso raiz `/` redirige a `/noticias` para cualquier usuario
  autenticado: Noticias es el nuevo punto de entrada, sin eliminar los
  accesos directos existentes.
- Fuera de alcance: correo/Teams/push, WebSockets/polling, cron o workers,
  chat o comentarios, adjuntos, HTML/Markdown en el mensaje, edicion o
  borrado de una noticia enviada, recibos individuales de lectura para el
  administrador, modo oscuro, temas por split y editor de branding.

## `1.0.1` — UX y presentacion de resultados

**Estado: completado.**

- Barra lateral de escritorio corregida a `100dvh` (`sticky`, pie siempre
  visible) y orden de navegacion del administrador con Noticias primero.
- Auditoria ortografica de todo el texto visible de la aplicacion, sin
  renombrar ninguna ruta, identificador ni clave de formulario.
- Clarificacion de "media" en el historico general (`/resultados`): la
  agrupacion `Semana` oculta la media redundante; `Mes`/`Año` la rotulan
  "Media semanal" con una nota de ayuda accesible. Sin cambio de formula
  ni de datos.
- Rediseño de `/fichas` en tarjetas horizontales agrupadas por estado del
  split, con la edicion de alias/avatar/profesion centralizada en
  `/fichas/[splitParticipantId]`.
- Nuevo submenu lateral (y version movil) en el detalle del split,
  sustituyendo el indice de enlaces subrayados.
- Maquetacion panoramica de "KPI del split" y nuevo guardado conjunto
  "Guardar todos los KPI", atomico y compartiendo la misma logica que el
  guardado individual.
- Alineacion del formulario "Anadir participante" y traslado de los
  textos de asterisco a una franja de ayuda accesible.
- **"Presentar resultados"**: nuevo modo de proyeccion a pantalla completa
  para revelar en vivo la clasificacion de la ultima semana publicada de
  un split (individual y de facciones, semanal y general), reutilizando
  integramente los servicios de clasificacion existentes. Puramente de
  lectura: sin persistencia, sin noticias, sin recalculo.
- Detalle completo en `docs/UX_AND_RESULTS_PRESENTATION_1_0_1.md`.
- Fuera de alcance (sin cambios): modelo de datos, formulas de KPI, bonus,
  reglas de clasificacion, creditos, mercado, avatares como snapshot
  historico, y cualquier otra capa de juego nueva.

## `1.1.0` — Analitica avanzada del equipo, exclusiva de administracion

**Estado: completado.**

- Nuevo modulo `/analitica`, exclusivo de `ADMIN` (menu inmediatamente
  debajo de `Resultados`, protegido en middleware y en cada pagina): seis
  bloques (vision general, rendimiento por KPI, evolucion del equipo,
  distribucion y consistencia, analisis por persona e impacto de la
  gamificacion), todos de solo lectura sobre semanas publicadas
  (`PublishedParticipantWeeklyResult`/`PublishedKpiResult`/
  `PublishedEquippedItem`/`CreditLedgerEntry`). No es una segunda
  clasificacion del juego ni sustituye ninguna pantalla de `Resultados`.
- Identidad de analisis por `personId` (nombre real), nunca alias ni
  faccion; filtro de nivel historico (`levelSnapshot`); combinacion de uno,
  varios o todos los splits sin duplicar el peso de una persona en semanas
  simultaneas.
- Motor analitico puro (`src/domain/analytics/*`) con la jerarquia de
  medias documentada, resolucion de la base "sin gamificacion" con su
  fallback legado, distribucion por intervalos y comparacion (semana
  anterior/media del periodo) sobre poblacion comun.
- Politica ajustable de exclusion de posibles ausencias (umbral de KPI en
  cero/sin dato), revisable fila a fila, exclusiva de este modulo.
- Impacto de la gamificacion: desglose de bonus de profesion, localizacion
  y objetos sobre puntos publicados, y subbloque economico independiente
  por fecha de operacion.
- Unica dependencia nueva: `recharts` (graficos), version fijada.
- Detalle completo en `docs/ADVANCED_ANALYTICS.md`.
- Fuera de alcance: exportacion Excel/PDF, informes programados, Power BI,
  analitica predictiva, modelos de IA, diagnosticos personales, registros
  de vacaciones/bajas reales, y cualquier nueva mecanica de juego.

## `1.1.1` — Asistencia semanal por horas y puntos por hora

**Estado: completado.**

- La asistencia semanal deja de inferirse (heuristica de posibles
  ausencias de `1.1.0`) y pasa a determinarse exclusivamente por
  "Horas totales de la semana": `totalHours > 0` = presente, `= 0` (o sin
  guardar) = ausente/pendiente.
- El bloque de horas semanales pasa a ser obligatorio para todo
  participante aplicable de toda semana, independientemente de si
  Cronomagia laboral (`WORK_CHRONOMANCY`) esta activa; el KPI en si sigue
  siendo opcional/configurable.
- Prioridad absoluta de la ausencia: `0` puntos KPI, `0` creditos, sin
  bonus, sin posicion numerica, pero con los puntos de la ultima posicion
  efectiva ocupada por una persona presente, contando en la clasificacion
  general y en el top-3 de facciones.
- Nueva medida "Puntos por hora" (numerador puntos KPI, denominador horas
  totales), semanal y de periodo (razon de sumas, nunca media de razones),
  con consolidacion explicita para splits simultaneos.
- Eliminacion completa de la politica de exclusion de posibles ausencias
  de `1.1.0` (umbral configurable, revision manual, `ExclusionsPanel`) y
  nuevo selector de medida en Analitica avanzada
  (`% del maximo | Puntos KPI | Puntos por hora`).
- Migracion aditiva y compatible: publicaciones anteriores a esta version
  nunca se reinterpretan (cobertura de asistencia legada, sin backfill).
- Detalle completo en `docs/WEEKLY_ATTENDANCE_AND_HOURS.md`.

## `1.2.0` — Equipo visual, inventario RPG e imagenes de objetos

**Estado: implementado, pendiente de validacion funcional manual del
usuario.**

Rediseña y amplia la experiencia de inventario y equipo existente desde la
`0.9.0`, sin crear una segunda economia y sin cambiar ninguna formula,
porcentaje, credito, clasificacion ni semana publicada.

- Catalogo tecnico cerrado de diez posiciones visuales (`HEAD`,
  `LEFT_HAND`, `TORSO`, `RIGHT_HAND`, `HANDS`, `LEGS`, `CAPE`, `ARTIFACT`,
  `FEET`, `RELIC`), con su rejilla fija y su nombre base en castellano.
- Separacion explicita de tres conceptos en una ranura: identidad tecnica
  (`id`), posicion visual y nombre visible. Renombrar o ubicar nunca rompe
  objetos, compras, inventario, equipo ni publicaciones.
- Editor visual administrativo en `/splits/[id]/economia`: activar,
  ubicar, renombrar, desactivar y eliminar posiciones, con contadores de
  uso y bloqueos explicados (nunca se desequipa a nadie automaticamente).
- Migracion aditiva y no destructiva de las ranuras existentes, con mapeo
  automatico solo por coincidencia exacta con un nombre base del catalogo,
  y compatibilidad completa de las ranuras historicas sin ubicar
  ("Ranuras pendientes de ubicar" en administracion, "Otras ranuras" en la
  ficha).
- Imagen opcional por objeto (`SplitStoreItemImage`), procesada en
  servidor con `sharp` a WebP y servida por una ruta autenticada con
  `ETag`. Es la unica excepcion cosmetica a la inmutabilidad de un objeto
  ya comprado.
- Tablero visual con silueta neutra, inventario unico por participante y
  split, borrador local, arrastrar y soltar con alternativa completa por
  clic, teclado y tactil, y un unico boton "Confirmar equipo" que sustituye
  el conjunto de forma atomica, con control de concurrencia por revision.
- Panel lateral "Bonificadores activos" que agrupa por KPI los porcentajes
  de profesion, localizacion y objetos y muestra el total potencial como
  suma aritmetica, nunca encadenada.
- Detalle completo en `docs/ECONOMY_INVENTORY_AND_EQUIPMENT.md`
  (seccion 22) y `docs/DESIGN_SYSTEM.md` (seccion 12).

## Capas posteriores (fuera de alcance por ahora)

**Estado: pendiente**, documentadas unicamente para no perder contexto:

- Renombre derivado de la posicion semanal, y ajustes de juego.
- Ficha individual en PDF y envio por correo mediante Outlook.
- Integracion con Power BI.
- Un sistema generico de plugins o funcionalidades, o una API publica.

Ver `docs/DISCOVERY-1-SPLIT-8.md` para el detalle funcional de estas
capas historicas.

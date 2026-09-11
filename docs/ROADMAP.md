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

## Capas posteriores (fuera de alcance por ahora)

**Estado: pendiente**, documentadas unicamente para no perder contexto:

- Facciones y clasificacion de faccion (basada en el promedio de los tres
  mejores renombres semanales del equipo).
- Profesiones, con bonus sobre pares de KPI.
- Localizaciones, con bonus semanales.
- Objetos permanentes y efectos acumulables.
- Economia: creditos equivalentes a puntos KPI, compras y saldo.
- Renombre derivado de la posicion semanal, y ajustes de juego.
- Ficha individual en PDF y envio por correo mediante Outlook.
- Integracion con Power BI.
- Un sistema generico de plugins o funcionalidades, o una API publica.

Ver `docs/DISCOVERY-1-SPLIT-8.md` para el detalle funcional de estas
capas historicas.

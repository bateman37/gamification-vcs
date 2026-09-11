# Changelog

Formato inspirado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).
Este proyecto usa versionado `0.x` mientras se construye el nucleo
funcional; la primera version publicada es `0.1.0`.

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

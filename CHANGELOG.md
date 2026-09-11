# Changelog

Formato inspirado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).
Este proyecto usa versionado `0.x` mientras se construye el nucleo
funcional; la primera version publicada es `0.1.0`.

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

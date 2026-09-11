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
`docs/KPI_CONFIGURATION.md`, `docs/IMPORT_PRODUCTIVITY.md` y
`docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md` si vas a trabajar en KPI,
cargas de datos o motor de calculo.

## Estado real de las cargas semanales (no romper sin justificarlo)

A fecha de `MVP-1C.2 / IMPORT-1B`, cuatro origenes de carga semanal estan
implementados: Productividad, Escalados, Calidad y Llamadas (ver
`docs/IMPORT_PRODUCTIVITY.md` y
`docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md`). Reglas ya asentadas que una
sesion futura no debe deshacer sin registrar el motivo en
`docs/DECISIONS.md`:

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
- Cada origen (Productividad, Escalados, Calidad, Llamadas) tiene su
  propia ruta bajo `.../kpis/<origen>/{cargar,comprobar}` y su propia
  cabecera de carga con sustitucion atomica e independiente de los demas.
  No reutilices la ruta de un origen para el boton de otro.
- El recorrido de bajo nivel de lectura de Excel
  (`src/server/services/shared/xlsx.ts`) y de emparejamiento por nombre
  real (`src/server/services/shared/matching.ts`) es un helper compartido,
  no un motor generico: cada origen sigue declarando sus propios
  encabezados, mensajes y reglas de persistencia en su propio lector y
  servicio.

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

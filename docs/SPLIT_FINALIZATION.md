# Finalizacion de split (`1.2.2`)

Referencia funcional de "Finalizar split": cierre formal de un split cuando
todas sus semanas ya estan publicadas. Detalle de modelo en
`docs/DATA_MODEL.md`, decisiones de diseño en `docs/DECISIONS.md`.

## 1. Condicion exacta

Un `ADMIN` puede finalizar un split (`finalizeSplit`,
`src/server/services/finalize-split.service.ts`) solo cuando, revalidado en
servidor y dentro de la propia transaccion:

1. el split esta `ACTIVE` (nunca `DRAFT` ni ya `CLOSED`);
2. tiene al menos una `SplitWeek`;
3. el numero de `WeekPublication` iguala al numero de `SplitWeek` del split.

La publicacion existente de cada semana es la unica prueba de cierre: nunca
se usa la fecha actual, que la ultima semana haya terminado por calendario,
un contador enviado por el navegador, ni `Split.numberOfWeeks` sin
contrastarlo con las semanas realmente persistidas.

## 2. Estado terminal reutilizado

No se añade un segundo estado: `finalizeSplit` es la primera y unica
operacion del dominio que pone `Split.status` en `CLOSED` (hasta `1.2.2`,
ningun servicio lo hacia). La etiqueta visible cambia de "Cerrado" a
"Finalizado" (`SPLIT_STATUS_LABELS`, `src/lib/labels.ts`), en todas las
pantallas que ya usan esa constante compartida. No existe accion
"Reabrir split" en esta version.

Todas las protecciones de solo lectura de un split `CLOSED` ya existian
antes de `1.2.2` (participantes, facciones, profesiones, localizaciones,
configuracion y cargas de KPI, puntos por posicion, publicaciones, mercado,
catalogo, compras y equipo): finalizar un split simplemente activa ese
mismo bloqueo ya wireado en cada servicio, sin tocar ningun guard existente.

## 3. Resumen y boton

En la parte superior del detalle administrativo del split
(`/splits/[id]`, bloque `#resumen`):

- `Semanas publicadas: X de Y` (`X` = `WeekPublication` existentes, `Y` =
  `SplitWeek` del split), visible para `ACTIVE` y `CLOSED`.
- Cuando `X = Y` y el split sigue `ACTIVE`, aparece el boton "Finalizar
  split" (`FinalizeSplitButton.tsx`), con confirmacion explicita que
  explica que el split quedara en solo lectura, el mercado se cerrara y se
  enviara la noticia final. Mientras se procesa, el boton queda
  deshabilitado (evita doble envio).
- Tras finalizar, el boton desaparece (el split ya no es `ACTIVE`) y el
  badge de estado pasa a "Finalizado", conservando la linea "Semanas
  publicadas: X de Y".

## 4. Servicio transaccional e idempotencia

`finalizeSplit(db, splitId)`:

1. Comprobacion inicial fuera de transaccion (split existe, `ACTIVE`,
   semanas = publicaciones). Si el split ya esta `CLOSED`, devuelve de
   inmediato un resultado idempotente (`alreadyFinalized: true`): no existe
   otro camino a `CLOSED`, asi que ese estado por si solo confirma una
   finalizacion previa.
2. Calcula el resumen final (podio, faccion ganadora, ganadores por KPI)
   reutilizando `computeSplitClassification`, `computeFactionClassification`
   y `computeSplitKpiClassification` (ver seccion 5): lectura pura sobre
   publicaciones ya inmutables, hecha antes de abrir la transaccion de
   escritura (ver `docs/DECISIONS.md` para el porque).
3. Abre una transaccion serializable que: revalida de nuevo el estado y los
   contadores de semanas/publicaciones, cambia `Split.status` a `CLOSED`,
   cierra el mercado (`closeMarketWithinTransaction`, reutiliza el mismo
   nucleo que `closeMarket` sin repetir su guard de estado) y crea la
   noticia final (ver seccion 6) con clave idempotente
   `split-finalized:{splitId}`.
4. Si la transaccion falla por una carrera concurrente (dos clics
   simultaneos), se vuelve a comprobar el estado del split: si ya quedo
   `CLOSED`, se devuelve el resultado idempotente en vez de un error
   opaco (mismo patron que `publishWeek`).

Un doble clic, un reintento de red o una llamada concurrente nunca crean
dos noticias, nunca duplican entregas y nunca vuelven a cambiar el estado.

## 5. Calculo del resumen final

Fuente exclusiva: tablas y snapshots publicados. Reutiliza integramente los
servicios de clasificacion existentes, sin reimplementar ningun ranking ni
desempate.

- **Podio individual**: `computeSplitClassification` (clasificacion general
  oficial acumulada). Rank 1/2/3 -> Ganador/Subcampeón/Tercero. Los empates
  se respetan (varias personas pueden compartir un rank); un rank sin
  ninguna entrada (menos de tres personas, o un empate que salta un
  puesto) se omite en vez de forzar un orden artificial.
- **Faccion ganadora**: `computeFactionClassification`, faccion(es) con
  `rank === 1` de la clasificacion acumulada. Si el split no usa facciones
  o no tiene publicaciones con snapshot de faccion (`hasFactionData:
  false`), se omite la linea en la noticia.
- **Ganador de cada KPI activo**: `computeSplitKpiClassification(db,
  splitId, kpiCode, weekId: null)` (suma total de `finalPoints` a lo largo
  de todo el split, `COMPUTED`/`VAC` incluidos como en el resto de la
  aplicacion, `NOT_APPLICABLE` excluido, comparacion siempre con
  `Prisma.Decimal`). Ganador(es) = entradas con `rank === 1`. Sin ninguna
  entrada aplicable, el KPI se muestra como "Sin datos aplicables".

Las funciones puras `buildFinalizationPodium`/`buildFinalizationFactionWinner`/
`buildFinalizationKpiWinner` (`src/domain/split-finalization.ts`) solo
agrupan estas salidas ya oficiales: no sustituyen ni recalculan ningun
ranking.

## 6. Noticia final

Una unica noticia (`RESULTS`, prioridad `IMPORTANT`) para todas las
personas participantes del split (entregada siempre a `Person`, aunque
alguna todavia no tenga cuenta; `resolveAllParticipantsForSplit` ya
devuelve una fila por participacion, sin duplicados por alias historicos),
mas un aviso administrativo equivalente (categoria `ADMIN`) para los
administradores activos. Ambas comparten el mismo texto de resumen
(`splitFinalizedNewsTemplateForParticipant`/`adminSplitFinalizedNewsTemplate`,
`src/domain/news-templates.ts`), con el titulo `Split finalizado ·
{nombre del split}` y el cuerpo en texto plano:

```text
Ganador: {alias}.
Subcampeón: {alias}.
Tercero: {alias}.
Facción ganadora: {nombre}.
Ganadores por KPI:
{KPI 1}: {alias} ({suma} puntos).
{KPI 2}: Sin datos aplicables.
...
```

Empates se redactan como "Ganadores: Alias A y Alias B." (o "Facciones
ganadoras: ..."). El enlace de la noticia de jugador apunta siempre a
`/resultados?vista=por-split&split={splitId}` (generico, no a un
`splitParticipantId` de otro destinatario); el aviso administrativo enlaza
al bloque `#resumen` del detalle del split.

## 7. Fuera de alcance de `1.2.2`

Reapertura de un split finalizado, edicion manual de la noticia final,
premios materiales o creditos extra por podio/KPI, exportacion PDF/Excel
del resumen final, y cualquier otra capa de juego nueva.

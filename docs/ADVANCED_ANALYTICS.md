# Analítica avanzada (`1.1.0`, exclusiva de administración; medida y asistencia actualizadas en `1.1.1`)

## 1. Propósito y diferencia respecto a Resultados

`/analitica` es una herramienta de comprensión del equipo a lo largo del
tiempo para el responsable de Customer Service: cómo evoluciona el
rendimiento KPI, dónde hay riesgo o mejora, y cómo se compara una persona
con su nivel histórico. **No es una segunda clasificación del juego**: no
calcula posiciones, puntos por posición, facciones ni sustituye ninguna
pantalla de `Resultados`. Es puramente analítica, de solo lectura, sobre
`PublishedParticipantWeeklyResult`/`PublishedKpiResult` (nunca sobre una
previsualización ni sobre el estado actual de profesión, localización o
equipo).

## 2. Los seis bloques y sus filtros

| Bloque | Pregunta | Ruta interna |
|---|---|---|
| Visión general | ¿Cómo está funcionando el equipo y qué merece revisar? | `?tab=vision-general` |
| Rendimiento por KPI | ¿Qué indicadores evolucionan mejor o peor y con cuánta cobertura? | `?tab=rendimiento-kpi` |
| Evolución del equipo | ¿Cómo cambian los resultados por semanas, meses, años y niveles? | `?tab=evolucion` |
| Distribución y consistencia | ¿La media representa al conjunto o esconde resultados muy distintos? | `?tab=distribucion` |
| Análisis por persona | ¿Cómo evoluciona esta persona y cómo se compara con su nivel? | `?tab=personas` |
| Impacto de la gamificación | ¿Cuántos puntos añade el juego y cómo se utiliza la economía? | `?tab=gamificacion` |

Filtros compartidos (parte D3), guardados en la URL para que recarga, atrás
y enlaces internos funcionen: `splits` (multi-selección; por defecto todos
los splits con al menos una publicación), `nivel` (N0/N1/N2), `inicio`/`fin`
(intervalo por `weekStartDate`, por defecto las últimas 12 semanas de
calendario hasta la última semana publicada disponible), `agrupacion`
(`semana`/`mes`/`año`, independiente del intervalo), `gamificacion`
(`con`/`sin`, reutilizando el mismo parámetro y semántica de `/resultados`),
`medida` (`% del máximo`/`Puntos KPI`/`Puntos por hora`, `1.1.1`, ver
sección 7), `comparacion` (`semana_anterior`/`media_periodo`) y `semana`
(semana analizada). "Restablecer filtros" limpia toda la URL.

Los controles son formularios GET nativos y enlaces de servidor (mismo
patrón que `GamificationToggle` de `/resultados`): no se ha añadido ningún
estado de cliente para los filtros, así que funcionan sin JavaScript salvo
en los propios gráficos (recharts, client components aislados).

## 3. Rutas y restricción de acceso

- `/analitica` y `/analitica/personas/[personId]`, exclusivas de `ADMIN`.
- Protegidas en dos capas (`docs/AUTHENTICATION.md`): `src/middleware.ts`
  (matcher `/analitica/:path*`, mismo trato que `/personas` y `/splits`,
  redirige a `/noticias`) y `requireAdminSession()` al inicio de cada
  página (redirige a `/resultados`). Un `PARTICIPANT` nunca ve el enlace en
  el menú (`buildNavItems`) ni puede entrar escribiendo la URL a mano.
- El enlace "Analítica avanzada" aparece inmediatamente después de
  "Resultados" en la navegación del administrador (`src/components/nav-items.ts`).
- El capa de lectura (`analytics.service.ts`) no acepta ni necesita un rol:
  como el resto de servicios de este proyecto, la autorización vive en la
  página, nunca en el servicio. Los DTO nunca incluyen correo, hash de
  contraseña ni bytes de avatar (`tests/advanced-analytics-access.test.ts`).

## 4. Fuentes, campos históricos y casos de compatibilidad

Únicas fuentes de rendimiento: `PublishedParticipantWeeklyResult` y
`PublishedKpiResult` (con su `WeekPublication`/`SplitWeek` para fechas).
Nunca se invoca `computeWeeklyResults` ni se consulta configuración o
equipo actuales. El bloque de impacto de gamificación añade
`PublishedEquippedItem` (objetos históricos) y `CreditLedgerEntry`/`ItemPurchase`
(economía, por fecha de operación).

KPI agrupados por `kpiCode` (nunca por nombre visible), porcentajes
normalizados siempre por el `baseMax` de cada instantánea. Con varios
splits de configuración distinta, los puntos absolutos son descriptivos; la
medida prioritaria es el `%` del máximo base de cada celda.

## 5. Diccionario de métricas (parte E del encargo)

- `x_i` = puntos de una celda `COMPUTED` según el modo (`b_i` sin
  gamificación, `g_i` con gamificación); `q_i = 100 * x_i / m_i` (`m_i` =
  máximo base). Ambos pueden ser negativos; `con gamificación` puede
  superar el 100 %.
- **Jerarquía de medias (E2/E3)**: 1) por `personId+fecha+kpiCode`, media
  simple entre splits simultáneos; 2) por persona, media simple de sus
  semanas válidas del periodo; 3) equipo = media simple de los valores
  personales. Implementado en `collapseSimultaneousSplits` +
  `collapseWeeksToPersonPeriod` (`src/domain/analytics/aggregation.ts`),
  reutilizado igual para KPI, índice total y evolución temporal.
- **Índice total de una persona-split-semana (E3)**: "Puntuación total
  válida" = suma de puntos de los KPI incluidos; "Índice total
  normalizado" = `100 * suma(puntos) / suma(máximos)`, exigiendo el mismo
  conjunto de KPI con puntos y máximo válidos en ambos lados
  (`computeObservationTotals`).
- **Mediana/cuartiles (E4)**: interpolación lineal, índice `(n-1)*p`
  (`quantile`, `computeDispersionStats`).
- Pesos: cada persona cuenta una vez por semana de calendario (nunca una
  vez por split) y una vez en la media del periodo (nunca una vez por
  semana publicada individual).

## 6. Significado de "sin gamificación" (parte C3)

Puntos KPI tras fórmula y máximo, antes de bonus de profesión, localización
y objetos (`basePointsBeforeProfession`). En publicaciones anteriores a
`0.8.0` (sin ningún bonus todavía), se usa el *fallback* documentado a
`finalPoints` (`resolveCellBase`, marcado `usedLegacyFallback`). Si faltase
la base y hubiese evidencia de bonus (inconsistencia moderna), la celda
queda fuera de las estadísticas con el motivo `"Dato base no disponible"`,
nunca se copia el total bonificado como rendimiento real. No es un dato
operativo bruto (tickets, llamadas, horas): `rawPoints` tampoco se usa como
sustituto de esta base.

## 7. Asistencia objetiva, selector de medida y puntos por hora (`1.1.1`)

`1.1.1` sustituye por completo la política de exclusión de posibles
ausencias de `1.1.0` (umbral configurable de 2 a 10 KPI en
`COMPUTED=0`/`VAC`, revisión manual por fila con "Ver exclusiones",
constante `DEFAULT_ZERO_THRESHOLD`, campos `excludeZeroObservations`,
`zeroThreshold`, `manualOverrides` y el componente `ExclusionsPanel.tsx`,
todos eliminados) por una regla objetiva: la asistencia semanal de cada
observación viene ya congelada en la publicación
(`attendanceStatus`/`totalHours`, ver `docs/WEEKLY_ATTENDANCE_AND_HOURS.md`),
determinada exclusivamente por las horas totales trabajadas esa semana.

- Una observación **`ABSENT`** se excluye de **todas** las estadísticas de
  rendimiento del periodo, en cualquier medida y modo, sin ningún ajuste
  manual: es un hecho objetivo, no una heurística revisable.
- Una publicación **anterior a `1.1.1`** no tiene este dato
  (`attendanceStatus: null`). En el dominio de analítica se modela como un
  tercer estado, `UNKNOWN_LEGACY` (solo en memoria, nunca persistido):
  también se excluye de las estadísticas de rendimiento, pero nunca se
  reinterpreta como presente ni como ausente.
- Ya no existe ninguna excepción manual por fila ni parámetro de URL de
  exclusión: al ser un dato objetivo congelado en la publicación, no hay
  nada que un administrador deba revisar o corregir caso a caso.

### Selector de medida

Los bloques 1-4 incorporan un selector de medida
(`AnalyticsMeasure`, parámetro de URL `medida`):

- **`% del máximo`** (`percentage`, predeterminado): el cálculo "sin
  gamificación" ya existente (sección 6).
- **`Puntos KPI`** (`points`): puntos brutos, sin dividir por el máximo.
- **`Puntos por hora`** (`pph`): puntos KPI entre horas totales
  trabajadas, calculado con las mismas funciones puras usadas en
  `Resultados` (`src/domain/points-per-hour.ts`):
  - una semana individual usa el PPH de esa semana;
  - un periodo usa **razón de sumas** (`suma(puntos) / suma(horas)`),
    nunca la media de los PPH semanales, para que una semana de 8 horas no
    pese igual que una de 40;
  - varios splits simultáneos de la misma persona y semana se consolidan
    con las mismas horas si coinciden entre splits (puntos = media simple
    equivalente), o se marcan como incidencia sin elegir un valor
    arbitrario si las horas difieren.
- Este módulo no incluye (por ahora) un desglose de puntos por hora por
  KPI individual, solo un índice de equipo agregado.

## 8. Consolidación de personas en splits simultáneos (parte D5)

Dos splits publicados el mismo lunes son una semana de calendario y dos
publicaciones de split (contadores separados en Visión general). Para
cualquier indicador de rendimiento, una persona pesa una sola vez esa
semana (media simple entre sus splits simultáneos) y una sola vez en la
media del periodo. El detalle por persona conserva todas las filas
originales (una por split), y los puntos/créditos oficiales de cada split
nunca se deduplican.

## 9. Niveles históricos, poblaciones comunes y cambios de composición KPI

El filtro de nivel actúa sobre `levelSnapshot` de cada observación
publicada, nunca sobre el nivel actual del participante. Si una persona
cambió de nivel entre splits, el detalle (`/analitica/personas/[id]`)
muestra cada tramo con su propio nivel; la fila global puede mostrar "Varios
niveles". Las comparaciones (semana analizada vs. referencia, bloque G)
usan siempre la **población común**: mismas personas con observación válida
en ambos lados y mismo nivel histórico
(`computeCommonPopulationComparison`). Con menos de 3 personas comparables,
se marca `Muestra pequeña`; el titular nunca oculta ese aviso.

## 10. Referencias temporales, agrupación y huecos

- Fecha de negocio siempre `SplitWeek.startDate` (calendario UTC), nunca
  `publishedAt`. Mes/año se asignan por el lunes de inicio; una semana que
  cruza mes/año se cuenta una sola vez.
- `Semana anterior` = lunes exactamente 7 días antes de la semana
  analizada (puede quedar fuera del intervalo visible, cargado con los
  mismos filtros de split/nivel, sin ampliar la cobertura del periodo).
  `Media del período` = media de las semanas válidas anteriores a la
  semana analizada **dentro** del periodo seleccionado.
- Los huecos (semana sin publicación, o excluida) se muestran como huecos
  reales en los gráficos (`connectNulls={false}` + siembra de todas las
  semanas de calendario del periodo en `buildTrend`), nunca como cero ni
  como una línea que salte por encima del hueco.

## 11. Distinción entre fechas de rendimiento y operaciones económicas (parte I2)

El rendimiento y los bonus usan siempre semanas publicadas. El subbloque
económico de "Impacto de la gamificación" usa **fecha de operación**
(`createdAt`/`purchasedAt`) de `CreditLedgerEntry`/`ItemPurchase`, con los
mismos splits y el mismo intervalo de fechas, pero **ignora** el filtro de
nivel y la asistencia semanal (no hay nivel congelado en una compra, y una
ausencia analítica nunca revoca créditos ya emitidos). El texto junto al
panel económico lo explica siempre. Créditos
emitidos/gastados nunca se recalculan a partir de puntos agregados: se leen
directamente del libro de movimientos ya persistido.

## 12. Límites de interpretación

- Normalizar por `%` del máximo no demuestra equivalencia de exigencia
  entre splits ni entre KPI.
- El bonus mide el efecto matemático de las reglas, no causalidad: una
  mejora en el rendimiento sin bonus no demuestra que la gamificación la
  produjo (aviso visible en el bloque 6).
- Ninguna pantalla atribuye una etiqueta de valor personal ("Desmotivado",
  "Peor trabajador"...) ni recomienda decisiones laborales.
- Con muestra pequeña (menos de 3 personas comparables) se etiqueta
  explícitamente; no se generan titulares concluyentes.

## 13. Dependencia de gráficos

`recharts@2.15.4` (única dependencia nueva, versión fijada; React 16-18
compatible). Componentes cliente aislados en
`src/components/analytics/charts/*`; el resto del módulo (filtros, tablas,
cálculo) es puramente de servidor. Cada gráfico principal incluye un
detalle `Ver datos` con la tabla equivalente accesible por teclado.

## 14. Cómo ejecutar las pruebas

```bash
npm run test -- tests/advanced-analytics-domain.test.ts tests/advanced-analytics-service.test.ts tests/advanced-analytics-access.test.ts
npm run typecheck
npm run lint
npm run build
```

Las pruebas de servicio/acceso usan la base de datos real de pruebas
(`tests/helpers/db.ts`, sin mocks), igual que el resto del proyecto:
construyen splits/participantes/publicaciones reales con los servicios ya
existentes y verifican el motor de lectura sobre esas instantáneas.

## 15. Checklist manual (por bloque)

1. **Acceso**: el administrador ve "Analítica avanzada" justo debajo de
   "Resultados"; un participante no la ve ni puede entrar escribiendo la
   URL (redirige a `/noticias`/`/resultados`).
2. **Visión general**: con publicaciones aparecen las seis pestañas con
   datos reales; sin publicaciones se muestra un estado vacío útil.
3. **Combinación de splits**: una persona con dos splits el mismo lunes
   aparece una sola vez en las tarjetas/tablas de personas, con su índice
   consolidado; el detalle conserva ambas filas originales.
4. **Nivel histórico**: filtrar por N0/N1/N2 usa el nivel de cada semana
   publicada; un cambio de nivel se ve reflejado en el detalle de persona.
5. **Modo con/sin gamificación**: el bloque de impacto de la gamificación
   sigue mostrando base y bonificado a la vez, cuadrando con
   profesión+localización+objetos publicados.
6. **Asistencia y medida (`1.1.1`)**: una semana con al menos una ausencia
   real la excluye de las estadísticas de rendimiento en cualquier medida,
   sin ningún ajuste manual; el selector `% del máximo | Puntos KPI |
   Puntos por hora` cambia la cifra mostrada sin alterar `Resultados` ni
   créditos oficiales; una publicación anterior a `1.1.1` se sigue
   mostrando sin errores (cobertura de asistencia desconocida).
7. **Comparaciones**: "Semana anterior" y "Media del período" muestran la
   semana/referencia correctas y "Sin referencia" cuando falta, sin
   inventar variaciones.
8. **Gráficos y tablas**: cada gráfico principal tiene su "Ver datos"; las
   cifras de la tabla y del gráfico coinciden.
9. **Meses/años y semanas simultáneas**: no se duplican personas ni se
   desplazan fechas de semana.
10. **Distribución y rachas**: los huecos, exclusiones y valores negativos
    o superiores al 100 % se respetan en la distribución.
11. **Detalle de persona**: compara con el resto de su nivel esa misma
    semana y enlaza a la publicación original para verificar el dato.
12. **Economía**: los objetos, compras y saldos siguen siendo históricos y
    reales; las fechas económicas están explicadas junto al panel.
13. **Responsive**: recarga, "Restablecer filtros" y el diseño en
    escritorio panorámico/móvil funcionan sin desbordamiento horizontal.

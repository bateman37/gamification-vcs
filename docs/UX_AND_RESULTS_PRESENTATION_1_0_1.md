# UX y presentación de resultados (`1.0.1`)

Hotfix de experiencia de usuario sobre la `1.0.0` (centro de noticias y
renovación visual "Prisma competitivo"): corrige defectos de navegación,
maquetación y ortografía, aclara la semántica de "media" en el histórico
general, rediseña `/fichas` y el detalle de un split, y añade una nueva
funcionalidad de proyección en vivo ("Presentar resultados"). **No cambia
ningún modelo de datos, ninguna fórmula de KPI, ningún bonus, ninguna regla
de clasificación ni ninguna publicación existente**: todo lo descrito aquí
es presentación, navegación o una operación de lectura sobre datos ya
oficiales.

## 1. Motivo y alcance

La `1.0.0` introdujo el sistema visual "Prisma competitivo" y el centro de
noticias, pero dejó varios defectos de uso real: la barra lateral crecía
con el contenido en vez de ocupar el alto del viewport, el orden de
navegación del administrador no empezaba por Noticias, gran parte del
texto visible carecía de tildes, la palabra "media" del histórico general
era ambigua, `/fichas` era una rejilla de tarjetas estrechas con enlaces
subrayados, el detalle del split no tenía una navegación contextual real,
la configuración de KPI no aprovechaba el ancho panorámico y solo permitía
guardar KPI uno a uno, y "Añadir participante" tenía el botón mal ubicado.
Esta entrega corrige todo eso y añade "Presentar resultados", una
funcionalidad nueva pero estrictamente de lectura y presentación.

## 2. Barra lateral fija a `100dvh`

`src/components/AppShell.tsx` y `src/components/MobileNav.tsx`: la barra
lateral de escritorio pasa a `sticky top-0` con `h-dvh` (alto exacto del
viewport dinámico), en vez de crecer con el contenido de la página. Solo
la zona de enlaces centrales tiene `overflow-y-auto` propio en alturas o
zoom extremos; el pie ("Mi cuenta"/"Cerrar sesión") queda siempre anclado
y visible, nunca se desplaza fuera de la pantalla. El menú móvil aplica el
mismo patrón (`h-dvh`, zona de enlaces con scroll propio, pie anclado).
Solo el contenido principal (`<main>`) tiene el scroll vertical de la
página.

## 3. Orden de navegación

`src/components/nav-items.ts` (`buildNavItems`), única fuente compartida
por `SidebarNav` y `MobileNav`: el administrador ve ahora **Noticias,
Personas, Splits, Resultados** (y Fichas si está vinculado a una persona),
en vez de dejar Noticias al final. El participante no cambia (Noticias,
Resultados, Fichas). Cubierto por `tests/branding.test.ts`.

## 4. Política de texto visible en castellano

Se audita y corrige la ortografía de todo el texto realmente visible para
el usuario (navegación, títulos, botones, columnas de tabla, badges,
mensajes de éxito/error, mensajes de validación de servidor, plantillas de
noticias automáticas, `aria-label`) para usar tildes correctas
(añadir/aún/clasificación/configuración/contraseña/créditos/economía/
está/evolución/facción/gamificación/histórico/localización/máximo/menú/
número/página/posición/profesión/publicación/sesión/técnico/también/
todavía, entre otras). **No se ha renombrado ninguna ruta, ningún nombre
de fichero, ningún identificador de código, ningún enum de Prisma, ninguna
clave de campo de formulario, ninguna clave de noticia/idempotencia ni
ningún dato ya congelado en una publicación histórica**: por ejemplo, las
rutas `/splits/[id]/weeks/[weekId]/localizacion` o los anclajes internos
`#kpi-configuracion`/`#facciones` siguen escritos exactamente igual, solo
cambia el texto que el usuario lee. Los comentarios técnicos preexistentes
no eran el objetivo de esta auditoría (solo el texto que ve el usuario);
la documentación nueva o tocada en esta entrega sí usa tildes correctas.
Regresión acotada en `tests/spanish-labels.test.ts` sobre las fuentes
centrales de etiquetas (categorías de noticia, rótulos de bonus, estados
de split, navegación por rol).

## 5. "Media semanal" en el histórico general

`src/domain/history-display.ts` (`resolveHistoryDisplayConfig`, función
pura y probada) centraliza qué columnas y textos mostrar según la
agrupación de `/resultados > Histórico general`
(`src/app/resultados/HistoricoSection.tsx`):

- **Agrupación `Semana`**: cada periodo es siempre una única semana
  publicada, así que la media coincidiría siempre con la suma. Se ocultan
  la media secundaria bajo cada KPI, la columna "Media semanal total KPI"
  y la columna "Semanas publicadas" (siempre `1`): eran ruido, no
  información nueva. Se conservan la fecha real de inicio de la semana, el
  nombre del split como texto secundario (con varios splits en el filtro),
  cada KPI, el total KPI, los puntos por posición, los créditos oficiales
  y las bandas de color existentes.
- **Agrupación `Mes`/`Año`**: se mantiene la media, ahora rotulada "Media
  semanal" (por KPI) y "Media semanal total KPI" (columna), con una nota
  de ayuda visible y asociada mediante `aria-describedby` (nunca solo un
  `title`, inaccesible en móvil):

  > Media semanal = suma del periodo dividida entre las semanas publicadas
  > incluidas. En cada KPI, "No aplica" no cuenta en el divisor; una
  > ausencia con resultado 0 sí cuenta.

Ningún dato ni cálculo cambia: `getPersonHistory` no se ha tocado; solo
cambia qué columnas se muestran y cómo se rotulan. Probado en
`tests/history-display.test.ts`.

## 6. Rediseño de `/fichas`

`src/app/fichas/page.tsx` deja de ser una rejilla de tarjetas estrechas
con enlaces subrayados: cada participación es ahora una **tarjeta
horizontal de ancho completo** (`src/app/fichas/ProfileSplitCard.tsx`),
agrupada en tres secciones (se omite la que esté vacía):

1. **Splits activos** — orden por fecha de inicio ascendente (empate:
   nombre alfabético).
2. **Próximos splits** (`DRAFT`) — mismo orden.
3. **Splits finalizados** (`CLOSED`) — orden por fecha de inicio
   **descendente** (el más reciente finalizado primero).

El orden y la agrupación son una función pura y probada
(`groupAndOrderProfileCards`, `src/domain/profile-order.ts`,
`tests/profile-order.test.ts`); `listProfileCardsForPerson` ya no impone
ningún orden propio. Cada tarjeta muestra avatar, alias, nivel técnico,
facción, profesión con sus dos KPI, localización activa (si la hay) y dos
botones reales del sistema de diseño: "Resultados del split" (secundario,
icono de trofeo; deshabilitado con texto accesible "Aún no hay resultados
publicados" si el split todavía no tiene publicaciones) y "Configurar
personaje"/"Ver personaje" (en `CLOSED`, de solo lectura). La edición de
alias, avatar y profesión se traslada por completo a la ruta dedicada
`/fichas/[splitParticipantId]` (antes vivía duplicada en el listado): esa
ruta ahora también carga las profesiones disponibles para el nivel de esa
participación concreta. Nunca se cargan los bytes del avatar en la consulta
del listado (solo su versión/hash, igual que antes de esta entrega).

## 7. Submenú lateral del detalle del split

`src/app/splits/[id]/SplitDetailNav.tsx` sustituye el índice de enlaces
subrayados por una columna lateral compacta, a la izquierda del contenido
del split y a la derecha de la barra global: `sticky` bajo la cabecera,
icono por opción, sección activa marcada por color (nunca solo un
subrayado). Activa la sección indicada por el hash al cargar y sigue el
scroll con `IntersectionObserver`; los enlaces son anclas HTML normales
que funcionan sin JavaScript. En móvil/tablet se sustituye por un control
"Secciones del split" (`SplitDetailMobileNav.tsx`) que despliega un panel
con las mismas opciones y se cierra al elegir una. Todas las secciones del
split usan `scroll-mt-20` de forma consistente para no quedar ocultas bajo
la cabecera fija.

**Hotfix `1.0.2`:** el submenú incluye ahora "Presentar resultados" justo
después de "Calendario de semanas" y antes de "Clasificación general
individual", en escritorio y en su versión móvil, para `ADMIN`, exista o
no ya alguna semana publicada. `SplitDetailNavItem` distingue ahora
explícitamente un enlace de sección (`type: "section"`, ancla de la misma
página, participa en el resaltado por hash/scroll) de un enlace de ruta
real (`type: "route"`, navega con `Link`, nunca altera el hash ni participa
en el `IntersectionObserver`): la funcionalidad de la sección 10 no
cambia, solo se hace alcanzable desde el submenú.

## 8. Guardado individual y conjunto de KPI

`src/app/splits/[id]/KpiConfigSection.tsx`/`KpiConfigCard.tsx`: cada fila
de KPI se reorganiza en zonas estables (identidad a la izquierda, campos
que envuelven en el centro, columna de acción de ancho fijo a la derecha,
fuera del grupo de campos variables). Un único `<form>` exterior comparte
la `FormData` entre el guardado individual de cada tarjeta (su botón usa
`formAction` propio) y el nuevo botón **"Guardar todos los KPI"** (acción
por defecto del formulario), sin llamar a diez Server Actions ni abrir diez
transacciones independientes:

- `parseAllKpiConfigsFromFormData` (`src/server/validation/kpi.ts`, función
  pura) valida los diez KPI con el mismo esquema que el guardado
  individual; si cualquiera es inválido, no se guarda ninguno y los
  errores se devuelven atados a su KPI y campo (`${kpiCode}.${campo}`), de
  modo que cada tarjeta solo recibe los suyos.
- `updateAllKpiConfigs` (`src/server/services/kpi.service.ts`) reutiliza
  `applyKpiConfigUpdate`, la misma función interna que usa el guardado
  individual: vuelve a comprobar el bloqueo de primera publicación una
  sola vez para todo el lote (dentro de la misma transacción) y aplica,
  KPI a KPI, las mismas restricciones de localizaciones/objetos que ya
  usaban un KPI. Un fallo de cualquier entrada revierte la transacción
  completa.
- `updateKpiConfigAction` vuelve a exigir `requireAdminSession()` dentro de
  la propia Server Action, igual que el resto de acciones administrativas.

Probado en `tests/kpi-bulk-save.test.ts` (validación pura, guardado
conjunto atómico, bloqueo por primera publicación, bloqueo en split
cerrado, rechazo por localización futura sin persistir el resto del
lote).

## 9. Alineación de "Añadir participante"

`src/app/splits/[id]/AddParticipantForm.tsx`: los campos se alinean en una
franja horizontal de altura común, con el botón "Añadir participante" en
una columna exterior estable a la derecha (antes quedaba justo bajo la
nota de "Semana inicial"). Los textos de asterisco se trasladan a una
franja de ayuda única bajo toda la rejilla, cada uno nombrando su campo
para que el asterisco compartido no sea ambiguo, y asociados mediante
`aria-describedby`. El texto de profesión se adapta al estado real (opcional
hasta la primera publicación, u obligatoria si el split ya publicó una
semana usándolas) sin sustituir nunca el `required`/`aria-required` real
del campo. No cambia ninguna regla de alta.

## 10. "Presentar resultados"

Nueva funcionalidad puramente de lectura y presentación: un administrador
puede proyectar en vivo la clasificación de la última semana publicada de
un split.

### 10.1 Acceso

Bajo "Calendario de semanas" en el detalle del split
(`src/app/splits/[id]/PresentationLaunchSection.tsx`): si no hay ninguna
semana publicada, el botón aparece deshabilitado con el texto "Publica una
semana para presentar sus resultados"; si las hay, se muestra el intervalo
real de la semana que se presentaría (`Semana del dd/mm/aaaa al
dd/mm/aaaa`, nunca "Semana N" a secas) junto al botón, que enlaza a
`/splits/[id]/presentacion-resultados`.

### 10.2 Fuente de datos: solo lo oficial ya publicado

`buildSplitResultsPresentation` (`src/server/services/results-presentation.service.ts`):

- localiza la **última** `WeekPublication` del split por número de
  secuencia de semana (nunca la última semana del calendario ni una
  semana completa-pero-sin-publicar);
- lee `PublishedParticipantWeeklyResult`/`PublishedKpiResult` de esa
  publicación para la clasificación semanal individual (`totalKpiPoints`,
  `weeklyRank`, ya congelados, nunca recalculados);
- reutiliza `computeSplitClassification` para la clasificación general
  individual acumulada (`totalPositionPoints`, con el mismo criterio de
  empate ya existente) y `computeFactionClassification` para las dos
  clasificaciones de facción (semanal: `weeklyScore`/`topContributors` de
  la última semana publicada; general: `totalScore` acumulado), sin
  reimplementar ningún ranking ni la regla del top-3 de facciones;
- cuando el split no usa facciones o ninguna publicación tiene snapshot de
  facción, `hasFactionData` es `false` y las fases de facción se omiten
  limpiamente (sin inventar datos ni mostrar un error);
- carga únicamente la versión (hash) del avatar de cada participante
  implicado, nunca `imageData`;
- el DTO devuelto excluye explícitamente `fullName` y `email`.

Sin publicación alguna, la ruta muestra un estado vacío seguro (nunca un
error). Un split inexistente devuelve `404` (`getSplitById` + `notFound()`
en la página, antes de invocar el servicio).

### 10.3 Agrupación de la revelación

`buildRevealGroups` (`src/domain/results-presentation-reveal.ts`), función
pura y probada (`tests/results-presentation-reveal.test.ts`): filtra las
posiciones `<= 6`, agrupa por posición real (un empate comparte grupo y se
revela a la vez, sin inventar ningún orden visual adicional entre
empatados) y devuelve los grupos en orden de revelación (de la peor
posición incluida hacia la primera). Soporta menos de seis participantes y
saltos de posición por empate (`1, 2, 2, 4`); un empate justo en la
posición de corte incluye a todos los empatados, nunca a la posición `7`.
Facciones usan exactamente la misma función.

### 10.4 Fases

`PresentationView` (`src/app/splits/[id]/presentacion-resultados/`):
portada (nombre del split, "Resultados semanales", intervalo real,
"Publicado", botón "Comenzar presentación") → clasificación semanal
individual ("Puntos KPI de la semana") → clasificación general individual
("Puntos por posición acumulados") → clasificación semanal de facciones
(si `hasFactionData`) → clasificación general de facciones (si
`hasFactionData`) → resumen final (tabla completa de la clasificación
general individual, con pestaña a la de facciones si existe, "Repetir
presentación" y "Volver al split").

### 10.5 Controles, teclado y accesibilidad

Pausar/Reanudar, Siguiente, Anterior, Reiniciar fase, Saltar fase y Salir
de la presentación, más avance automático cada ~3 s mientras se reproduce.
Teclado: Espacio (pausar/reanudar), flecha derecha o Enter (siguiente),
flecha izquierda (anterior), Escape (sale de pantalla completa del
navegador si estaba activa); los controles ignoran estas teclas cuando el
foco ya está en un botón/enlace/campo que las usa de forma nativa. Un
`aria-live="polite"` anuncia la posición revelada sin repetir toda la
pantalla. El estado de la revelación es puramente local a React: nunca se
guarda en Prisma, nunca genera noticias ni modifica la semana; recargar la
página reinicia la presentación.

### 10.6 Privacidad y seguridad

La ruta exige `requireAdminSession()` (además del `middleware` que ya
protege todo `/splits/*`); nunca acepta `personId`/puntos/posiciones desde
el navegador. Las tarjetas de participante muestran solo posición, alias,
avatar (o iniciales) y los puntos de esa fase: nunca nombre real, correo
ni KPI individuales de otros participantes.

### 10.7 Diseño y movimiento

Lienzo fijo a pantalla completa (`position: fixed`, `inset-0`, `z-50`) que
cubre por completo la barra lateral y la cabecera de la aplicación, sin
reestructurar el layout raíz; usable sin activar la API de pantalla
completa del navegador, con un botón "Entrar en pantalla completa" que
la activa tras el gesto del usuario (oculto si el navegador no la admite).
Ámbar para el primer puesto, azul/violeta como estructura, color de
facción solo como acento de identidad. La animación de entrada
(`.animate-reveal-in`, `src/app/globals.css`) es opacidad + un ligero
desplazamiento de ~550 ms; la regla `prefers-reduced-motion` ya existente
(seccion 10 de `docs/DESIGN_SYSTEM.md`) la reduce a instantánea sin omitir
ningún paso de la revelación (`tests/reduced-motion.test.ts`).

## 11. Sin cambios de modelo ni de fórmulas

Esta entrega no añade ninguna migración de Prisma, ninguna columna nueva,
ningún campo de estado persistido para la presentación, ninguna fórmula de
KPI ni ningún bonus nuevo. Toda la funcionalidad nueva es de lectura sobre
datos ya oficiales (publicaciones existentes) o de presentación pura sobre
el cliente.

# Sistema visual "Prisma competitivo" (`1.0.0` / MVP-3)

Direccion visual permanente de toda la aplicacion. Es unicamente el nombre
interno de la identidad grafica: no renombra el producto (sigue siendo
**Gamification VCS**), ningun modelo de Prisma ORM ni ningun concepto de
negocio.

## 1. Proposito e independencia de tematica

Identidad generica de gaming/gamificacion, profesional, colorida sin ser
infantil, legible con mucha densidad de datos. Debe funcionar igual para
un split de fantasia, olimpiadas, mundo medieval o cualquier otra
tematica: la ambientacion vive en los nombres, avatares, facciones,
profesiones, localizaciones, objetos y noticias **de cada split**, nunca
en la estructura visual global. La identidad permanente no usa castillos,
naves, medallas olimpicas, criaturas de franquicias ni terminologia de
mision/quest/logro que no existe en el producto.

## 2. Paleta y tokens

Los colores fisicos viven **solo** en `src/app/globals.css` (variables CSS
`--color-*`, como tripletes `R G B` para poder combinarse con opacidad
Tailwind) y se exponen en `tailwind.config.ts` con nombres semanticos.
Ningun componente conoce un hexadecimal suelto salvo `BrandMark.tsx`
(marca SVG) y los propios tokens.

| Token Tailwind | Uso | Hex |
|---|---|---|
| `canvas` | Fondo general | `#F7F8FC` |
| `surface` | Superficie principal (tarjetas, cabecera) | `#FFFFFF` |
| `surface-muted` | Panel secundario, fila de tabla en hover, fondo de badge neutro | derivado `#F3F5F9` |
| `ink` | Texto principal, navegacion | `#172033` |
| `text-muted` | Texto secundario | `#667085` |
| `border` | Borde principal | `#E4E7EC` |
| `border-strong` | Borde de campo, borde discontinuo | `#D0D5DD` |
| `primary` / `primary-hover` / `primary-soft` | Accion principal y seleccion | `#2563EB` / `#1D4ED8` / `#EFF6FF` |
| `game` / `game-ink` / `game-soft` | Progreso, profesiones | `#6D4AFF` / `#5B21B6` / `#F5F3FF` |
| `info` / `info-ink` / `info-soft` | Informacion activa, localizaciones | `#0F9D8A` / `#0F766E` / `#F0FDFA` |
| `reward` / `reward-ink` / `reward-soft` | Creditos, recompensas, importante | `#F4B740` / `#92400E` / `#FFFBEB` |
| `success` / `success-soft` | Exito, publicado | `#16A34A` / `#F0FDF4` |
| `danger` / `danger-ink` / `danger-soft` | Error, accion destructiva | `#E85D5D` / `#B42318` / `#FEF2F2` |

## 3. Reglas de color

- Azul (`primary`) es la unica accion principal: botones primarios,
  enlaces relevantes, foco y seleccion.
- Violeta (`game`) identifica progreso/profesiones; turquesa (`info`)
  informacion activa/localizaciones; ambar (`reward`) creditos,
  recompensas y prioridad importante — **nunca** con texto blanco encima
  (siempre `reward-ink` sobre `reward-soft` o sobre `reward` solido).
  Verde y coral quedan reservados a exito/publicado y error/peligro.
- Ningun estado se comunica solo por color: leido/no leido tambien usa un
  punto/franja y peso de fuente; publicado/importante tambien lleva
  texto o badge.
- Los colores de facción (`SplitFaction.color`) son **datos del split**:
  solo aparecen en puntos, franjas, chips o avatares que identifican a esa
  faccion. Nunca cambian la navegacion, el fondo general, los botones ni
  los formularios. Si el color no ofrece contraste suficiente, se usa como
  muestra/borde junto a texto `ink`, nunca como fondo de texto sin
  comprobar contraste.
- No hay modo oscuro ni tema por split en esta release; no hay editor de
  branding ni selector de paletas.

## 4. Tipografia y numeros

`Inter` autoalojada con `next/font/google` (`src/app/layout.tsx`, variable
CSS `--font-app`, consumida por `tailwind.config.ts` con una pila de
sistema como respaldo si el entorno de build no pudiera descargarla).
Jerarquia: titulo de pagina (`PageHeader`, `text-xl font-semibold`),
titulo de seccion (`SectionHeader`, `text-base font-semibold`), cuerpo
(`text-sm`), ayuda/etiqueta (`text-xs text-text-muted`). KPI, creditos,
porcentajes, posiciones y celdas de tabla usan la utilidad `.tabular`
(`font-variant-numeric: tabular-nums`, `src/app/globals.css`).

## 5. Marca visible

`Gamification VCS` sigue siendo el nombre visible. `BrandMark.tsx` es una
marca abstracta en SVG (cuatro piezas modulares en progresion, sin
tematica concreta), con una variante `light` (fondos claros) y `dark`
(barra lateral tinta), reconocible a tamano pequeño y sin depender de un
bitmap externo.

## 6. App shell y navegacion

`src/components/AppShell.tsx` (servidor) calcula sesion, rol y noticias
una sola vez y compone:

- **Escritorio**: barra lateral fija tinta (`bg-ink`), `sticky top-0` y
  `h-dvh` (`1.0.1`: ocupa exactamente el alto del viewport en vez de
  crecer con el contenido de la pagina), con marca, navegacion
  (`SidebarNav.tsx`, resalta la ruta activa con `usePathname`) y, al pie
  siempre anclado y visible, "Mi cuenta"/cerrar sesion. Solo la zona de
  enlaces centrales admite scroll propio en alturas/zoom extremos; el
  `<main>` es el unico scroll de la pagina.
- **Movil/tablet**: cabecera compacta (`sticky top-0`) con marca, campana
  y boton de menu (`MobileNav.tsx`, panel deslizante con el mismo patron
  `h-dvh`/pie anclado, cerrable con `Escape`, sin bloquear el scroll tras
  cerrarse).
- **Navegacion por rol** (`src/components/nav-items.ts`, funcion pura
  `buildNavItems`): administrador ve **Noticias primero** (`1.0.1`),
  despues Personas, Splits, Resultados y Fichas (solo si su cuenta esta
  vinculada a una persona); participante ve Noticias, Resultados y
  Fichas. La campana aparece para cualquier usuario autenticado.
- El acceso raiz `/` redirige a `/noticias` para cualquier usuario
  autenticado (`src/app/page.tsx`): Noticias es el punto de entrada desde
  la `1.0.0`, sin eliminar los accesos directos existentes.
- **Submenu contextual de un split** (`1.0.1`,
  `src/app/splits/[id]/SplitDetailNav.tsx`): columna lateral compacta y
  distinta de la barra global (fondo `surface-muted`), `sticky` bajo la
  cabecera, icono por opcion y seccion activa marcada por color; version
  movil con un control "Secciones del split" que despliega el mismo
  listado. Nunca compite visualmente con la barra lateral global.

## 7. Componentes compartidos (`src/components/ui.tsx`)

`Button`/`LinkButton`/`IconButton` con variantes `primary`/`secondary`/
`ghost`/`danger`/`game` (`1.0.1`: tono violeta de personaje/juego, usado en
"Configurar personaje" y "Presentar resultados"; todas con estados
`hover`/`focus-visible`/`active` vía transición de 150 ms y `disabled` vía
opacidad **más** `cursor-not-allowed`, nunca solo opacidad); `SubmitButton`
conserva su firma anterior
(usada en mas de veinte formularios) como envoltorio de `Button`.
`Card`/`StatCard` para paneles y metricas; `PageHeader`/`SectionHeader`
para cabeceras consistentes; `Badge` con tonos semanticos (incluye los
tonos heredados `slate`/`green`/`amber`/`gray` mapeados al tono mas
cercano, para no romper los usos existentes); `Alert` (`success`/
`warning`/`info`/`error`) ademas de los `ErrorMessage`/`SuccessMessage`
anteriores; `TableContainer` + `TABLE_HEAD_ROW_CLASSES`/
`TABLE_ROW_HOVER_CLASSES`; `EmptyState`; `Skeleton`. No se ha creado un
sistema de configuracion por JSON: solo los patrones realmente repetidos.

## 8. Fichas, objetos y mercado

El tratamiento de coleccion (tarjetas compactas) se aplica solo donde ya
existe la funcionalidad real: avatar y resumen de personaje, profesion en
tarjeta violeta (`game`), localizacion activa en tarjeta turquesa
(`info`), saldo en tarjeta ambar (`reward`), inventario/equipo con
tarjetas consistentes. No se han añadido ilustraciones, rarezas,
animaciones ni elementos inexistentes en `0.9.0`.

## 9. Responsive y pantallas panoramicas

Las paginas administrativas y de datos usan el ancho util disponible tras
la barra lateral (`main` con `max-w-[1920px]` y padding creciente por
breakpoint, heredado de versiones anteriores); las tablas anchas
conservan scroll horizontal accesible en movil (`TableContainer`). Probado
visualmente en movil, `1366px`, `1920px` y una vista ultrapanoramica de
`2560px` (ver checklist manual).

## 10. Accesibilidad y movimiento

- Foco visible y consistente: `*:focus-visible` en `globals.css` aplica
  un contorno de 2px en `primary` a toda la aplicacion.
- Botones de icono llevan `aria-label`; la campana anuncia el numero de
  no leidas en su `aria-label` y usa `aria-haspopup`/`aria-expanded`.
- Ningun estado depende solo del color (ver seccion 3).
- Transiciones de like 150 ms como maximo; `@media (prefers-reduced-motion:
  reduce)` en `globals.css` anula duraciones de animacion/transicion para
  quien lo prefiera. No hay parallax, confeti ni animaciones continuas.
- **`1.0.1`:** la unica animacion nueva (`.animate-reveal-in`, entrada de
  cada tarjeta revelada en "Presentar resultados") es opacidad + un ligero
  desplazamiento de ~550 ms, sujeta a la misma regla
  `prefers-reduced-motion` de arriba (se reduce a instantanea sin omitir
  ningun paso de la revelacion). Ver
  `docs/UX_AND_RESULTS_PRESENTATION_1_0_1.md`.

## 11. Ejemplos de uso correcto e incorrecto

- Correcto: usar `<Badge tone="reward">Importante</Badge>` para una
  noticia prioritaria. Incorrecto: pintar toda la tarjeta de amarillo o
  usar `bg-yellow-400` suelto.
- Correcto: un objeto de facción usa su `color` guardado solo como
  pastilla/borde junto al nombre. Incorrecto: cambiar el fondo de la
  barra lateral o de un botón primario según la facción del usuario.
- Correcto: `<Button variant="secondary">Cancelar</Button>` junto a
  `<Button variant="primary">Guardar</Button>`. Incorrecto: dos botones
  `primary` compitiendo por la misma atención en el mismo formulario.


## 12. Tablero de equipo: "Prisma competitivo atenuado" (`1.2.0`)

El tablero visual de equipo (`/fichas/[splitParticipantId]` y el editor
administrativo de `/splits/[id]/economia`) toma del genero RPG **solo la
estructura**: una silueta con las ranuras distribuidas a su alrededor. No es
una licencia para cambiar el branding.

- Usa exclusivamente los tokens ya existentes: `canvas`/`surface` para
  pagina y bloques, `ink`/`text-muted` para estructura y texto, `primary`
  para seleccion y accion principal, `game` para profesion, `info` para
  localizacion y destino valido de arrastre, `reward` para creditos,
  `success`/`danger` solo para sus estados. **No se ha añadido ningun token
  ni ningun hexadecimal nuevo.**
- Tablero claro; silueta en `ink` con opacidad muy baja (`~0.06-0.07`);
  ranuras vacias neutras; borde azul solo para seleccion y cambio sin
  confirmar; turquesa solo durante un destino valido; coral solo para
  destino invalido o error; ambar reservado a creditos y recompensa. El
  color del contenido lo aportan las imagenes de los objetos; el marco
  permanece sobrio.
- Prohibido en esta pantalla: arcoiris por ranura, neones, resplandores,
  degradados decorativos dominantes, piedra, pergamino, fuego, runas, metal
  medieval, fondos espaciales o futuristas, marcos dorados de rareza,
  texturas pesadas y copiar la interfaz identificable de un videojuego
  concreto. Debe sentirse como una aplicacion profesional gamificada.

**Silueta** (`src/components/equipment/EquipmentSilhouette.tsx`): SVG
generico, geometrico, sin rostro, sin genero marcado, sin raza, edad,
uniforme ni tematica; `aria-hidden` y `focusable="false"` porque no contiene
informacion funcional; independiente del avatar del jugador; incapaz de
ocultar etiquetas, estados o controles (se oculta en movil cuando resta
espacio). El tablero **nunca** es una imagen rasterizada: ranuras,
miniaturas, textos, badges y controles son HTML accesible.

**Miniatura de objeto** (`src/components/equipment/StoreItemImage.tsx`): un
unico componente consistente para administracion, mercado, inventario, equipo
y desglose lateral. Sin imagen muestra un icono neutro **local** asociado a
la posicion visual de la ranura (formas geometricas simples, nunca
ilustraciones tematicas, nunca imagenes remotas ni placeholders de terceros).
Cuando el nombre del objeto ya esta inmediatamente al lado, la miniatura es
redundante y usa `alt=""` para no repetirlo. Las tablas densas de resultados
siguen **sin** miniaturas.

**Accesibilidad y movimiento:** ningun estado depende solo del color (todos
llevan badge o texto); todo lo que se hace arrastrando se puede hacer con
clic y teclado sobre botones HTML reales; los cambios se anuncian en una
region `aria-live` discreta; objetivos tactiles de al menos 44 px; sin
animaciones continuas, confeti ni rebotes (solo las transiciones de 150 ms ya
existentes, sujetas a `prefers-reduced-motion`). En movil la composicion se
apila en dos columnas y la pagina nunca tiene scroll horizontal.

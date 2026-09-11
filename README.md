# Gamification VCS

Aplicacion web para administrar las gamificaciones periodicas ("splits")
del equipo de Customer Service. Sustituye un libro Excel con formulas y
hojas de datos por una aplicacion sencilla que representa correctamente
los conceptos del negocio: personas, splits, semanas, participantes, KPI,
resultados y clasificacion.

## Estado actual

**MVP-1A — Personas y creacion de splits**, **MVP-1B — KPI activos y
configuracion**, **IMPORT-1A / MVP-1C.1 — Carga semanal de
Productividad**, **MVP-1C.2 / IMPORT-1B — Carga semanal de Escalados,
Calidad y Llamadas**, **MVP-1C.3 / INPUT-1C — Cargas manuales y
completitud semanal**, **BUGFIX-1 / UX-SPLIT-1 — Correcciones de
formularios manuales y configuracion compacta del split**, **`0.6.0` /
MVP-1C — Resultados, publicacion y clasificacion**, **`0.7.0` / MVP-2A —
Facciones, clasificacion de facciones y consolidacion de UX** y **`0.8.0` /
MVP-2B — Profesiones, bonus de KPI y fichas de participante** (ver
`docs/ROADMAP.md`). Version actual: `0.8.0`.

Estas entregas implementan:

- Gestion de personas (registro global, reutilizable entre splits).
- Creacion y edicion de splits en borrador, con generacion automatica de
  sus semanas.
- Incorporacion de participantes a un split (persona + alias + nivel +
  semana inicial), tanto en borrador como con el split ya activo.
- Catalogo cerrado de los diez KPI de Split 8, configurable por split:
  activacion, maximo base, multiplicadores por nivel y parametros propios
  de cada tipo de calculo (ver `docs/KPI_CONFIGURATION.md`).
- Activacion de un split cuando tiene al menos un participante **y** al
  menos un KPI activo.
- Carga semanal del Excel de Productividad desde el calendario de semanas
  de un split activo, con previsualizacion, emparejamiento por nombre
  real, calculo administrativo de Cazador de soluciones y Explorador de
  datos, y sustitucion explicita de una carga anterior (ver
  `docs/IMPORT_PRODUCTIVITY.md`).
- Carga semanal de los Excel de Escalados, Calidad y Llamadas, con calculo
  administrativo de Domador de Escaladas (cruzado con Productividad de la
  misma semana), Maestro Artesano y Embajador de voz. Cada carga confirmada
  queda verde aunque falten participantes (`n AVISO`); el amarillo queda
  reservado para la dependencia de Domador (ver
  `docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md`).
- Entrada manual de los cinco KPI restantes — Guardian de la Estabilidad,
  Cronomagia laboral, Redactor estrella, Estudiante entusiasta y Aprendiz
  experto —, sin Excel, con guardado atomico y estados
  `Pendiente`/`Cargado`. **Los diez KPI de Split 8 tienen ya introduccion
  de datos funcional** (ver `docs/MANUAL_KPI_ENTRY.md`).
- Nueva columna `KPI cargados` en el "Calendario de semanas" de cada split
  (`n/X` de los KPI activos completos por semana, calculada al consultar).
- Hotfix: Domador de Escaladas ahora infiere reasignaciones `0` cuando la
  carga de Escalados ya existe y la persona no aparece en ella, siempre que
  tenga Productividad; si tampoco tiene Productividad, se muestra `AVISO`.
- Hotfix `AVISO`/`0`: en las pantallas de carga y comprobacion, el texto
  `VAC` se sustituye siempre por la palabra fija `AVISO` (`n AVISO`, nunca
  `AVISOS`), sin cambiar ninguna regla de cuando una carga esta completa. En
  resultados, previsualizacion, publicacion, clasificacion e historico, ese
  mismo resultado se muestra siempre como el valor numerico `0` (participa
  en sumas y rankings como cualquier otro cero); `No aplica` se mantiene
  diferenciado. Ver `docs/RESULTS_PUBLICATION.md` y `docs/DECISIONS.md`.
- Correccion de "Volver a introducir datos" en los cinco formularios
  manuales, campos vacios interpretados como `0` en Redactor estrella,
  Estudiante entusiasta y Aprendiz experto, maximo inclusivo de Aprendiz
  experto, nueva configuracion "Puntos por posicion semanal" por split y
  mejora responsive del detalle del split (`BUGFIX-1 / UX-SPLIT-1`, ver
  mas abajo).

- Motor agregado de resultados semanales, previsualizacion en vivo con
  mapa de calor, publicacion irreversible de una semana (instantanea
  inmutable) y bloqueo real de las cargas/entradas de una semana
  publicada.
- Autenticacion local (administrador y participante), con gestion de
  cuentas integrada en Personas y cambio de contrasena obligatorio en el
  primer acceso.
- Vista individual `/resultados` (por split e historico general) y
  clasificacion general del split (resumen, vista detallada y version
  limitada para participante).

- Primera capa de juego real: **facciones por split**, con administracion
  (crear/editar/eliminar segun el estado del split), asignacion
  obligatoria de participantes en cuanto el split ya usa facciones, y
  clasificacion de facciones (semanal y acumulada) calculada a partir de
  los mismos puntos por posicion ya publicados (Renombre = puntos por
  posicion, sin segunda formula). Ver `docs/FACTIONS.md`.
- **Bloqueo de configuracion tras la primera publicacion:** los puntos por
  posicion semanal y toda la configuracion de KPI (activacion, maximos,
  multiplicadores, parametros) quedan bloqueados en cuanto el split tiene
  al menos una semana publicada.
- Correcciones de UX: KPI del split en una sola linea por tarjeta, layout
  panoramico mas ancho, formulario "Anadir participante" reorganizado,
  clasificacion individual filtrada por KPI con orden y posicion correctos,
  denominador unico "x de n" en todos los resultados del split, e
  historico general con columnas KPI compactas.

- Segunda capa de juego: **profesiones configurables por split**
  (opcionales, con exactamente dos KPI distintos y disponibilidad por
  nivel), **bonus fijo del `+20 %` despues del maximo base** aplicado por
  una unica funcion pura del dominio, bloqueo de profesiones y asignaciones
  desde la primera publicacion, e instantanea publicada que congela la
  profesion y el desglose del bonus. Ver
  `docs/PROFESSIONS_AND_PROFILES.md`.
- **Fichas privadas de participante (`/fichas`)**: una ficha por
  participacion de split con avatar propio (guardado en PostgreSQL,
  validado y normalizado con `sharp`), alias editable y eleccion de la
  propia profesion mientras el split no tenga publicaciones.
- Correccion del rotulo semanal del historico general: fecha de inicio real
  de la semana en vez de `Semana N`.

Todavia **no** incluye despublicar/reabrir una semana, exportacion
Excel/PDF de resultados, ni localizaciones, objetos o economia de
creditos. Consulta `docs/ROADMAP.md` para el plan completo.

## Pila tecnologica

- [Next.js](https://nextjs.org/) 14 (App Router) + [React](https://react.dev/) 18
- [TypeScript](https://www.typescriptlang.org/) en modo estricto
- [PostgreSQL](https://www.postgresql.org/) 16
- [Prisma ORM](https://www.prisma.io/) con migraciones versionadas en Git
- [Tailwind CSS](https://tailwindcss.com/) para la interfaz administrativa
- [Vitest](https://vitest.dev/) para pruebas de servicio
- npm y su lockfile (`package-lock.json`)

## Requisitos locales

- Node.js 20 o superior
- npm 10 o superior
- Una instancia de PostgreSQL 16 accesible desde tu maquina. El recorrido
  principal de este proyecto es **PostgreSQL instalado directamente en
  Windows** (sin Docker); Docker Compose se mantiene como alternativa
  opcional (ver mas abajo).

## 1. Configurar las variables de entorno

Copia el archivo de ejemplo y ajustalo con los datos de tu instalacion
local de PostgreSQL (usuario, contrasena, puerto):

**Windows (PowerShell):**

```powershell
Copy-Item .env.example .env
```

**Linux/macOS:**

```bash
cp .env.example .env
```

El archivo `.env` no debe subirse nunca al repositorio (ya esta excluido
en `.gitignore`) y no debe contener contrasenas reales compartidas. Las
variables relevantes son `DATABASE_URL`:

```
postgresql://USUARIO:CONTRASENA@HOST:PUERTO/BASE_DE_DATOS?schema=public
```

y `AUTH_SECRET` (`0.6.0` / MVP-1C, ver `docs/AUTHENTICATION.md`), el
secreto que firma la sesion. Genera uno propio por entorno, por ejemplo con
`npx auth secret` (PowerShell) u `openssl rand -base64 32`
(Linux/macOS/WSL); no reutilices el valor de ejemplo del archivo.

## 2. Preparar PostgreSQL

### Opcion principal: PostgreSQL local en Windows

Con el servicio de PostgreSQL 16 ya instalado y en marcha en tu maquina
Windows, crea la base de datos indicada en tu `DATABASE_URL` (por
ejemplo, `gamification_vcs`) con `psql`, pgAdmin o la herramienta que
prefieras. No es necesario nada mas: la aplicacion se conecta directamente
a esa instancia mediante `DATABASE_URL`.

### Alternativa opcional: Docker Compose

Si prefieres no instalar PostgreSQL directamente, Docker Compose sigue
disponible como alternativa. Desde la raiz del proyecto:

```powershell
docker compose up -d
```

Esto levanta un PostgreSQL 16 en `localhost:5432` con usuario `postgres`,
contrasena `postgres` y base de datos `gamification_vcs`, que coincide con
el `DATABASE_URL` de `.env.example`.

Para detenerlo:

```powershell
docker compose down
```

Ni las pruebas, ni las migraciones, ni el desarrollo dependen
obligatoriamente de Docker: cualquiera de las dos opciones anteriores es
valida.

## 3. Instalar dependencias

```powershell
npm install
```

## 4. Aplicar las migraciones

Con PostgreSQL ya iniciado y el archivo `.env` configurado:

```powershell
npm run db:migrate:deploy
```

Este comando aplica las migraciones existentes sin generar ninguna
nueva; es el que se debe usar en un entorno limpio (por ejemplo, la
primera vez que se instala el proyecto). Durante el desarrollo, si
modificas `prisma/schema.prisma`, usa en su lugar:

```powershell
npm run db:migrate
```

## 5. Crear el primer administrador (`0.6.0` / MVP-1C)

Con las migraciones ya aplicadas, crea la cuenta de administrador inicial
(ver `docs/AUTHENTICATION.md`):

```powershell
$env:ADMIN_EMAIL = "admin@ejemplo.com"
$env:ADMIN_PASSWORD = "una-contrasena-temporal-segura"
npm run db:create-admin
```

No hace nada si ya existe algun administrador. La cuenta creada exige
cambiar la contrasena en el primer acceso.

## 6. Ejecutar la aplicacion en modo desarrollo

```powershell
npm run dev
```

La aplicacion queda disponible en <http://localhost:3000>. Inicia sesion en
`/login` con el administrador creado en el paso anterior.

## Comandos disponibles

| Comando | Descripcion |
|---|---|
| `npm run dev` | Arranca la aplicacion en modo desarrollo. |
| `npm run build` | Genera la build de produccion. |
| `npm run start` | Sirve la build de produccion ya generada. |
| `npm run lint` | Ejecuta ESLint sobre el proyecto. |
| `npm run typecheck` | Comprueba los tipos de TypeScript sin generar archivos. |
| `npm run test` | Ejecuta las pruebas de servicio (Vitest). Requiere una base de datos de pruebas accesible (ver mas abajo). |
| `npm run db:migrate` | Crea y aplica una nueva migracion de Prisma a partir de cambios en el esquema (uso en desarrollo). |
| `npm run db:migrate:deploy` | Aplica las migraciones existentes sin crear ninguna nueva (uso en un entorno limpio o en despliegue). |
| `npm run db:generate` | Regenera el cliente de Prisma. |
| `npm run db:studio` | Abre Prisma Studio para inspeccionar los datos. |
| `npm run db:create-admin` | Crea el primer administrador a partir de `ADMIN_EMAIL`/`ADMIN_PASSWORD` (`0.6.0` / MVP-1C). |

## Ejecutar las pruebas

Las pruebas de servicio (`tests/*.test.ts`) ejercitan las reglas de
negocio criticas contra una base de datos PostgreSQL real (no se usan
mocks para las restricciones de unicidad). Por defecto esperan una base
de datos disponible en:

```
postgresql://postgres:postgres@localhost:5432/gamification_vcs_test?schema=public
```

Puedes sobrescribir esta cadena de conexion con la variable de entorno
`TEST_DATABASE_URL`. Antes de ejecutar las pruebas por primera vez, crea
la base de datos de pruebas y aplica las migraciones:

```powershell
# Con PostgreSQL local en Windows (crea la base con psql, pgAdmin, etc.):
$env:TEST_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/gamification_vcs_test?schema=public"
npx prisma migrate deploy
npm run test
```

```powershell
# Alternativa con Docker Compose ya levantado ("docker compose up -d"):
docker compose exec db createdb -U postgres gamification_vcs_test
$env:TEST_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/gamification_vcs_test?schema=public"
npx prisma migrate deploy
npm run test
```

## Configuracion de KPI (MVP-1B)

Cada split tiene su propia configuracion de los diez KPI del catalogo
cerrado de Split 8: se pueden activar o desactivar individualmente y
editar su maximo base, sus multiplicadores por nivel (`N0`/`N1`/`N2`) y
los parametros propios de su calculo. Esta entrega todavia no calcula
ningun resultado: solo configura los datos que usara el futuro motor de
calculo (`MVP-1C`). La seccion "KPI del split" esta integrada en el
detalle de cada split (`/splits/[id]`). Referencia completa:
[`docs/KPI_CONFIGURATION.md`](docs/KPI_CONFIGURATION.md).

## Comprobar MVP-1B manualmente

Con la migracion aplicada (`npm run db:migrate:deploy`) y la aplicacion en
marcha (`npm run dev`):

1. Abre un split ya existente de MVP-1A: deberian aparecer sus diez KPI,
   todos inactivos, en la seccion "KPI del split".
2. Activa "Cazador de soluciones", "Explorador de datos" y "Maestro
   Artesano" (casilla "KPI activo en este split" + "Guardar" en cada uno).
3. Modifica el maximo base de uno de ellos, un multiplicador y uno de sus
   parametros propios, y guarda.
4. Recarga la pagina: los cambios deben seguir ahi.
5. Desactiva uno de los KPI, recarga y vuelve a activarlo: sus valores
   anteriores deben conservarse.
6. Crea un split nuevo (`/splits/nuevo`) y comprueba que tiene sus propios
   diez KPI inactivos con los valores de Split 8, independientes de los
   del split anterior.
7. Intenta activar un split en borrador sin ningun KPI activo: debe
   mostrarse un mensaje pidiendo configurar al menos uno.
8. Anade un participante y activa al menos un KPI en ese split: ahora se
   deberia poder activar correctamente.
9. Si tenias un split ya `Activo` antes de aplicar esta migracion,
   comprueba que sigue activo y que puedes configurar sus KPI desde la
   misma pantalla.

## Carga semanal de Productividad (IMPORT-1A / MVP-1C.1)

Desde el detalle de un split `Activo`, cada fila del "Calendario de
semanas" tiene una accion `Introducir KPI` (o `Ver KPI` si el split esta
`Cerrado`) que abre una pantalla independiente para esa semana. Ahi, el
grupo `Productividad` permite subir un `.xlsx` con la productividad real
de la semana, analizarlo sin guardar, confirmarlo (o sustituir una carga
anterior) y comprobar los resultados de Cazador de soluciones y Explorador
de datos ya calculados. Detalle completo, contrato exacto del Excel y
reglas de emparejamiento:
[`docs/IMPORT_PRODUCTIVITY.md`](docs/IMPORT_PRODUCTIVITY.md).

## Carga semanal de Escalados, Calidad y Llamadas (MVP-1C.2 / IMPORT-1B)

En la misma pantalla semanal, tres grupos adicionales -- `Domador de
Escaladas`, `Maestro Artesano` y `Embajador de voz` -- permiten cargar,
analizar, confirmar y sustituir sus propios Excel (Escalados, Calidad y
Llamadas respectivamente) y comprobar sus resultados calculados. Domador
depende ademas de la Productividad ya cargada de la misma semana
(`ProductivityWeeklyRow.updates`); si falta, la pantalla ofrece un enlace
directo a cargarla, incluso si Cazador de soluciones y Explorador de datos
estan inactivos. Detalle completo, contrato exacto de los tres Excel y
reglas de calculo:
[`docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md`](docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md).

## Comprobar la carga de Productividad manualmente

Con la migracion aplicada (`npm run db:migrate:deploy`) y la aplicacion en
marcha (`npm run dev`):

1. Detén el servidor de desarrollo anterior antes de `npm ci`, para evitar
   el bloqueo del DLL de Prisma en Windows.
2. Actualiza dependencias (`npm ci`) y aplica la nueva migracion.
3. Inicia la aplicacion en `localhost`.
4. Abre un split activo con al menos "Cazador de soluciones" o
   "Explorador de datos" activado, y pulsa `Introducir KPI` en la fila de
   la semana que quieras cargar.
5. Comprueba que la pantalla solo muestra los KPI activos y que
   Productividad agrupa Cazador y Explorador con un unico estado rojo
   `Pendiente`.
6. Pulsa `Cargar`, analiza tu Excel real de productividad y revisa
   encontrados, ignorados y participantes sin dato.
7. Verifica al menos dos calculos a mano con el nivel y la configuracion
   mostrados en pantalla.
8. Confirma la carga y comprueba que el unico estado cambia a amarillo
   (`Carga parcial`) o verde (`Cargado`) segun la cobertura.
9. Pulsa `Comprobar` y revisa los resultados persistidos.
10. Vuelve a cargar el mismo archivo: la pantalla debe pedir
    `Sustituir carga` en vez de crear una carga duplicada.
11. Sustituyelo y comprueba que no aparecen filas duplicadas.
12. Comprueba que un split cerrado permite `Ver KPI` y `Comprobar`, pero
    no `Cargar`.

## Comprobar la carga de Escalados, Calidad y Llamadas manualmente

Con Domador de Escaladas, Maestro Artesano y Embajador de voz activos en un
split activo, en la misma semana usada para Productividad:

1. Antes de cargar nada, `Domador de Escaladas` debe verse en amarillo
   (`Carga parcial`) si falta uno de sus dos origenes (Escalados o
   Productividad) y en rojo (`Pendiente`) si faltan ambos.
2. Carga Escalados (`Cargar`). Si Productividad de esa semana todavia no
   existe, la previsualizacion debe mostrar `Falta Productividad` en vez
   de puntos.
3. Carga Productividad de esa semana (el enlace de la pantalla lo permite
   aunque Cazador de soluciones y Explorador de datos esten inactivos).
   Domador debe pasar a verde y mostrar los puntos calculados.
4. Carga Calidad y Llamadas de la misma semana: Maestro Artesano y
   Embajador de voz deben quedar en verde con sus puntos.
5. Deja un participante aplicable sin fila en alguno de los tres ficheros:
   el grupo correspondiente debe seguir en verde, con el contador `n AVISO`.
6. Sustituye cada origen una vez (`Sustituir carga`) y comprueba que los
   otros dos, y Productividad, permanecen intactos.
7. Comprueba un cero real, un participante `Sin dato`, un `No aplica` y un
   caso `Actualizaciones es 0` en Domador.
8. Cierra el split y verifica que `Comprobar` sigue disponible en los tres
   grupos, pero `Cargar` queda deshabilitado.

## Cargas manuales y completitud semanal (MVP-1C.3 / INPUT-1C)

Con los cinco KPI restantes activos, la pantalla semanal muestra un boton
`Introducir datos` en vez de `Cargar` para Guardian de la Estabilidad,
Cronomagia laboral, Redactor estrella, Estudiante entusiasta y Aprendiz
experto. Cada uno abre su propio formulario
(`.../kpis/<origen>/introducir`) con los participantes aplicables
precargados (Guardian, solo N2) y su propia comprobacion
(`.../kpis/<origen>/comprobar`). El "Calendario de semanas" del detalle del
split muestra ademas una columna `KPI cargados` (`n/X`). Detalle completo
en `docs/MANUAL_KPI_ENTRY.md`.

### Comprobar manualmente

1. Con Productividad y Escalados cargados, deja fuera del Excel de
   Escalados a alguien que si tenga Productividad esa semana: en
   `Comprobar Domador de Escaladas` debe verse `0 (inferido)` con ayuda
   accesible, calcular puntos y no sumar al contador `n AVISO`. Deja a otra
   persona fuera de ambos ficheros: debe verse `AVISO`.
2. Pulsa `Introducir datos` en Guardian de la Estabilidad: solo deben
   aparecer los participantes N2; guarda un `0` y comprueba que se
   conserva como resultado real (no como vacaciones).
3. Introduce Cronomagia con un ratio normal (por ejemplo `38,5 / 40`), uno
   superior al 100 % (por ejemplo `46,7 / 40`) y un `0 / 0`: revisa el
   porcentaje, el limite al 100 % y el `AVISO` respectivamente en
   `Comprobar`.
4. Introduce Redactor con entregados, no entregados y propuestas en la
   misma semana, y revisa que el multiplicador solo afecta a los
   entregados.
5. Introduce horas de Estudiante, incluido un `0`.
6. Introduce formaciones de Aprendiz e intenta superar el maximo
   configurado: debe rechazarse con un mensaje claro.
7. Edita de nuevo cada formulario (el boton pasa a `Actualizar datos`) y
   comprueba que precarga sus propios valores y no toca los demas KPI.
8. Observa el "Calendario de semanas" avanzar de `0/X` a `X/X` a medida
   que completas cada KPI, quedando en verde con el texto accesible
   "Carga semanal completa" al llegar a `X/X`.
9. Cierra el split: las pantallas `Comprobar` siguen siendo consultables,
   pero ninguna accion de guardado esta disponible.

## Correcciones de formularios manuales y configuracion del split (BUGFIX-1 / UX-SPLIT-1)

Version `0.5.1`. Corrige tres errores de las cargas manuales y anade una
nueva configuracion administrativa y mejoras de composicion, sin tocar
resultados, publicacion ni clasificacion:

- **Navegacion:** "Volver a introducir datos" en los cinco formularios
  manuales vuelve realmente al formulario (antes se quedaba en la pantalla
  de exito) y precarga los datos ya guardados.
- **Campos vacios como cero:** en Redactor estrella, Estudiante entusiasta
  y Aprendiz experto, un campo vacio se guarda como `0` (Guardian de la
  Estabilidad y Cronomagia laboral no cambian).
- **Maximo inclusivo de Aprendiz experto:** un valor igual al maximo
  configurado es valido; solo se rechaza al superarlo.
- **Puntos por posicion semanal:** nueva seccion en el detalle de cada
  split con las quince posiciones y sus puntos (valores predeterminados de
  Split 8). Todavia no calcula ninguna posicion ni reparte estos puntos:
  detalle completo en
  [`docs/POSITION_POINTS_CONFIGURATION.md`](docs/POSITION_POINTS_CONFIGURATION.md).
- **Responsive:** el detalle del split aprovecha mejor pantallas grandes,
  con un indice lateral de secciones en escritorio y navegacion compacta en
  movil; `AddParticipantForm` y `KpiConfigSection` usan rejillas
  horizontales.

### Comprobar manualmente

1. En cualquiera de los cinco formularios manuales, guarda datos, pulsa
   `Volver a introducir datos` y comprueba que el formulario reaparece
   precargado con los valores guardados y el boton pasa a decir
   `Actualizar datos`.
2. En Redactor estrella, deja los tres campos vacios para una persona:
   debe guardarse sin pedir "es obligatorio" y calcularse como cero.
3. En Estudiante entusiasta, deja el campo vacio: se guarda como `0`.
4. En Aprendiz experto, introduce exactamente el maximo configurado (por
   ejemplo `15`): debe aceptarse; introduce `16` y comprueba que se
   rechaza. Revisa que el texto dice "Máximo configurado".
5. En el detalle de un split (`/splits/[id]`), guarda los quince puntos de
   la seccion "Puntos por posicion semanal" y recarga: los valores se
   mantienen; comprueba que un split cerrado los muestra en solo lectura.
6. Reduce la ventana del navegador a unos 360 px: no debe aparecer scroll
   horizontal de pagina ni una barra lateral fija. A partir de 1024 px
   aproximadamente debe aparecer el indice lateral y los KPI en rejilla de
   dos columnas.

## Resultados, publicacion, clasificacion y autenticacion (`0.6.0` / MVP-1C)

Cierra el ciclo semanal completo. Detalle funcional exhaustivo en
[`docs/RESULTS_PUBLICATION.md`](docs/RESULTS_PUBLICATION.md) y
[`docs/AUTHENTICATION.md`](docs/AUTHENTICATION.md).

- Cuando una semana esta `n/n` completa, la pantalla de cargas y el
  calendario de semanas ofrecen `Ver resultados de la semana` /
  `Mostrar resultados`, que abre una previsualizacion en vivo con tabla,
  mapa de calor y leyenda.
- `Publicar semana` (con confirmacion) crea una instantanea inmutable y
  bloquea cualquier modificacion posterior de las cargas/entradas de esa
  semana; una semana publicada se identifica con un badge y no admite
  formularios editables.
- Bajo el calendario de cada split aparece la `Clasificacion general`
  (solo puntos por posicion de semanas publicadas), con enlace a la vista
  detallada (`/splits/[id]/clasificacion`).
- `Resultados` en la navegacion superior abre `/resultados`: el
  administrador elige una persona; el participante ve siempre la suya,
  con subvistas `Por split` e `Historico general`.
- Autenticacion local con administrador y participante (ver seccion "5.
  Crear el primer administrador" mas arriba).

### Comprobar manualmente

1. Crea el primer administrador (`npm run db:create-admin`) e inicia
   sesion en `/login`; comprueba que te fuerza a `/cuenta/cambiar-contrasena`
   antes de dejarte navegar.
2. En un split activo, deja una semana con Guardian de la Estabilidad y
   Cronomagia laboral activos; comprueba que un campo vacio de ambos se
   guarda como `0` (Cronomagia ambos vacios: `AVISO` en Comprobar, `0 %`).
3. Completa todos los KPI activos de una semana y abre
   `Ver resultados de la semana`: revisa la tabla, el heatmap y un
   empate (dos participantes con el mismo total reciben la misma
   posicion y los mismos puntos por posicion); comprueba que ninguna celda
   muestra `VAC` ni `AVISO`, sino el valor numerico `0`.
4. Publica la semana con el boton de confirmacion; intenta modificar una
   carga manual y una de Excel de esa semana y comprueba que ambas se
   rechazan; intenta cambiar la configuracion de un KPI o los puntos por
   posicion despues de publicar y comprueba que ahora se rechaza tambien
   (bloqueo de configuracion, `0.7.0` / MVP-2A, ver mas abajo).
5. Intenta anadir un participante con semana inicial en la semana recien
   publicada (debe rechazarse) y con semana inicial en una semana futura
   (debe aceptarse).
6. Desde `/personas`, crea una cuenta de participante vinculada a una
   persona con resultados publicados, con una contrasena temporal;
   cierra sesion e inicia con esa cuenta, comprobando que te obliga a
   cambiar la contrasena.
7. Como participante, entra en `/resultados`: comprueba tu propio detalle
   (`Por split` e `Historico general`) y la clasificacion limitada
   (sin nombres reales ni KPI ajenos); intenta acceder a `/personas` o
   `/splits` y comprueba que te redirige.
8. Como administrador, entra en `/resultados`, selecciona distintas
   personas, y revisa `/splits/[id]/clasificacion` con sus filtros.
9. Reduce la ventana del navegador a unos 360 px en las tablas de
   resultados y clasificacion: deben mantenerse legibles con scroll
   horizontal contenido, sin desbordar la pagina.

## Facciones, clasificacion de facciones y consolidacion de UX (`0.7.0` / MVP-2A)

Primera capa de juego real y correcciones de resultados/UX. Detalle
funcional exhaustivo en [`docs/FACTIONS.md`](docs/FACTIONS.md).

- Facciones por split (crear/editar/eliminar segun el estado del split),
  asignacion obligatoria de participantes en cuanto el split ya tiene
  alguna faccion, y activacion/publicacion condicionadas al conjunto
  completo de reglas solo cuando el split usa facciones.
- Clasificacion de facciones (suma de los tres mejores puntos por
  posicion, nunca una media) semanal y acumulada, con resumen bajo la
  clasificacion individual y vista detallada
  (`/splits/[id]/clasificacion-facciones`), y visibilidad segura en
  `/resultados > Por split`.
- Bloqueo de la configuracion de KPI y de los puntos por posicion en
  cuanto el split tiene al menos una semana publicada.
- KPI del split en una sola linea por tarjeta, layout panoramico mas
  ancho, formulario "Anadir participante" reorganizado, clasificacion
  individual filtrada por KPI con orden accesible y denominador `x de n`
  unico, e historico general con columnas KPI compactas.

### Comprobar manualmente

1. Crea un split en borrador y dos facciones con nombre y colores
   distintos; comprueba que no se puede repetir el mismo nombre dentro
   del split.
2. Anade al menos seis participantes (tres por faccion); comprueba que el
   selector `Faccion` es obligatorio en el formulario en cuanto existe
   alguna faccion.
3. Configura al menos un KPI activo y los puntos por posicion, y activa el
   split; repite quitando participantes de una faccion hasta dejarla con
   menos de tres y comprueba que la activacion se rechaza con un mensaje
   claro.
4. Carga o introduce una semana completa; en la previsualizacion revisa la
   tabla individual y, debajo, la previsualizacion compacta de
   clasificacion de facciones.
5. Publica la semana y comprueba que la suma de cada faccion usa
   exactamente los tres mejores puntos por posicion; fuerza un empate de
   suma con distinto mejor participante y comprueba el desempate, y un
   empate real (mismo vector de tres aportaciones) y comprueba que reciben
   la misma posicion.
6. En el detalle del split, comprueba que aparece primero
   `Clasificacion general individual` y justo debajo
   `Clasificacion general facciones`; abre ambas vistas detalladas.
7. Intenta modificar la configuracion de KPI y los puntos por posicion
   despues de publicar: debe rechazarse tanto en la interfaz (solo
   lectura con el aviso de bloqueo) como directamente en el servicio.
8. Entra como participante vinculado a una persona del split y comprueba
   que ve su propia faccion y la clasificacion de facciones sin datos
   privados de otras personas.
9. Con un split de seis personas, comprueba que todos los `x de n` de sus
   resultados (posicion general, semanal, por KPI) terminan en `de 6`.
10. En `/splits/[id]/clasificacion`, filtra por un KPI activo: comprueba
    que el orden predeterminado es la suma de ese KPI descendente, que la
    columna se llama `Posicion KPI`, y que se puede ordenar tambien por
    puntos de posicion, total KPI y media.
11. Abre el historico general (`/resultados > Historico general`) por
    semana, mes y año, y revisa las columnas compactas por KPI (suma y
    media) en vez del bloque de texto anterior.
12. Revisa el detalle del split a 1366 px, a 1920/2048 px y en movil (~360
    px): el contenido debe aprovechar el ancho disponible sin scroll
    horizontal de pagina.

## Profesiones, bonus de KPI y fichas de participante (`0.8.0` / MVP-2B)

Segunda capa de juego. Detalle funcional exhaustivo en
[`docs/PROFESSIONS_AND_PROFILES.md`](docs/PROFESSIONS_AND_PROFILES.md).

- **Profesiones opcionales por split** (`Profesiones del split` en
  `/splits/[id]`): nombre, niveles disponibles (`N0`/`N1`/`N2`) y
  exactamente dos KPI distintos. Un split sin ninguna profesion creada
  funciona exactamente igual que en `0.7.0`.
- **Bonus fijo `+20 % después del máximo base`**, ineditable, aplicado solo
  a los dos KPI de la profesion y solo cuando el resultado tras el maximo
  es estrictamente positivo. El maximo no se vuelve a aplicar: un KPI
  limitado a `70` puede terminar en `84`.
- **Bloqueo desde la primera publicacion:** profesiones y asignaciones
  quedan congeladas; un alta posterior exige profesion en el propio
  formulario.
- **`Fichas`** junto a `Resultados` en la navegacion: una ficha por split
  con avatar, alias editable, profesion y datos de solo lectura (nivel y
  faccion).
- **Avatar por split** guardado en PostgreSQL, validado y normalizado en
  servidor (JPEG/PNG/WebP, maximo 5 MB, EXIF corregido, 512 px como maximo
  por lado, salida WebP).
- **Historico semanal por fecha**: `07/09/2026` en vez de `Semana 1`.

### Comprobar manualmente

1. Crea un split **sin** profesiones y comprueba que todo funciona igual
   que en `0.7.0` (sin selectores de profesion ni avisos nuevos).
2. Crea otro split y anade varias profesiones con distintas combinaciones
   de niveles y KPI.
3. Comprueba que no se aceptan dos KPI iguales ni una profesion sin ningun
   nivel marcado.
4. Anade participantes dejando a alguno sin profesion.
5. Entra como participante y abre `Fichas` junto a `Resultados`.
6. Cambia el alias y comprueba que no puedes repetir el de otro
   participante del mismo split.
7. Sube, reemplaza y elimina un avatar (prueba tambien un archivo de mas de
   5 MB, un `.svg` y un archivo corrupto: los tres deben rechazarse con un
   mensaje claro).
8. Elige una profesion compatible y comprueba el resumen con sus dos KPI y
   el texto del bonus.
9. Intenta abrir o modificar la ficha de otra persona manipulando la URL o
   el formulario: debe rechazarse.
10. Completa la primera semana y verifica que la falta de profesion bloquea
    la publicacion, con el alias afectado en el mensaje.
11. Corrige la asignacion y revisa la previsualizacion: las celdas con
    bonus llevan borde y badge, ademas del color.
12. Valida a mano `70 + 14 = 84` en un KPI limitado a `70`.
13. Publica la primera semana.
14. Comprueba que profesiones y asignaciones quedan bloqueadas tanto para
    el administrador como para el participante.
15. Comprueba que alias y avatar siguen siendo editables en el split
    activo.
16. Revisa el bonus y su desglose en resultados publicados e historico.
17. Comprueba que rankings, puntos por posicion y clasificacion de
    facciones reflejan el resultado final con bonus, sin duplicarlo.
18. Anade un participante con semana inicial futura despues de publicar:
    el alta debe exigir profesion.
19. Abre el historico semanal y verifica que muestra fechas como
    `07/09/2026`, no `Semana 1`.
20. Prueba `Fichas` y resultados en movil (~360 px), a 1366 px y en
    pantalla panoramica.

## Reinicio opcional y destructivo del entorno local

**Solo para una base de datos local ficticia.** Este comando **borra
permanentemente** todos los datos de la base indicada en `DATABASE_URL`
(personas, splits, participantes, facciones, cargas, resultados,
publicaciones y cuentas) y vuelve a aplicar las migraciones desde cero.
No lo ejecutes contra una base con datos reales: no hay forma de
deshacerlo. Antes de continuar, detén `npm run dev` y verifica en tu
`.env` que `DATABASE_URL` apunta a tu base local ficticia y no a un
entorno compartido.

```powershell
# ATENCION: elimina todos los datos de la base indicada en DATABASE_URL.
# Detén antes npm run dev y verifica que DATABASE_URL apunta a la base local ficticia correcta.
npx prisma migrate reset

$env:ADMIN_EMAIL = "admin@ejemplo.com"
$env:ADMIN_PASSWORD = "una-contrasena-temporal-segura"
npm run db:create-admin
npm run dev
```

`.env` y cualquier credencial real nunca se suben al repositorio (ya
estan excluidos en `.gitignore`).

## Documentos del proyecto

- [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) — objetivo del
  producto, roles y vocabulario.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — plan de entregas.
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — modelo de datos.
- [`docs/DISCOVERY-1-SPLIT-8.md`](docs/DISCOVERY-1-SPLIT-8.md) —
  descubrimiento funcional del Split 8 (contexto historico de los KPI).
- [`docs/KPI_CONFIGURATION.md`](docs/KPI_CONFIGURATION.md) — catalogo de
  KPI, sus parametros y las reglas de configuracion por split.
- [`docs/IMPORT_PRODUCTIVITY.md`](docs/IMPORT_PRODUCTIVITY.md) — carga
  semanal del Excel de Productividad y calculo de Cazador de soluciones y
  Explorador de datos.
- [`docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md`](docs/IMPORT_ESCALATIONS_QUALITY_VOICE.md)
  — carga semanal de los Excel de Escalados, Calidad y Llamadas, y calculo
  de Domador de Escaladas, Maestro Artesano y Embajador de voz.
- [`docs/MANUAL_KPI_ENTRY.md`](docs/MANUAL_KPI_ENTRY.md) — hotfix del cero
  implicito de Domador de Escaladas, entrada manual de los cinco KPI
  restantes y el contador `KPI cargados` del calendario de semanas.
- [`docs/POSITION_POINTS_CONFIGURATION.md`](docs/POSITION_POINTS_CONFIGURATION.md)
  — configuracion "Puntos por posicion semanal" por split, consumida al
  publicar desde `0.6.0` / MVP-1C.
- [`docs/RESULTS_PUBLICATION.md`](docs/RESULTS_PUBLICATION.md) — motor
  agregado de resultados semanales, previsualizacion, publicacion
  inmutable, vista individual y clasificacion general (`0.6.0` / MVP-1C).
- [`docs/AUTHENTICATION.md`](docs/AUTHENTICATION.md) — autenticacion
  local, ciclo de cuenta y matriz de permisos (`0.6.0` / MVP-1C).
- [`docs/FACTIONS.md`](docs/FACTIONS.md) — facciones, clasificacion de
  facciones y bloqueo de configuracion (`0.7.0` / MVP-2A).
- [`docs/PROFESSIONS_AND_PROFILES.md`](docs/PROFESSIONS_AND_PROFILES.md) —
  profesiones configurables por split, bonus del `+20 %`, fichas privadas,
  avatar por split y rotulo semanal del historico (`0.8.0` / MVP-2B).
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — decisiones tecnicas y de
  producto registradas.
- [`CHANGELOG.md`](CHANGELOG.md) — historial de cambios.
- [`CLAUDE.md`](CLAUDE.md) — instrucciones permanentes para trabajar en
  este repositorio con Claude Code.

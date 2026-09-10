# Gamification VCS

Aplicacion web para administrar las gamificaciones periodicas ("splits")
del equipo de Customer Service. Sustituye un libro Excel con formulas y
hojas de datos por una aplicacion sencilla que representa correctamente
los conceptos del negocio: personas, splits, semanas, participantes, KPI,
resultados y clasificacion.

## Estado actual

**MVP-1A — Personas y creacion de splits** y **MVP-1B — KPI activos y
configuracion** (ver `docs/ROADMAP.md`).

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

Todavia **no** incluye motor de calculo de resultados, carga de datos,
importacion de Excel, clasificacion, autenticacion ni ninguna capa de
juego adicional (facciones, profesiones, objetos, economia, renombre...).
Consulta `docs/ROADMAP.md` para el plan completo.

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
en `.gitignore`) y no debe contener contrasenas reales compartidas. La
variable relevante es `DATABASE_URL`, con el formato:

```
postgresql://USUARIO:CONTRASENA@HOST:PUERTO/BASE_DE_DATOS?schema=public
```

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

## 5. Ejecutar la aplicacion en modo desarrollo

```powershell
npm run dev
```

La aplicacion queda disponible en <http://localhost:3000>.

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

## Documentos del proyecto

- [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) — objetivo del
  producto, roles y vocabulario.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — plan de entregas.
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — modelo de datos.
- [`docs/DISCOVERY-1-SPLIT-8.md`](docs/DISCOVERY-1-SPLIT-8.md) —
  descubrimiento funcional del Split 8 (contexto historico de los KPI).
- [`docs/KPI_CONFIGURATION.md`](docs/KPI_CONFIGURATION.md) — catalogo de
  KPI, sus parametros y las reglas de configuracion por split.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — decisiones tecnicas y de
  producto registradas.
- [`CHANGELOG.md`](CHANGELOG.md) — historial de cambios.
- [`CLAUDE.md`](CLAUDE.md) — instrucciones permanentes para trabajar en
  este repositorio con Claude Code.

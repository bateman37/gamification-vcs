# Gamification VCS

Aplicacion web para administrar las gamificaciones periodicas ("splits")
del equipo de Customer Service. Sustituye un libro Excel con formulas y
hojas de datos por una aplicacion sencilla que representa correctamente
los conceptos del negocio: personas, splits, semanas, participantes, KPI,
resultados y clasificacion.

## Estado actual

**MVP-1A — Personas y creacion de splits** (ver `docs/ROADMAP.md`).

Esta entrega implementa:

- Gestion de personas (registro global, reutilizable entre splits).
- Creacion y edicion de splits en borrador, con generacion automatica de
  sus semanas.
- Incorporacion de participantes a un split (persona + alias + nivel +
  semana inicial), tanto en borrador como con el split ya activo.
- Activacion de un split cuando tiene al menos un participante.

Todavia **no** incluye KPI, carga de resultados, clasificacion,
autenticacion ni ninguna capa de juego adicional (facciones, profesiones,
objetos, economia, renombre...). Consulta `docs/ROADMAP.md` para el plan
completo.

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
- Docker y Docker Compose (para levantar PostgreSQL localmente), o bien
  una instancia de PostgreSQL 16 accesible desde tu maquina

## 1. Configurar las variables de entorno

Copia el archivo de ejemplo y ajustalo si tu configuracion difiere del
valor por defecto:

**Windows (PowerShell):**

```powershell
Copy-Item .env.example .env
```

**Linux/macOS:**

```bash
cp .env.example .env
```

El archivo `.env` no debe subirse nunca al repositorio (ya esta excluido
en `.gitignore`). La variable relevante es `DATABASE_URL`, con el formato:

```
postgresql://USUARIO:CONTRASENA@HOST:PUERTO/BASE_DE_DATOS?schema=public
```

## 2. Iniciar PostgreSQL

Con Docker Compose, desde la raiz del proyecto:

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
# Con Docker Compose ya levantado ("docker compose up -d"):
docker compose exec db createdb -U postgres gamification_vcs_test
$env:TEST_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/gamification_vcs_test?schema=public"
npx prisma migrate deploy
npm run test
```

## Documentos del proyecto

- [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md) — objetivo del
  producto, roles y vocabulario.
- [`docs/ROADMAP.md`](docs/ROADMAP.md) — plan de entregas.
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md) — modelo de datos.
- [`docs/DISCOVERY-1-SPLIT-8.md`](docs/DISCOVERY-1-SPLIT-8.md) —
  descubrimiento funcional del Split 8 (contexto para los futuros KPI).
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — decisiones tecnicas y de
  producto registradas.
- [`CHANGELOG.md`](CHANGELOG.md) — historial de cambios.
- [`CLAUDE.md`](CLAUDE.md) — instrucciones permanentes para trabajar en
  este repositorio con Claude Code.

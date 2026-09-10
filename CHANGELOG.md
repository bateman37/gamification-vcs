# Changelog

Formato inspirado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/).
Este proyecto usa versionado `0.x` mientras se construye el nucleo
funcional; la primera version publicada es `0.1.0`.

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

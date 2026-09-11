# Modelo de datos — MVP-1A, MVP-1B e IMPORT-1A / MVP-1C.1

Fuente de verdad: `prisma/schema.prisma` y las migraciones
`prisma/migrations/20260910133815_init/migration.sql` (MVP-1A),
`prisma/migrations/20260910202939_add_kpi_configuration/migration.sql`
(MVP-1B) y
`prisma/migrations/20260911082446_add_productivity_import/migration.sql`
(IMPORT-1A / MVP-1C.1). Este documento describe y explica ese esquema; en
caso de discrepancia, el esquema real manda.

## Diagrama entidad-relacion

```mermaid
erDiagram
    Person ||--o{ SplitParticipant : "participa como"
    Split ||--o{ SplitWeek : "tiene"
    Split ||--o{ SplitParticipant : "tiene"
    Split ||--o{ SplitKpiConfig : "configura"
    SplitWeek ||--o{ SplitParticipant : "es semana inicial de"
    SplitWeek ||--o| ProductivityImport : "tiene carga vigente"
    ProductivityImport ||--o{ ProductivityWeeklyRow : "contiene"
    SplitParticipant ||--o{ ProductivityWeeklyRow : "tiene fila en"

    Person {
        string id PK
        string fullName
        string email "opcional, unico, normalizado"
        datetime createdAt
        datetime updatedAt
    }

    Split {
        string id PK
        string name
        string description "opcional"
        date startDate "siempre lunes"
        int numberOfWeeks "1 a 52"
        enum status "DRAFT, ACTIVE, CLOSED"
        datetime createdAt
        datetime updatedAt
    }

    SplitWeek {
        string id PK
        string splitId FK
        int sequenceNumber "identidad: splitId + sequenceNumber"
        date startDate "lunes"
        date endDate "domingo"
        datetime createdAt
        datetime updatedAt
    }

    SplitParticipant {
        string id PK
        string splitId FK
        string personId FK
        string alias
        string aliasNormalized "minusculas, sin espacios exteriores"
        enum level "N0, N1, N2"
        int startWeekSequenceNumber "FK compuesta a SplitWeek"
        int endWeekSequenceNumber "opcional, sin usar todavia"
        datetime createdAt
        datetime updatedAt
    }

    SplitKpiConfig {
        string id PK
        string splitId FK
        enum kpiCode "catalogo cerrado, ver KpiCode"
        boolean isActive "por defecto false"
        decimal baseMax "mayor que cero"
        decimal multiplierN0 "opcional: null = nivel no aplicable"
        decimal multiplierN1 "opcional: null = nivel no aplicable"
        decimal multiplierN2 "opcional: null = nivel no aplicable"
        json parameters "parametros propios del KPI, validados por esquema"
        datetime createdAt
        datetime updatedAt
    }

    ProductivityImport {
        string id PK
        string splitWeekId FK "unico: una carga vigente por semana"
        string originalFilename
        string fileSha256 "identifica el archivo, no deduce la semana"
        int sourceRowCount
        int importedRowCount
        datetime createdAt
        datetime updatedAt
    }

    ProductivityWeeklyRow {
        string id PK
        string productivityImportId FK
        string splitParticipantId FK "onDelete Restrict"
        string sourceAgentName "trazabilidad"
        int updates "conservado para Domador de Escaladas"
        int comments
        int publicComments
        int internalComments
        int ticketsUpdatedWithComment "entrada de Explorador de datos"
        int ticketsResolved "entrada de Cazador de soluciones"
        int ticketsCreated
        datetime createdAt
        datetime updatedAt
    }
```

## Tablas, campos y relaciones

### `Person`

Registro global y estable, reutilizable entre splits.

- `id`: UUID, clave primaria.
- `fullName`: nombre completo, obligatorio.
- `email`: opcional. Se normaliza (recortado y en minusculas) antes de
  guardarse, y tiene un indice unico (`Person_email_key`). Preparado para
  identificar en el futuro la cuenta del participante.
- `createdAt`, `updatedAt`: gestionados automaticamente.
- No existe borrado fisico en esta entrega. No se ha disenado todavia
  ninguna regla de baja o desactivacion: se ha pospuesto deliberadamente
  (ver `docs/DECISIONS.md`).

### `Split`

Una edicion de la gamificacion.

- `id`: UUID, clave primaria.
- `name`, `description` (opcional).
- `startDate`: columna `DATE` (sin hora). Restriccion de base de datos
  `Split_startDate_is_monday_check` que exige que sea lunes
  (`EXTRACT(ISODOW FROM "startDate") = 1`).
- `numberOfWeeks`: entero. Restriccion de base de datos
  `Split_numberOfWeeks_range_check` que exige un valor entre 1 y 52.
- `status`: enum `SplitStatus` (`DRAFT`, `ACTIVE`, `CLOSED`). Se crea
  siempre en `DRAFT`. El cierre funcional (`CLOSED`) no se implementa
  todavia; el estado queda preparado en el modelo.

### `SplitWeek`

Las semanas generadas de un split.

- `id`: UUID, clave primaria.
- `splitId`: referencia a `Split` (borrado en cascada si se borra el
  split).
- `sequenceNumber`: numero secuencial dentro del split (1, 2, 3...). Es la
  identidad funcional de la semana junto con `splitId`; el numero ISO del
  calendario no se guarda ni se usa como identidad.
- `startDate` / `endDate`: columnas `DATE`. Restricciones de base de datos
  que exigen que `startDate` sea lunes y `endDate` sea domingo.
- Indice unico `SplitWeek_splitId_sequenceNumber_key` sobre
  (`splitId`, `sequenceNumber`).

### `SplitParticipant`

La relacion entre una persona y un split, con sus datos propios de esa
participacion.

- `id`: UUID, clave primaria.
- `splitId`, `personId`: referencias a `Split` y `Person`.
- `alias`: tal como lo escribe el administrador.
- `aliasNormalized`: version normalizada (recortada y en minusculas),
  usada exclusivamente para garantizar la unicidad dentro del split.
  Restriccion de base de datos que impide que quede vacia.
- `level`: enum `ParticipantLevel` (`N0`, `N1`, `N2`).
- `startWeekSequenceNumber`: semana desde la que participa. Es una clave
  foranea **compuesta** hacia `SplitWeek` (`splitId` +
  `sequenceNumber`), lo que garantiza a nivel de base de datos que la
  semana inicial pertenece al mismo split.
- `endWeekSequenceNumber`: opcional, sin uso todavia. Preparado para un
  futuro cierre de participacion; cuando se use, debera referenciar una
  semana del mismo split (regla a aplicar en su momento, no forzada aun
  por una restriccion de base de datos).
- Indice unico `SplitParticipant_splitId_personId_key`: una persona solo
  puede aparecer una vez en un mismo split.
- Indice unico `SplitParticipant_splitId_aliasNormalized_key`: el alias
  normalizado es unico dentro del split (el mismo alias si puede
  repetirse en splits distintos).

### `SplitKpiConfig`

Configuracion de un KPI del catalogo cerrado (enum `KpiCode`, ver
`src/domain/kpis/catalog.ts` y `docs/KPI_CONFIGURATION.md`) para un split
concreto. Cada split conserva su propia copia editable, independiente de
los valores predeterminados del catalogo y de la configuracion de otros
splits.

- `id`: UUID, clave primaria.
- `splitId`: referencia a `Split` (borrado en cascada si se borra el
  split).
- `kpiCode`: enum `KpiCode` con los diez codigos del catalogo cerrado. El
  orden de declaracion del enum coincide con el orden de presentacion del
  catalogo (PostgreSQL ordena los enums por orden de declaracion, no
  alfabeticamente).
- `isActive`: si el KPI esta activo en este split. `false` por defecto.
- `baseMax`: `Decimal(12,4)` (nunca `Float`, para no perder precision en
  comparaciones). Restriccion de base de datos que exige que sea mayor que
  cero.
- `multiplierN0` / `multiplierN1` / `multiplierN2`: `Decimal(12,4)`
  opcionales. Restriccion de base de datos que exige, cuando existen, que
  sean mayores o iguales que cero. Un valor `NULL` significa que ese nivel
  **no es aplicable** a ese KPI, no que el multiplicador sea cero.
- Restriccion de base de datos adicional: si `isActive` es `true`, al
  menos uno de los tres multiplicadores debe estar informado.
- `parameters`: `Json` (`jsonb`) con los parametros propios del tipo de
  calculo de ese KPI (ver `docs/KPI_CONFIGURATION.md`). Nunca se acepta tal
  cual desde el navegador: la accion de servidor construye este objeto a
  partir de los campos que el catalogo declara para ese `kpiCode`, y el
  esquema de validacion de ese KPI concreto lo valida antes de guardarse.
- Indice unico `SplitKpiConfig_splitId_kpiCode_key`: un split tiene como
  mucho una configuracion por cada KPI del catalogo (en la practica,
  siempre las diez).

### `ProductivityImport`

Cabecera de la carga semanal del Excel de Productividad para una semana de
un split (ver `docs/IMPORT_PRODUCTIVITY.md`). Un unico archivo alimenta
`SOLUTION_HUNTER` y `DATA_EXPLORER`.

- `id`: UUID, clave primaria.
- `splitWeekId`: referencia a `SplitWeek` (borrado en cascada si se borra
  la semana). Indice unico: como mucho una carga **vigente** por semana.
- `originalFilename`: nombre del archivo tal como se subio, solo para
  mostrarlo en pantalla; nunca se guarda el binario.
- `fileSha256`: hash del contenido procesado. Identifica el archivo para
  depuracion administrativa; no se usa para deducir la semana ni ninguna
  otra logica de negocio.
- `sourceRowCount` / `importedRowCount`: total de filas de datos leidas y
  numero de filas realmente persistidas (solo las "encontradas"). Ambas
  con restriccion de base de datos que exige un valor no negativo.

### `ProductivityWeeklyRow`

Una fila por participante encontrado dentro de una carga.

- `id`: UUID, clave primaria.
- `productivityImportId`: referencia a `ProductivityImport` (borrado en
  cascada si se borra la carga, por ejemplo al sustituirla).
- `splitParticipantId`: referencia a `SplitParticipant` con
  `onDelete: Restrict`, a proposito: una fila de productividad nunca debe
  desaparecer por borrar accidentalmente al participante.
- `sourceAgentName`: nombre tal como aparecia en la columna "Nombre del
  actualizador", conservado para trazabilidad (la identidad real es
  `Person.fullName`, pero se guarda el texto de origen).
- Los siete conteos (`updates`, `comments`, `publicComments`,
  `internalComments`, `ticketsUpdatedWithComment`, `ticketsResolved`,
  `ticketsCreated`) son `Int`, todos con restriccion de base de datos que
  exige un valor no negativo. `updates` se conserva para el futuro calculo
  de Domador de Escaladas (`ESCALATION_TAMER`); no se usa todavia.
- Indice unico `ProductivityWeeklyRow_productivityImportId_splitParticipant_key`
  (`productivityImportId` + `splitParticipantId`): una carga solo puede
  tener una fila por participante.
- Los puntos de Cazador de soluciones y Explorador de datos **no** se
  guardan aqui: se calculan al consultar, a partir de estos conteos, el
  nivel del participante y `SplitKpiConfig` (ver
  `docs/IMPORT_PRODUCTIVITY.md` y `docs/DECISIONS.md`).

## Decisiones sobre fechas

- Todas las fechas de negocio (`Split.startDate`, `SplitWeek.startDate`,
  `SplitWeek.endDate`) se guardan como columnas `DATE` de PostgreSQL, sin
  componente horario.
- En el codigo de la aplicacion (`src/lib/dates.ts`) estas fechas se
  representan siempre como `Date` de JavaScript a medianoche **UTC**, y se
  parsean/formatean explicitamente como fechas de calendario
  (`AAAA-MM-DD`). Esto evita el error tipico de que un lunes se convierta
  en domingo (o viceversa) por la zona horaria del proceso.
- La generacion de semanas (`generateSplitWeeks`) es una funcion pura que
  no depende de la hora actual ni de la zona horaria del servidor.

## Backfill de splits existentes (`MVP-1B`)

La migracion `add_kpi_configuration` crea, ademas del enum y la tabla, una
sentencia `INSERT ... SELECT` que genera las diez `SplitKpiConfig` (una
por `KpiCode`, inactivas, con los valores predeterminados de Split 8) para
cada `Split` que ya existiera antes de aplicar la migracion. Sobre una
base de datos vacia esa sentencia no inserta ninguna fila. No modifica
`Person`, `SplitWeek` ni `SplitParticipant` existentes, ni cambia el
`status` de ningun split: un split `ACTIVE` que ya existiera quedara con
sus diez KPI inactivos hasta que el administrador los configure (ver
`docs/DECISIONS.md`).

## Entidades pospuestas

Estas entidades aparecen en el contexto funcional del producto pero
**no** se han creado todavia. Se documentan para que una futura entrega no
tenga que redescubrirlas:

- Resultados calculados de los KPI distintos de Productividad (`MVP-1C`).
- Registros de carga de datos de los demas origenes (Escalados, Calidad,
  Llamadas, Estabilidad, Cronomagia, Articulos, Dedicacion, Formaciones;
  ver `IMPORT-1`). La carga de Productividad ya existe: `ProductivityImport`
  y `ProductivityWeeklyRow`, arriba.
- Clasificacion general y su calculo acumulado (`MVP-1C`).
- Usuarios, autenticacion y sesiones.
- Facciones, profesiones, localizaciones, objetos, economia de creditos y
  renombre.

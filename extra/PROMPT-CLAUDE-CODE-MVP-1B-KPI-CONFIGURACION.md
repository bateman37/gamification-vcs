# Prompt para Claude Code — MVP-1B: KPI activos y configuración

## Encargo

Trabaja sobre el repositorio:

`https://github.com/bateman37/gamification-vcs`

Implementa exclusivamente **MVP-1B — KPI activos y configuración**.

`MVP-1A` ya está mergeado en `main`, ha sido probado manualmente por el usuario y todas sus pruebas funcionales han sido satisfactorias: creación y edición de personas, creación de splits y semanas, incorporación de participantes, alias por split, niveles, activación del split y altas durante un split activo.

En el momento de preparar este encargo, `main` incluía el merge de la PR #1 y estaba en el commit `18825f6`. Comprueba el estado actual del repositorio antes de actuar: el código y las migraciones reales son la fuente de verdad.

No rehagas `MVP-1A`, no cambies su comportamiento salvo que una modificación mínima sea imprescindible para integrar esta entrega y no amplíes el alcance.

---

## 1. Lectura obligatoria antes de modificar código

Lee completamente y en este orden:

1. `CLAUDE.md`
2. `README.md`
3. `docs/PROJECT_CONTEXT.md`
4. `docs/ROADMAP.md`
5. `docs/DATA_MODEL.md`
6. `docs/DECISIONS.md`
7. `docs/DISCOVERY-1-SPLIT-8.md`
8. `CHANGELOG.md`
9. `prisma/schema.prisma`
10. Las migraciones, servicios, acciones, validaciones, pantallas y pruebas existentes.

Respeta la estructura ya establecida:

- lógica de negocio en `src/server/services/*`;
- acciones de servidor como capa fina;
- validación explícita;
- fechas de negocio tratadas como fechas de calendario en UTC;
- interfaz en castellano;
- código e identificadores técnicos en inglés;
- documentación de producto en castellano.

---

## 2. Objetivo de esta entrega

Cada split debe disponer de una configuración propia de KPI que permita:

- ver el catálogo cerrado de los diez KPI utilizados en Split 8;
- activar o desactivar cada KPI para ese split;
- configurar su máximo base;
- configurar sus multiplicadores para los niveles `N0`, `N1` y `N2`;
- configurar los parámetros numéricos propios de su tipo de cálculo;
- conservar configuraciones distintas para el mismo KPI en splits diferentes.

Esta entrega configura los cálculos, pero **todavía no calcula resultados**.

El administrador no puede crear KPI nuevos, cambiar el nombre del KPI, introducir fórmulas libres, escribir código ni modificar el orden interno de operaciones. La estructura matemática de cada KPI está definida por el sistema; solo se editan parámetros concretos mediante campos comprensibles.

---

## 3. Alcance exacto

Implementa:

1. Catálogo cerrado en código de los diez KPI de Split 8.
2. Persistencia de la configuración de cada KPI por split.
3. Valores predeterminados de Split 8.
4. Activación y desactivación por split.
5. Edición de máximo base, multiplicadores por nivel y parámetros propios.
6. Validación de todos los parámetros en servidor.
7. Pantalla administrativa integrada en el detalle del split.
8. Creación automática de la configuración inicial al crear un split nuevo.
9. Migración segura para crear configuraciones en los splits que ya existen.
10. Ajuste de la activación del split: un nuevo split necesita al menos un participante y al menos un KPI activo.
11. Documentación y changelog actualizados.
12. Pruebas automatizadas acotadas a las reglas críticas de `MVP-1B`.

No implementes:

- motor de cálculo de resultados;
- carga manual de valores;
- importación o lectura de Excel;
- apertura, cierre o publicación de semanas;
- resultados semanales;
- clasificación;
- vista individual;
- autenticación;
- facciones;
- profesiones;
- efectos que aumenten el máximo;
- localizaciones;
- objetos, cartas, mercado o créditos;
- renombre;
- misiones;
- conexión con Power BI;
- fórmulas libres;
- constructor genérico de KPI;
- motor genérico de reglas o plugins;
- API pública;
- actualización general de dependencias.

No añadas tablas ni abstracciones preventivas para lo que está fuera de alcance.

---

## 4. Decisión de modelo recomendada

Mantén el catálogo cerrado en código y guarda en PostgreSQL una copia configurable por split.

### 4.1 Código de KPI

Añade un enum estable `KpiCode` con estos valores técnicos. Puedes ajustar el estilo exacto al convenio de Prisma, pero no cambies su significado:

- `SOLUTION_HUNTER`
- `DATA_EXPLORER`
- `VOICE_AMBASSADOR`
- `MASTER_CRAFTSMAN`
- `ESCALATION_TAMER`
- `STABILITY_GUARDIAN`
- `WORK_CHRONOMANCY`
- `STAR_WRITER`
- `ENTHUSIASTIC_STUDENT`
- `EXPERT_APPRENTICE`

Los nombres visibles en castellano están definidos en el apartado 6.

### 4.2 Configuración por split

Crea una entidad equivalente a `SplitKpiConfig` con, como mínimo:

- `id` UUID;
- `splitId`;
- `kpiCode`;
- `isActive`;
- `baseMax` decimal positivo;
- `multiplierN0` decimal opcional;
- `multiplierN1` decimal opcional;
- `multiplierN2` decimal opcional;
- `parameters` JSON;
- `createdAt`;
- `updatedAt`.

Relaciones y restricciones:

- un split tiene diez configuraciones, una por cada `KpiCode`;
- `splitId + kpiCode` debe ser único;
- el borrado de un split elimina sus configuraciones;
- los decimales no deben guardarse como `Float`; utiliza `Decimal` con precisión suficiente y consistente;
- `baseMax` debe ser mayor que cero;
- los multiplicadores, cuando existen, deben ser mayores o iguales que cero;
- si un KPI está activo, debe tener al menos un nivel aplicable con multiplicador informado;
- un multiplicador vacío significa **no aplicable para ese nivel**, no multiplicador cero;
- `parameters` nunca se acepta directamente desde JSON enviado por el navegador: se construye a partir de campos conocidos y se valida según `kpiCode`.

Si durante la implementación descubres que un pequeño ajuste de nombres encaja mejor con Prisma o con el código existente, puedes hacerlo, pero conserva estas reglas y documenta la decisión.

### 4.3 Catálogo en código

Crea una única fuente de verdad tipada, por ejemplo en `src/domain/kpis/catalog.ts`, que defina para cada KPI:

- código estable;
- nombre visible;
- descripción breve;
- orden de presentación;
- explicación legible del cálculo;
- máximo base predeterminado;
- multiplicadores predeterminados por nivel;
- definición y valores predeterminados de sus parámetros;
- esquema de validación de parámetros.

No dupliques manualmente los mismos valores en componentes, servicios y validadores.

El catálogo no necesita una tabla global editable. Añadir un KPI nuevo en el futuro requerirá un cambio de código y migración deliberados.

### 4.4 Copia estable por split

Cada split debe conservar sus propios valores. Un cambio futuro en los valores predeterminados del catálogo no puede modificar silenciosamente la configuración de splits ya creados.

Por ello:

- al crear un split nuevo, crea sus diez `SplitKpiConfig` dentro de la misma transacción que crea el split y sus semanas;
- se crean inicialmente inactivos y con los valores predeterminados de Split 8;
- la migración de esta entrega debe crear también las diez configuraciones inactivas para cada split ya existente;
- no cambies el estado de los splits existentes;
- no borres ni modifiques personas, semanas o participantes existentes.

La migración debe ser reproducible en una base de datos vacía y segura sobre una base que ya contenga datos de `MVP-1A`.

---

## 5. Edición y estados del split

### Split en borrador

En `DRAFT` el administrador puede:

- activar o desactivar KPI;
- editar todos sus parámetros;
- activar el split cuando tenga al menos un participante y al menos un KPI activo.

### Split activo

En esta entrega también se permite editar la configuración de KPI de un split `ACTIVE`, porque todavía no existen resultados calculados ni semanas publicadas.

Documenta esta decisión como provisional: `MVP-1C` deberá definir el bloqueo, versionado o recálculo cuando existan resultados. No construyas ahora ese sistema.

Los splits activos que ya existan al aplicar la migración quedarán con los diez KPI inactivos. La interfaz debe mostrar un aviso claro para que el administrador configure al menos uno. No reviertas el split a `DRAFT` ni inventes KPI activos automáticamente.

### Split cerrado

No permitas editar la configuración de KPI de un split `CLOSED`.

---

## 6. Catálogo y valores predeterminados de Split 8

Implementa exactamente estos diez KPI y estos valores iniciales.

| Código | Nombre visible | Máximo base | N0 | N1 | N2 |
|---|---|---:|---:|---:|---:|
| `SOLUTION_HUNTER` | Cazador de soluciones | 70 | 2,5 | 1 | 1,85 |
| `DATA_EXPLORER` | Explorador de datos | 70 | 0,62 | 0,5 | 1,5 |
| `VOICE_AMBASSADOR` | Embajador de voz | 50 | 1,25 | 1,5 | 2 |
| `MASTER_CRAFTSMAN` | Maestro Artesano | 100 | 3 | 2 | 2 |
| `ESCALATION_TAMER` | Domador de Escaladas | 30 | 1 | 1 | 1 |
| `STABILITY_GUARDIAN` | Guardián de la Estabilidad | 30 | No aplica | No aplica | 1 |
| `WORK_CHRONOMANCY` | Cronomagia laboral | 60 | 1 | 1 | 1 |
| `STAR_WRITER` | Redactor estrella | 60 | 4 | 1,5 | 2 |
| `ENTHUSIASTIC_STUDENT` | Estudiante entusiasta | 50 | 1 | 1 | 1 |
| `EXPERT_APPRENTICE` | Aprendiz experto | 50 | 1 | 1 | 1,25 |

En código y base de datos usa punto decimal. En la interfaz puedes mostrar coma decimal de forma legible, pero debes aceptar y normalizar correctamente la entrada definida para el formulario.

---

## 7. Parámetros configurables por tipo de KPI

La forma de la fórmula es fija. Los siguientes parámetros son los únicos editables en esta entrega.

### 7.1 Cazador de soluciones

Forma futura del cálculo:

`tickets resueltos × puntos por ticket × multiplicador del nivel`

Parámetro:

- `pointsPerResolvedTicket`: valor predeterminado `1`.

### 7.2 Explorador de datos

Forma futura del cálculo:

`tickets actualizados con comentario × puntos por ticket × multiplicador del nivel`

Parámetro:

- `pointsPerCommentedTicket`: valor predeterminado `1`.

### 7.3 Embajador de voz

Forma futura del cálculo:

`(aceptadas × acceptedWeight − rechazadas × rejectedPenalty − no atendidas × unattendedPenalty) × multiplicador del nivel + salientes × outboundPoints`

Parámetros:

- `acceptedWeight`: `1`;
- `rejectedPenalty`: `1`;
- `unattendedPenalty`: `1`;
- `outboundPoints`: `1`.

La posición del multiplicador es fija: afecta al bloque de llamadas entrantes, no a las salientes.

### 7.4 Maestro Artesano

Forma futura del cálculo:

`(positivas × positiveWeight − negativas × negativePenalty) × scale × multiplicador del nivel`

Parámetros:

- `positiveWeight`: `1`;
- `negativePenalty`: `4`;
- `scale`: `10`.

### 7.5 Domador de Escaladas

Forma futura del cálculo:

`(basePoints − (escalados / tickets gestionados) × ratioPenaltyFactor) × multiplicador del nivel`

Parámetros:

- `basePoints`: `30`;
- `ratioPenaltyFactor`: `200`.

No añadas un suelo de cero: no existía en la fórmula auditada. La base alternativa 60 pertenecía a una profesión y queda fuera de esta entrega.

### 7.6 Guardián de la Estabilidad

Forma futura del cálculo:

`resultados × pointsPerResult × multiplicador del nivel`

Parámetro:

- `pointsPerResult`: `30`.

Por defecto solo aplica a N2. La configuración permite que en otro split el administrador informe también multiplicadores para N0 o N1.

### 7.7 Cronomagia laboral

Forma futura del cálculo:

`occupancy expresado como fracción × pointsAtFullOccupancy × multiplicador del nivel`

Parámetro:

- `pointsAtFullOccupancy`: `60`.

No implementes todavía ajustes manuales adicionales; se decidirán al auditar la carga real.

### 7.8 Redactor estrella

Forma futura del cálculo:

- si artículos aprobados es cero o positivo: `artículos × approvedArticlePoints × multiplicador + propuestas × proposalPoints`;
- si artículos aprobados es negativo: `artículos × negativeArticlePoints + propuestas × proposalPoints`.

Parámetros:

- `approvedArticlePoints`: `10`;
- `negativeArticlePoints`: `10`;
- `proposalPoints`: `5`.

La posición del multiplicador es fija: no afecta a propuestas ni a artículos negativos.

### 7.9 Estudiante entusiasta

Forma futura del cálculo:

`horas de dedicación × pointsPerHour × multiplicador del nivel`

Parámetro:

- `pointsPerHour`: `12,5`.

### 7.10 Aprendiz experto

Forma futura del cálculo:

`valor de formación / targetValue × pointsAtTarget × multiplicador del nivel`

Parámetros:

- `targetValue`: `15`;
- `pointsAtTarget`: `50`.

### Validación común

- Todos los parámetros deben ser números finitos.
- Los valores de puntos, escalas, pesos, penalizaciones, objetivos y factores deben ser mayores que cero.
- No aceptes `NaN`, infinito, cadenas arbitrarias ni propiedades JSON inesperadas.
- Devuelve mensajes en castellano y asociados al campo concreto.

---

## 8. Interfaz administrativa

Integra la configuración en el detalle existente del split. No crees un dashboard separado ni rediseñes la aplicación completa.

### Resumen del split

Añade:

- número de KPI activos sobre diez;
- aviso si no existe ningún KPI activo;
- enlace o desplazamiento a la sección de KPI.

### Sección «KPI del split»

Muestra los diez KPI en el orden del catálogo. Para cada uno:

- nombre;
- descripción o fórmula legible;
- estado activo/inactivo;
- máximo base;
- multiplicadores N0, N1 y N2;
- campos propios del cálculo con etiquetas comprensibles;
- acción para guardar.

Requisitos de uso:

- no muestres ni permitas editar JSON;
- no muestres códigos técnicos como título principal;
- deja claro que un nivel sin multiplicador está como «No aplica»;
- desactivar un KPI no borra su configuración;
- al volver a activarlo conserva los valores anteriores;
- muestra confirmación de guardado y errores de validación;
- en `CLOSED`, presenta los valores en modo solo lectura;
- no añadas gráficos, animaciones ni diseño de marca;
- conserva la navegación y los componentes visuales existentes.

Puedes usar formularios individuales por KPI o un formulario conjunto si encaja mejor con la aplicación actual. Prioriza una implementación fácil de entender y mantener.

---

## 9. Cambios sobre la activación del split

Actualiza la regla existente:

- antes: se podía activar con al menos un participante;
- ahora: se puede activar con al menos un participante **y al menos un KPI activo**.

Protege la regla en el servicio de dominio, no solo en la interfaz.

Para no romper datos existentes:

- no cambies de estado los splits que ya estén activos;
- un split activo sin KPI debe mostrar aviso y permitir configurar sus KPI;
- no ejecutes una migración que active automáticamente los diez KPI;
- no elimines participantes ni semanas existentes.

---

## 10. Entorno local del usuario

El usuario ha decidido usar **PostgreSQL instalado directamente en Windows**. Su aplicación ya funciona en `localhost` y las migraciones de `MVP-1A` están aplicadas correctamente.

Docker debe seguir siendo opcional:

- no elimines `docker-compose.yml`;
- no hagas que pruebas, migraciones o desarrollo dependan obligatoriamente de Docker;
- actualiza el README para explicar primero la conexión mediante `DATABASE_URL` a PostgreSQL local;
- conserva Docker como alternativa opcional;
- nunca sobrescribas ni incluyas `.env` en Git;
- no incluyas contraseñas reales.

No actualices Prisma, Next.js, React, ESLint ni otras dependencias como parte de esta entrega. Los avisos de `npm audit` o de versiones nuevas no autorizan una actualización ni el uso de `npm audit fix --force`.

---

## 11. Migración y compatibilidad

La nueva migración debe:

- añadir el enum y la tabla de configuración de KPI;
- preservar todos los datos de `MVP-1A`;
- crear diez configuraciones inactivas con valores Split 8 para cada split existente;
- funcionar sobre una base vacía aplicando toda la cadena de migraciones;
- funcionar sobre una base con personas, splits, semanas y participantes existentes;
- poder desplegarse mediante `prisma migrate deploy`;
- no requerir ejecutar manualmente un seed después de migrar.

La migración puede contener SQL explícito para el backfill cuando Prisma no pueda expresarlo de forma declarativa. Documenta cualquier decisión relevante.

El proceso de creación de un split nuevo debe crear el split, sus semanas y sus diez configuraciones dentro de una única transacción. Si falla una parte, no debe quedar un split incompleto.

---

## 12. Pruebas automatizadas acotadas

Mantén en verde todas las pruebas de `MVP-1A` y añade solo pruebas de alto valor para:

1. El catálogo contiene exactamente diez códigos únicos con los valores predeterminados esperados.
2. Crear un split genera diez configuraciones inactivas.
3. Dos splits pueden conservar configuraciones diferentes y un cambio no afecta al otro.
4. Desactivar y reactivar un KPI conserva sus parámetros.
5. Se rechazan máximos, multiplicadores y parámetros inválidos; un multiplicador vacío permanece como no aplicable.
6. Un split en borrador solo puede activarse cuando tiene participante y al menos un KPI activo.
7. Un split activo permite configurar KPI y uno cerrado queda en solo lectura.
8. La migración/backfill conserva personas, semanas y participantes existentes.

No añadas pruebas end-to-end de navegador ni una suite exhaustiva. El usuario realizará pruebas funcionales manuales.

Ejecuta y deja en verde:

- `npm run lint`;
- `npm run typecheck`;
- `npm test`;
- `npm run build`;
- migraciones completas sobre una base limpia;
- nueva migración sobre una base que ya tenga el esquema y datos de `MVP-1A`.

Si el entorno disponible no permite una de las comprobaciones de base de datos, no inventes el resultado: explica exactamente cuál no se pudo ejecutar y deja instrucciones reproducibles.

---

## 13. Documentación obligatoria

Actualiza la documentación para que una futura sesión solo necesite GitHub.

### `README.md`

- Mantén las instrucciones existentes.
- Documenta PostgreSQL local en Windows como recorrido principal.
- Deja Docker como alternativa opcional.
- Añade una explicación breve de la configuración de KPI.
- Añade pasos manuales para comprobar `MVP-1B`.

### `docs/ROADMAP.md`

- Marca `MVP-1A` como validado manualmente por el usuario.
- Marca `MVP-1B` como completado solo si se cumplen todos sus criterios.
- Mantén `IMPORT-1` como siguiente entrega pendiente de recibir los Excel originales.
- No adelantes `MVP-1C`.

### `docs/DATA_MODEL.md`

- Añade `SplitKpiConfig` y `KpiCode`.
- Actualiza el diagrama Mermaid.
- Documenta `Decimal`, campos opcionales, JSON validado, relaciones y restricciones.
- Explica el backfill de splits existentes.

### `docs/DECISIONS.md`

Registra al menos:

- catálogo cerrado y tipado en código;
- copia estable de configuración por split;
- parámetros propios almacenados como JSON pero validados por esquema conocido;
- multiplicador vacío como nivel no aplicable;
- edición de KPI en splits activos permitida provisionalmente hasta que existan resultados;
- activación de un nuevo split exige participante y KPI activo;
- PostgreSQL local como entorno usado por el usuario y Docker opcional.

### `docs/KPI_CONFIGURATION.md`

Crea este documento como referencia principal para la siguiente entrega. Debe contener:

- los diez KPI y sus códigos;
- sus valores predeterminados;
- sus parámetros;
- forma fija de cada cálculo;
- reglas de validación;
- significado de máximo base y multiplicadores;
- aclaración de que todavía no existe motor de cálculo;
- ejemplos de dos splits con configuraciones diferentes, usando datos ficticios.

### `docs/DISCOVERY-1-SPLIT-8.md`

Actualízalo únicamente si hace falta enlazar `docs/KPI_CONFIGURATION.md` o aclarar qué parte ya está implementada. No borres el contexto histórico.

### `CLAUDE.md`

Añade `docs/KPI_CONFIGURATION.md` a la lectura obligatoria para cualquier trabajo futuro relacionado con KPI, cargas o resultados.

### `CHANGELOG.md`

Añade una versión coherente, recomendada `0.2.0`, con únicamente lo realmente implementado en `MVP-1B`.

---

## 14. Criterios de aceptación

La entrega está terminada cuando:

- los diez KPI aparecen en cada split;
- inicialmente están inactivos y cargados con valores de Split 8;
- pueden activarse y desactivarse individualmente;
- pueden configurarse máximo, multiplicadores y parámetros propios mediante campos claros;
- los datos persisten después de recargar la página;
- dos splits pueden tener valores diferentes para el mismo KPI;
- desactivar un KPI no borra sus parámetros;
- un nivel puede quedar como no aplicable;
- los errores se muestran en castellano;
- un split nuevo no puede activarse sin participante y KPI activo;
- los splits activos existentes no cambian de estado y permiten configurar KPI;
- los splits cerrados son de solo lectura;
- la migración preserva los datos existentes;
- un split nuevo crea semanas y configuraciones KPI de forma atómica;
- no existe todavía cálculo de resultados ni código de importación;
- documentación, modelo, decisiones, roadmap y changelog coinciden con el código;
- las comprobaciones acotadas terminan correctamente.

---

## 15. Pruebas manuales que debes dejar al usuario

Incluye en tu respuesta final instrucciones exactas y breves para probar desde `localhost`:

1. Ejecutar la migración nueva con PostgreSQL local.
2. Abrir un split existente y comprobar que aparecen diez KPI inactivos.
3. Activar Cazador de soluciones, Explorador de datos y Maestro Artesano.
4. Modificar un máximo, un multiplicador y un parámetro propio.
5. Recargar la página y verificar que persisten.
6. Desactivar un KPI, recargar y volver a activarlo para verificar que conserva los valores.
7. Crear otro split y comprobar que mantiene sus propios valores.
8. Intentar activar un split sin KPI activos y comprobar el mensaje.
9. Activar correctamente un split con participante y KPI activo.
10. Comprobar que un split activo existente puede recibir configuración.

No pidas al usuario que ejecute suites exhaustivas. Sus pruebas manuales deben centrarse en el comportamiento visible.

---

## 16. Git y GitHub

1. Parte de `main` actualizado.
2. Crea la rama `feature/mvp-1b-kpi-configuration`.
3. Trabaja solo en esa rama.
4. Conserva cambios ajenos y no reescribas historial.
5. Crea commits claros; utiliza como commit principal algo equivalente a:
   - `feat: implement MVP-1B KPI configuration`
6. Sube la rama.
7. Crea una Pull Request si el entorno lo permite.
8. No fusiones la Pull Request.

Si no puedes hacer `push` o crear la PR por autenticación, deja los commits preparados y explica el bloqueo. No intentes eludir permisos.

---

## 17. Respuesta final de Claude Code

Responde en castellano, sin pegar archivos completos, e incluye:

1. Resumen de lo implementado.
2. Rama, commits y URL de la PR.
3. Modelo de datos y migración añadidos.
4. Decisión utilizada para catálogo y configuración por split.
5. Pantallas y comportamiento visible.
6. Archivos de documentación actualizados o creados.
7. Comandos ejecutados y resultado real de cada comprobación.
8. Confirmación de que los datos de `MVP-1A` se preservan.
9. Pasos manuales exactos para PostgreSQL local y `localhost`.
10. Limitaciones o decisiones registradas.
11. Confirmación explícita de que no se implementaron importación, resultados, clasificación ni funcionalidades de juego.

Si aparece una ambigüedad menor, elige la opción más sencilla compatible con este documento y regístrala. Pregunta solo ante un bloqueo sustancial, una posible pérdida de datos o una contradicción que cambie el alcance.

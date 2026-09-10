# Prompt para Claude Code — MVP-1A: Personas y creación de splits

## Encargo

Trabaja sobre el repositorio:

`https://github.com/bateman37/gamification-vcs`

Esta es la primera entrega funcional del proyecto. En el momento de redactar este encargo el repositorio solo contiene un `README.md` con el título del proyecto. Comprueba primero el estado real del repositorio. Si ya hubiese cambios posteriores, consérvalos y adapta esta entrega sin sobrescribir trabajo existente.

Debes implementar **MVP-1A — Personas y creación de splits** y dejar en el propio repositorio toda la documentación necesaria para que futuras sesiones de Claude Code puedan continuar leyendo únicamente GitHub.

No amplíes el alcance. Esta entrega debe ser pequeña, ejecutable y comprobable.

---

## 1. Objetivo del producto

El producto será una aplicación web para administrar gamificaciones periódicas del equipo de Customer Service.

En el producto completo, un administrador podrá:

- crear un split;
- seleccionar sus participantes;
- configurar los KPI activos;
- cargar resultados mediante Excel o formularios manuales;
- revisar los resultados;
- consultar la clasificación general.

Cada participante podrá acceder posteriormente a su resultado individual y a la clasificación.

El sistema sustituirá un libro Excel con fórmulas y hojas de datos. No debe reproducir la estructura visual del Excel: debe representar correctamente los conceptos del negocio en una aplicación sencilla.

La arquitectura acordada es deliberadamente simple:

- una única aplicación web;
- una base de datos relacional;
- un único repositorio y despliegue;
- sin microservicios ni infraestructura distribuida.

---

## 2. Alcance exacto de esta entrega

Implementa exclusivamente:

1. Base del proyecto web.
2. Conexión y esquema inicial de PostgreSQL.
3. Gestión de personas.
4. Creación y gestión básica de splits.
5. Generación de las semanas de un split.
6. Incorporación de personas como participantes de un split.
7. Alias y nivel técnico propios de cada participante dentro de cada split.
8. Incorporación de participantes cuando el split ya está activo, indicando desde qué semana participan.
9. Documentación, roadmap, decisiones y changelog persistidos en GitHub.

No implementes todavía:

- autenticación o autorización;
- usuarios administradores o cuentas de participantes;
- KPI en base de datos;
- fórmulas o motor de cálculo;
- importación de Excel;
- formularios de carga de resultados;
- resultados, clasificación o ficha individual;
- facciones o equipos;
- profesiones;
- localizaciones;
- objetos, cartas, mercado o créditos;
- renombre;
- misiones;
- correo, PDF o integración con Outlook;
- conexión con Power BI;
- un sistema genérico de plugins o funcionalidades;
- API pública;
- microservicios, colas, caché distribuida o event bus.

Aunque parte de estos conceptos aparezca en el contexto funcional, solo se debe documentar para futuras entregas. No construyas tablas, pantallas ni abstracciones prematuras para ellos.

---

## 3. Decisiones técnicas obligatorias

Si el repositorio continúa vacío, utiliza:

- **Next.js con App Router**.
- **TypeScript** con modo estricto.
- **PostgreSQL**.
- **Prisma ORM** y migraciones versionadas en Git.
- **Tailwind CSS** para una interfaz administrativa sencilla.
- **npm** y su lockfile.
- ESLint y formateo consistente.
- Pruebas unitarias o de servicio únicamente para las reglas críticas de esta entrega.

Usa versiones estables compatibles entre sí. No fijes versiones experimentales ni `latest` de forma incontrolada.

La aplicación, las rutas de servidor y la lógica de negocio deben vivir en el mismo proyecto Next.js. No crees un backend independiente.

Incluye:

- `.env.example` sin secretos;
- variable `DATABASE_URL`;
- una configuración de PostgreSQL para desarrollo local mediante `docker-compose.yml` o `compose.yml`;
- scripts npm claros para desarrollo, comprobaciones, migraciones y pruebas;
- migración inicial de Prisma comprometida en Git.

No dependas de Supabase, Firebase ni otro servicio externo en esta entrega.

---

## 4. Modelo funcional obligatorio

### 4.1 Persona

Una persona es un registro estable que puede reutilizarse en distintos splits.

Datos mínimos:

- `id` estable, preferiblemente UUID;
- nombre completo;
- correo opcional, preparado para identificar la futura cuenta del participante;
- fecha de creación;
- fecha de modificación.

Reglas:

- El alias no pertenece a `Person`.
- Una persona puede participar en cero, uno o varios splits.
- El correo, cuando exista, debe normalizarse y no puede repetirse.
- No hace falta implementar eliminación física. Evita diseñar ahora reglas complejas de borrado.
- No incluyas datos reales de trabajadores en seeds, fixtures o capturas.

### 4.2 Split

Un split representa una edición de la gamificación.

Datos mínimos:

- `id` estable;
- nombre;
- descripción opcional;
- fecha de inicio;
- número de semanas;
- estado: `DRAFT`, `ACTIVE` y `CLOSED`;
- fecha de creación;
- fecha de modificación.

Reglas:

- La fecha inicial debe ser un lunes.
- El número de semanas debe ser positivo. Usa un límite razonable y documentado, por ejemplo entre 1 y 52.
- El split se crea en estado `DRAFT`.
- Las fechas y la duración se pueden editar mientras esté en borrador.
- Para activar un split debe existir al menos un participante.
- Después de activarlo se pueden añadir participantes.
- No es necesario implementar todavía el cierre funcional del split; el estado `CLOSED` queda preparado en el modelo.

### 4.3 Semana del split

Al crear un split se generan sus semanas.

Datos mínimos:

- `id`;
- `splitId`;
- número secuencial dentro del split: 1, 2, 3…;
- fecha inicial;
- fecha final.

Reglas:

- Cada semana comienza en lunes y termina en domingo.
- La combinación split + número secuencial es única.
- No uses el número ISO del calendario como identidad de la semana. Puede mostrarse como información, pero la identidad funcional es `splitId + sequenceNumber`.
- Si se editan fecha o duración durante `DRAFT`, las semanas deben mantenerse coherentes. Resuélvelo de la forma más sencilla y segura posible, dado que todavía no existen resultados dependientes.

### 4.4 Participante del split

La participación es una relación entre una persona y un split.

Datos mínimos:

- `id`;
- `splitId`;
- `personId`;
- alias propio para ese split;
- nivel técnico `N0`, `N1` o `N2`;
- semana inicial de participación;
- semana final opcional, preparada para futuro;
- fecha de creación;
- fecha de modificación.

Reglas obligatorias:

- Una persona solo puede aparecer una vez en un mismo split.
- Puede participar en distintos splits.
- Puede tener un alias distinto en cada split.
- El alias debe ser único dentro del split, sin distinguir mayúsculas y minúsculas ni espacios exteriores.
- El mismo alias sí puede existir en splits diferentes.
- El alias se puede editar sin modificar el nombre global de la persona.
- La semana inicial debe pertenecer al mismo split.
- Al crear el split, la semana inicial predeterminada será la semana 1.
- Si se añade una persona con el split activo, el administrador debe escoger desde qué semana compite.
- Una persona incorporada durante el split no debe considerarse participante en semanas anteriores.

Implementa la normalización necesaria de forma explícita y testeable. No dependas únicamente de validaciones del navegador. Las reglas críticas deben protegerse en servidor y, cuando sea viable, también mediante restricciones de base de datos.

---

## 5. Interfaz administrativa mínima

Toda la interfaz debe estar en castellano. Prioriza claridad y funcionamiento sobre diseño visual.

### 5.1 Navegación

Crea una navegación administrativa mínima con:

- Personas.
- Splits.

No muestres todavía enlaces vacíos a KPI, cargas, resultados o clasificación.

### 5.2 Pantalla de personas

Debe permitir:

- listar personas;
- crear una persona;
- editar nombre y correo;
- consultar en cuántos splits participa, si resulta sencillo obtenerlo sin ampliar el alcance.

Muestra errores comprensibles, por ejemplo para un correo duplicado o no válido.

### 5.3 Listado de splits

Debe mostrar como mínimo:

- nombre;
- fechas;
- número de semanas;
- estado;
- número de participantes;
- acceso al detalle;
- acción para crear un split.

### 5.4 Creación de split

Implementa un recorrido sencillo, sin un wizard complejo. Puede resolverse creando primero el borrador y completándolo en su página de detalle.

Debe permitir:

- indicar nombre, descripción opcional, lunes de inicio y número de semanas;
- guardar el split en borrador;
- generar automáticamente las semanas;
- seleccionar personas existentes;
- crear una persona desde el flujo si todavía no existe, sin duplicar lógica de negocio;
- indicar alias, nivel y semana inicial de cada participante;
- revisar la configuración;
- activar el split cuando tenga al menos un participante.

### 5.5 Detalle de split

Debe mostrar:

- datos generales y estado;
- calendario de semanas;
- participantes;
- nombre global de la persona;
- alias dentro del split;
- nivel;
- semana inicial;
- posibilidad de editar alias y nivel;
- posibilidad de añadir participantes tanto en `DRAFT` como en `ACTIVE`;
- botón de activación cuando se cumplan las condiciones.

No implementes eliminación de participantes ni modificación retroactiva compleja. Si detectas una decisión no definida, aplica la solución mínima que no destruya datos y déjala documentada.

### 5.6 Estados de interfaz

Incluye estados simples de:

- carga;
- éxito;
- formulario inválido;
- error de servidor;
- lista vacía.

No dediques tiempo a animaciones, temas, dashboards, gráficas o diseño de marca.

---

## 6. Estructura de código

Mantén una separación pequeña y comprensible entre:

- páginas/componentes;
- acciones o controladores de servidor;
- servicios de dominio;
- acceso a datos con Prisma;
- validación de entradas.

No introduzcas patrones empresariales innecesarios. Sí evita meter todas las reglas directamente en componentes React.

Centraliza las operaciones principales para que puedan probarse sin navegador:

- crear persona;
- crear split y sus semanas;
- actualizar un split en borrador;
- añadir participante;
- editar alias y nivel;
- activar split.

Las fechas semanales deben manejarse como fechas de calendario, evitando errores de zona horaria que cambien un lunes por un domingo.

---

## 7. Documentación obligatoria dentro del repositorio

La documentación es parte de la entrega, no una tarea opcional al final.

### 7.1 `CLAUDE.md`

Créalo en la raíz con instrucciones permanentes para futuras sesiones de Claude Code:

- leer primero `README.md`, `docs/PROJECT_CONTEXT.md`, `docs/ROADMAP.md`, `docs/DATA_MODEL.md` y `CHANGELOG.md`;
- comprobar el código real antes de proponer cambios;
- trabajar por entregas pequeñas;
- no ampliar alcance sin una petición explícita;
- mantener documentación, migraciones y changelog sincronizados con cada cambio;
- registrar decisiones nuevas y no contradecir decisiones existentes sin explicarlo;
- mantener la aplicación como monolito web sencillo;
- no introducir funcionalidades futuras de forma preventiva;
- no usar datos personales reales en pruebas;
- ejecutar solo pruebas acotadas y relevantes para la entrega;
- no fusionar ramas ni PR sin aprobación del usuario.

### 7.2 `README.md`

Sustituye el README mínimo por uno útil que contenga:

- qué es Gamification VCS;
- estado actual: `MVP-1A`;
- pila tecnológica;
- requisitos locales;
- configuración de `.env`;
- cómo iniciar PostgreSQL;
- cómo instalar dependencias;
- cómo aplicar migraciones;
- cómo ejecutar la aplicación;
- comandos de lint, typecheck, test y build;
- enlaces a los documentos del proyecto.

Las instrucciones deben poder seguirse en Windows/PowerShell y ser suficientemente claras para una persona no desarrolladora. No incluyas secretos ni rutas de una máquina concreta.

### 7.3 `docs/PROJECT_CONTEXT.md`

Debe dejar documentado:

- objetivo del producto;
- roles futuros: administrador y participante;
- vocabulario: persona, split, semana, participante, alias, KPI, resultado y clasificación;
- diferencia entre persona global y participante de un split;
- decisión de alias por split;
- posibilidad de incorporar participantes durante un split;
- principio de empezar con el núcleo e incorporar capas de juego después;
- resumen funcional del Split 8 incluido en el apartado 8 de este encargo.

### 7.4 `docs/ROADMAP.md`

Registra como mínimo:

- `MVP-1A — Personas y creación de splits`: esta entrega.
- `MVP-1B — KPI activos y configuración`: pendiente.
- `IMPORT-1 — Auditoría e implementación de cargas`: pendiente de recibir Excel originales.
- `MVP-1C — Resultados`: panel admin, vista individual y clasificación general.
- Capas posteriores: autenticación, facciones, profesiones, localizaciones, objetos, economía, renombre y otros módulos.

Usa estados claros: pendiente, en curso y completado. Marca una entrega como completada solo si se cumplen sus criterios de aceptación.

### 7.5 `docs/DATA_MODEL.md`

Documenta:

- tablas creadas;
- campos y relaciones;
- restricciones y normalizaciones;
- decisiones sobre fechas;
- diagrama Mermaid ER pequeño;
- qué entidades se han pospuesto.

### 7.6 `docs/DISCOVERY-1-SPLIT-8.md`

Crea un documento de descubrimiento funcional permanente con el contexto del apartado 8. Debe distinguir claramente:

- comportamiento auditado del Excel;
- alcance del primer MVP;
- funcionalidades históricas que se incorporarán después;
- cuestiones pendientes de los Excel de entrada.

No hace falta copiar este prompt literalmente. Sí debe conservar todos los datos funcionales que una futura sesión necesitará para implementar los KPI sin volver a depender de esta conversación.

### 7.7 `docs/DECISIONS.md`

Registra al menos:

- monolito Next.js frente a frontend/backend separados;
- PostgreSQL y Prisma;
- alias ubicado en la participación del split;
- semanas con identidad secuencial dentro del split;
- catálogo cerrado de KPI para el siguiente incremento;
- autenticación aplazada;
- módulos de juego aplazados.

### 7.8 `CHANGELOG.md`

Créalo con formato claro inspirado en Keep a Changelog. Añade la entrada de `MVP-1A` bajo `Unreleased` o una primera versión `0.1.0`, pero sé consistente con el versionado indicado en el resto de documentación.

Incluye únicamente cambios realmente implementados.

---

## 8. Contexto funcional de Split 8 que debe quedar en GitHub

### 8.1 Campaña auditada

- El Split 8 tuvo 10 semanas operativas: semanas de calendario 41 a 50 de 2025.
- Fechas iniciales: 06/10/2025, 13/10/2025, 20/10/2025, 27/10/2025, 03/11/2025, 10/11/2025, 17/11/2025, 24/11/2025, 01/12/2025 y 08/12/2025.
- La hoja de resultados contenía 12 participantes.
- La hoja maestra contenía 13 personas, lo que confirma que persona y participación en split son conceptos diferentes.
- Dos participantes se incorporaron en semanas posteriores, lo que confirma la necesidad de una semana inicial de participación.

### 8.2 Los diez KPI iniciales

El primer catálogo de KPI será cerrado. En `MVP-1B` se podrán activar o desactivar por split y configurar sus parámetros; todavía no se permitirá crear KPI nuevos.

| KPI | Cálculo observado en Split 8 | Multiplicador N0 / N1 / N2 | Máximo base |
|---|---|---:|---:|
| Cazador de soluciones | Tickets resueltos × multiplicador | 2,5 / 1 / 1,85 | 70 |
| Explorador de datos | Tickets actualizados con comentario × multiplicador | 0,62 / 0,5 / 1,5 | 70 |
| Embajador de voz | (Aceptadas − rechazadas − no atendidas) × multiplicador + salientes | 1,25 / 1,5 / 2 | 50 |
| Maestro Artesano | (Positivas − negativas × 4) × 10 × multiplicador | 3 / 2 / 2 | 100 |
| Domador de Escaladas | (Base 30 o 60 − 200 × escalados/tickets gestionados) × multiplicador | 1 / 1 / 1 | La base 60 era un efecto de profesión |
| Guardián de la Estabilidad | Resultados × 30 × multiplicador | — / — / 1 | 30 |
| Cronomagia laboral | Occupancy × 60 × multiplicador + ajuste opcional | 1 / 1 / 1 | 60 |
| Redactor estrella | Si artículos < 0: artículos × 10 + propuestas × 5. Si no: artículos × 10 × multiplicador + propuestas × 5 | 4 / 1,5 / 2 | 60 |
| Estudiante entusiasta | Horas de dedicación × 12,5 × multiplicador | 1 / 1 / 1 | 50 |
| Aprendiz experto | Valor de formación / 15 × 50 × multiplicador | 1 / 1 / 1,25 | 50 |

Detalles importantes para el futuro motor:

- Las llamadas salientes se sumaban después del multiplicador.
- Las propuestas de artículo valían 5 puntos y se sumaban fuera del multiplicador.
- Los artículos negativos restaban 10 puntos sin multiplicador de nivel para esa parte.
- Escalados utilizaba como denominador las actualizaciones de Productividad para la misma persona y semana.
- Vacío, cero, ausencia, dato pendiente y persona todavía no incorporada no son necesariamente el mismo estado.
- El máximo era un máximo base. Profesiones, localizaciones u objetos podían elevar el resultado después del máximo.
- Algunos efectos se acumulaban y generaban factores como 1,44, 1,56 o 1,68.

En `MVP-1B` cada KPI tendrá un tipo de cálculo conocido y parámetros editables. No se guardarán fórmulas Excel libres ni código introducido por el administrador.

### 8.3 Origen de las futuras cargas

| Fuente histórica | Forma de introducción |
|---|---|
| Productividad | Excel; alimenta Cazador, Explorador y el denominador de Escalados |
| Escalados | Dato manual y cruce con Productividad |
| Calidad | Excel |
| Llamadas | Excel |
| Estabilidad | Manual |
| Cronomagia | Manual desde Power BI |
| Artículos | Excel |
| Dedicación | Manual desde Power BI |
| Formaciones | Excel |

`DATAPadawan` no se utilizó y `DATADedicacionLeo` era histórico. No forman parte del catálogo inicial.

Los importadores no deben diseñarse a partir de las hojas transformadas del antiguo libro. En `IMPORT-1` el usuario proporcionará ejemplos de los Excel originales tal como llegan. Entonces se definirán columnas, encabezados, nombres, duplicados, vacíos, ceros, correcciones y previsualización.

### 8.4 Flujo futuro completo

El flujo que se construirá por incrementos es:

1. Crear split y participantes.
2. Seleccionar KPI activos y configurar sus cálculos.
3. Abrir una semana.
4. Cargar Excel o introducir valores manuales.
5. Calcular los KPI.
6. Revisar desde administración.
7. Publicar resultados.
8. Mostrar resultado individual.
9. Mostrar clasificación general acumulada.

El primer MVP básico no incluye funcionalidades de juego adicionales. Su clasificación general se basará en los puntos KPI acumulados.

### 8.5 Funcionalidades históricas aplazadas

Split 8 también utilizó o describió:

- facciones;
- promedio de los tres mejores renombres semanales para la clasificación de facción;
- profesiones con bonus sobre pares de KPI;
- localizaciones con bonus semanales;
- objetos permanentes y efectos acumulables;
- créditos equivalentes a puntos KPI;
- compras y saldo;
- renombre derivado de la posición semanal;
- ajustes de juego de 25 puntos;
- preparación de una ficha individual en PDF y correo mediante Outlook.

Todo lo anterior queda fuera del MVP básico y no se debe implementar en esta entrega.

---

## 9. Pruebas acotadas obligatorias

No construyas una suite exhaustiva ni pruebas end-to-end de navegador. El usuario realizará pruebas funcionales manuales al final.

Añade únicamente pruebas automatizadas de alto valor para comprobar:

1. Generación correcta de semanas desde un lunes.
2. Rechazo de una fecha inicial que no sea lunes.
3. Una persona puede tener alias distintos en splits diferentes.
4. Dos participantes no pueden compartir el mismo alias normalizado dentro del mismo split.
5. Una persona no puede añadirse dos veces al mismo split.
6. La semana inicial de un participante debe pertenecer al split.
7. Un split no puede activarse sin participantes.
8. Se puede añadir un participante a un split activo indicando una semana inicial válida.

Ejecuta y deja en verde:

- lint;
- typecheck;
- pruebas acotadas;
- build de producción;
- migración sobre una base de datos limpia.

No añadas pruebas ajenas a esta entrega solo para aumentar cobertura.

---

## 10. Criterios de aceptación

La entrega estará terminada cuando:

- el proyecto pueda instalarse siguiendo únicamente el README;
- PostgreSQL pueda iniciarse localmente y Prisma pueda aplicar la migración inicial;
- se pueda crear y editar una persona;
- se pueda crear un split en borrador indicando lunes inicial y duración;
- sus semanas se generen correctamente;
- se puedan incorporar personas con alias y nivel propios del split;
- la misma persona pueda tener alias diferentes en splits distintos;
- no se puedan duplicar persona o alias dentro del mismo split;
- se pueda activar un split con participantes;
- se pueda añadir un participante a un split activo desde una semana seleccionada;
- la interfaz muestre la información en castellano y errores comprensibles;
- no se haya implementado ninguna funcionalidad fuera del alcance;
- la documentación describa fielmente el estado real del repositorio;
- el changelog recoja únicamente lo implementado;
- lint, typecheck, pruebas, build y migración limpia terminen correctamente.

---

## 11. Forma de trabajar con Git y GitHub

1. Actualiza la rama principal antes de empezar.
2. Crea una rama llamada `feature/mvp-1a-personas-splits`.
3. Trabaja únicamente en esa rama.
4. Conserva cualquier cambio existente que no pertenezca a esta tarea.
5. Realiza uno o varios commits claros. Usa como commit principal algo equivalente a:
   - `feat: implement MVP-1A people and splits`
6. Sube la rama a GitHub.
7. Crea una Pull Request si el entorno lo permite.
8. No fusiones la Pull Request ni la rama principal.

Si no puedes hacer `push` o crear la PR por autenticación, no intentes eludirlo. Deja los commits preparados y explica el bloqueo exacto.

---

## 12. Entrega final que debes devolver

Cuando termines, responde en castellano y sin pegar archivos completos. Incluye:

1. Resumen de lo implementado.
2. Rama y commits creados.
3. URL de la Pull Request, si existe.
4. Estructura principal de archivos añadidos.
5. Modelo de datos implementado.
6. Migración creada.
7. Comandos ejecutados y resultado de cada comprobación.
8. Pasos manuales exactos para que el usuario pueda probar:
   - crear una persona;
   - crear un split;
   - añadirla con un alias;
   - activar el split;
   - añadir otra persona a partir de una semana posterior.
9. Decisiones o limitaciones que hayan quedado documentadas.
10. Confirmación explícita de que no se implementó nada de `MVP-1B`, `IMPORT-1` o `MVP-1C`.

Si durante el trabajo encuentras una ambigüedad menor, elige la opción más sencilla compatible con este documento y regístrala en `docs/DECISIONS.md`. Pregunta únicamente si existe un bloqueo que cambie sustancialmente el alcance o pueda destruir trabajo existente.


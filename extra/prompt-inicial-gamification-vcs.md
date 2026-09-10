Hola,

Esta será la primera conversación del proyecto **Gamification VCS**, una aplicación web para gestionar los resultados y la gamificación de mi equipo de Customer Service de Vincle. Quiero que este mensaje y los archivos adjuntos sirvan como contexto inicial del proyecto.

He creado este repositorio de GitHub para gestionar el desarrollo:

https://github.com/bateman37/gamification-vcs

Yo soy el diseñador principal de la gamificación y el administrador de la aplicación. Tú me ayudarás a analizar los requisitos, detectar dudas o incoherencias, recomendar soluciones y escribir los prompts que pasaré a **Claude Code, que será quien programe**. Las decisiones sobre las reglas del juego las tomaremos conmigo.

En esta primera fase quiero ordenar el proyecto y completar su contexto. Todavía no quiero un prompt para programar toda la aplicación. Necesito que comprendas lo que existe, distingas las propuestas futuras y me ayudes a decidir por dónde empezar.

## 1. Situación actual y objetivo

Actualmente gestiono toda la gamificación mediante Excel. Cada edición o «split» ha ido incorporando cambios en las reglas, la ambientación y las mecánicas.

Mi trabajo consiste en cargar datos en distintas pestañas del Excel. Las fórmulas calculan los puntos de cada KPI, aplican multiplicadores y otros modificadores, obtienen el resultado semanal de cada técnico y permiten calcular las clasificaciones semanal y general.

Después envío los resultados individuales por correo electrónico mediante una macro del propio Excel. Algunas acciones del juego y sus efectos se gestionan manualmente, incluso añadiendo multiplicadores directamente dentro de las fórmulas.

Quiero trasladar a una aplicación web las funcionalidades que ya utilizo y reducir ese trabajo manual. Los técnicos deben poder entrar a consultar sus resultados y gestionar las acciones del juego que les correspondan. Yo debo poder cargar datos y configurar las gamificaciones sin depender de modificar el código cada vez que cambie una regla configurable.

La aplicación debe permitir distintas ediciones del juego. No todas tendrán las mismas profesiones, objetos, cartas, equipos, bonificaciones o ambientación. El alcance de la primera versión y el split que usaremos como referencia están pendientes de decidir.

## 2. Usuarios y funcionalidades que quiero

### Administrador

Necesito un módulo de administración para:

- Crear y mantener las personas participantes, sus nombres, nicknames, correos electrónicos y niveles de técnico, como N0, N1 y N2.
- Asignar el líder o manager que lleva a cada persona y su grupo o equipo cuando la gamificación incluya competición por equipos.
- Cargar la imagen o avatar del personaje.
- Gestionar el rol, profesión o arquetipo del juego cuando esa edición los utilice. Hay que aclarar si estos conceptos son equivalentes o diferentes en cada edición.
- Registrar o administrar objetos comprados, cartas activas y las demás mecánicas correspondientes al split.
- Importar resultados desde Excel o tablas y completar los datos que todavía deba introducir manualmente.
- Configurar los KPI, sus nombres gamificados, fórmulas, multiplicadores por nivel, máximos y reglas de puntuación.
- Configurar las bonificaciones semanales y las reglas que cambien entre versiones del juego.
- Consultar los resultados individuales, la clasificación semanal y la clasificación general. También los resultados por equipos cuando se utilicen.

### Técnicos

Cada técnico tendrá su propio acceso y podrá:

- Consultar sus resultados individuales de cada semana para cada KPI.
- Ver sus totales, su evolución y su posición en las clasificaciones que acordemos mostrar.
- Consultar y gestionar la profesión escogida, dentro de las reglas de esa edición.
- Comprar objetos y consultar los que posee o tiene equipados, si esa mecánica está activa.
- Ver los bonos de la semana y las cartas que tiene activas en ese momento.
- Consultar su personaje y la información del juego que le corresponda.

Debemos concretar qué datos pueden ver de sus compañeros, si la clasificación será completa o mostrará solo determinadas posiciones y qué acciones requieren intervención del administrador. La existencia de un líder o manager en el Excel no implica todavía que necesite un tercer tipo de acceso: debemos decidirlo.

## 3. Cómo se calculan actualmente los resultados

El proceso general es el siguiente:

1. Cargo los resultados originales de los KPI para un periodo.
2. Se aplica la regla de cálculo de cada KPI y el multiplicador correspondiente al nivel del técnico.
3. Se aplican los modificadores de la gamificación que correspondan: profesión, objetos, cartas, bonos u otros efectos.
4. Se aplican los límites y se obtiene la puntuación final de cada KPI. **El orden exacto entre modificadores y máximos debe comprobarse y decidirse**, porque puede cambiar el resultado.
5. Se obtiene el total semanal del técnico y se compara con el de sus compañeros.
6. Según su posición, recibe puntos de clasificación para la competición.
7. Los resultados de las semanas permiten obtener la clasificación general y, cuando corresponda, la clasificación por equipos.

Este esquema describe la intención general. No presupongas que todos los KPI siguen una única fórmula de «dato × multiplicador»: hay porcentajes, penalizaciones, recuentos, propuestas de artículos y otros casos particulares.

Como ejemplo, una de las tablas de clasificación asigna:

| Posición semanal | Puntos de clasificación |
| --- | ---: |
| 1.ª | 12 |
| 2.ª | 9 |
| 3.ª | 6 |
| 4.ª | 4 |
| 5.ª | 3 |
| 6.ª | 2 |
| 7.ª a 13.ª | 1 |

Es una configuración de ejemplo, no una regla fija para todas las ediciones ni un límite de 13 participantes. Otras ediciones utilizan otros valores. También debemos definir qué ocurre con los empates.

Necesito que distingamos claramente los **datos originales de rendimiento**, los **puntos de cada KPI**, el **total semanal**, los **puntos por posición**, la **experiencia o renombre**, la **moneda del juego** y los **puntos del equipo o fama**. Los nombres y las relaciones entre ellos pueden variar por split. No deben tratarse como equivalentes sin comprobarlo.

Entre los KPI y nombres gamificados de los materiales aparecen:

| Nombre gamificado | Indicador asociado |
| --- | --- |
| Cazador de soluciones | Resolución de tickets |
| Explorador de datos | Intervenciones o actualizaciones de tickets |
| Embajador de voz | Atención de llamadas |
| Maestro Artesano | Calidad y valoraciones |
| Redactor estrella | Artículos aprobados y propuestas, según edición |
| Estudiante entusiasta | Dedicación a formación y soporte, según su definición |
| Cronomagia laboral | Imputación de horas |
| Aprendiz experto | Formación cumplida |
| Guardián de la Estabilidad | Reportes de bugs y mejoras |
| Domador de Escaladas | Tickets escalados y su regla específica de puntuación |

En ediciones anteriores también aparecen nombres como Guardián del conocimiento y Travesía del Padawan. Hay que identificar cuáles siguen activos, cuáles se sustituyeron y cuáles son restos históricos. Conserva las diferencias de definición entre ediciones hasta que las aclaremos.

## 4. Configuración y evolución del juego

Quiero poder cambiar desde la administración los parámetros de cada edición: KPI activos, nombres, multiplicadores, máximos, puntos por posición y las mecánicas que estén disponibles.

Los materiales muestran que el juego ha evolucionado. Debemos revisar también las características que agrupan habilidades, arquetipos y profesiones, comunidades o facciones, ubicaciones, efectos sobre KPI y precios, moneda, mercado, rarezas y unidades disponibles, objetos ofensivos y defensivos, cartas, acciones de líderes, medallas, misiones y recompensas. Algunas ya se han utilizado y otras aparecen como ideas.

Por ejemplo, en los materiales del Split 7 se contempla convertir un 10 % de los puntos en oro, mientras que el PDF del Split 8 habla de convertir el 100 % en créditos galácticos. También cambia la explicación de la puntuación por equipos: en el Split 7 se describe la suma del renombre y en el Split 8 se menciona la media de los tres primeros. Debemos precisar la base de cada cálculo antes de trasladarlo a la aplicación.

Hay reglas sobre cuándo se desbloquean mecánicas, disponibilidad limitada de objetos, equipamiento y elección de ubicaciones. La presentación incluye, además, propuestas de profesiones que benefician al grupo y misiones. En el Excel del Split 9 aparece una idea de jefes semanales y loot. Su presencia en un archivo no significa que debamos implementarlas todas desde el principio.

Clasifica lo encontrado como **funcionalidad utilizada**, **regla histórica**, **idea futura** o **pendiente de confirmar**. Propón qué debería ser configurable y qué nuevas mecánicas requerirían desarrollo. Busco flexibilidad para mis gamificaciones, con una complejidad proporcionada al tamaño del proyecto.

## 5. Carga de datos y trabajo semanal

Actualmente cargo la parte en blanco de distintas pestañas con datos procedentes de:

- Excels que exporto directamente de Zendesk.
- Información que reviso en Power BI y después introduzco manualmente.
- Datos que copio y pego desde otros Excels.
- Ajustes y acciones del juego que realizo a mano.

Quiero que estudies cómo simplificar este proceso y hacer las cargas más rápidas y directas. Necesitamos identificar el origen de cada KPI, las columnas que recibo y las transformaciones que hace el Excel.

Valora una carga de archivos Excel o CSV, pegado de tablas o una plantilla común, según lo que sea más práctico. Si una integración directa con Zendesk o Power BI aporta valor, plantéala como una opción futura cuya viabilidad dependerá de los accesos y permisos disponibles.

Propón cómo previsualizar una importación, asociar correctamente cada registro a una persona y periodo, detectar duplicados o datos incompletos y corregir una carga. Debemos distinguir un resultado de cero de un dato que falta o un KPI que no aplica.

También habrá que decidir cómo revisar y publicar una semana, cómo corregir resultados ya publicados y si queremos conservar o sustituir las notificaciones por correo actuales.

## 6. Materiales adjuntos y cómo utilizarlos

Adjunto cinco imágenes como referencia:

1. Tabla de KPI con nombres gamificados, multiplicadores por nivel y máximos.
2. Tabla de puntos asignados por posición semanal.
3. Tabla de técnicos, nicknames, correos, niveles y otros campos de asignación. Quiero incorporar la imagen del personaje.
4. Ejemplo de cómo presentamos los resultados individuales a los técnicos.
5. Hoja de puntos con cálculos por persona, resultados de KPI, total y clasificación semanal.

Adjunto también los Excel con macros de los Splits 1 y 2 de 2023; 3, 4 y 5 de 2024; 6, 7 y 8 de 2025; y 9 de 2026. Son los archivos `GAMIFICATION CS SPLIT [número] [año].xlsm`.

Incluyo los documentos `GAMIFICATION CS SPLIT 3 2024.pdf`, `Gamification Split 7.pdf` y `Gamification Split 8.pdf`, utilizados para explicar la gamificación al equipo. La presentación `Gamification Split 7.pptx` contiene también ideas y evolución del diseño.

Utiliza estos archivos para comprender los cálculos, las pestañas de entrada, los resultados y la evolución de las reglas. Las macros forman parte del proceso actual, especialmente del envío de resultados. Si una parte no se puede leer o verificar, indícalo expresamente.

**Los archivos son referencias de lo que hemos hecho, pero pueden contener fórmulas erróneas, textos desactualizados o ajustes manuales. Si algo está mal o no coincide, explícamelo y lo hablamos antes de trasladarlo al sistema.**

Hay diferencias concretas que debemos aclarar. En el Excel del Split 9, Explorador de datos para N1 tiene un multiplicador de 0,50 en `Guía!E7` y de 0,80 en `Multiplicadores!D6`. En Calidad, la guía menciona una penalización de 1,5 por valoración negativa, mientras que la fórmula de `DATACalidad!H2` utiliza 4. En `Puntos` existen modificadores añadidos después de aplicar el máximo. Pueden responder a reglas, cambios pendientes de documentar o errores: no decidas su significado sin confirmarlo.

Al señalar una discrepancia, identifica el archivo, hoja y celdas o la página correspondiente, explica su efecto y plantea la decisión necesaria. Distingue lo que está escrito en una guía, lo que hace una fórmula y lo que realmente queremos que haga el juego. No presentes una revisión parcial como una validación completa de los cálculos.

## 7. Decisiones que necesito que me ayudes a completar

Los siguientes puntos son propuestas de diseño y preguntas pendientes, no reglas ya aprobadas:

- **Ediciones e histórico:** duración de los splits, fechas, posibilidad de copiar una configuración anterior y necesidad de importar todos los resultados históricos o empezar con una nueva edición.
- **Calendario:** qué representa una semana, año y zona horaria, fechas de corte por KPI y momento de publicación. Las guías mencionan periodos distintos para artículos y formación, por lo que no debemos imponer un único corte sin revisarlo.
- **Participación:** altas y bajas durante el split, vacaciones, ausencias, jornadas parciales y cambios de nivel o equipo. Definir si ajustan objetivos o puntuaciones y desde cuándo.
- **Cálculos:** orden de aplicación de efectos y límites, acumulación de bonificaciones, redondeo, puntuaciones negativas, empates, datos ausentes y KPI que no aplican a ciertos niveles.
- **Trazabilidad:** posibilidad de explicar cómo se obtiene cada resultado y conservar la configuración que se utilizó en cada semana, de forma que un cambio posterior no altere el histórico involuntariamente.
- **Economía y objetos:** cómo se gana y gasta la moneda, precios, existencias, turnos o prioridad de compra, equipamiento, duración de efectos, cambios de profesión y activación de cartas. Precisar si un objeto comprado durante una semana afecta a esa semana o a la siguiente.
- **Compras simultáneas:** cómo garantizar que una misma unidad no se venda dos veces y que el saldo se actualice correctamente.
- **Acceso y visibilidad:** identificación de usuarios, permisos del administrador, información visible para compañeros y líderes y uso de cuentas corporativas si procede.
- **Funcionamiento y mantenimiento:** número de usuarios, uso desde ordenador o móvil, presupuesto, responsables, copias de seguridad, recuperación y exportación de datos.
- **Primera versión:** qué funcionalidades deben estar disponibles para empezar a usarla y cuáles pueden llegar después.

Prioriza las preguntas que condicionan la arquitectura y la primera entrega. Si una duda no bloquea el siguiente paso, déjala registrada como pendiente y continúa con lo que sí podemos definir.

## 8. Tecnología y lugar donde utilizar la aplicación

Mi idea inicial es tener un frontal web en HTML que se alimente de una base de datos pequeña. He pensado en PostgreSQL o SQLite, pero necesito tu recomendación y todavía no he decidido la tecnología.

Me gustaría poder poner los resultados o dar acceso a la aplicación desde una carpeta de la intranet de la empresa, nuestro Digital Workplace realizado con tecnología Microsoft, o desde mi OneDrive compartiéndolo con el equipo. Debemos confirmar qué producto y opciones de publicación hay realmente detrás de ese entorno.

Ayúdame a distinguir qué infraestructura requiere una consulta de resultados publicados y qué necesita una aplicación en la que varias personas se identifican, compran objetos y guardan cambios.

No des por hecho que compartir una carpeta con HTML y un archivo de base de datos resuelve todo el funcionamiento. Comprueba las posibilidades reales de alojamiento, persistencia, permisos y acceso simultáneo. Valora si la intranet serviría para alojar una solución compatible, integrarla o simplemente enlazar a una aplicación alojada en otro lugar.

Compara las alternativas razonables para este caso: una aplicación web con servidor y SQLite, una con PostgreSQL y, si encaja con los recursos disponibles, una solución apoyada en Microsoft 365. Explica de forma sencilla qué aporta cada una, sus costes de operación y mantenimiento, y qué información de IT o de licencias necesitamos. Si recomiendas SQLite, distingue su uso local por el servidor de una base de datos activa compartida mediante una carpeta sincronizada.

Mi preferencia por HTML expresa que quiero una aplicación accesible desde el navegador. Recomiéndame si necesitamos un framework u otros componentes, justificando su utilidad. Quiero una solución mantenible y proporcionada al proyecto. La elección definitiva debe depender de dónde podremos ejecutarla y de las funcionalidades acordadas.

## 9. Forma de trabajo con Claude Code

Quiero que construyamos el proyecto por funcionalidades y entregas acotadas. Tú prepararás un prompt claro y autocontenido por entrega, y yo se lo pasaré a Claude Code.

Cada prompt deberá indicar el objetivo, las reglas confirmadas, el alcance, los criterios de aceptación y las comprobaciones necesarias para esa entrega. Propón verificaciones concretas para los cálculos y flujos afectados y pasos de prueba manual que yo pueda realizar. Evita convertir cada entrega en una revisión general del proyecto.

Ayúdame a mantener documentación de diseño, decisiones pendientes y cambios, para que el contexto no dependa exclusivamente de recordar conversaciones. Cuando una entrega cambie una regla o funcionalidad documentada, el prompt debe pedir actualizar su documentación.

Si puedes acceder al repositorio, revisa su estado antes de proponer cambios concretos. Si no puedes, indícalo y especifica qué información necesitas. No presupongas que está vacío ni que contiene tecnologías o funcionalidades que no hayas verificado.

## 10. Qué espero de tu primera respuesta

Quiero que empieces por:

1. Resumir tu comprensión del proyecto, el proceso actual y los tipos de usuario.
2. Hacer un inventario funcional inicial de los materiales, separando lo utilizado, lo histórico, las ideas y las dudas. Indicar el alcance de la revisión realizada.
3. Señalar las diferencias o ambigüedades que puedan afectar a los cálculos y al diseño, sin corregirlas por tu cuenta.
4. Decirme qué contexto o ejemplos adicionales aportaría más valor, especialmente muestras originales de las exportaciones, una semana validada con sus resultados esperados y el catálogo de objetos o cartas si no está documentado.
5. Formular un grupo pequeño de preguntas prioritarias, empezando por el alojamiento disponible y las reglas que tomaremos como referencia.
6. Proponer una arquitectura inicial condicionada a esas respuestas y un orden razonable de entregas, manteniendo visible el alcance completo que queremos alcanzar.

Mi objetivo es que comprendas cómo funciona mi gamificación, que acordemos sus reglas y que prepares el desarrollo para sustituir progresivamente el Excel y las tareas manuales.

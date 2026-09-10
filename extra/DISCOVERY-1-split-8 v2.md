# DISCOVERY-1 — Auditoría funcional de Gamification CS Split 8

**Fecha de auditoría:** 10 de septiembre de 2026  
**Estado:** completada sobre los archivos disponibles  
**Objetivo:** entender el funcionamiento real del Split 8 para reconstruirlo como una aplicación web sencilla con base de datos y reglas configurables.

## 1. Conclusión ejecutiva

Split 8 puede trasladarse a una aplicación sin reproducir la estructura del Excel ni plantear una arquitectura compleja. El flujo real es:

```mermaid
flowchart LR
    A["Abrir semana"] --> B["Pegar o introducir datos"]
    B --> C["Calcular KPI"]
    C --> D["Aplicar límites y efectos"]
    D --> E["Revisar resultados"]
    E --> F["Publicar ranking, renombre y créditos"]
```

La solución de partida debe ser una sola aplicación web conectada a una base de datos relacional. El código de servidor necesario para guardar y calcular formará parte de la misma aplicación; no se necesitan microservicios, colas, integraciones con Power BI ni automatizaciones de importación para el primer producto.

La auditoría confirma estos puntos:

- El Split 8 operativo consta de **10 semanas**, de la semana 41 a la 50 de 2025.
- Participan **12 personas** en la hoja `Puntos`, organizadas en **3 facciones**. La hoja maestra contiene 13 personas, por lo que la persona debe existir de forma independiente y su participación —incluido su alias— debe configurarse dentro de cada split.
- Hay **10 KPI activos** y nueve hojas de captura utilizadas. `DATAPadawan` no se utilizó; `DATADedicacionLeo` contiene datos históricos y tampoco interviene en el Split 8.
- El Excel calcula primero los puntos del KPI, aplica el máximo base y después incorpora determinados efectos de arquetipo, localización u objeto. Por ello, **un resultado superior al máximo base puede ser correcto**.
- Los efectos se acumulan. En las fórmulas aparecen combinaciones como `1,2`, `1,3`, `1,4`, `1,44`, `1,56` y `1,68`.
- La fama de facción usa el **promedio de los tres mejores renombres semanales**, evitando que una ausencia o vacaciones perjudiquen directamente al equipo.
- Los créditos equivalen al 100 % de los puntos KPI acumulados; el saldo resta las compras. En Split 8 los precios son los del Split 7 multiplicados por 10.

## 2. Fuentes revisadas y criterio de lectura

- `GAMIFICATION CS SPLIT 8 2025(1).xlsm`: datos, fórmulas, participantes, semanas, clasificaciones, gasto y hoja individual.
- `Gamification Split 8.pptx`: reglas comunicadas, profesiones, mapa, mercado y criterio de fama de facción.

Para reconstruir el comportamiento operativo se toma como referencia:

1. Las fórmulas efectivamente usadas durante las semanas 41–50.
2. `Multiplicadores!A1:D35` para los multiplicadores por nivel.
3. `Guía!B5:I15` para los máximos base y descripciones.
4. Las fórmulas de `Puntos` para los efectos posteriores al máximo.
5. La versión más reciente de una regla cuando la presentación conserva explicaciones anteriores. Esto aplica especialmente a la fama de facción.

Las diferencias históricas entre textos o tablas no se consideran por sí mismas un problema: la nueva aplicación deberá permitir configurar versiones distintas para cada split.

## 3. Calendario reconstruido

La hoja `Puntos` indica 10 semanas completadas. El periodo operativo es:

| Semana | Primer día |
|---:|---|
| 41 | 06/10/2025 |
| 42 | 13/10/2025 |
| 43 | 20/10/2025 |
| 44 | 27/10/2025 |
| 45 | 03/11/2025 |
| 46 | 10/11/2025 |
| 47 | 17/11/2025 |
| 48 | 24/11/2025 |
| 49 | 01/12/2025 |
| 50 | 08/12/2025 |

Existe un bloque previo de semana 40 sin resultados y otro posterior de semana 51, pero no forman parte de las 10 semanas completadas. La presentación sitúa el primer movimiento en la semana del 20 al 24 de octubre, coherente con que los efectos de localización comiencen en la semana 43.

## 4. Proceso actual de carga

La siguiente tabla refleja tanto la explicación operativa recibida como las columnas del libro:

| Hoja | Datos aportados | Fecha semanal | Columnas calculadas | Uso posterior |
|---|---|---|---|---|
| `DATAProductividad` | Copiar y pegar A:H desde Excel | I | J:P | Cazador, Explorador y tickets gestionados de Escalados |
| `DATAEscalados` | B manual; C se obtiene de Productividad | D | E:I | Domador de Escaladas |
| `DATACalidad` | Copiar y pegar A:C desde Excel | D | E:H | Maestro Artesano |
| `DATALlamadas` | Copiar y pegar A:J desde Excel | K | L:O | Embajador de voz |
| `DATAPadawan` | No utilizado | — | — | Ninguno en Split 8 |
| `DataEstabilidad` | Resultado manual en B | C | D:G | Guardián de la Estabilidad |
| `DataCronomagia` | Porcentaje de occupancy manual desde Power BI en B | C | D:G; H admite un ajuste histórico | Cronomagia laboral |
| `DATAArticulos` | Artículos en B y propuestas en H, copiados desde Excel | C | D:G | Redactor estrella |
| `DATADedicacionForm` | Dedicación manual desde Power BI en B | C | D:G | Estudiante entusiasta |
| `DATAFormaciones` | Valor de formación copiado desde Excel en B | C | D:G | Aprendiz experto |

### Implicación para la web

El MVP debe mantener un método de carga familiar:

- Elegir la semana una sola vez.
- Cargar mediante Excel los KPI que actualmente llegan en ficheros.
- Introducir manualmente los KPI que actualmente se consultan en Power BI o se completan a mano.
- Relacionar los nombres del fichero con las personas participantes en ese split.
- Revisar los datos y resultados desde el panel de administración.

El formato exacto de cada Excel, sus columnas, la correspondencia de nombres y las validaciones de importación se diseñarán en una auditoría independiente cuando se aporten ejemplos reales de los archivos tal como llegan. Esta parte no queda cerrada en `DISCOVERY-1`.

## 5. Fórmulas operativas de los KPI

`m` representa el multiplicador configurado para el nivel N0, N1 o N2. El máximo indicado es el **máximo base aplicado en `Puntos` antes de los efectos posteriores**.

| KPI | Cálculo de Split 8 | Multiplicador N0 / N1 / N2 | Máximo base |
|---|---|---:|---:|
| Cazador de soluciones | Tickets resueltos × `m` | 2,5 / 1 / 1,85 | 70 |
| Explorador de datos | Tickets actualizados con comentario × `m` | 0,62 / 0,5 / 1,5 | 70 |
| Embajador de voz | (Aceptadas − rechazadas − no atendidas) × `m` + salientes | 1,25 / 1,5 / 2 | 50 |
| Maestro Artesano | (Positivas − negativas × 4) × 10 × `m` | 3 / 2 / 2 | 100 |
| Domador de Escaladas | (base 30 o 60 − 200 × escalados/tickets gestionados) × `m` | 1 / 1 / 1 | La base 60 se usa como efecto de profesión |
| Guardián de la Estabilidad | Resultados × 30 × `m` | — / — / 1 | 30 |
| Cronomagia laboral | Occupancy × 60 × `m` + ajuste opcional | 1 / 1 / 1 | 60 |
| Redactor estrella | Si artículos < 0: artículos × 10 + propuestas × 5. Si no: artículos × 10 × `m` + propuestas × 5 | 4 / 1,5 / 2 | 60 |
| Estudiante entusiasta | Horas de dedicación × 12,5 × `m` | 1 / 1 / 1 | 50 |
| Aprendiz experto | Valor de formación / 15 × 50 × `m` | 1 / 1 / 1,25 | 50 |

Observaciones funcionales:

- Las llamadas salientes se suman después del multiplicador de llamadas entrantes.
- Las propuestas de artículo valen 5 puntos y se suman fuera del multiplicador de artículos.
- Un artículo negativo resta 10 puntos sin aplicar el multiplicador por nivel a esa parte.
- Escalados toma como denominador `Actualizaciones` de Productividad, mediante persona + semana.
- Estabilidad solo se registró para el grupo al que aplicaba este KPI.
- `vacío`, `cero`, `no participa` y `ausente` no deberían convertirse en el mismo estado en la base de datos.

## 6. Orden real de cálculo

Este orden es fundamental para reproducir el Split 8:

1. Guardar el dato bruto semanal.
2. Calcular el KPI con el multiplicador de nivel.
3. Aplicar el máximo base cuando corresponda.
4. Aplicar efectos personales o semanales: profesión/arquetipo, localización y objeto.
5. Aplicar ajustes de juego con signo, si existen.
6. Sumar los diez KPI y obtener la posición semanal.
7. Convertir la posición en renombre.
8. Acumular puntos KPI como créditos y renombre para clasificaciones.

Por tanto, no debe programarse una validación del tipo «el resultado nunca puede superar el máximo». El máximo pertenece a una fase del cálculo. Un efecto puede modificarlo después o sustituir la base, como ocurre con Escalados.

Para que sea configurable, cada efecto necesita al menos:

- KPI afectado.
- Operación: multiplicar, sumar, restar o sustituir límite/base.
- Valor.
- Fase: antes del límite, sobre el límite o después del límite.
- Alcance: participante, profesión, facción, localización o semana.
- Fecha de inicio y fin, o permanencia durante todo el split.

Esto evita introducir a mano fórmulas diferentes en cada participante y semana.

## 7. Ranking, renombre, facciones y créditos

### Ranking individual semanal

El total semanal es la suma de los diez KPI menos los ajustes que en algunas semanas aparecen bajo la columna `Medallas`. Los valores observados son penalizaciones de 25 puntos. En la aplicación conviene llamarlos **ajustes de juego** y guardar su motivo, importe y origen, en vez de crear una columna específica que solo permita restar 25.

La posición semanal usa el comportamiento de `RANK.EQ`: los empates comparten posición y la siguiente posición se salta.

### Conversión de posición a renombre

| Posición | Renombre semanal |
|---:|---:|
| 1 | 15 |
| 2 | 11 |
| 3 | 8 |
| 4 | 5 |
| 5 | 3 |
| 6 | 2 |
| 7 en adelante | 1 |

La correspondencia procede de `Guía!B57:C71`.

### Facciones

La regla activa es: seleccionar los tres renombres individuales más altos de cada facción en cada semana y calcular su promedio. Esta es la versión coherente con la explicación de no castigar a equipos con personas de vacaciones y con las fórmulas de `Puntos`.

En 29 de las 30 combinaciones facción-semana, las celdas seleccionadas coinciden exactamente con los tres mejores valores. En una combinación se incluyeron cuatro valores; esto confirma que el Excel requería selección manual y que la web debe calcular automáticamente el top 3.

### Créditos y mercado

- El 100 % de los puntos KPI acumulados se transforma en créditos.
- El saldo disponible es créditos acumulados menos compras.
- El gasto figura introducido manualmente en `Puntos`.
- Los objetos son permanentes en el Split 8.
- La presentación indica existencias por rareza: común 5, raro 2 y legendario 1.
- Se puede equipar un objeto ofensivo y uno defensivo.
- Compra primero quien tenga menos créditos.
- El catálogo exacto de objetos comprados, sus efectos y su correspondencia con cada multiplicador no está incluido de forma completa en los archivos aportados.

## 8. Reglas de juego identificadas

### Profesiones/arquetipos visibles y activos como concepto

| Profesión | Mejora comunicada |
|---|---|
| Mecánico | +20 % a Cazador y Explorador |
| Arreglador | +20 % a Llamadas y Calidad |
| Mercenario | +20 % a Artículos y Dedicación |
| Científico | +20 % a Cronomagia y Formación |
| Piloto | Mejora de Escalados y Estabilidad |

En `Puntos` se observan de forma recurrente los multiplicadores `×1,2` asociados a varios de estos pares. La base 60 de Escalados para determinados participantes y los efectos de Estabilidad encajan con Piloto. No es necesario convertir las cifras publicadas en límites rígidos: el motor debe reproducir el orden configurable descrito anteriormente.

### Localizaciones

La presentación define nueve localizaciones sin repetición y una bonificación por localización:

- Cuatro planetas: +20 % Cronomagia.
- Dos lunas: +20 % Redactor.
- Estación: +30 % Cronomagia.
- Cinturón de asteroides: +50 % Escalados.
- Portal: +50 % Llamadas.

Las tres facciones se mueven a la misma localización y la facción ganadora escoge la siguiente. En las fórmulas se reconocen claramente:

- Semanas 43–44: `×1,2` global en Redactor.
- Semana 45: `×1,3` global en Cronomagia.
- Semanas 46, 48, 49 y 50: `×1,2` global en Cronomagia.

No se ha podido identificar de forma inequívoca el bonus global de la semana 47 solo a partir de las fórmulas. Esto no bloquea el producto: la localización será una selección administrativa y su efecto se aplicará desde configuración.

### Efectos acumulados

A partir de la semana 46 aparecen efectos personales adicionales `×1,3` y `×1,4`, apilados con el `×1,2` de profesión o localización. Esto produce factores combinados como `1,44`, `1,56` y `1,68`. El comportamiento confirma que los objetos o efectos no deben modelarse como una simple columna de bonus final, sino como efectos independientes que dejan trazabilidad.

### Contenido no activo en Split 8

La presentación conserva siete diapositivas ocultas sobre profesiones adicionales, misiones, consumibles, hechizos/potenciadores y actividades secundarias. Se consideran ideas históricas o futuras, no alcance inicial. `DATAPadawan` y `DATADedicacionLeo` también quedan fuera.

## 9. Participantes y ausencias

El libro y el alcance confirmado distinguen tres conceptos que la aplicación debe representar:

- **Persona:** registro estable y reutilizable entre splits.
- **Participante del split:** relación entre una persona y un split, con un alias propio de ese split y la configuración necesaria para calcular sus KPI.
- **Participación temporal:** momento en que la persona empieza o deja de participar en el split.

Una misma persona podrá tener alias diferentes en splits diferentes. El alias no pertenece al registro global de persona. También debe ser posible añadir un participante mientras el split ya está en curso, indicando desde qué fecha o semana participa para que no se le atribuyan resultados anteriores.

Como evidencia, dos participantes del Split 8 no tienen datos en las primeras semanas y aparecen desde la semana 48. También existen ausencias parciales en fuentes concretas.

El tratamiento detallado de ausencias, ceros y datos no recibidos se cerrará junto con la auditoría de los Excel de entrada. Para el modelo inicial sí queda fijado que un participante solo compite desde su fecha de incorporación al split.

## 10. Propuesta de producto mínimo

### Estructura técnica deliberadamente simple

- **Una aplicación web** para administración y consulta.
- **Una base de datos relacional**.
- **Un único proyecto y despliegue**; la lógica de cálculo vive en la propia aplicación.
- Integraciones automáticas con Excel o Power BI: fuera del primer alcance.

### Alcance funcional aprobado para el primer MVP

1. **Personas:** crear y mantener un listado de personas reutilizable entre splits.
2. **Inicio de un split:** nombre, fechas y configuración inicial.
3. **Participantes del split:** seleccionar personas existentes o crear nuevas, asignarles un alias exclusivo de ese split y configurar los datos que necesiten los KPI.
4. **Altas durante el split:** incorporar nuevos participantes indicando su primera semana activa.
5. **KPI activos:** seleccionar cuáles de los diez KPI de Split 8 se jugarán en ese split.
6. **Configuración del cálculo:** editar los parámetros de cálculo de esos KPI para el split.
7. **Carga semanal:** importar los Excel auditados o introducir datos manuales, según el KPI.
8. **Resultados de administración:** consultar el desglose calculado por semana y participante.
9. **Resultado individual:** cada participante puede consultar sus propios resultados y su evolución.
10. **Clasificación general:** ranking acumulado de los participantes del split.

### Funcionalidades de juego en el primer MVP

El primer MVP empieza sin funcionalidades adicionales. No entran todavía facciones, profesiones, localizaciones, objetos, cartas, mercado, créditos, renombre ni misiones. El inicio del split podrá evolucionar más adelante para activar módulos de juego, pero no se construirá ahora un sistema genérico de funcionalidades vacío.

La clasificación general inicial se basará en los puntos KPI acumulados. Cuando se incorpore el módulo de renombre se podrá ofrecer otra clasificación sin cambiar el histórico de puntos.

### Catálogo inicial de KPI

El administrador no podrá crear KPI nuevos en el primer MVP. Dispondrá de los diez que se jugaron en Split 8:

1. Cazador de soluciones.
2. Explorador de datos.
3. Embajador de voz.
4. Maestro Artesano.
5. Domador de Escaladas.
6. Guardián de la Estabilidad.
7. Cronomagia laboral.
8. Redactor estrella.
9. Estudiante entusiasta.
10. Aprendiz experto.

Cada split permitirá activar o desactivar estos KPI y configurar su cálculo. La configuración se realizará mediante parámetros propios de cada cálculo —multiplicadores, valores, penalizaciones y máximos—, no escribiendo código ni fórmulas Excel libres. La incorporación de KPI nuevos se abordará en una capa posterior.

### Pantallas mínimas

1. **Personas:** listado, alta y edición.
2. **Nuevo split:** datos generales, KPI activos y participantes.
3. **Participantes:** alias por split, configuración de cálculo y fecha de incorporación.
4. **Configuración de KPI:** parámetros de los KPI seleccionados.
5. **Carga semanal:** Excel o formulario manual según el KPI.
6. **Resultados de administración:** semana, participante, datos recibidos y puntos calculados.
7. **Mi resultado:** evolución y desglose individual.
8. **Clasificación general:** puntos acumulados y posición.

### Datos mínimos que debe guardar la base de datos

| Grupo | Información |
|---|---|
| Personas | Identidad estable, nombre y correo |
| Splits | Nombre, fechas y estado |
| Participación | Persona, split, alias propio, configuración necesaria y periodo activo |
| Semanas | Fecha inicial, número y estado de carga/publicación |
| KPI | Los diez KPI disponibles de Split 8 |
| Configuración KPI | KPI activo por split y parámetros de su cálculo |
| Entradas | Valores brutos por persona, semana y fuente, incluida la carga de origen |
| Resultados | Puntos calculados por KPI, total acumulado y posición |

No se propone guardar fórmulas de Excel como texto ejecutable. Cada uno de los diez KPI tendrá un cálculo conocido y parámetros editables. Así la herramienta es configurable sin convertirse en una hoja de cálculo dentro del navegador.

## 11. Auditoría independiente de las cargas

Las reglas de importación no se cerrarán usando únicamente las hojas `DATA...` del libro de gamificación. Se desarrollarán en una fase separada a partir de los Excel originales tal como se reciben antes de copiarlos al libro actual.

Para cada fichero real se identificará conjuntamente:

- estructura, hoja y fila de encabezados;
- columnas necesarias y columnas ignorables;
- tipo y formato de cada dato;
- campo utilizado para reconocer a la persona;
- transformación hasta la entrada del KPI;
- comportamiento ante duplicados, nombres no reconocidos, vacíos y ceros;
- posibilidad de corregir o reemplazar una carga;
- previsualización y mensajes que necesita el administrador.

Los KPI manuales se analizarán en la misma fase para definir un formulario sencillo y, cuando sea útil, la posibilidad de pegar varias filas. El resultado será una especificación de importación y un conjunto de ficheros de prueba. Hasta entonces, `DISCOVERY-1` solo fija que el MVP admitirá Excel y carga manual; no impone todavía su formato.

## 12. Alcance que no debe entrar en el primer desarrollo

- Microservicios o una plataforma distribuida.
- Conexión directa a Power BI.
- Importador genérico para cualquier Excel; solo se admitirán los formatos concretos que se auditen.
- Constructor libre de fórmulas.
- Sistema completo de misiones, hechizos, consumibles o actividades secundarias.
- Automatización del correo de Outlook.
- Facciones, profesiones, localizaciones, objetos, cartas, mercado, créditos y renombre.

La macro del libro confirma un flujo de creación de PDF y envío o visualización mediante Outlook desde la hoja `Tech`. Se ha identificado su propósito, pero no se ha realizado una reconstrucción completa del código VBA. Para el MVP basta con la ficha web; PDF y correo pueden incorporarse después.

## 13. Información pendiente, no bloqueante para empezar

1. Los Excel originales de entrada para diseñar las importaciones y validaciones.
2. Tratamiento exacto de una persona ausente, un cero y un dato aún no cargado.
3. Confirmación de si el histórico de Split 8 se migrará a la nueva base de datos o solo se usará para pruebas.

Estas cuestiones no impiden construir personas, splits, participantes, alias y configuración de KPI. La carga por Excel debe implementarse después de revisar los ficheros originales. Las reglas y funcionalidades de juego identificadas en esta auditoría quedan documentadas para capas posteriores, pero no bloquean el MVP básico.

## 14. Decisión recomendada para la siguiente fase

El MVP se puede construir en cuatro incrementos pequeños:

1. **MVP-1A — Personas y creación de split:** base web, base de datos, personas, participantes, alias por split, fechas y altas durante el split.
2. **MVP-1B — KPI activos y configuración:** catálogo cerrado de los diez KPI, selección por split y parámetros de cálculo.
3. **IMPORT-1 — Auditoría e implementación de cargas:** revisión de los Excel originales, carga por fichero y formularios manuales.
4. **MVP-1C — Resultados:** panel administrativo, resultado individual y clasificación general acumulada.

La primera tarea para Claude Code debería limitarse a `MVP-1A`. No debe implementar todavía cálculos, importadores ni funcionalidades de juego. Cuando esté estable se añadirá `MVP-1B`; después, con los ficheros reales disponibles, se diseñará `IMPORT-1` antes de programar las cargas.

## 15. Referencias internas principales

- Multiplicadores activos: `Multiplicadores!A1:D35`.
- Máximos base y descripción de KPI: `Guía!B5:I15`.
- Conversión de posición a renombre: `Guía!B57:C71`.
- Semanas y cálculos individuales: bloques semanales de `Puntos`, semanas 41–50.
- Acumulados y gasto: `Puntos!FP:GF`.
- Ficha individual y preparación de envío: `Tech!C3:I19`.
- Tabla de KPI comunicada: diapositiva 9.
- Profesiones: diapositivas 11–15.
- Localizaciones y mapa: diapositivas 18–19.
- Mercado: diapositiva 23.
- Regla activa de facciones: diapositiva 26.

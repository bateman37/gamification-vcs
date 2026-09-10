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
- Participan **12 personas** en la hoja `Puntos`, organizadas en **3 facciones**. La hoja maestra contiene 13 personas, por lo que pertenecer a un split debe modelarse aparte del usuario.
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
- Pegar una tabla completa en Productividad, Calidad, Llamadas, Artículos y Formaciones.
- Introducir o pegar una tabla pequeña en Escalados, Estabilidad, Cronomagia y Dedicación.
- Reconocer a las personas por una correspondencia de nombres configurable.
- Enseñar antes de guardar qué filas se aceptan, cuáles no pertenecen al split y cuáles no encuentran participante.

No hace falta exigir un formato de fichero perfecto en la primera versión. Un área de pegado tabular reproduce mejor la operación actual y reduce trabajo.

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

El libro distingue de hecho tres conceptos que la aplicación debe representar:

- Persona existente en el maestro.
- Persona inscrita en el split, con nivel, facción y profesión.
- Participación de esa persona en una semana concreta.

Dos participantes no tienen datos en las primeras semanas y aparecen desde la semana 48. También hay ausencias parciales en fuentes concretas. Esto impide asumir que una fila vacía equivale automáticamente a cero puntos.

Cada participante-semana debería tener uno de estos estados:

- Participa y tiene datos.
- Participa, dato confirmado en cero.
- Ausente/vacaciones.
- Aún sin cargar o revisar.
- No inscrito en esa fecha.

Para la clasificación individual se debe decidir explícitamente si una ausencia entra en el ranking semanal. Para la facción, el top 3 ya evita que una cuarta persona ausente reduzca el promedio.

## 10. Propuesta de producto mínimo

### Estructura técnica deliberadamente simple

- **Una aplicación web** para administración y consulta.
- **Una base de datos relacional**.
- **Un único proyecto y despliegue**; la lógica de cálculo vive en la propia aplicación.
- Integraciones automáticas con Excel o Power BI: fuera del primer alcance.

### Pantallas mínimas

1. **Configuración del split:** nombre, fechas, semanas, participantes, niveles, facciones y profesiones.
2. **Reglas:** KPI, multiplicadores, máximos, renombre y efectos.
3. **Carga semanal:** selector de semana y pestañas por fuente para pegar o introducir datos.
4. **Validación:** filas reconocidas, excluidas, duplicadas, ausentes o pendientes.
5. **Resultados de semana:** desglose de KPI, efectos aplicados, ajuste, total, posición y renombre.
6. **Clasificación:** individual, facciones, créditos generados, gasto y saldo.
7. **Ficha individual:** equivalente web de `Tech`, con evolución semanal y desglose.

### Datos mínimos que debe guardar la base de datos

| Grupo | Información |
|---|---|
| Personas | Nombre, alias, correo y correspondencias de nombre de los Excel |
| Splits | Fechas, estado y plantilla de reglas utilizada |
| Participación | Persona, split, nivel, facción, profesión y periodo activo |
| Semanas | Fecha inicial, número, estado de carga/publicación y localización |
| KPI | Fórmula/tipo, multiplicadores por nivel, máximo y orden de cálculo |
| Entradas | Valores brutos por persona, semana y fuente, incluida la carga de origen |
| Efectos | Operación, valor, fase, alcance, vigencia y motivo |
| Resultados | Puntos antes/después de límite y efectos, total, posición y renombre |
| Economía | Créditos, compras, ajustes y saldo; catálogo cuando se incorpore el mercado |

No se propone guardar fórmulas de Excel como texto ejecutable. Deben existir tipos de cálculo conocidos y parámetros editables. Así la herramienta es configurable sin convertirse en una hoja de cálculo dentro del navegador.

## 11. Reglas de validación recomendadas

- Una sola entrada por persona, semana y fuente, salvo sustitución explícita de una carga.
- Previsualización antes de confirmar una tabla pegada.
- No importar personas ajenas al split aunque aparezcan en los ficheros generales de CS.
- Conservar el dato bruto y el resultado calculado para poder explicar cada cifra.
- Registrar quién realizó una carga o cambio y cuándo.
- Recalcular una semana al modificar reglas o efectos, pero no alterar semanas publicadas sin una reapertura explícita.
- Mostrar por separado cero, vacío, ausencia y no aplicable.
- Calcular automáticamente el top 3 de cada facción.
- Mostrar el límite base y cada modificador aplicado en el desglose; superar el límite no genera alerta si existe un efecto que lo permite.

## 12. Alcance que no debe entrar en el primer desarrollo

- Microservicios o una plataforma distribuida.
- Conexión directa a Power BI.
- Lectura automática de todos los formatos Excel posibles.
- Constructor libre de fórmulas.
- Sistema completo de misiones, hechizos, consumibles o actividades secundarias.
- Automatización del correo de Outlook.
- Mercado avanzado antes de que exista el núcleo de cálculo semanal.

La macro del libro confirma un flujo de creación de PDF y envío o visualización mediante Outlook desde la hoja `Tech`. Se ha identificado su propósito, pero no se ha realizado una reconstrucción completa del código VBA. Para el MVP basta con la ficha web; PDF y correo pueden incorporarse después.

## 13. Información pendiente, no bloqueante para empezar

1. Catálogo exacto de objetos de Split 8: nombre, rareza, tipo, precio, efecto, stock y compras realizadas.
2. Significado funcional definitivo de los ajustes de 25 puntos actualmente bajo `Medallas`.
3. Tratamiento exacto de una persona ausente dentro del ranking individual semanal.
4. Bonus correspondiente a la localización de la semana 47.
5. Confirmación de si el histórico de Split 8 se migrará a la nueva base de datos o solo se usará para pruebas.

Estas cuestiones no impiden construir la base. El primer desarrollo puede trabajar con el Split 8 como plantilla configurable y usar sus diez semanas como conjunto de pruebas de regresión.

## 14. Decisión recomendada para la siguiente fase

La siguiente entrega debería ser **MVP-1 — Especificación de la carga semanal y motor de cálculo**. Debe cerrar:

- recorrido exacto del administrador;
- formato de cada tabla pegada;
- estados de carga y ausencia;
- reglas de cálculo configurables;
- estructura mínima de la base de datos;
- casos de prueba comparando una semana del Excel con la web.

Después de esa especificación ya se puede dar a Claude Code una primera tarea pequeña y comprobable: crear la aplicación web, la base de datos, la configuración de un split y una pantalla de carga de Productividad que calcule Cazador y Explorador. El resto de fuentes se añade de forma incremental usando el mismo patrón.

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


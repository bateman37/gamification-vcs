# Descubrimiento funcional — Split 8

Este documento recoge el contexto funcional auditado sobre el Split 8,
la campana real usada para disenar el nucleo del sistema (MVP-1A) y para
planificar el catalogo de KPI y las cargas de datos de los proximos
incrementos (`MVP-1B`, `IMPORT-1`, `MVP-1C`). Su objetivo es que una
sesion futura pueda implementar los KPI y las cargas sin depender de la
conversacion original en la que se recogio esta informacion.

Se distinguen explicitamente tres tipos de contenido:

- **Comportamiento auditado del Excel**: lo que realmente hacia el libro
  historico en el Split 8.
- **Alcance del primer MVP**: lo que se construye ahora o en el siguiente
  incremento inmediato.
- **Funcionalidades historicas que se incorporaran despues**: capas de
  juego que existieron en el Excel pero que quedan fuera del nucleo.

## 1. La campana auditada

- El Split 8 tuvo **10 semanas operativas**, correspondientes a las
  semanas de calendario 41 a 50 de 2025.
- Fechas de inicio de cada semana (lunes): 06/10/2025, 13/10/2025,
  20/10/2025, 27/10/2025, 03/11/2025, 10/11/2025, 17/11/2025, 24/11/2025,
  01/12/2025 y 08/12/2025.
- La hoja de **resultados** contenia **12 participantes**.
- La hoja **maestra de personas** contenia **13 personas**. Esta
  diferencia (13 frente a 12) confirma que persona y participacion en un
  split son conceptos distintos: no todas las personas registradas
  globalmente participaron en esta edicion.
- **Dos participantes se incorporaron en semanas posteriores** a la
  primera, lo que confirma la necesidad de una semana inicial de
  participacion por persona y split (`SplitParticipant.startWeekSequenceNumber`).

## 2. Los diez KPI iniciales (implementado en `MVP-1B`)

El primer catalogo de KPI es **cerrado**: desde `MVP-1B` se pueden activar
o desactivar por split y configurar sus parametros, pero **no** se pueden
crear KPI nuevos ni introducir formulas o codigo libre. Cada KPI tiene un
tipo de calculo conocido de antemano por el sistema. La referencia
completa de la configuracion implementada (catalogo, parametros, reglas
de validacion y ejemplos) esta en `docs/KPI_CONFIGURATION.md`; esta
seccion se conserva tal cual se audito, como contexto historico.

| KPI | Calculo observado en Split 8 | Multiplicador N0 / N1 / N2 | Maximo base |
|---|---|---:|---:|
| Cazador de soluciones | Tickets resueltos × multiplicador | 2,5 / 1 / 1,85 | 70 |
| Explorador de datos | Tickets actualizados con comentario × multiplicador | 0,62 / 0,5 / 1,5 | 70 |
| Embajador de voz | (Aceptadas − rechazadas − no atendidas) × multiplicador + salientes | 1,25 / 1,5 / 2 | 50 |
| Maestro Artesano | (Positivas − negativas × 4) × 10 × multiplicador | 3 / 2 / 2 | 100 |
| Domador de Escaladas | (Base 30 o 60 − 200 × escalados/tickets gestionados) × multiplicador | 1 / 1 / 1 | La base 60 era un efecto de profesion, no del KPI base |
| Guardian de la Estabilidad | Resultados × 30 × multiplicador | — / — / 1 | 30 |
| Cronomagia laboral | Occupancy × 60 × multiplicador + ajuste opcional | 1 / 1 / 1 | 60 |
| Redactor estrella | Si artículos < 0: artículos × 10 + propuestas × 5. Si no: artículos × 10 × multiplicador + propuestas × 5 | 4 / 1,5 / 2 | 60 |
| Estudiante entusiasta | Horas de dedicacion × 12,5 × multiplicador | 1 / 1 / 1 | 50 |
| Aprendiz experto | Valor de formacion / 15 × 50 × multiplicador | 1 / 1 / 1,25 | 50 |

### Detalles importantes para el futuro motor de calculo

- Las **llamadas salientes** se sumaban **despues** de aplicar el
  multiplicador de nivel (Embajador de voz).
- Las **propuestas de articulo** valian 5 puntos y se sumaban **fuera**
  del multiplicador (Redactor estrella).
- Los **articulos negativos** restaban 10 puntos, sin multiplicador de
  nivel para esa parte del calculo (Redactor estrella).
- **Escalados** utilizaba como denominador las actualizaciones de
  Productividad de la misma persona y semana (Domador de Escaladas).
- **Vacio, cero, ausencia, dato pendiente y persona todavia no
  incorporada no son necesariamente el mismo estado.** El motor de calculo
  y los importadores futuros deberan distinguir explicitamente entre
  estos casos en lugar de tratarlos todos como "cero".
- El maximo de cada KPI era un **maximo base**: profesiones,
  localizaciones u objetos podian elevar el resultado por encima de ese
  maximo despues de aplicarlo. Esto no se implementa en el nucleo, pero
  el motor de calculo futuro debe dejar espacio para ese efecto posterior.
- Algunos efectos de las capas de juego se acumulaban entre si y
  generaban factores compuestos como 1,44, 1,56 o 1,68 sobre el resultado
  base.

## 3. Origen de las futuras cargas (alcance de `IMPORT-1`)

| Fuente historica | Forma de introduccion |
|---|---|
| Productividad | Excel; alimenta Cazador, Explorador y el denominador de Escalados |
| Escalados | Dato manual, cruzado con Productividad |
| Calidad | Excel |
| Llamadas | Excel |
| Estabilidad | Manual |
| Cronomagia | Manual, proveniente de Power BI |
| Articulos | Excel |
| Dedicacion | Manual, proveniente de Power BI |
| Formaciones | Excel |

`DATAPadawan` no se llego a utilizar y `DATADedicacionLeo` era una fuente
historica ya discontinuada. Ninguna de las dos forma parte del catalogo
inicial de fuentes.

**Importante:** los importadores de `IMPORT-1` no deben disenarse a
partir de las hojas ya transformadas del libro Excel historico. El
usuario proporcionara ejemplos de los Excel **originales**, tal como
llegan hoy, momento en el que se definiran columnas, encabezados,
variaciones de nombres, duplicados, celdas vacias, ceros, correcciones y
la previsualizacion antes de guardar. Esta auditoria queda pendiente y no
se debe suponer su estructura de antemano.

## 4. Flujo funcional completo (a construir por incrementos)

1. Crear split y participantes — **`MVP-1A`, implementado**.
2. Seleccionar KPI activos y configurar sus calculos — `MVP-1B`.
3. Abrir una semana para carga de datos — `MVP-1C`.
4. Cargar Excel o introducir valores manuales — `IMPORT-1` / `MVP-1C`.
5. Calcular los KPI — `MVP-1C`.
6. Revisar desde administracion — `MVP-1C`.
7. Publicar resultados — `MVP-1C`.
8. Mostrar resultado individual — `MVP-1C`.
9. Mostrar clasificacion general acumulada — `MVP-1C`.

El primer MVP de resultados (`MVP-1C`) no incluira ninguna capa de juego
adicional: su clasificacion general se basara unicamente en los puntos
KPI acumulados.

## 5. Funcionalidades historicas aplazadas

El Split 8 tambien utilizo o describio las siguientes capas, que **no**
se implementan en el nucleo del producto y quedan documentadas
unicamente para no perder contexto de cara a futuras entregas (ver
tambien `docs/ROADMAP.md`):

- **Facciones**, con una clasificacion de faccion basada en el promedio
  de los tres mejores renombres semanales de sus miembros.
- **Profesiones**, con bonus sobre pares de KPI concretos.
- **Localizaciones**, con bonus semanales.
- **Objetos permanentes** con efectos acumulables.
- **Creditos**, equivalentes a puntos KPI, con compras y saldo.
- **Renombre**, derivado de la posicion semanal de cada participante.
- **Ajustes de juego** de 25 puntos.
- **Ficha individual en PDF** y su envio por correo mediante Outlook.
- Integracion con **Power BI** (mas alla de ser origen manual de dos de
  las fuentes de datos).

## 6. Cuestiones pendientes de los Excel de entrada

Estas preguntas quedan explicitamente abiertas hasta que el usuario
aporte los Excel originales en `IMPORT-1`:

- Estructura exacta de columnas y encabezados de cada fuente
  (Productividad, Calidad, Llamadas, Articulos, Formaciones).
- Como se identifica a cada persona en esos ficheros (nombre, alias,
  identificador propio del origen) y como se cruza con `Person` o con
  `SplitParticipant`.
- Tratamiento de filas duplicadas, vacias, con ceros explicitos o con
  correcciones posteriores a la carga inicial.
- Si el usuario necesita una previsualizacion editable antes de guardar
  una carga, y que nivel de correccion manual se permite sobre ella.
- Como se distingue, en cada fuente, entre "sin dato todavia", "cero
  real" y "persona no incorporada esa semana".

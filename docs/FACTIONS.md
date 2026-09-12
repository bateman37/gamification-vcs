# Facciones y clasificacion de facciones (`0.7.0` / MVP-2A)

Primera capa de juego real anadida sobre el nucleo de resultados de
`0.6.0` / MVP-1C. Documenta el modelo, las reglas de puntuacion y
desempate, la instantanea publicada, la clasificacion semanal y acumulada,
la edicion administrativa y la privacidad de la vista de participante.
Consulta `docs/DATA_MODEL.md` para el esquema completo y
`docs/RESULTS_PUBLICATION.md` para el motor agregado y la publicacion de
una semana, que esta entrega amplia sin tocar sus formulas.

## 1. Concepto: Renombre = puntos por posicion, sin segunda formula

No existe una moneda, contador o calculo independiente llamado "renombre".
En esta entrega:

```text
Renombre individual de una semana = puntos por posicion obtenidos esa semana
```

Es literalmente `PublishedParticipantWeeklyResult.positionPoints`, ya
calculado y congelado por el motor agregado (`weekly-results.service.ts`)
a partir de `SplitPositionPointRule` (ver
`docs/POSITION_POINTS_CONFIGURATION.md`). "Renombre" es solo una etiqueta
de ambientacion usada en algunas pantallas de facciones, siempre aclarada
como equivalente a los puntos por posicion. No existe una segunda
configuracion, un saldo, un evento ni una copia editable de esos puntos.

## 2. Facciones opcionales por split

**Decision de alcance (ver `docs/DECISIONS.md`):** las facciones son una
capa opcional por split. Un split que nunca ha tenido ninguna faccion
creada se comporta exactamente igual que antes de `0.7.0` (activacion,
publicacion, resultados y clasificacion sin ningun requisito de facciones).
En cuanto un administrador crea la primera faccion de un split, ese split
queda "usando facciones" y a partir de ahi se exige el conjunto completo
de reglas descrito en este documento para poder activarlo y publicar sus
semanas.

## 3. Modelo de datos

`SplitFaction` (ver `docs/DATA_MODEL.md` para el detalle de columnas):

- Pertenece a un unico split (`splitId`, `onDelete: Cascade` desde `Split`).
- `name` / `nameNormalized` (minusculas, sin espacios exteriores): unico
  dentro del split, puede repetirse en otro split.
- `color`: hexadecimal `#RRGGBB`, validado en servicio y con una
  restriccion de base de datos (`SplitFaction_color_format_check`). Es
  solo una ayuda visual, no necesita ser unico.
- `SplitParticipant.factionId` es nullable (migracion segura de datos
  existentes) con `onDelete: Restrict` hacia `SplitFaction`: nunca se borra
  fisicamente una faccion mientras tenga participantes asignados.

## 4. Administracion de facciones

Seccion "Facciones" en el detalle del split (`/splits/[id]`):

- **`DRAFT` y `ACTIVE` antes de la primera publicacion:** crear, editar y
  eliminar facciones (eliminar solo si la faccion no tiene participantes
  asignados).
- **Desde la primera publicacion del split:** ya no se pueden crear ni
  eliminar facciones (cambiaria la estructura de la competicion), pero el
  nombre y el color siguen siendo editables mientras el split no este
  `CLOSED`. Cambiar nombre/color nunca recalcula ni reescribe una
  publicacion: la clasificacion acumulada agrupa siempre por el
  identificador estable de la faccion y muestra su nombre/color
  **actuales**; el detalle de una semana ya publicada usa el nombre/color
  **congelados** en esa semana.
- **`CLOSED`:** solo lectura.

Todas las validaciones viven en `src/server/services/faction.service.ts` y
se repiten en servidor, nunca solo mediante un boton deshabilitado.

## 5. Asignacion de participantes

- `Anadir participante` exige un selector `Faccion` obligatorio en cuanto
  el split ya tiene alguna faccion creada; si todavia no hay ninguna, el
  campo no aparece (comportamiento identico al anterior a `0.7.0`).
- `Editar participante` permite cambiar tambien la faccion.
- La faccion debe pertenecer siempre al mismo split: nunca se acepta desde
  el cliente una faccion de otro split (validado en servidor incluso
  cuando el split de destino todavia no tiene ninguna faccion propia).
- Si se reasigna la faccion de un participante despues de publicar
  semanas, el cambio solo afecta a publicaciones futuras: las semanas ya
  publicadas conservan su faccion original mediante la instantanea.

## 6. Activacion de un split con facciones

Cuando el split ya tiene alguna faccion creada, `activateSplit` exige
ademas de las reglas ya existentes (al menos un participante y un KPI
activo):

- al menos dos facciones;
- todos los participantes del split (no solo los aplicables a la semana 1)
  con una faccion asignada;
- cada faccion con al menos tres participantes aplicables desde la primera
  semana del split (de lo contrario nunca podria cumplir la regla
  obligatoria del top 3).

## 7. Regla semanal de puntuacion de facciones

Para cada semana publicada y cada faccion (`src/domain/faction-ranking.ts`,
`selectFactionTopThree`):

1. Toma sus participantes aplicables y ya clasificados individualmente
   (con `positionPoints` calculados por el motor agregado).
2. Ordena por `positionPoints` descendente (desempate solo por alias
   normalizado y despues id, sin conceder ninguna ventaja de negocio).
3. Selecciona exactamente los tres primeros.
4. La puntuacion semanal de la faccion es la **suma** de esos tres
   `positionPoints`. Nunca una media.

```text
Faccion A: 15 + 11 + 8 = 34 puntos
```

Una faccion con menos de tres participantes aplicables esa semana no
puede puntuar: si tiene uno o dos, bloquea la publicacion con un mensaje
que indica su nombre y cuantos faltan (nunca rellena con ceros). Una
faccion sin ningun participante aplicable esa semana simplemente no
compite.

## 8. Desempates entre facciones

`src/domain/faction-ranking.ts` (`rankFactions`, sobre el generico
`rankByComparator` de `src/domain/ranking.ts`):

1. mayor suma semanal;
2. si empatan, mayor puntuacion del mejor jugador, despues del segundo,
   despues del tercero (comparacion lexicografica del vector de
   aportaciones, ya ordenado de mayor a menor);
3. si las tres aportaciones coinciden, es un empate real: ranking de
   competicion (`1, 2, 2, 4`), igual que la clasificacion individual.

```text
Faccion A: 15 + 5 + 1 = 21
Faccion B: 11 + 8 + 2 = 21
Gana Faccion A: su mejor participante obtuvo 15 frente a 11.
```

El nombre o el color de la faccion nunca rompen un empate: solo
estabilizan el orden visual entre facciones con la misma posicion.

Para el acumulado, el mismo criterio se aplica sobre las aportaciones
acumuladas de los miembros que realmente puntuaron dentro de los trios
semanales (mayor contribuidor acumulado, despues el segundo, y asi
sucesivamente).

## 9. Instantanea publicada e inmutabilidad

`publishWeek` (`src/server/services/publish-week.service.ts`) congela, por
cada `PublishedParticipantWeeklyResult`, el identificador estable de la
faccion del participante en ese momento (`factionId`) junto con su nombre
y color (`factionNameSnapshot`, `factionColorSnapshot`). No se guarda
ningun "renombre" ni total de faccion independiente: la clasificacion de
facciones se calcula siempre al consultar
(`src/server/services/faction-classification.service.ts`) a partir de
estos snapshots y de `positionPoints`, agrupando en memoria con `Map`.

Antes de publicar, si el split usa facciones, se valida en servidor
(`buildFactionWeeklyPreview`, reutilizada por la previsualizacion y por la
publicacion):

- todos los participantes aplicables de esa semana tienen una faccion
  valida;
- cada faccion con participantes aplicables esa semana tiene al menos
  tres.

Si falta alguna condicion, la publicacion se rechaza con un mensaje claro;
la previsualizacion muestra los mismos problemas antes de pulsar
`Publicar semana`, junto con una previsualizacion compacta de la
clasificacion de facciones de esa semana.

## 10. Semanas publicadas antes de esta version

Las publicaciones anteriores a `0.7.0` no tienen snapshot de faccion
(`factionId: null`). No se recalculan ni se completan retroactivamente:
quedan excluidas de la clasificacion de facciones (que pasa a
`hasFactionData: false` si ninguna publicacion del split tiene snapshot),
sin afectar a la clasificacion individual existente. Un split, una vez
publicada su primera semana, usa facciones en todas sus publicaciones
futuras o en ninguna: no puede mezclar semanas con y sin facciones,
porque crear/eliminar facciones queda bloqueado desde esa primera
publicacion (seccion 4).

## 11. Clasificacion semanal y acumulada

- **Resumen en el detalle del split:** debajo de `Clasificacion general
  individual` (renombrada desde `Clasificacion general`), aparece
  `Clasificacion general facciones`: posicion acumulada, color y nombre,
  una columna `S1`, `S2`... por semana con clasificacion de faccion
  publicada, y total acumulado. Estado vacio explicito si todavia no hay
  ninguna publicacion con facciones.
- **Vista detallada** (`/splits/[id]/clasificacion-facciones`): filtro de
  semana (`Acumulado` por defecto). La vista de una semana concreta
  muestra posicion semanal, color/nombre **de esa semana**, los tres
  participantes que puntuaron con su Renombre/puntos por posicion, suma
  semanal, acumulado y posicion acumulada hasta esa semana. La vista
  acumulada muestra posicion, color/nombre **actuales**, puntuacion por
  semana publicada y total acumulado; nunca muestra una "media resultante".

## 12. Visibilidad para participantes

Dentro de `/resultados > Por split`:

- se muestra la faccion actual de la persona (nombre y color);
- una `Clasificacion general de facciones` de solo lectura, con la propia
  faccion destacada (equivalente a `(tu)` en la clasificacion individual);
- un enlace por semana permite consultar que tres alias aportaron puntos y
  cuantos puntos por posicion aporto cada uno.

Privacidad: esta vista solo expone alias, nombre de faccion, posicion y
puntos por posicion -- nunca nombres reales, niveles ni KPI individuales de
otras personas (los mismos datos que ya usa la clasificacion individual
limitada). El servidor resuelve siempre la identidad desde la sesion; un
participante no puede cambiar `personId` ni `splitId` para ver resultados
privados ajenos.

## 13. Autorizacion

- Crear, editar, eliminar o asignar facciones: solo `ADMIN`.
- Pagina detallada administrativa de facciones: solo `ADMIN`.
- Vista de facciones en `/resultados`: `ADMIN` para la persona
  seleccionada, o `PARTICIPANT` unicamente para si mismo.
- Todas las comprobaciones se repiten en servidor.

## 14. Fuera de alcance de `0.7.0`

Profesiones, localizaciones, objetos, economia de creditos, misiones y
cualquier otra capa de juego adicional (ver `docs/ROADMAP.md`).

## 15. Reutilizacion en "Presentar resultados" (`1.0.1`)

`buildSplitResultsPresentation` (ver
`docs/UX_AND_RESULTS_PRESENTATION_1_0_1.md`) llama directamente a
`computeFactionClassification` para las fases de clasificacion semanal y
general de facciones: no reimplementa la regla del top-3 ni el desempate.
Un split sin facciones, o sin ninguna publicacion con snapshot de faccion
(`hasFactionData: false`), omite limpiamente esas dos fases de la
presentacion, sin inventar datos ni mostrar un error.

# Profesiones, bonus de KPI y fichas privadas (`0.8.0` / MVP-2B)

Segunda capa de juego sobre el nucleo de resultados de `0.6.0` / MVP-1C y
las facciones de `0.7.0` / MVP-2A. Documenta el modelo de profesiones
configurables por split, la regla exacta del bonus del `+20 %`, el bloqueo
desde la primera publicacion, la instantanea publicada, la nueva seccion
privada de `Fichas` (alias, profesion y avatar por split) y la correccion
del rotulo semanal del historico general.

Consulta `docs/DATA_MODEL.md` para el esquema completo,
`docs/RESULTS_PUBLICATION.md` para el motor agregado y la publicacion de
una semana (que esta entrega amplia sin tocar ninguna formula de KPI) y
`docs/AUTHENTICATION.md` para la matriz de permisos.

> **Nota historica.** `docs/DISCOVERY-1-SPLIT-8.md` describe profesiones y
> arquetipos concretos del antiguo Split 8 (Mecanico, Arreglador,
> Mercenario, Cientifico, Piloto...) con reglas especiales propias. **Esas
> reglas no se implementan.** Esta entrega usa exclusivamente el modelo
> simplificado y configurable descrito aqui: nombre libre, dos KPI
> cualesquiera del catalogo cerrado y un unico bonus fijo del `20 %`.

## 1. Profesiones opcionales por split

Las profesiones son una capa **opcional por split**, igual que las
facciones:

- si el administrador no crea ninguna profesion, el split se comporta
  exactamente como en `0.7.0`: no se exige nada para activarlo ni para
  publicarlo, no aparece ningun selector vacio y no se aplica ningun bonus;
- en cuanto existe **al menos una** profesion, ese split "usa profesiones" y
  se le aplican todas las reglas de este documento.

No existe ningun catalogo global de profesiones, ni seeds, ni profesiones
predeterminadas: cada administrador decide que profesiones existen en cada
split.

## 2. Modelo de profesion

`SplitProfession` (ver `docs/DATA_MODEL.md` para el detalle de columnas):

- pertenece a un unico split (`splitId`, `onDelete: Cascade` desde `Split`);
- `name` / `nameNormalized` (minusculas, sin espacios exteriores): unico
  dentro del split, puede repetirse en otro split;
- `kpiCodeA` y `kpiCodeB`: exactamente dos KPI **distintos** del catalogo
  cerrado (restriccion de base de datos `SplitProfession_distinct_kpis_check`);
- `availableN0` / `availableN1` / `availableN2`: al menos uno debe ser
  `true` (restriccion `SplitProfession_at_least_one_level_check`);
- el porcentaje del bonus **no se guarda**: es una constante unica y tipada
  del dominio (`PROFESSION_BONUS_PERCENT`, `src/domain/profession-bonus.ts`),
  siempre `20`. El administrador no lo introduce ni lo modifica.

Nunca se guardan formulas, JavaScript, expresiones ni JSON libre enviado
por el navegador: solo un nombre, dos codigos del enum `KpiCode` y tres
booleanos.

No hace falta que los dos KPI esten activos al crear la profesion. Si uno
esta inactivo, sencillamente no produce resultado ni bonus mientras siga
inactivo.

## 3. Administracion dentro del split

Seccion `Profesiones del split` en el detalle del split (`/splits/[id]`),
con su entrada `Profesiones` en el indice lateral. El formulario pide
nombre, niveles disponibles (`N0`/`N1`/`N2`) y los dos KPI afectados, y
muestra siempre de forma explicita el texto fijo
`+20 % después del máximo base`. Cada profesion se resume asi:

```text
Mecánico
Disponible para: N0, N1
Potencia: Cazador de soluciones + Explorador de datos
Bonus: +20 % después del máximo base
```

(`Mecánico` es solo un ejemplo del encargo: no se crea automaticamente.)

Reglas de edicion, comprobadas siempre en el servicio
(`src/server/services/profession.service.ts`), nunca solo deshabilitando el
formulario:

- **`DRAFT` y `ACTIVE` sin publicaciones:** crear, editar y eliminar.
- **Desde la primera `WeekPublication` del split:** no se puede crear,
  editar ni eliminar ninguna profesion. Si el split publico su primera
  semana sin ninguna profesion creada, continuara sin profesiones durante
  todo su ciclo: tampoco podran anadirse despues.
- **`CLOSED`:** solo lectura.
- No se elimina una profesion con participantes asignados: el administrador
  debe retirar o cambiar primero esas asignaciones (siempre antes de la
  primera publicacion).
- Una edicion de niveles que dejase invalida la profesion de algun
  participante se **rechaza** indicando exactamente a quien afectaria. Las
  asignaciones nunca se limpian en silencio.

## 4. Relacion entre participante y profesion

La profesion pertenece a `SplitParticipant`, no a `Person`: una misma
persona puede tener profesiones distintas en splits distintos.
`SplitParticipant.professionId` es una relacion **opcional** y de
cardinalidad uno (nunca muchos-a-muchos), con `onDelete: Restrict`:

- `null` mientras el split no usa profesiones, o mientras la persona
  todavia no ha elegido antes de la primera publicacion;
- como maximo una profesion por participacion;
- la profesion debe pertenecer al mismo split;
- debe estar disponible para el nivel tecnico actual del participante.

## 5. Asignacion desde administracion

**Al anadir un participante:**

- si el split no tiene profesiones, no se muestra ningun selector;
- si existe alguna, aparece `Profesión (opcional hasta publicar)`, filtrada
  por el nivel `N0`/`N1`/`N2` seleccionado en el propio formulario;
- funciona tanto al anadir una persona existente como al crear una persona
  nueva dentro del split;
- la profesion se guarda en `SplitParticipant`: no existe ningun campo de
  profesion en la pantalla global `/personas`, donde no hay contexto de
  split;
- el administrador puede dejarla vacia antes de la primera publicacion para
  que la elija despues el propio participante desde su ficha.

**En la tabla de participantes:** columna `Profesión` con el nombre y el
resumen corto de sus dos KPI; badge `Sin elegir` cuando el split usa
profesiones y todavia falta; texto neutro (`—`) cuando el split no usa
profesiones. Antes de publicar, la edicion de un participante permite
escoger o cambiar la profesion entre las compatibles con su nivel.

**Cambios de nivel:** antes de publicar, el administrador debe escoger una
profesion compatible o dejarla vacia. Despues de la primera publicacion la
profesion no se puede cambiar, y un cambio de nivel incompatible con la
profesion congelada se **rechaza** con un mensaje claro: nunca se elimina
ni se cambia la profesion automaticamente.

**Altas posteriores a la primera publicacion:** si el split ya usa
profesiones y tiene una publicacion, el alta de un participante con semana
inicial futura **exige** una profesion compatible en el propio formulario
(no puede quedar vacia, porque tanto el catalogo como las profesiones ya
estan bloqueados). Esa profesion queda inmutable desde el alta y su primer
resultado futuro la congelara en la publicacion.

## 6. Eleccion obligatoria antes de publicar

Cuando el split tiene una o mas profesiones, antes de publicar cualquier
semana se exige que:

- todos los participantes aplicables tengan exactamente una profesion;
- cada profesion pertenezca al split;
- cada profesion este disponible para el nivel del participante;
- los dos KPI configurados sigan siendo distintos.

Si falta alguna condicion, la previsualizacion incluye un `blockingIssue`
con el alias afectado y la publicacion queda bloqueada
(`collectProfessionAssignmentIssues`, consumida por
`weekly-results.service.ts`). Un split con **cero** profesiones no tiene
ningun requisito nuevo ni recibe ningun bonus.

## 7. Bloqueo desde la primera publicacion

La primera `WeekPublication` del split es el punto de cierre:

- las definiciones de profesiones quedan bloqueadas;
- las asignaciones existentes quedan bloqueadas (ni el administrador desde
  la tabla, ni el participante desde su ficha, pueden cambiarlas, ni
  volver a dejarlas vacias);
- no existe ninguna accion de desbloquear, reiniciar o reabrir.

El bloqueo se comprueba en los servicios de servidor, reutilizando el mismo
concepto de "primera publicacion" ya usado por facciones y por la
configuracion de KPI. Enviar un `professionId` manipulado directamente a
una Server Action no lo evita.

**El alias y el avatar no forman parte de este bloqueo:** se pueden seguir
editando mientras el split este `DRAFT` o `ACTIVE`, incluso despues de la
primera publicacion. En `CLOSED` pasan a solo lectura. Las publicaciones
anteriores conservan sus instantaneas y nunca se reescriben.

## 8. Regla del bonus: orden exacto del calculo

Para un resultado `COMPUTED`:

```text
1. Calcular rawPoints con la formula existente del KPI.
2. Aplicar el maximo base existente.
3. Obtener los puntos base finales del KPI (baseFinalPoints).
4. Aplicar el +20 % de profesion, si corresponde.
5. Obtener finalPoints definitivo.
6. Sumar el resultado definitivo al total semanal.
7. Calcular rankings, puntos por posicion y facciones.
```

```text
baseFinalPoints      = resultado despues del maximo base
professionBonusPoints = baseFinalPoints x 0,20
finalPoints          = baseFinalPoints + professionBonusPoints
```

| Resultado antes del maximo | Maximo base | Tras maximo | Bonus | Resultado final |
|---:|---:|---:|---:|---:|
| 50 | 70 | 50 | 10 | 60 |
| 80 | 70 | 70 | 14 | 84 |
| 0 | 70 | 0 | 0 | 0 |
| -10 | 70 | -10 | 0 | -10 |

El bonus **puede** hacer que el resultado supere el maximo base hasta un
20 % adicional: el maximo **no** se vuelve a aplicar despues de sumarlo.

### 8.1 Cuando se aplica

Solo cuando se cumplen **todas** estas condiciones:

- el split tiene profesiones;
- el participante tiene una profesion valida;
- el codigo del KPI coincide con uno de los dos de su profesion;
- ese KPI esta activo (si no lo esta, no produce resultado);
- el KPI aplica a su nivel segun la configuracion existente;
- el resultado tiene estado `COMPUTED`;
- los puntos despues del maximo base son **estrictamente positivos**.

No se aplica bonus a `VAC`/`AVISO` (que sigue mostrando y aportando `0`),
a `NOT_APPLICABLE`, a resultados iguales a `0`, a resultados negativos (un
bonus nunca debe empeorar una puntuacion negativa), a KPI no incluidos en
la profesion ni a KPI inactivos.

No cambia ningun dato bruto, ningun parametro de KPI ni ningun
multiplicador `N0`/`N1`/`N2`: la profesion es una capa estrictamente
posterior al maximo.

### 8.2 Precision y maximo aplicable

- Todo el calculo usa `Prisma.Decimal`; no hay redondeo antes de calcular
  el bonus, sumar el total ni decidir rankings y empates. El unico redondeo
  es el de la escala de los campos `Decimal` al persistir.
- `baseMax` sigue siendo el maximo base original.
- `applicableMaxPoints` sigue sumando **maximos base**, nunca maximos
  inflados por profesion. Por eso el porcentaje visual puede superar el
  `100 %`: es un resultado valido y es justamente lo que permite ver que la
  profesion ha superado el maximo. Los umbrales del mapa de calor no
  cambian (la banda superior ya cubre "90 % o mas").

### 8.3 Efecto sobre rankings y facciones

El `finalPoints` posterior a profesion es el valor usado por el total KPI
semanal, el ranking por KPI, el ranking individual semanal, la asignacion
de puntos por posicion, la clasificacion acumulada y los historicos. Las
facciones se ven afectadas solo **indirectamente**: siguen sumando los
puntos por posicion de sus tres mejores participantes. No se concede ningun
`+20 %` directo a una faccion, no se multiplican puntos por posicion y el
bonus no se aplica dos veces al recalcular la publicacion.

### 8.4 Una unica funcion de dominio

`applyProfessionBonus` (`src/domain/profession-bonus.ts`) es la unica
funcion que decide y calcula el bonus. Recibe los puntos tras el maximo, el
codigo del KPI, la profesion aplicable (o `null`) y el nivel del
participante, y devuelve puntos antes de profesion, puntos de bonus, puntos
finales, si se aplico y la identificacion de la profesion para poder
mostrarlo. No hay ninguna condicion `x 1.2` repartida entre los diez
resolvers: siguen calculando su resultado base exactamente como antes.

## 9. Instantanea publicada e inmutabilidad

`publishWeek` recalcula todo desde base de datos (nunca confia en puntos,
profesion o bonus enviados por el navegador), valida las profesiones cuando
el split las usa, aplica el bonus una sola vez, calcula rankings y
facciones con el resultado definitivo y escribe todos los snapshots en la
misma transaccion serializable ya existente, conservando la idempotencia
frente a carreras concurrentes.

`PublishedParticipantWeeklyResult` congela:

- `professionId` (identificador estable), `professionNameSnapshot`,
  `professionKpiCodeA`, `professionKpiCodeB`, `professionBonusPercent` (`20`);
- `splitUsedProfessions` (`Boolean`, por defecto `false`), que distingue
  "el split no usaba profesiones" de "publicacion anterior a `0.8.0`".

`PublishedKpiResult` congela, ademas de `rawPoints` y `finalPoints` ya
existentes:

- `basePointsBeforeProfession`: puntos tras el maximo y antes de profesion;
- `professionBonusPoints`: puntos anadidos por la profesion;
- `professionApplied`: si el bonus se aplico realmente a ese KPI;
- `professionNameSnapshot`: nombre de la profesion que lo produjo.

`finalPoints` sigue siendo el valor definitivo: desde `0.8.0` incluye el
bonus; en publicaciones anteriores coincide con los puntos tras el maximo,
porque entonces no existia ningun bonus.

Una vez publicada la primera semana: modificar una Server Action, el
formulario o enviar ids manuales no permite cambiar una profesion; cambiar
despues el alias o el avatar no modifica nombre, profesion ni bonus
guardados en publicaciones anteriores; y las vistas historicas leen
**siempre** los snapshots, nunca la definicion actual de la profesion.

## 10. Compatibilidad con publicaciones anteriores

Los campos nuevos son `nullable` (o tienen un valor predeterminado seguro),
asi que las filas publicadas antes de `0.8.0` conservan `null`/`false` y se
siguen leyendo sin errores. **Ninguna publicacion se recalcula
retroactivamente** y la migracion no inventa profesiones ni bonuses. Una
semana publicada en `0.7.0` aparece sin profesion y sin bonus, exactamente
igual que antes, sin datos inventados: en la vista individual y en la
previsualizacion administrativa la columna `Profesión` ni siquiera se
muestra si ninguna publicacion de ese split usaba profesiones.

## 11. Presentacion del bonus

- **Tabla administrativa de participantes:** columna `Profesión` junto a
  persona, alias, nivel y faccion (seccion 5); bloqueada y no editable
  despues de publicar.
- **Previsualizacion de una semana:** columna `Profesión` por participante
  y celdas KPI afectadas identificadas con borde discontinuo **y** badge
  `+20 % profesion` (el resaltado nunca depende solo del color), con el
  desglose completo en el `title` accesible y en texto solo para lectores
  de pantalla:

  ```text
  Resultado tras máximo: 70
  Bonus Mecánico (+20 %): +14
  Resultado final: 84
  ```

  `AVISO`, `No aplica`, topes y estados existentes se conservan intactos.
- **Resultados publicados e individuales (`/resultados > Por split`):** se
  muestra la profesion **congelada** de cada semana y se identifican los
  KPI en los que realmente se aplico el bonus, con puntos antes de
  profesion, bonus y total final. Nunca se consulta la profesion actual
  para explicar una semana historica.
- **Historico general:** sigue sumando `finalPoints`, que desde esta
  entrega ya incluye el bonus. En cada celda por KPI, ademas del valor
  principal (suma final) y de la media, se anade `+N por profesion` cuando
  el periodo tuvo bonus; el total del periodo muestra
  `Bonus profesion: N`. Para periodos agregados se suman exclusivamente los
  `professionBonusPoints` **publicados**: nunca se recalcula el bonus con
  la profesion actual. Las columnas por KPI, el scroll interno y el diseno
  de `0.7.0` no cambian.

## 12. Fichas privadas (`/fichas`)

Nueva opcion `Fichas` junto a `Resultados` en la navegacion superior para
las cuentas `PARTICIPANT` (y tambien para un `ADMIN` vinculado a una
persona, que entonces tiene fichas propias).

La pagina resuelve **siempre** la `Person` desde `session.user.personId`:
no acepta ningun `personId` del navegador para decidir que fichas puede ver
o editar. Si la cuenta no esta vinculada a una persona, muestra el mismo
tipo de estado controlado que `/resultados`. `/fichas` **no** es un segundo
panel administrativo: el administrador sigue configurando profesiones y
participantes desde cada split.

### 12.1 Una ficha por participacion de split

Porque alias, faccion, nivel, profesion y avatar pertenecen al contexto de
ese split. Orden: splits `ACTIVE`, despues `DRAFT`, despues `CLOSED`, y
dentro de cada grupo los mas recientes primero.

Cada ficha muestra el avatar, el nombre y el estado del split, el alias, el
nivel tecnico (solo lectura), la faccion (solo lectura, con nombre y
color), la profesion actual con sus dos KPI y el texto
`+20 % después del máximo base`, si la profesion sigue siendo editable o ya
esta bloqueada, y un enlace a los resultados de ese split cuando tenga
publicaciones. En un split `CLOSED`, toda la ficha es de solo lectura.

### 12.2 Alias

El participante puede cambiar su propio alias mientras el split no este
`CLOSED`, reutilizando la misma normalizacion y la misma unicidad por split
ya existentes. La operacion es de autoservicio y de intencion minima
(`updateOwnAlias`): comprueba que `splitParticipant.personId ===
session.user.personId`, no acepta ningun `personId` del formulario y no
permite modificar nombre real, correo, nivel, faccion, semana inicial ni
ninguna otra persona. Un cambio de alias no reescribe instantaneas
anteriores; las publicaciones futuras congelan el nuevo alias.

### 12.3 Profesion desde la ficha

Antes de la primera publicacion, si el split tiene profesiones, el
participante puede seleccionar una entre las disponibles para su nivel,
cambiarla o dejarla sin elegir. Cada opcion muestra nombre, los dos KPI y
el bonus, y al seleccionarla la ficha muestra inmediatamente el resumen
completo. El servidor valida propiedad de la ficha, split, nivel y
pertenencia de la profesion.

Despues de la primera publicacion el selector se sustituye por informacion
de solo lectura con el mensaje
`Profesión bloqueada desde la publicación de la primera semana`, y
cualquier intento directo de cambiarla se rechaza en servidor. Si el split
no tiene profesiones, la ficha indica de forma discreta
`Este split no utiliza profesiones.`.

## 13. Avatar por split

El avatar pertenece tambien a `SplitParticipant`, no a `Person`: una misma
persona puede usar imagenes distintas en splits distintos. El participante
puede subir, previsualizar, reemplazar y eliminar su imagen, y ve un
placeholder con sus iniciales cuando no tiene ninguna. Alias y avatar son
editables mientras el split este `DRAFT` o `ACTIVE`, incluso despues de la
primera publicacion; en `CLOSED` quedan en solo lectura.

### 13.1 Almacenamiento

`SplitParticipantAvatar` es una entidad **uno-a-uno separada** en
PostgreSQL (`splitParticipantId` como clave primaria, `onDelete: Cascade`
desde `SplitParticipant`), precisamente para no cargar los bytes en las
consultas normales de participantes, fichas o resultados. Guarda la imagen
ya procesada (`imageData`), su MIME final, su tamano y un `sha256` usado
como version estable de cache. El avatar **no** se guarda en `public/`, ni
en una ruta local del servidor, ni como base64 dentro de una columna de
texto: sobrevive al reinicio de la aplicacion y no depende de disco
efimero. No se usa ningun servicio externo de imagenes.

### 13.2 Validacion y procesamiento seguro

`src/server/services/avatar-image.ts` (con `sharp`, dependencia directa
fijada):

- entrada aceptada: **JPEG, PNG y WebP**, comprobados decodificando el
  **contenido real**, nunca por la extension ni por el `File.type`
  declarado. SVG, GIF, HTML y cualquier otro formato se rechazan;
- tamano maximo de entrada: `5 MB`;
- se corrige la orientacion EXIF y no se conserva ningun metadato del
  original;
- se redimensiona conservando la proporcion para que ningun lado supere
  `512 px`, sin ampliar imagenes mas pequenas;
- la salida es siempre WebP, razonablemente comprimida, con un limite
  propio del tamano almacenado (`1 MB`);
- un archivo corrupto o no decodificable se rechaza con un mensaje
  comprensible en castellano.

Toda mutacion (subir, reemplazar, eliminar) verifica sesion valida,
propiedad de la ficha mediante `session.user.personId`, split no `CLOSED` y
limite/formato. La gestion administrativa de avatares queda fuera de
alcance.

### 13.3 Servir la imagen

`GET /api/fichas/[splitParticipantId]/avatar` devuelve la imagen con su
MIME final real, `X-Content-Type-Options: nosniff`, cache **privada** y
`ETag` basado en el hash. Un `PARTICIPANT` solo puede leer la ficha
vinculada a su propio `personId`; un `ADMIN` puede leer cualquiera. Un
intento de leer una ficha ajena devuelve `404`, igual que una ficha
inexistente: no se revela si existe. No se expone ninguna ruta del sistema
de archivos, y el texto alternativo se construye a partir del alias.

## 14. Autorizacion y separacion de operaciones

Solo `ADMIN` puede crear, editar o eliminar profesiones, asignar profesion
al anadir participantes, gestionarla desde la tabla administrativa y ver
nombres reales y resultados administrativos. Una cuenta `PARTICIPANT` solo
puede ver sus propias fichas, editar su alias por split, escoger su propia
profesion mientras este permitido, subir/reemplazar/eliminar su propio
avatar y consultar sus propios resultados.

Para evitar una unica accion generica con demasiados permisos, cada
intencion tiene su propia operacion: administrar la definicion de una
profesion, asignar profesion como administrador, cambiar el alias propio,
escoger la profesion propia y guardar/eliminar el avatar propio. Asi un
formulario de participante no puede aprovechar una accion administrativa
para cambiar nivel, faccion, persona o semana inicial. Las acciones
administrativas de participante y de profesion vuelven a exigir
`requireAdminSession()` dentro de la propia Server Action, porque una
Server Action es una ruta invocable directamente.

## 15. Rendimiento

- Los bytes de avatar no se cargan nunca en listados de participantes,
  fichas ni resultados: `readAvatarForViewer` es la unica funcion que
  selecciona `imageData`, y solo se invoca al servir la imagen.
- La profesion se carga junto al participante cuando el calculo semanal la
  necesita (`listApplicableParticipantsWithProfessionForWeek`), evitando
  N+1.
- El bonus se calcula con una funcion pura en memoria, sin una consulta por
  KPI, y no existe ningun total mutable ni cache de puntos de profesion.

## 16. Correccion del rotulo semanal del historico general

Con agrupacion `Semana`, el historico general identificaba el periodo como
`Semana 1 (2026)`, `Semana 2 (2026)`... Desde `0.8.0` muestra la **fecha
del primer dia de esa semana**:

```text
07/09/2026
14/09/2026
```

- se usa `SplitWeek.startDate` de la publicacion;
- se formatea con el helper UTC de fechas (`formatCalendarDateEs`,
  `src/lib/dates.ts`) para evitar desplazamientos de un dia;
- la clave interna sigue incluyendo el split y el numero de semana, para no
  fusionar por accidente dos semanas de splits distintos que empiecen el
  mismo dia;
- si el filtro incluye varios splits, se muestra el nombre del split como
  texto secundario para distinguir fechas iguales;
- el orden es cronologico descendente por la fecha real, no alfabetico por
  la etiqueta;
- las agrupaciones `Mes` y `Año` no cambian.

## 17. Fuera de alcance de `0.8.0`

Catalogo global o profesiones predeterminadas; porcentajes configurables
distintos del 20 %; mas o menos de dos KPI por profesion; las reglas
historicas especiales de Mecanico, Arreglador, Mercenario, Cientifico o
Piloto; reduccion especial de valoraciones negativas; sustitucion de bases,
multiplicadores o maximos del KPI; bonus directo para toda una faccion;
profesiones multiples por participante; cambios de profesion despues de la
primera publicacion; localizaciones; objetos; creditos o economia;
misiones; cartas, hechizos o consumibles; generacion de fichas PDF; envio
de correo; integracion con Power BI; y avatares generados por IA o editor
de imagenes.

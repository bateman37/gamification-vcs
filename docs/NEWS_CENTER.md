# Centro de noticias (`1.0.0` / MVP-3)

Bandeja privada por usuario con noticias generadas por eventos reales de la
aplicacion (facciones, profesiones, localizaciones, mercado, compras,
publicaciones, alta y activacion de participantes/splits) y con envio
manual segmentado desde administracion. No es un chat, ni una red social,
ni una notificacion de navegador, ni correo: es texto plano, persistente,
privado por destinatario y consultable historicamente.

## 1. Dos conceptos separados: `NewsItem` y `NewsDelivery`

`prisma/schema.prisma`, migracion
`prisma/migrations/20260912143314_add_news_center`:

- **`NewsItem`**: el contenido, congelado en el momento de crearse.
  `splitId`/`splitNameSnapshot` opcionales (una noticia de administracion
  puede no pertenecer a ningun split); `origin` (`AUTOMATIC`/`MANUAL`);
  `category` (catalogo cerrado: `SPLIT`, `PROFILE`, `RESULTS`, `FACTION`,
  `PROFESSION`, `LOCATION`, `MARKET`, `PURCHASE`, `ANNOUNCEMENT`, `ADMIN`);
  `priority` (`NORMAL`/`IMPORTANT`); `title`/`body` en texto plano;
  `eventKey` opcional y unico (idempotencia de noticias automaticas);
  `createdByUserId` y `manualAudienceSnapshot` solo para envio manual.
  Restriccion de base de datos: `title`/`body` nunca vacios tras recortar
  espacios, con un tope generoso (200/2000 caracteres) como red de
  seguridad; el limite estricto del envio manual (120/600) se aplica en
  `src/server/validation/news-manual.ts`.
- **`NewsDelivery`**: la entrega privada a un unico destinatario. Exacto
  uno entre `recipientPersonId` (noticias de jugador, para que lleguen
  aunque la cuenta todavia no exista) y `recipientUserId` (noticias de
  administracion), forzado por la restriccion SQL
  `NewsDelivery_recipient_exclusive_check`. Solo `readAt`/`archivedAt`
  cambian despues de crearse. `actionPath` se construye siempre en
  servidor (`src/domain/news-links.ts`) y la restriccion
  `NewsDelivery_actionPath_internal_check` obliga a que empiece por `/`.
  Entrega unica por noticia y persona, y por noticia y usuario
  (`@@unique([newsItemId, recipientPersonId])` /
  `@@unique([newsItemId, recipientUserId])`).

Ninguna de las dos tablas usa borrado fisico desde la interfaz. No existe
"despublicar" ni editar una noticia ya enviada.

## 2. Persona frente a User

Las noticias de jugador se entregan siempre a `Person`
(`recipientPersonId`), nunca solo a `User`: como una `Person` puede existir
sin cuenta todavia (ver `docs/AUTHENTICATION.md`), la entrega queda
preparada y visible en cuanto la cuenta se crea y se vincula. Las noticias
de administracion se entregan a `User` (`recipientUserId`): un
administrador vinculado a una persona ve, en la misma bandeja, sus avisos
directos de administracion **y** sus propias noticias de jugador, sin que
ninguna se duplique (son dos filas de `NewsDelivery` distintas) y sin
acceder nunca a las bandejas privadas de otros jugadores.

## 3. Categorias, origen y prioridad

Categoria cerrada (icono + etiqueta en
`src/domain/news-category-display.ts`), puramente descriptiva: no
condiciona destinatarios ni permisos. Origen `AUTOMATIC` (generado por un
servicio de negocio) o `MANUAL` (redactado por un administrador).
Prioridad `NORMAL`/`IMPORTANT`: una noticia importante se distingue con un
badge ambar, nunca con apariencia de error.

## 4. Matriz de eventos automaticos

### Jugador (entregas a `Person`)

| Evento | Disparador | Categoria | Destino |
|---|---|---|---|
| Participante añadido | `addParticipant` (`participant.service.ts`) | `PROFILE` | Ficha |
| Split activado | `activateSplit` (`split.service.ts`) | `SPLIT` | Ficha |
| Facción reasignada | `updateParticipant`, solo si cambia realmente y el split está `ACTIVE` | `FACTION` | Ficha |
| Facción renombrada | `updateFaction`, solo si el nombre cambia y el split está `ACTIVE` | `FACTION` | Ficha (a los miembros actuales) |
| Profesión elegida/cambiada | `updateParticipant`, solo con split `ACTIVE` | `PROFESSION` | Ficha |
| Localización creada/actualizada/eliminada | `upsertWeekLocation`/`deleteWeekLocation` (`location.service.ts`), solo con split `ACTIVE` | `LOCATION` | Ficha |
| Mercado abierto/cerrado | `openMarket`/`closeMarket` (`economy.service.ts`) | `MARKET` | Ficha `#mercado` |
| Compra completada | `purchaseStoreItem` (`purchase.service.ts`) | `PURCHASE` | Ficha `#mercado` |
| Semana publicada | `publishWeek` (`publish-week.service.ts`) | `RESULTS` | Resultados |

### Administración (entregas a `User`)

| Evento | Disparador | Destino |
|---|---|---|
| Split creado | `createSplitWithWeeks` | Detalle del split |
| Split activado | `activateSplit` | Detalle del split (`#participantes`) |
| Fichas incompletas | `activateSplit`, solo si hay alguna | Detalle del split (`#participantes`) |
| Semana lista para revisar | tras cada carga Excel o entrada manual, tras confirmar que todos los KPI activos ya están cargados (`notifyIfWeekReadyToReview`, `news-week-ready.service.ts`) | Resultados administrativos de la semana |
| Semana publicada | `publishWeek` | Resultados administrativos de la semana |
| Próxima localización pendiente | `publishWeek`, solo si la semana siguiente sigue editable y sin localización | Configurar localización de esa semana |
| Mercado abierto/cerrado | `openMarket`/`closeMarket` | Economía y mercado del split |

Todas comparten un mismo servicio nuclear
(`src/server/services/news.service.ts`,
`createNewsWithDeliveries`/`resolveAllParticipantsForSplit`/
`resolveFactionMembers`/`resolveActiveAdminUserIds`) y plantillas de texto
puras (`src/domain/news-templates.ts`): no hay un motor generico de
eventos, cada evento tiene su propia funcion explicita en el servicio de
negocio que ya realiza esa operacion.

## 5. Agrupacion contra el ruido

- Publicar genera **un unico** resumen semanal por persona (posicion,
  puntos KPI, puntos por posicion, creditos y faccion en una sola
  noticia), nunca tres separadas.
- Abrir el mercado informa del numero de objetos disponibles, no crea una
  noticia por objeto.
- Equipar/desequipar, editar alias o avatar no crean noticias
  persistentes.
- Cargar un KPI (Excel o manual) no genera noticias de jugador.
- Solo `Participante añadido` y la propia activacion generan noticias
  mientras el split esta en `DRAFT`; el resto de cambios de facciones,
  profesiones y localizaciones solo notifican durante `ACTIVE`.
- Un cambio identico (`OPEN -> OPEN`, la misma faccion, el mismo `upsert`
  de localizacion sin datos distintos) nunca genera noticia.

## 6. Atomicidad e idempotencia

La noticia se escribe **dentro de la misma transaccion** que confirma el
hecho de negocio cuando ese hecho ya abre una transaccion (compra,
publicacion semanal, apertura/cierre de mercado, alta de participante,
activacion de split, renombrado de faccion, reasignacion de
faccion/profesion, creacion/edicion/eliminacion de localizacion): si la
noticia fallara, toda la operacion se revierte.

`eventKey` es la clave de idempotencia:

- Eventos no repetibles: identificador estable
  (`participant-added:<splitParticipantId>`,
  `split-activated:<splitId>:<splitParticipantId>`,
  `purchase:<purchaseId>`, `week-published:<publicationId>:<personId>`,
  `week-ready:<splitWeekId>`, `next-location-missing:<publicationId>:<nextWeekId>`).
- Eventos repetibles (facciones, profesiones, localizaciones, mercado): un
  UUID de operacion (`randomUUID()`) generado una sola vez antes de
  entrar a la transaccion, nunca `updatedAt`.
- `createNewsWithDeliveries` comprueba primero si ya existe una noticia
  con ese `eventKey`; si la creacion choca con la restriccion unica por
  una carrera concurrente, vuelve a comprobar y devuelve la noticia
  existente (`created: false`) en vez de lanzar un error o duplicar.

El envio manual usa el mismo mecanismo: `idempotencyKey` se genera una
vez al renderizar el formulario (campo oculto) y un doble envio con la
misma clave no duplica el mensaje.

## 7. Bandeja, campana, lectura y archivado

`src/server/services/news-inbox.service.ts`:

- **Contador** (`countUnreadNews`): entregas no archivadas y no leidas del
  destinatario. Muestra `99+` en la campana cuando supera 99.
- **Vista previa** (`previewRecentNews`): las cinco entregas no archivadas
  mas recientes.
- **Bandeja `/noticias`** (`listNewsDeliveries`): paginacion por cursor de
  20, pestañas `Todas`/`No leídas`/`Archivadas`, filtro opcional por split
  (solo si el destinatario tiene noticias de mas de uno) y por categoria.
- **Mutaciones** (`markNewsRead`/`markNewsUnread`/`archiveNews`/
  `restoreNews`/`markAllNewsRead`): siempre acotadas por la identidad de
  la sesion (`recipientUserId = session.user.id OR recipientPersonId =
  session.user.personId`); una entrega ajena simplemente no cambia, sin
  revelar si existe. Archivar marca tambien como leida si no lo estaba;
  restaurar nunca vuelve a marcarla como no leida.

La campana (`src/components/NewsBell.tsx`) y la bandeja no hacen polling:
los datos se calculan en servidor y se refrescan al navegar o tras una
accion propia (`revalidatePath`).

## 8. Enlaces internos seguros

`src/domain/news-links.ts` es el unico lugar que construye `actionPath`.
El administrador nunca escribe una URL: el formulario de envio manual
ofrece un conjunto cerrado (`MANUAL_NEWS_DESTINATIONS`: sin enlace,
Resultados, Ficha, Mercado); los eventos automaticos pueden usar ademas
destinos exclusivamente administrativos (`SPLIT_ADMIN`,
`WEEK_RESULTS_ADMIN`, `WEEK_LOCATION_ADMIN`, `SPLIT_ECONOMY_ADMIN`), que
lanzan `InvalidNewsLinkError` si se intentan construir para un
destinatario de jugador. Toda ruta generada empieza por `/`
(reforzado tambien por la restriccion de base de datos
`NewsDelivery_actionPath_internal_check`). El texto se renderiza siempre
como texto plano escapado: no hay Markdown ni `dangerouslySetInnerHTML`.

## 9. Privacidad

- Un resumen semanal solo contiene los datos del propio destinatario:
  nunca el resultado de un companero.
- Las noticias de faccion muestran el nombre y la posicion de la faccion,
  nunca el resultado privado de sus miembros.
- El envio manual a una faccion resuelve los destinatarios en servidor a
  partir de `splitId`/`factionId`/`splitParticipantId` ya validados: nunca
  una lista de ids enviada por el navegador.
- El historico administrativo de envios manuales
  (`listManualNewsHistory`) muestra autor, publico congelado, prioridad,
  titulo, cuerpo y numero de destinatarios, pero **nunca** quien lo ha
  leido.

## 10. Rendimiento

- El contador y la vista previa son consultas acotadas (`take: 5`/una
  agregacion `count`).
- La bandeja pagina de 20 en 20 por cursor, sin cargar todo el historico.
- Resolver destinatarios de un split o una faccion es una unica consulta
  (`resolveAllParticipantsForSplit`/`resolveFactionMembers`) mas
  `createMany` para las entregas.
- `notifyIfWeekReadyToReview` reutiliza `getWeeklyKpiLoadSummary` (la
  misma logica que ya usa el calendario de semanas) para una sola semana,
  nunca recalcula el motor de resultados completo solo para decidir si
  avisar.

## 11. Sin backfill historico

La bandeja empieza a registrar eventos desde el despliegue de `1.0.0`. No
se generan noticias retrospectivas para publicaciones, compras,
localizaciones, altas ni aperturas de mercado anteriores: recrearlas
produciria una bandeja artificial y potencialmente confusa. La migracion
de `1.0.0` solo añade estructura e indices; no borra ni recalcula datos
existentes.

## 12. Fuera de alcance

Correo, Teams/Outlook, notificaciones push, WebSockets/SSE/polling, cron o
workers, comentarios/reacciones/chat, adjuntos o imagenes, HTML o
Markdown en el mensaje, edicion/retirada/borrado de una noticia enviada,
recibos individuales de lectura visibles para el administrador,
preferencias granulares para silenciar categorias y un motor generico de
plantillas o de eventos.

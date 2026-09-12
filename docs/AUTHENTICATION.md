# Autenticacion y autorizacion (`0.6.0` / MVP-1C)

Autenticacion local minima, gratuita y mantenible, necesaria para que cada
participante vea unicamente su propio detalle y para proteger el resto de
la aplicacion. No hay SSO/OAuth, ni proveedores externos, ni servicios de
pago.

## Solucion tecnica

- [Auth.js/NextAuth v4](https://next-auth.js.org/) con `CredentialsProvider`
  (correo + contrasena). Sesion `JWT` firmada con `AUTH_SECRET`, sin tabla
  de sesiones en base de datos.
- Hash de contrasena con `bcryptjs` (12 rondas). Las contrasenas nunca se
  guardan en claro ni con cifrado reversible, y nunca se registran en
  consola, errores, pruebas ni PR.
- Cookies `HttpOnly` y `SameSite=Lax` (gestionadas por NextAuth); `Secure`
  se activa automaticamente en produccion (`NODE_ENV=production`).
- Las mutaciones siguen siendo acciones de servidor de Next.js, protegidas
  por las mismas medidas CSRF del framework.

## Modelo de datos

```
User
- id
- email (normalizado, unico)
- passwordHash
- role: ADMIN | PARTICIPANT
- personId (unico, opcional; obligatorio de facto para PARTICIPANT)
- isActive
- mustChangePassword
- createdAt / updatedAt
```

Un `PARTICIPANT` debe estar vinculado uno a uno con una `Person`
(`personId` unico). Un `ADMIN` puede no estar vinculado a ninguna persona.

## Proteccion de rutas

`src/middleware.ts` se ejecuta en **cada peticion** a las rutas de su
`matcher`, incluida una URL escrita a mano o un enlace directo, no solo
cuando se navega desde la interfaz:

- sin sesion -> redirige a `/login` (con `callbackUrl`);
- `mustChangePassword` activo -> redirige a `/cuenta/cambiar-contrasena`
  hasta que se cambie la contrasena, salvo esa misma ruta;
- `/personas/*` y `/splits/*` (incluidas las cargas de KPI, la
  previsualizacion de resultados y la clasificacion detallada) exigen
  `role = ADMIN`; si un `PARTICIPANT` lo intenta, se redirige a
  `/resultados`;
- `/resultados/*`, `/fichas/*` (`0.8.0` / MVP-2B), `/cuenta/*` y
  `/noticias/*` (`1.0.0` / MVP-3) son para cualquier usuario autenticado;
  `/noticias/administrar/*` exige ademas `role = ADMIN` (mismo trato que
  `/personas`/`/splits`), redirigiendo a `/noticias` si un `PARTICIPANT`
  lo intenta.

Dentro de paginas y acciones de servidor, `src/lib/session.ts`
(`requireSession`, `requireAdminSession`) es la segunda capa de defensa: se
llama explicitamente en cada pagina y accion sensible, sin depender solo
del middleware. Ninguna pagina ni accion acepta un `personId` recibido del
navegador para decidir que ve **o edita** un participante: siempre se usa
`session.user.personId`, resuelto en servidor a partir del JWT (ver
`docs/RESULTS_PUBLICATION.md`, seccion "Privacidad de `/resultados`", y
`docs/PROFESSIONS_AND_PROFILES.md`, secciones 12 a 14).

Desde `0.8.0` / MVP-2B, las Server Actions administrativas de participante
y de profesion vuelven a exigir `requireAdminSession()` dentro de la propia
accion, porque una Server Action es una ruta invocable directamente y no
solo el destino de un formulario ya renderizado por una pagina protegida.
Las de localizacion semanal (`0.8.5` / MVP-2C,
`src/server/actions/location.actions.ts`) y las de mercado, ranuras y
objetos (`0.9.0` / MVP-2D, `src/server/actions/economy.actions.ts`,
`src/server/actions/equipment-slot.actions.ts`,
`src/server/actions/store-item.actions.ts`) siguen exactamente el mismo
patron.
Las operaciones de autoservicio de la ficha (`alias propio`, `profesion
propia`, `avatar propio` y, desde `0.9.0` / MVP-2D, `comprar propio`,
`equipar propio`, `desequipar propio`,
`src/server/actions/purchase.actions.ts`,
`src/server/actions/equipment.actions.ts`) son operaciones separadas y de
intencion minima: no pueden cambiar nivel, faccion, persona ni semana
inicial, ni comprar o equipar en nombre de otro participante.

La ruta `/fichas/[splitParticipantId]` (`0.9.0` / MVP-2D, configuracion
privada del personaje: economia, inventario, equipo e historial) resuelve
la participacion siempre desde `session.user.personId` y comprueba que le
pertenece, con el mismo patron que `/fichas`; un `ADMIN` vinculado a una
persona solo puede usarla para su propia participacion.

La ruta `GET /api/fichas/[splitParticipantId]/avatar` exige sesion y
autoriza por ella: un `PARTICIPANT` solo puede leer la ficha vinculada a su
propio `personId`, un `ADMIN` puede leer cualquiera, y un intento de leer
una ficha ajena devuelve `404` igual que una ficha inexistente (no se
revela si existe).

## Ciclo de cuenta

1. **Primer administrador.** Script `npm run db:create-admin`
   (`scripts/create-first-admin.ts`), que lee `ADMIN_EMAIL` y
   `ADMIN_PASSWORD` de variables de entorno (nunca de un archivo con
   secretos en Git) y no hace nada si ya existe algun `ADMIN`. En
   PowerShell:

   ```powershell
   $env:ADMIN_EMAIL = "admin@ejemplo.com"
   $env:ADMIN_PASSWORD = "una-contrasena-temporal-segura"
   npm run db:create-admin
   ```

   El administrador creado tiene `mustChangePassword = true`.

2. **Login / logout.** `/login` (formulario de correo y contrasena) y un
   boton "Cerrar sesion" en la navegacion superior (`signOut` de
   `next-auth/react`).

3. **Gestion de cuentas de participante (solo administrador).** Integrada
   en `/personas`: cada persona muestra su cuenta (si tiene), con acciones
   para crear una cuenta vinculada (correo + contrasena temporal),
   activar/desactivar y restablecer la contrasena temporal.

4. **Cambio de contrasena propia.** `/cuenta/cambiar-contrasena`, para
   cualquier usuario autenticado; obligatorio en el primer acceso
   (`mustChangePassword`). Tras guardar, la sesion se cierra para forzar
   un nuevo inicio de sesion: la sesion `JWT` de NextAuth no relee la base
   de datos en cada peticion, asi que `mustChangePassword` solo se
   actualiza en un JWT nuevo.

No existe recuperacion de contrasena por correo ni invitacion por email en
esta entrega: el administrador es quien fija la contrasena temporal.

## Matriz de permisos

| Accion o dato | Administrador | Participante |
|---|---:|---:|
| Personas, configuracion y carga de KPI | Si | No |
| Previsualizar resultados no publicados | Si | No |
| Publicar semana | Si | No |
| Ver el detalle de cualquier persona | Si | No |
| Selector de persona en Resultados | Si | No |
| Ver su propio detalle publicado | Si | Si |
| Ver detalle privado de otro participante | Si | No |
| Ver clasificacion limitada por alias | Si | Si |
| Crear, editar o eliminar profesiones de un split | Si | No |
| Asignar la profesion de un participante | Si | No |
| Ver sus propias fichas (`/fichas`) | Si (si esta vinculado a una persona) | Si |
| Ver o editar la ficha de otra persona | No | No |
| Editar su propio alias por split | Si (su propia ficha) | Si |
| Escoger su propia profesion (antes de publicar) | Si (su propia ficha) | Si |
| Subir, reemplazar o eliminar su propio avatar | Si (su propia ficha) | Si |
| Leer el avatar de otra persona | Si | No |
| Gestionar el avatar de otra persona | No (fuera de alcance) | No |
| Crear, editar o eliminar la localizacion de una semana | Si (antes de `startDate`, semana no publicada, split no cerrado) | No |
| Ver la localizacion activa esta semana en su ficha | Si (su propia ficha) | Si |
| Ver o mutar la localizacion de un split ajeno | No | No |
| Abrir o cerrar el mercado de un split | Si | No |
| Crear, editar, reordenar o eliminar ranuras de equipo | Si (mercado cerrado, split no cerrado) | No |
| Crear, editar o retirar objetos del catalogo | Si (mercado cerrado, split no cerrado) | No |
| Ver el resumen de compras y creditos del split | Si | No |
| Ver su propia configuracion de personaje (`/fichas/[id]`) | Si (si esta vinculado a una persona) | Si |
| Comprar un objeto propio (mercado abierto, saldo suficiente) | Si (su propia ficha) | Si |
| Equipar o desequipar un objeto propio (split activo) | Si (su propia ficha) | Si |
| Comprar o equipar en nombre de otro participante | No | No |
| Editar precio, bonus, ranuras o estado del mercado desde la ficha | No | No |
| Ver el saldo, inventario o historial de otro participante | No | No |
| Leer, marcar leida/no leida o archivar su propia noticia | Si | Si |
| Leer, marcar o archivar una noticia de otro destinatario | No | No |
| Enviar una noticia manual (`/noticias/administrar`) | Si | No |
| Ver el historico de envios manuales o el numero de destinatarios | Si | No |
| Ver quien ha leido una noticia (recibo individual) | No (fuera de alcance) | No |

## Navegacion segun sesion

- **Administrador:** `Personas`, `Splits` (incluida `Economia y mercado`
  dentro de cada split, `0.9.0` / MVP-2D), `Resultados`, `Noticias`
  (con envio manual, `1.0.0` / MVP-3), `Fichas` (solo si su cuenta esta
  vinculada a una persona), gestion de cuenta/sesion.
- **Participante:** `Noticias`, `Resultados`, `Fichas` (con `Configurar
  personaje` por cada participacion, `0.9.0` / MVP-2D), gestion de
  cuenta/sesion.
- **Sin autenticar:** solo `Login`.
- El acceso raiz `/` redirige a `/noticias` para cualquier sesion valida
  (`1.0.0` / MVP-3, ver `docs/NEWS_CENTER.md`).

## Limitaciones conocidas de esta entrega

- No hay recuperacion de contrasena por correo (el encargo no la pide).
- La sesion es `JWT`: revocar una sesion activa (por ejemplo, tras
  desactivar una cuenta) exige que expire el token o que la persona vuelva
  a autenticarse; no hay una lista de revocacion server-side.
- No hay auditoria ni historial de inicios de sesion.

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
- `/resultados/*` y `/cuenta/*` son para cualquier usuario autenticado.

Dentro de paginas y acciones de servidor, `src/lib/session.ts`
(`requireSession`, `requireAdminSession`) es la segunda capa de defensa: se
llama explicitamente en cada pagina y accion sensible, sin depender solo
del middleware. Ninguna pagina ni accion acepta un `personId` recibido del
navegador para decidir que ve un participante: siempre se usa
`session.user.personId`, resuelto en servidor a partir del JWT (ver
`docs/RESULTS_PUBLICATION.md`, seccion "Privacidad de `/resultados`").

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

## Navegacion segun sesion

- **Administrador:** `Personas`, `Splits`, `Resultados`, gestion de
  cuenta/sesion.
- **Participante:** `Resultados`, gestion de cuenta/sesion.
- **Sin autenticar:** solo `Login`.

## Limitaciones conocidas de esta entrega

- No hay recuperacion de contrasena por correo (el encargo no la pide).
- La sesion es `JWT`: revocar una sesion activa (por ejemplo, tras
  desactivar una cuenta) exige que expire el token o que la persona vuelva
  a autenticarse; no hay una lista de revocacion server-side.
- No hay auditoria ni historial de inicios de sesion.

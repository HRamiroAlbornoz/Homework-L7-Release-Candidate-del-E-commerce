# Autenticación en el e-commerce — Homework L6 (Henry, Módulo 5)

E-commerce con React + TypeScript + Vite, Firestore y **Firebase Authentication**: catálogo de productos (heredado del Homework L4), login/signup con email y contraseña, roles (`customer`/`admin`), rutas protegidas y panel de administración placeholder.

## Stack

- React 19 + TypeScript (strict) + Vite
- Firebase Auth (SDK modular v9+) — email/password
- Firestore (SDK modular v9+, cliente) — catálogo de productos y perfiles de usuario (`users/{uid}`)
- react-router (v8, paquete unificado — no `react-router-dom`)
- Zod para validar variables de entorno, datos de Firestore y formularios
- Vitest + Testing Library para tests

## Setup

1. Instalar dependencias:
   ```bash
   npm install
   ```
2. Copiar `.env.example` a `.env` y completar con los datos de tu proyecto Firebase (Firebase Console → Configuración del proyecto → Tus apps → SDK setup and configuration):
   ```bash
   cp .env.example .env
   ```
3. **Habilitar Email/Password en Firebase Authentication** (paso manual, no es código): Firebase Console → Authentication → Sign-in method → Email/Password → Habilitar.
4. Cargar datos de prueba del catálogo (opcional, 60-100 productos en la colección `products`):
   ```bash
   npm run seed
   ```
5. Levantar el servidor de desarrollo:
   ```bash
   npm run dev
   ```
6. Crear un usuario desde `/signup` (nace con `role: "customer"`). Para probar el panel de administración, ir a Firestore Console → colección `users` → documento de ese usuario → cambiar `role` a `"admin"` a mano.

## Scripts

| Script | Qué hace |
|---|---|
| `npm run dev` | Levanta el servidor de desarrollo de Vite |
| `npm run build` | Type-check (`tsc -b`) + build de producción |
| `npm run test` | Corre la suite de Vitest |
| `npm run lint` | Corre ESLint |
| `npm run seed` | Carga productos de prueba en Firestore (`scripts/seed.ts`) |

## Rutas

| Ruta | Acceso | Componente |
|---|---|---|
| `/` | Público | `ProductsPage` (catálogo) |
| `/login` | Público (redirige a `/` si ya hay sesión) | `LoginPage` |
| `/signup` | Público (redirige a `/` si ya hay sesión) | `SignupPage` |
| `/cart` | Requiere sesión | `CartPage` (placeholder) |
| `/checkout` | Requiere sesión | `CheckoutPage` (placeholder) |
| `/admin` | Requiere sesión + `role === "admin"` | `AdminPage` (placeholder, CRUD real en Clase 7) |

`/cart` y `/checkout` están protegidas por `ProtectedRoute`; `/admin` por `AdminRoute`. Ambos guards viven en `src/routes/`.

## Arquitectura

- `components/` y `pages/` nunca importan el SDK de Firestore/Auth directamente. Todo el acceso a datos vive en `src/services/` (`productsService.ts`, `usersService.ts`), sobre `src/lib/firebase.ts` (única fuente de las instancias `db` y `auth`).
- `src/contexts/AuthContext.tsx` es la única fuente de verdad del estado de sesión (`user`, `loading`, `error`). El listener `onAuthStateChanged` es el único lugar que actualiza `user`; `login`/`signup`/`logout` nunca lo hacen directamente.
- `src/routes/ProtectedRoute.tsx` y `src/routes/AdminRoute.tsx` protegen la navegación; `firestore.rules` protege los datos en el servidor — son dos capas independientes, la segunda es la que de verdad importa contra un cliente malicioso.
- `src/lib/authErrors.ts` traduce los códigos de error de Firebase Auth a mensajes en español; `src/lib/authFormSchemas.ts` valida los formularios con Zod antes de llamar a Firebase.

## Documentación de decisiones

- [`docs/auth-notes.md`](docs/auth-notes.md): tabla de códigos de error de Firebase incluidos/descartados, el experimento de comentar el chequeo de `loading` en `ProtectedRoute`, el code review de seguridad, las 4 preguntas de reflexión del enunciado, y el caso borde de un usuario autenticado sin perfil en Firestore.
- [`docs/ai-notes.md`](docs/ai-notes.md): decisiones heredadas del Homework L4 sobre el catálogo de productos (paginación, búsqueda por prefijo, por qué `getDocs` en vez de `onSnapshot`).

## Seguridad

- Contraseñas: nunca se manejan en texto plano del lado de la app — Firebase Auth se encarga del hashing server-side.
- `firestore.rules` (raíz del repo) impide que un usuario se autoasigne el rol `admin`, tanto al crear su perfil como al actualizarlo. Ver el detalle completo en `docs/auth-notes.md`, sección 3.
- Los mensajes de error de login nunca revelan si un email existe o no en la base (mismo mensaje genérico para credenciales inválidas, usuario inexistente y contraseña incorrecta).

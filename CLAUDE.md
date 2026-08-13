# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Servidor de desarrollo (Vite)
npm run build             # Type-check (tsc -b) + build de producción
npm run lint               # ESLint sobre todo el repo
npm run test                # Corre toda la suite de Vitest (modo run, no watch)
npx vitest run <path>        # Corre un solo archivo de test, ej: npx vitest run src/lib/authErrors.test.ts
npx vitest                    # Modo watch
npx tsc -b --noEmit           # Solo type-check, sin build
npm run seed                   # Carga productos de prueba en Firestore (scripts/seed.ts)
```

No hay un test runner por nombre de test individual configurado aparte del filtro por archivo de Vitest; para acotar más, usar `npx vitest run <path> -t "<nombre del test>"`.

Setup local: copiar `.env.example` a `.env` con las credenciales de un proyecto Firebase, y habilitar Email/Password en Firebase Console → Authentication → Sign-in method (paso manual, no hay código para esto). Las variables de entorno se validan al arrancar con Zod en `src/lib/envSchema.ts`.

## Arquitectura

E-commerce React + TypeScript (strict) + Vite, con Firestore como base de datos y Firebase Authentication (SDK modular v9+, cliente) para email/password.

### Capa de acceso a datos — nunca se salta

`components/`, `pages/` y `contexts/` **nunca** importan el SDK de Firebase/Firestore directamente. Todo el acceso a datos pasa por `src/services/` (`productsService.ts`, `usersService.ts`), que a su vez usan las instancias únicas `db`/`auth` exportadas desde `src/lib/firebase.ts`. Si cambia la fuente de datos, solo cambia esa capa.

### Sesión de usuario: una única fuente de verdad

`src/contexts/AuthContext.tsx` es la única fuente de verdad del estado de sesión (`user`, `loading`, `error`). El listener `onAuthStateChanged` es el **único** lugar que actualiza `user` — las funciones `login`/`signup`/`logout` que expone el contexto nunca lo tocan directamente, solo disparan la operación en Firebase y dejan que el listener reaccione. Esto evita que dos caminos escriban el mismo estado y se desincronicen.

`loading` empieza en `true` y se resuelve solo cuando `onAuthStateChanged` confirma el estado real. Por eso todo componente que decide algo en base a la sesión (`ProtectedRoute`, `AdminRoute`, `LoginPage`, `SignupPage`) **siempre chequea `loading` antes que `user`** — mientras `loading` es `true`, un `user: null` significa "todavía no se sabe", no "no hay sesión". El motivo completo, con un experimento reproducido a propósito, está documentado en `docs/auth-notes.md` sección 2.

`signup()` hace rollback (`deleteUser`) si falla después de crear la cuenta de Auth pero antes de terminar de escribir el perfil en Firestore, para no dejar cuentas huérfanas sin perfil y sin forma de reintentar el registro.

### Dos capas de protección independientes

- **Navegación**: `src/routes/ProtectedRoute.tsx` (requiere sesión) y `src/routes/AdminRoute.tsx` (requiere sesión + `role === "admin"`) son guards de React Router que redirigen (`Navigate replace`) antes de renderizar rutas hijas.
- **Datos**: `firestore.rules` (raíz del repo) es la que realmente importa contra un cliente malicioso — impide que un usuario se autoasigne el rol `admin`, tanto al crear su perfil como al actualizarlo, y valida los campos del documento al crearlo (`email`, `displayName`, `createdAt == request.time`).

Estas dos capas son independientes a propósito: los guards son UX, las reglas son seguridad real.

### Errores de auth: código + mensaje

`src/lib/authErrorCodes.ts` define `AUTH_ERROR_CODES` (`as const`, SCREAMING_SNAKE_CASE). `src/lib/authErrors.ts` expone `mapAuthError(error)`, que traduce cualquier error de Firebase Auth a una instancia de `AuthError extends Error` con `.code` + `.message` en español + `.cause` (el error original). Los mensajes de login nunca revelan si un email existe o no en la base — `user-not-found`/`wrong-password`/`invalid-credential` colapsan al mismo código `INVALID_CREDENTIALS` con el mismo mensaje genérico.

### Validación de formularios

`src/lib/authFormSchemas.ts` valida signup/login con Zod antes de llamar a Firebase: límites de longitud en todos los campos (email 254, displayName 100, password 128) y, solo en signup, contraseña mínimo 8 caracteres con letra + número. El schema usa `.pipe()` (`z.string().min().max().pipe(z.email())`) para que un email vacío muestre "es obligatorio" antes que "no es válido" — si se usa `z.email()` como raíz del schema, esa precedencia de mensajes se rompe.

### Árbol de la app

`main.tsx`: `BrowserRouter` → `AuthProvider` → `App`. `AuthProvider` envuelve todo *dentro* del router para que `useAuth()` esté disponible en cualquier ruta, incluido el `Header`. `App.tsx` define las rutas sobre `RootLayout` (Header + `<Outlet />` compartidos); `ProductsProvider` envuelve solo la ruta `/` porque el catálogo de productos no lo necesita el resto de la app.

### Estados de carga en fetch

Todo componente que fetchea datos maneja `loading`/`error`/`success` explícitamente, reusando `src/components/states/` (`LoadingState`, `ErrorState`, `EmptyState`) en vez de reimplementarlos por pantalla.

## Documentación de decisiones ya escrita

No repetir investigación ya resuelta — leer antes de tocar código relacionado:

- [`docs/auth-notes.md`](docs/auth-notes.md): tabla de códigos de error de Firebase incluidos/descartados, el experimento de comentar el chequeo de `loading` en `ProtectedRoute`, code review de seguridad, preguntas de reflexión del enunciado, el caso borde de usuario autenticado sin perfil en Firestore, y un bug real de sesión ya diagnosticado y corregido (`createdAt` sin resolver justo después del signup — requiere `serverTimestamps: "estimate"` al leer con `snapshot.data()`).
- [`docs/ai-notes.md`](docs/ai-notes.md): decisiones heredadas del Homework L4 sobre el catálogo (paginación, búsqueda por prefijo, por qué `getDocs` en vez de `onSnapshot`). **Advertencia**: `endAt()` en `productsService.ts` usa el carácter Unicode de fin de rango (rango de uso privado, sin glifo visible) — en cualquier editor o salida de terminal se ve como si el string terminara vacío, pero no lo está; verificar a nivel de bytes/`charCodeAt` antes de "corregirlo".

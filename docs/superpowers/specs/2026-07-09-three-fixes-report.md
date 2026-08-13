# Reporte: 3 fixes independientes (2026-07-09)

## Issue 1 — Documentación desactualizada en `docs/auth-notes.md`

**Problema:** la fila #1 de la tabla en la sección "3. Code review de seguridad con IA" decía que `firestore.rules` NO validaba tipo/forma de `email`/`displayName`/`createdAt` en la regla `create` de `users/{uid}`, y que quedaba "documentado como mejora futura". Leyendo `firestore.rules` (líneas 55-61) esa validación ya está implementada.

**Cambio:** se corrigió la columna "¿Se implementó?" de esa fila, de "No" a "Sí", citando las líneas reales de `firestore.rules` y qué validan exactamente (`email is string` + `.size() > 0`, `displayName is string`, `createdAt == request.time`).

Antes:
> No — documentado como mejora futura de `firestore.rules`; agregar validación de tipos con `request.resource.data.email is string`, etc. excede el alcance de este homework.

Después:
> Sí — implementado en una ronda de fixes posterior. La regla `allow create` de `users/{uid}` (`firestore.rules`, líneas 55-61) ahora valida, además de `role == 'customer'`: `request.resource.data.email is string` y `.size() > 0`, `request.resource.data.displayName is string`, y `request.resource.data.createdAt == request.time` (el patrón oficial de Firebase para confirmar que el campo se escribió con `serverTimestamp()` real). Un documento con `email: 123` o sin `createdAt` ya no pasa la regla de creación.

**Verificación:** relectura de la fila corregida contra el contenido real de `firestore.rules` — coincide exactamente con las líneas citadas. No se tocó ninguna otra fila ni sección del archivo.

**Archivo modificado:** `docs/auth-notes.md`

---

## Issue 2 — Chunk de JS > 500 kB en el build de Vite

**Problema:** `npm run build` advierte que hay un chunk mayor a 500 kB después de minificar.

**Cambio aplicado:** en `src/App.tsx`, se convirtieron los imports estáticos de `CartPage`, `CheckoutPage` y `AdminPage` (las tres páginas placeholder, fuera del flujo crítico de auth/catálogo de este homework) a `React.lazy()`, envueltos con `.then()` porque esas páginas usan named exports en vez de default export (consistente con el resto del proyecto, no se cambió su forma de exportar). Se agregó un `<Suspense fallback={<LoadingState message="Cargando página..." />}>` alrededor de cada una de esas tres rutas, reusando el componente `LoadingState` ya existente (`src/components/states/LoadingState.tsx`), con el mismo patrón que ya usan `ProtectedRoute.tsx`/`AdminRoute.tsx` para su propio loading de sesión. `ProductsPage`, `LoginPage` y `SignupPage` quedaron con import estático, sin tocar, tal como pedía el alcance.

**Resultado real (antes/después), build de producción:**

Antes (import estático de las 3 páginas, un solo chunk):
```
dist/index.html                   0.48 kB │ gzip:   0.30 kB
dist/assets/index-C3w6Hcb7.css    7.73 kB │ gzip:   2.13 kB
dist/assets/index-ClE32pG7.js   883.27 kB │ gzip: 263.35 kB

(!) Some chunks are larger than 500 kB after minification.
```

Después (con `React.lazy()` + `Suspense` en Cart/Checkout/Admin):
```
dist/index.html                         0.48 kB │ gzip:   0.31 kB
dist/assets/index-CGU6qn2X.css          7.72 kB │ gzip:   2.12 kB
dist/assets/AdminPage-tafojW_d.js       0.14 kB │ gzip:   0.15 kB
dist/assets/CartPage-BcEOOufo.js        0.25 kB │ gzip:   0.20 kB
dist/assets/CheckoutPage-C7xfW-_c.js    0.25 kB │ gzip:   0.20 kB
dist/assets/index-hvKyiRjB.js         883.41 kB │ gzip: 263.44 kB

(!) Some chunks are larger than 500 kB after minification.
```

**Concern / juicio explícito:** el warning de Vite **NO desaparece y prácticamente no se reduce** (883.27 kB → 883.41 kB en el chunk principal; hasta subió unos bytes por el overhead del wrapper de `lazy()`). Las tres páginas placeholder (`CartPage`, `CheckoutPage`, `AdminPage`) son minúsculas — cada una se separó en su propio chunk de ~0.14-0.25 kB, así que sacarlas del bundle principal no tenía margen para mover la aguja. El grueso de los 883 kB es casi con certeza el SDK de Firebase (Auth + Firestore), que es parte del flujo crítico (`AuthContext`, `ProductsContext`/`productsService`, `usersService`) y por eso, siguiendo el alcance explícito del pedido ("NO lazy-load `ProductsPage`, `LoginPage`, o `SignupPage`"), no se tocó.

En resumen: el cambio es correcto y seguro (mismo comportamiento funcional, code splitting real y verificado en las 3 páginas indicadas), pero **no resuelve el warning de 500 kB** porque ese peso no vive en las páginas que se pidió dividir. Resolverlo de verdad requeriría separar el SDK de Firebase en un chunk propio (`build.rollupOptions.output.manualChunks`) o evaluar imports más finos de `firebase/auth`/`firebase/firestore` — eso está fuera del alcance que se definió para este fix (que explícitamente excluía tocar `ProductsPage`/`LoginPage`/`SignupPage`, que son las que arrastran Firebase al bundle inicial). Se deja documentado como próximo paso si se quiere atacar el warning de raíz.

**Verificación:** `npx tsc -b --noEmit` sin errores, `npx vitest run` con 311/311 tests igual que antes (ningún test referencia `CartPage`/`CheckoutPage`/`AdminPage` por nombre, confirmado por búsqueda antes de aplicar el cambio), `npm run build` completa sin errores (solo el warning preexistente, sin reducción significativa por lo explicado arriba).

**Archivo modificado:** `src/App.tsx`

---

## Issue 3 — CSS: dos hallazgos cosméticos menores

### 3.1 `.auth-page` con `min-height: calc(100vh - 64px)` hardcodeado

**Cambio:** se reemplazó `min-height: calc(100vh - 64px)` por `min-height: 100dvh`, manteniendo `display: flex; align-items: center; justify-content: center;` sin cambios. El centrado flex ya centra la card contra el viewport completo; la resta de 64px asumía una altura fija del Header que no existe en ningún lado del CSS (el Header es `sticky`, con padding que varía por breakpoint, así que su altura real varía). Se usó `100dvh` (dynamic viewport height) en vez de `100vh` porque además evita el salto de layout típico en mobile cuando la barra de direcciones del navegador aparece/desaparece.

**Archivo modificado:** `src/index.css`, regla `.auth-page`.

### 3.2 `.auth-card::before` (badge del ícono) sin margen de seguridad

**Decisión: no se modificó nada.** Se leyó la cascada completa: `.auth-page` tiene `padding: 24px 16px` en mobile (sin media query que lo reduzca en viewports chicos), y `.auth-card::before` está en `top: -14px` relativo a `.auth-card` (`position: relative`). Como `.auth-card` se centra dentro del *padding box* de `.auth-page` (el padding-top de 24px separa el borde del contenedor del área donde se centra el contenido), el badge que sobresale 14px por arriba del borde superior de la card tiene, en el caso normal, 24px − 14px = 10px de margen de sobra antes de llegar al borde del contenedor — ya cubierto sin cambios.

El único escenario donde esto podría no alcanzar es un viewport tan bajo que la card no entre verticalmente y quede empujada contra (o más allá de) el padding-top. En ese caso, `.auth-page` no tiene `overflow: hidden` en ningún punto de la cascada (ni el elemento ni sus padres, `RootLayout`/`body`), así que el contenido simplemente desborda hacia arriba y la página scrollea — no hay clipping real, solo el badge quedaría momentáneamente fuera del viewport inicial hasta hacer scroll, que es un comportamiento aceptable y no lo que reportó el review original ("no clipping observado pero sin margen de seguridad").

Conclusión: el padding-top de 24px ya funciona como margen de seguridad suficiente en el caso normal, y no hay riesgo de recorte real en el caso extremo por ausencia de `overflow: hidden`. Forzar un cambio (ej. subir el `padding-top` o agregar `margin-top` a `.auth-card`) no resuelve ningún problema observable y movería la card visualmente sin necesidad. Se deja el CSS como estaba para este punto.

---

## Verificación final (suite completa)

### `npx eslint .`
```
(sin salida — exit code 0)
```

### `npx tsc -b --noEmit`
```
(sin salida — exit code 0)
```

### `npx vitest run`
```
 RUN  v4.1.10 E:/Henry/Homework/Módulo 5/Front End/Homework L6-Autenticación en el e-commerce

 Test Files  15 passed (15)
      Tests  311 passed (311)
   Start at  22:11:12
   Duration  25.73s (transform 2.21s, setup 29.50s, import 13.28s, tests 35.51s, environment 103.23s)
```

### `npm run build`
```
> homework-l6-autenticacion-en-el-e-commerce@0.0.0 build
> tsc -b && vite build

vite v8.1.3 building client environment for production...
transforming...✓ 208 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                         0.48 kB │ gzip:   0.31 kB
dist/assets/index-CGU6qn2X.css          7.72 kB │ gzip:   2.12 kB
dist/assets/AdminPage-tafojW_d.js       0.14 kB │ gzip:   0.15 kB
dist/assets/CartPage-BcEOOufo.js        0.25 kB │ gzip:   0.20 kB
dist/assets/CheckoutPage-C7xfW-_c.js    0.25 kB │ gzip:   0.20 kB
dist/assets/index-hvKyiRjB.js         883.41 kB │ gzip: 263.44 kB

✓ built in 246ms
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rolldownOptions.output.codeSplitting to improve chunking: https://rolldown.rs/reference/OutputOptions.codeSplitting
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
```

## Resumen de archivos modificados

- `docs/auth-notes.md` — corrección de una fila de tabla (Issue 1)
- `src/App.tsx` — code splitting de `CartPage`/`CheckoutPage`/`AdminPage` con `React.lazy()` + `Suspense` (Issue 2)
- `src/index.css` — `.auth-page` usa `100dvh` en vez de `calc(100vh - 64px)` (Issue 3.1); `.auth-card::before` sin cambios, justificado (Issue 3.2)

No se tocó ningún archivo de test. No se hizo commit (no hay repositorio Git en este proyecto).

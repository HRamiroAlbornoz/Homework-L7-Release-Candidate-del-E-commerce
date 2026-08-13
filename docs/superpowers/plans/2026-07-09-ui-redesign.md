# Rediseño visual (Header + Login/Signup) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Estilizar visualmente el `Header` y las páginas `LoginPage`/`SignupPage` (con sus formularios), que hoy son HTML sin ninguna clase CSS, reusando y extendiendo el sistema de diseño que ya existe en `src/index.css` para el catálogo.

**Architecture:** Cambios puramente de presentación: se agregan `className`s a componentes ya existentes (sin tocar su lógica, roles ARIA ni texto visible) y se agregan reglas nuevas a `src/index.css`. No se crean componentes nuevos, no se agregan dependencias.

**Tech Stack:** CSS plano (variables CSS ya definidas en `:root`), React 19 + TypeScript, sin librerías de UI ni fuentes externas.

## Global Constraints

- Spec de referencia: `docs/superpowers/specs/2026-07-09-ui-redesign-design.md`.
- Ningún cambio puede alterar el **nombre accesible**, el **texto visible**, los **roles** o los atributos `aria-*`/`htmlFor`/`id` que ya existen — los 311 tests de la suite deben seguir pasando sin modificarse.
- El ícono de etiqueta (🏷) se implementa **siempre** vía `content` en un pseudo-elemento CSS (`::before`), nunca como texto real en el JSX — así nunca puede terminar formando parte del nombre accesible de un link/botón.
- Sin fuentes externas, sin librerías de UI nuevas. Solo `system-ui` (ya en uso).
- Todas las animaciones/transiciones nuevas deben tener su contraparte en un bloque `@media (prefers-reduced-motion: reduce)`, siguiendo el patrón ya usado en `.spinner` y `.product-card` de `index.css`.
- **No hay Git inicializado en este repositorio** (`git init` no se corrió) — se omiten los pasos de "commit" del template estándar de esta skill. Cada tarea termina con un paso de verificación (lint + tsc + tests relevantes) en su lugar.

---

### Task 1: Tokens de diseño nuevos en `index.css`

**Files:**
- Modify: `src/index.css:1-37` (bloques `:root` y `@media (prefers-color-scheme: dark)`)

**Interfaces:**
- Produces: 4 variables CSS nuevas usadas por las Tasks 2-5: `--surface-raised`, `--accent-soft`, `--shadow-card`, `--header-bg`.

- [ ] **Step 1: Agregar los tokens al bloque `:root` (tema claro)**

En `src/index.css`, dentro del bloque `:root` (después de la línea `--error-border: #e5a3a3;`, antes del `font: 16px/1.5 ...`), agregar:

```css
  --surface-raised: #ffffff;
  --accent-soft: rgba(123, 63, 242, 0.1);
  --shadow-card: 0 8px 24px rgba(43, 43, 51, 0.08);
  --header-bg: rgba(255, 255, 255, 0.85);
```

- [ ] **Step 2: Agregar los tokens al bloque `@media (prefers-color-scheme: dark)`**

Dentro del bloque `@media (prefers-color-scheme: dark) { :root { ... } }` (después de la línea `--error-border: #6b2c2c;`), agregar:

```css
    --surface-raised: #262832;
    --accent-soft: rgba(192, 132, 252, 0.14);
    --shadow-card: 0 8px 24px rgba(0, 0, 0, 0.35);
    --header-bg: rgba(31, 32, 40, 0.85);
```

- [ ] **Step 3: Aplicar el tratamiento tipográfico de "título" al `h1` global**

En `src/index.css`, la regla `h1 { color: var(--text-h); font-size: 28px; margin: 0 0 16px; }` (línea ~49) queda así (agrega `font-weight` y `letter-spacing`, sin tocar lo demás):

```css
h1 {
  color: var(--text-h);
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 0 0 16px;
}
```

Esto aplica al `h1` del catálogo ("Catálogo de productos") y a los de `LoginPage`/`SignupPage` por igual — es un ajuste tipográfico global mínimo (no un rediseño de layout), coherente con "fuera de alcance: no se rediseña el catálogo" del spec.

- [ ] **Step 4: Verificar que no se rompió nada**

Run: `npx tsc -b --noEmit && npx eslint . && npx vitest run`
Expected: `tsc` sin errores, `eslint` sin errores, 311/311 tests passed (CSS no afecta a los tests, es solo para confirmar que no se tocó nada más).

---

### Task 2: Rediseño del `Header`

**Files:**
- Modify: `src/components/Header.tsx` (agregar `className`s, reestructurar el JSX del lado derecho del nav en un wrapper)
- Modify: `src/index.css` (agregar al final del archivo)

**Interfaces:**
- Consumes: `--surface`, `--border`, `--text`, `--text-h`, `--text-muted`, `--accent`, `--accent-soft`, `--header-bg` (de `:root`, Task 1 para los últimos dos).
- Produces: ninguna interfaz nueva para otras tasks (el Header no es consumido por Login/Signup).

- [ ] **Step 1: Reemplazar el JSX de `Header.tsx`**

Reemplazar el contenido completo del archivo `src/components/Header.tsx`:

```tsx
import { useState } from "react";
import { Link } from "react-router";
import { useAuth } from "../contexts/AuthContext";

// Toda la información de sesión sale de useAuth(): este componente no recibe
// (ni debe recibir) props relacionadas con autenticación. Ocultar el link de
// admin acá es solo una mejora de UX — la protección real de /admin la hace
// AdminRoute, no este componente.
export function Header() {
  const { user, logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function handleLogout(): Promise<void> {
    setLogoutError(null);
    setIsLoggingOut(true);
    try {
      await logout();
    } catch (error) {
      setLogoutError(
        error instanceof Error ? error.message : "No pudimos cerrar tu sesión. Probá de nuevo."
      );
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <header className="site-header">
      <nav className="site-header__nav" aria-label="Navegación principal">
        <Link to="/" className="site-header__brand">
          Catálogo
        </Link>

        <div className="site-header__links">
          {user ? (
            <>
              {user.role === "admin" && (
                <Link to="/admin" className="site-header__link">
                  Panel de administración
                </Link>
              )}
              <span className="site-header__user">{user.displayName ?? user.email}</span>
              <button
                type="button"
                className="site-header__logout"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                {isLoggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
              </button>
            </>
          ) : (
            <Link to="/login" className="site-header__link">
              Iniciar sesión
            </Link>
          )}
        </div>
      </nav>

      {logoutError && (
        <p className="site-header__error" role="alert" aria-live="assertive">
          {logoutError}
        </p>
      )}
    </header>
  );
}
```

Nota: los roles, textos y `aria-label` son exactamente los mismos que antes — solo se agregaron `className`s y un `<div className="site-header__links">` envolviendo el contenido de la derecha (necesario para el layout `flex` con `justify-content: space-between` entre la marca y el resto).

- [ ] **Step 2: Correr los tests de `Header` para confirmar que nada se rompió por la reestructuración del JSX**

Run: `npx vitest run src/components/Header.test.tsx`
Expected: 21/21 tests passed (todos consultan por rol/nombre accesible/texto, no por estructura del DOM — ver `docs/superpowers/specs/2026-07-09-ui-redesign-design.md`).

- [ ] **Step 3: Agregar los estilos del Header a `index.css`**

Al final de `src/index.css`, agregar:

```css
/* Header: barra sticky con blur, marca con ícono de etiqueta (vía ::before,
   nunca como texto real — no debe afectar el nombre accesible del link). */
.site-header {
  position: sticky;
  top: 0;
  z-index: 10;
  background: var(--header-bg);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--border);
}

.site-header__nav {
  max-width: 1100px;
  margin: 0 auto;
  padding: 12px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

@media (min-width: 768px) {
  .site-header__nav {
    padding: 14px 24px;
  }
}

.site-header__brand {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  font-size: 18px;
  letter-spacing: -0.02em;
  color: var(--text-h);
  text-decoration: none;
}

.site-header__brand::before {
  content: "🏷";
  font-size: 16px;
  line-height: 1;
}

.site-header__links {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.site-header__link {
  position: relative;
  color: var(--text);
  text-decoration: none;
  padding-bottom: 2px;
}

.site-header__link::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: 0;
  width: 100%;
  height: 2px;
  background: var(--accent);
  transform: scaleX(0);
  transform-origin: left;
  transition: transform 0.15s ease;
}

.site-header__link:hover::after,
.site-header__link:focus-visible::after {
  transform: scaleX(1);
}

@media (prefers-reduced-motion: reduce) {
  .site-header__link::after {
    transition: none;
  }
}

.site-header__user {
  font-size: 14px;
  color: var(--text-muted);
}

.site-header__logout {
  min-height: 44px;
  padding: 6px 16px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
  color: var(--text);
  font-size: 14px;
  cursor: pointer;
  transition: background-color 0.15s ease, border-color 0.15s ease;
}

.site-header__logout:hover:not(:disabled) {
  background: var(--accent-soft);
  border-color: var(--accent);
}

.site-header__logout:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (prefers-reduced-motion: reduce) {
  .site-header__logout {
    transition: none;
  }
}

.site-header__error {
  max-width: 1100px;
  margin: 0 auto;
  padding: 8px 16px 12px;
  color: var(--error-text);
  font-size: 14px;
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc -b --noEmit && npx eslint . && npx vitest run src/components/Header.test.tsx`
Expected: sin errores de tipos/lint, 21/21 tests passed.

---

### Task 3: Rediseño de `FormField`

**Files:**
- Modify: `src/components/auth/FormField.tsx`
- Modify: `src/index.css` (agregar al final)

**Interfaces:**
- Consumes: `--border`, `--surface`, `--text`, `--text-muted`, `--accent`, `--accent-soft`, `--error-border`, `--error-text` (de `:root`).
- Produces: clases `.form-field`, `.form-field__label`, `.form-field__input`, `.form-field__error`, consumidas por `LoginForm`/`SignupForm` indirectamente (son internas de `FormField`, no hace falta que Task 4 las conozca).

- [ ] **Step 1: Reemplazar el JSX de `FormField.tsx`**

Reemplazar el contenido completo del archivo `src/components/auth/FormField.tsx`:

```tsx
interface FormFieldProps {
  id: string;
  label: string;
  type: "email" | "password" | "text";
  value: string;
  onChange: (value: string) => void;
  // "| undefined" explícito (no solo "?"): con exactOptionalPropertyTypes,
  // el resultado de Zod (issues.campo?.[0]) es "string | undefined", y este
  // componente recibe ese valor directo sin filtrar el caso "undefined".
  error?: string | undefined;
  disabled?: boolean;
  autoComplete?: string;
}

// Input reutilizable para los formularios de auth (LoginForm, SignupForm):
// accesibilidad (label asociado, aria-describedby/aria-invalid/aria-required)
// resuelta una sola vez acá, en vez de repetirla campo por campo.
export function FormField({ id, label, type, value, onChange, error, disabled, autoComplete }: FormFieldProps) {
  const errorId = `${id}-error`;

  return (
    <div className="form-field">
      <label htmlFor={id} className="form-field__label">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        required
        aria-required="true"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        autoComplete={autoComplete}
        className="form-field__input"
      />
      {error && (
        <span id={errorId} role="alert" className="form-field__error">
          {error}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Correr los tests de `FormField`**

Run: `npx vitest run src/components/auth/FormField.test.tsx`
Expected: todos los tests passed (sin cambios respecto al total actual del archivo).

- [ ] **Step 3: Agregar los estilos a `index.css`**

Al final de `src/index.css`, agregar:

```css
/* Campos de los formularios de auth (login/signup) */
.form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 16px;
}

.form-field__label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}

.form-field__input {
  min-height: 44px;
  padding: 8px 12px;
  font-size: 16px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.form-field__input:hover:not(:disabled) {
  border-color: var(--accent);
}

.form-field__input:focus {
  border-color: var(--accent);
  background: var(--accent-soft);
}

.form-field__input:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.form-field__input[aria-invalid="true"] {
  border-color: var(--error-border);
}

@media (prefers-reduced-motion: reduce) {
  .form-field__input {
    transition: none;
  }
}

.form-field__error {
  font-size: 13px;
  color: var(--error-text);
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc -b --noEmit && npx eslint . && npx vitest run src/components/auth/FormField.test.tsx`
Expected: sin errores, todos los tests del archivo passed.

---

### Task 4: Rediseño de `LoginForm` y `SignupForm`

**Files:**
- Modify: `src/components/auth/LoginForm.tsx`
- Modify: `src/components/auth/SignupForm.tsx`
- Modify: `src/index.css` (agregar al final)

**Interfaces:**
- Consumes: `.form-field*` (Task 3), `--error-bg`, `--error-text`, `--error-border`, `--accent`, `--accent-contrast` (de `:root`).
- Produces: clases `.auth-form__error`, `.auth-form__submit`, consumidas visualmente pero sin acoplamiento de código con Task 5 (Task 5 solo envuelve estos formularios en un card, no depende de sus clases internas).

- [ ] **Step 1: Actualizar el JSX de `LoginForm.tsx`**

En `src/components/auth/LoginForm.tsx`, reemplazar el bloque `return (...)` (líneas 55-84) por:

```tsx
  return (
    <form onSubmit={handleSubmit} noValidate className="auth-form">
      <FormField
        id="login-email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        error={fieldErrors.email}
        disabled={isSubmitting}
        autoComplete="email"
      />
      <FormField
        id="login-password"
        label="Contraseña"
        type="password"
        value={password}
        onChange={setPassword}
        error={fieldErrors.password}
        disabled={isSubmitting}
        autoComplete="current-password"
      />

      <div aria-live="polite">
        {formError && (
          <p role="alert" className="auth-form__error">
            {formError}
          </p>
        )}
      </div>

      <button type="submit" className="auth-form__submit" disabled={isSubmitting}>
        {isSubmitting ? "Iniciando sesión..." : "Iniciar sesión"}
      </button>
    </form>
  );
```

- [ ] **Step 2: Actualizar el JSX de `SignupForm.tsx`**

En `src/components/auth/SignupForm.tsx`, reemplazar el bloque `return (...)` (líneas 63-112) por:

```tsx
  return (
    <form onSubmit={handleSubmit} noValidate className="auth-form">
      <FormField
        id="signup-display-name"
        label="Nombre para mostrar"
        type="text"
        value={displayName}
        onChange={setDisplayName}
        error={fieldErrors.displayName}
        disabled={isSubmitting}
        autoComplete="name"
      />
      <FormField
        id="signup-email"
        label="Email"
        type="email"
        value={email}
        onChange={setEmail}
        error={fieldErrors.email}
        disabled={isSubmitting}
        autoComplete="email"
      />
      <FormField
        id="signup-password"
        label="Contraseña"
        type="password"
        value={password}
        onChange={setPassword}
        error={fieldErrors.password}
        disabled={isSubmitting}
        autoComplete="new-password"
      />
      <FormField
        id="signup-confirm-password"
        label="Confirmar contraseña"
        type="password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        error={fieldErrors.confirmPassword}
        disabled={isSubmitting}
        autoComplete="new-password"
      />

      <div aria-live="polite">
        {formError && (
          <p role="alert" className="auth-form__error">
            {formError}
          </p>
        )}
      </div>

      <button type="submit" className="auth-form__submit" disabled={isSubmitting}>
        {isSubmitting ? "Creando cuenta..." : "Crear cuenta"}
      </button>
    </form>
  );
```

- [ ] **Step 3: Correr los tests de ambos formularios**

Run: `npx vitest run src/components/auth/LoginForm.test.tsx src/components/auth/SignupForm.test.tsx`
Expected: todos los tests de ambos archivos passed.

- [ ] **Step 4: Agregar los estilos a `index.css`**

Al final de `src/index.css`, agregar:

```css
/* Formularios de auth (login/signup): banner de error y botón de submit */
.auth-form__error {
  margin: 0 0 16px;
  padding: 10px 12px;
  background: var(--error-bg);
  color: var(--error-text);
  border: 1px solid var(--error-border);
  border-radius: 6px;
  font-size: 14px;
}

.auth-form__submit {
  width: 100%;
  min-height: 44px;
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  background: var(--accent);
  color: var(--accent-contrast);
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.05s ease;
}

.auth-form__submit:hover:not(:disabled) {
  opacity: 0.92;
}

.auth-form__submit:active:not(:disabled) {
  transform: scale(0.98);
}

.auth-form__submit:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (prefers-reduced-motion: reduce) {
  .auth-form__submit {
    transition: none;
  }

  .auth-form__submit:active:not(:disabled) {
    transform: none;
  }
}
```

- [ ] **Step 5: Verificar**

Run: `npx tsc -b --noEmit && npx eslint . && npx vitest run src/components/auth/LoginForm.test.tsx src/components/auth/SignupForm.test.tsx`
Expected: sin errores, todos los tests passed.

---

### Task 5: Card centrado en `LoginPage` y `SignupPage`

**Files:**
- Modify: `src/pages/LoginPage.tsx`
- Modify: `src/pages/SignupPage.tsx`
- Modify: `src/index.css` (agregar al final)

**Interfaces:**
- Consumes: `--surface-raised`, `--shadow-card`, `--accent-soft` (Task 1), `--error-bg`/`--error-text`/`--error-border`, `--text-muted` (de `:root`).
- Produces: ninguna interfaz nueva (última capa visual del árbol, nada la consume después).

- [ ] **Step 1: Actualizar el JSX de `LoginPage.tsx`**

Reemplazar el contenido completo del archivo `src/pages/LoginPage.tsx`:

```tsx
import { Link, Navigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { LoginForm } from "../components/auth/LoginForm";
import { LoadingState } from "../components/states/LoadingState";
import { AUTH_LOADING_MESSAGE } from "../lib/authConstants";

export function LoginPage() {
  const { user, loading, error } = useAuth();

  // Mismo criterio que ProtectedRoute: loading se chequea ANTES que user,
  // para no decidir nada mientras Firebase todavía está resolviendo la sesión.
  if (loading) {
    return <LoadingState message={AUTH_LOADING_MESSAGE} />;
  }

  // Si ya hay sesión, no tiene sentido mostrar el formulario de login.
  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">Iniciar sesión</h1>
        {/* Caso borde documentado en docs/auth-notes.md: si AuthContext no pudo
            cargar el perfil (ej. justo después de un signup interrumpido), acá
            es donde el usuario termina — antes ese mensaje nunca se mostraba. */}
        {error && (
          <p role="alert" className="auth-card__error">
            {error}
          </p>
        )}
        <LoginForm />
        <p className="auth-card__footer">
          ¿No tenés cuenta? <Link to="/signup">Registrate</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Actualizar el JSX de `SignupPage.tsx`**

Reemplazar el contenido completo del archivo `src/pages/SignupPage.tsx`:

```tsx
import { Link, Navigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { SignupForm } from "../components/auth/SignupForm";
import { LoadingState } from "../components/states/LoadingState";
import { AUTH_LOADING_MESSAGE } from "../lib/authConstants";

export function SignupPage() {
  const { user, loading, error } = useAuth();

  // Mismo criterio que ProtectedRoute: loading se chequea ANTES que user,
  // para no decidir nada mientras Firebase todavía está resolviendo la sesión.
  if (loading) {
    return <LoadingState message={AUTH_LOADING_MESSAGE} />;
  }

  // Si ya hay sesión, no tiene sentido mostrar el formulario de registro.
  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-card__title">Crear cuenta</h1>
        {/* Caso borde documentado en docs/auth-notes.md: si AuthContext no pudo
            cargar el perfil (ej. justo después de un signup interrumpido), acá
            es donde el usuario termina — antes ese mensaje nunca se mostraba. */}
        {error && (
          <p role="alert" className="auth-card__error">
            {error}
          </p>
        )}
        <SignupForm />
        <p className="auth-card__footer">
          ¿Ya tenés cuenta? <Link to="/login">Iniciá sesión</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Correr los tests de ambas páginas**

Run: `npx vitest run src/pages/LoginPage.test.tsx src/pages/SignupPage.test.tsx`
Expected: 44/44 tests passed (22 por archivo, incluidos los del banner de error agregados en la sesión de fixes anterior).

- [ ] **Step 4: Agregar los estilos a `index.css`**

Al final de `src/index.css`, agregar:

```css
/* Login/Signup: un solo card centrado (no split-screen), con el ícono de
   etiqueta reutilizado como acento decorativo en la esquina. */
.auth-page {
  min-height: calc(100vh - 64px);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
}

.auth-card {
  position: relative;
  width: 100%;
  max-width: 420px;
  padding: 32px 24px;
  background: var(--surface-raised);
  border-radius: 12px;
  box-shadow: var(--shadow-card);
  animation: auth-card-in 0.15s ease-out;
}

@media (min-width: 768px) {
  .auth-card {
    padding: 40px 32px;
  }
}

.auth-card::before {
  content: "🏷";
  position: absolute;
  top: -14px;
  left: 24px;
  font-size: 20px;
  line-height: 1;
  background: var(--accent-soft);
  border-radius: 999px;
  padding: 6px;
}

@keyframes auth-card-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .auth-card {
    animation: none;
  }
}

.auth-card__title {
  margin-bottom: 20px;
}

.auth-card__error {
  margin: 0 0 16px;
  padding: 10px 12px;
  background: var(--error-bg);
  color: var(--error-text);
  border: 1px solid var(--error-border);
  border-radius: 6px;
  font-size: 14px;
}

.auth-card__footer {
  margin: 16px 0 0;
  font-size: 14px;
  color: var(--text-muted);
  text-align: center;
}
```

- [ ] **Step 5: Verificar**

Run: `npx tsc -b --noEmit && npx eslint . && npx vitest run src/pages/LoginPage.test.tsx src/pages/SignupPage.test.tsx`
Expected: sin errores, 44/44 tests passed.

---

### Task 6: Verificación final completa

**Files:** ninguno (solo verificación).

**Interfaces:** ninguna.

- [ ] **Step 1: Suite completa + build**

Run: `npx eslint . && npx tsc -b --noEmit && npm run build && npx vitest run`
Expected: lint sin errores, `tsc` sin errores, build exitoso (`dist/` generado), 311/311 tests passed (sin ningún test nuevo ni modificado).

- [ ] **Step 2: Revisión manual en el navegador**

Con `npm run dev` corriendo, verificar en `http://localhost:5173`:
- `/login` y `/signup`: el card aparece centrado, con la animación de entrada, el ícono de etiqueta en la esquina, foco visible al tabular por los campos.
- El Header: queda fijo arriba al hacer scroll en `/` (catálogo), el link activo muestra el subrayado al pasar el mouse.
- Cambiar el tema del sistema operativo (o emular `prefers-color-scheme: dark` en DevTools) y confirmar que los tokens nuevos (`--surface-raised`, `--accent-soft`, `--shadow-card`, `--header-bg`) se ven bien en ambos modos.
- Emular `prefers-reduced-motion: reduce` en DevTools (Rendering tab) y confirmar que la animación del card y las transiciones de hover desaparecen.
- Probar en 3 anchos: 320px (mobile), 768px (tablet), 1280px (desktop) — el Header no debe romperse ni el card desbordar en mobile.

Expected: todo lo anterior se cumple, sin errores ni warnings nuevos en la consola del navegador.

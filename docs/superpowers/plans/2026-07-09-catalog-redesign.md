# Rediseño visual del Catálogo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extender el sistema visual ya establecido (Header + auth) al catálogo de productos: `ProductCard`, `SearchBar`, `CategoryFilter` y `LoadMoreButton`, sin cambiar ninguna lógica de búsqueda/filtrado/paginación.

**Architecture:** Cambios de presentación pura, casi todos en `src/index.css` (extender/agregar reglas), consumiendo los tokens ya definidos por el rediseño anterior (`--accent-soft`, `--shadow-card`, etc.). No se crean componentes nuevos, no se agregan dependencias.

**Tech Stack:** CSS plano, React 19 + TypeScript, sin librerías de UI ni fuentes externas.

## Global Constraints

- Spec de referencia: `docs/superpowers/specs/2026-07-09-catalog-redesign-design.md`.
- **`ProductCard`, `ProductGrid`, `SearchBar`, `CategoryFilter`, `LoadMoreButton` y `ProductsPage` no tienen tests dedicados** — ningún paso de este plan depende de un test automático para estos componentes. La verificación es manual (ver Task 4).
- Ningún cambio puede alterar el comportamiento de búsqueda, filtrado o paginación — solo `className`s y estilos.
- Ningún cambio puede alterar el nombre accesible de ningún elemento ni sus atributos `aria-*`/`htmlFor`/`id` ya existentes.
- El ícono de etiqueta (🏷) junto al precio se implementa **siempre** vía `content: "🏷" / ""` en un pseudo-elemento CSS (`::before`) — la sintaxis `/ ""` excluye el glyph del nombre accesible (mismo patrón ya usado en `.site-header__brand::before` y `.auth-card::before`, `src/index.css:292-296` y `515-525`).
- Toda transición/animación nueva necesita su contraparte en `@media (prefers-reduced-motion: reduce)`.
- Sin fuentes externas, sin librerías de UI nuevas.
- No hay Git inicializado en este repositorio (decisión explícita del dueño del proyecto) — no hay pasos de commit en este plan. Cada tarea termina con un paso de verificación en su lugar.

---

### Task 1: `ProductCard` — categoría como "eyebrow", ícono de etiqueta en el precio, hover refinado

**Files:**
- Modify: `src/index.css` (reglas `.product-card`, `.product-card__category`, `.product-card__price`, aproximadamente líneas 203-232 en el archivo actual — buscar por nombre de selector, no por número de línea, porque tasks anteriores en este mismo archivo pueden haber desplazado las líneas)

**Interfaces:**
- Consumes: `--accent`, `--text-muted`, `--shadow-card` (de `:root`, ya definidos por el rediseño anterior).
- Produces: ninguna interfaz nueva para otras tasks.

No hace falta tocar `src/components/ProductCard.tsx`: sus tres elementos (`product-card`, `product-card__category`, `product-card__price`) ya tienen esos `className`s en el JSX actual — todo el cambio de esta task es CSS puro.

- [ ] **Step 1: Actualizar `.product-card` para el hover refinado**

En `src/index.css`, reemplazar la regla actual:

```css
.product-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  background: var(--surface);
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}
```

por:

```css
.product-card {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 16px;
  background: var(--surface);
  transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.product-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: var(--shadow-card);
}
```

El bloque `@media (prefers-reduced-motion: reduce) { .product-card { transition: none; } }` que ya existe justo debajo (líneas ~211-215) no necesita cambios: `transition: none` sigue neutralizando cualquier transición, sin importar cuántas propiedades tenga la regla de arriba.

- [ ] **Step 2: Actualizar `.product-card__category` con tratamiento de "eyebrow"**

Reemplazar:

```css
.product-card__category {
  margin: 0 0 8px;
  font-size: 13px;
  color: var(--text-muted);
}
```

por (mismo tratamiento que `.form-field__label`, `src/index.css:385-391`):

```css
.product-card__category {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}
```

- [ ] **Step 3: Agregar el ícono de etiqueta a `.product-card__price`**

Reemplazar:

```css
.product-card__price {
  margin: 0;
  font-weight: 600;
}
```

por:

```css
.product-card__price {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
}

.product-card__price::before {
  content: "🏷" / "";
  font-size: 14px;
  line-height: 1;
}
```

- [ ] **Step 4: Verificar**

Run: `npx tsc -b --noEmit && npx eslint . && npx vitest run`
Expected: sin errores de tipos/lint, 311/311 tests passed (ningún test cubre estos componentes, así que el número no debería cambiar).

---

### Task 2: `SearchBar` / `CategoryFilter` — foco y hover consistentes con los inputs de auth

**Files:**
- Modify: `src/index.css` (regla `.search-bar input, .category-filter select`, aproximadamente líneas 129-138 en el archivo actual)

**Interfaces:**
- Consumes: `--accent`, `--accent-soft` (de `:root`).
- Produces: ninguna interfaz nueva.

No hace falta tocar `src/components/SearchBar.tsx` ni `src/components/CategoryFilter.tsx`: ya tienen los `className`s (`search-bar`, `category-filter`) en su JSX actual.

- [ ] **Step 1: Agregar transición y estados de hover/foco**

En `src/index.css`, reemplazar:

```css
.search-bar input,
.category-filter select {
  min-height: 44px; /* área táctil mínima en mobile */
  padding: 8px 12px;
  font-size: 16px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
}
```

por:

```css
.search-bar input,
.category-filter select {
  min-height: 44px; /* área táctil mínima en mobile */
  padding: 8px 12px;
  font-size: 16px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  transition: border-color 0.15s ease, background-color 0.15s ease;
}

.search-bar input:hover,
.category-filter select:hover {
  border-color: var(--accent);
}

.search-bar input:focus,
.category-filter select:focus {
  border-color: var(--accent);
  background: var(--accent-soft);
}

@media (prefers-reduced-motion: reduce) {
  .search-bar input,
  .category-filter select {
    transition: none;
  }
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc -b --noEmit && npx eslint . && npx vitest run`
Expected: sin errores, 311/311 tests passed.

---

### Task 3: `LoadMoreButton` — microinteracción de hover/active

**Files:**
- Modify: `src/index.css` (regla `.load-more-button` y `.load-more-button:disabled`, aproximadamente líneas 234-250 en el archivo actual)

**Interfaces:**
- Consumes: `--accent` (de `:root`).
- Produces: ninguna interfaz nueva.

No hace falta tocar `src/components/LoadMoreButton.tsx`: ya tiene el `className="load-more-button"` en su JSX actual.

- [ ] **Step 1: Agregar transición y estados de hover/active**

En `src/index.css`, reemplazar:

```css
.load-more-button {
  display: block;
  margin: 0 auto;
  min-height: 44px;
  padding: 8px 24px;
  border: 1px solid var(--accent);
  border-radius: 6px;
  background: transparent;
  color: var(--accent);
  font-size: 16px;
  cursor: pointer;
}

.load-more-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
```

por:

```css
.load-more-button {
  display: block;
  margin: 0 auto;
  min-height: 44px;
  padding: 8px 24px;
  border: 1px solid var(--accent);
  border-radius: 6px;
  background: transparent;
  color: var(--accent);
  font-size: 16px;
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.05s ease;
}

.load-more-button:hover:not(:disabled) {
  opacity: 0.8;
}

.load-more-button:active:not(:disabled) {
  transform: scale(0.98);
}

.load-more-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (prefers-reduced-motion: reduce) {
  .load-more-button {
    transition: none;
  }

  .load-more-button:active:not(:disabled) {
    transform: none;
  }
}
```

Nota: `:hover:not(:disabled)` y `:active:not(:disabled)` (mismo patrón que `.form-field__input:hover:not(:disabled)`, `src/index.css:404`) evitan que el hover/active se vea mientras el botón está deshabilitado (`loading: true`), sin depender del orden de las reglas CSS.

- [ ] **Step 2: Verificar**

Run: `npx tsc -b --noEmit && npx eslint . && npx vitest run`
Expected: sin errores, 311/311 tests passed.

---

### Task 4: Verificación final completa

**Files:** ninguno (solo verificación).

**Interfaces:** ninguna.

- [ ] **Step 1: Suite completa + build**

Run: `npx eslint . && npx tsc -b --noEmit && npm run build && npx vitest run`
Expected: lint sin errores, `tsc` sin errores, build exitoso, 311/311 tests passed (sin ningún test nuevo ni modificado).

- [ ] **Step 2: Revisión manual en el navegador**

Con `npm run dev` (o `npm run preview` contra el build real) corriendo, verificar en `http://localhost:5173` (o el puerto que corresponda), en la página `/` (catálogo):

- **Comportamiento intacto** (lo más importante, porque no hay tests automáticos): escribir en el buscador y confirmar que sigue filtrando después del debounce; cambiar la categoría en el `<select>` y confirmar que sigue filtrando; hacer click en "Cargar más" y confirmar que sigue paginando.
- **Visual**: cada `ProductCard` muestra la categoría en mayúsculas con tracking, el precio con el ícono de etiqueta antes del monto, y al pasar el mouse el card se eleva levemente con el borde en violeta.
- **Accesibilidad**: tabular hasta el buscador y el select — deben mostrar el mismo `outline` de foco visible que el resto de la app (no se tocó `:focus-visible`, solo se agregó `background`/`border-color` en `:focus`, así que ambos deberían convivir). Confirmar con el árbol de accesibilidad (o inspeccionando el DOM) que el ícono de etiqueta del precio NO aparece como texto en ningún nombre accesible.
- **Tema claro/oscuro**: alternar `prefers-color-scheme` y confirmar que el hover del card y los inputs se ven bien en ambos.
- **`prefers-reduced-motion`**: emular esa preferencia en DevTools y confirmar que el hover del card, el foco de los inputs y el hover/active del botón "Cargar más" pierden su transición (el cambio de color/estado sigue ocurriendo, solo sin animación).
- **Breakpoints**: 320px (mobile), 768px (tablet), 1024px+ (desktop) — el grid y los filtros ya tenían este comportamiento responsive antes de este plan; confirmar que sigue intacto.

Expected: todo lo anterior se cumple, sin errores ni warnings nuevos en la consola del navegador.

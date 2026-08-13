# Rediseño visual: Catálogo de productos

**Fecha**: 2026-07-09
**Estado**: aprobado por Hernán, pendiente de plan de implementación

## Contexto

El Header, `LoginPage` y `SignupPage` ya pasaron por un rediseño visual (ver `docs/superpowers/specs/2026-07-09-ui-redesign-design.md`) que estableció un sistema: paleta violeta existente, tratamiento tipográfico de títulos, y el ícono de etiqueta (🏷) como firma de marca reutilizada vía pseudo-elemento `::before` (nunca como texto real, para no afectar el nombre accesible).

El catálogo de productos (`ProductsPage` y sus componentes: `ProductCard`, `ProductGrid`, `SearchBar`, `CategoryFilter`, `LoadMoreButton`) ya tiene estilos base funcionales en `index.css`, pero no pasó por esa misma mano de diseño: le falta el tratamiento tipográfico de "eyebrow" en las etiquetas, el estado de foco/hover consistente con los inputs de auth, y microinteracciones en los botones.

Este documento define esa segunda pasada, extendiendo el mismo sistema — no reemplazándolo.

## Objetivo

Consistencia visual entre el catálogo y el resto de la app (Header, auth), sin agregar tokens de diseño nuevos, sin librerías, sin cambiar la lógica de búsqueda/filtrado/paginación.

## Restricción no negociable: cero cambios de comportamiento

`ProductCard`, `ProductGrid`, `SearchBar`, `CategoryFilter`, `LoadMoreButton` y `ProductsPage` **no tienen tests dedicados** (solo `ProductsContext.test.tsx` y `productsService.test.ts` cubren la lógica de datos, no la UI). Esto da libertad para tocar JSX/CSS sin un test que se rompa, pero exige más disciplina manual:

- Ningún cambio puede alterar el comportamiento de búsqueda, filtrado o paginación — solo `className`s y estilos.
- Ningún cambio puede alterar el nombre accesible de ningún elemento (labels, botones, inputs) ni sus atributos `aria-*`/`htmlFor`/`id` ya existentes.
- El ícono de etiqueta junto al precio se implementa **siempre** vía `content` en un pseudo-elemento CSS (`::before`), igual que en el Header y el card de auth — nunca como texto real en el JSX.
- Como no hay tests automáticos para esta parte, la verificación incluye una revisión manual en el navegador más exhaustiva de lo habitual (ver sección Testing).

## Cambios por componente

### `ProductCard`

- `product-card__category` pasa a tratarse como "eyebrow": mayúsculas, `letter-spacing` positivo, tamaño reducido, color `--text-muted` — mismo patrón ya usado en `.form-field__label`.
- `product-card__price` gana el ícono de etiqueta (🏷) como `::before` decorativo, antes del monto.
- El hover del card se refina: en vez de solo `box-shadow`, se agrega una elevación sutil (`translateY` negativo pequeño) y el borde toma `--accent` en vez de quedarse en `--border`. Transición ya existente (`box-shadow 0.15s ease, transform 0.15s ease`) se reutiliza, ya tiene su bloque `prefers-reduced-motion` en `index.css`.

### `SearchBar` / `CategoryFilter`

- Los selectores `.search-bar input, .category-filter select` (hoy con estilo estático: borde `--border` fijo) ganan el mismo tratamiento de foco/hover que `.form-field__input`: borde `--accent` al hover, fondo `--accent-soft` al foco. Se extiende la regla ya existente en vez de duplicarla.

### `LoadMoreButton`

- Gana la misma microinteracción que `.auth-form__submit`: atenuación de opacidad al hover, achique sutil (`scale`) al `:active`, ambas con su contraparte en `@media (prefers-reduced-motion: reduce)`. El estado `disabled` (mientras `loading`) no cambia.

## Fuera de alcance (decisión explícita)

- **Imágenes de producto**: el modelo de datos (`Product`, `src/types/product.ts`) no tiene campo de imagen. Agregar una implicaría tocar Firestore y el script de seed — fuera del alcance de "mejorar la UI".
- **`LoadingState`/`EmptyState`/`ErrorState`**: se comparten con las páginas de auth (ya rediseñadas) y ya están alineados visualmente (el spinner ya usa `--accent`). No se tocan para no romper esa consistencia ya lograda.
- **Animación de entrada por card**: con potencialmente 20+ cards renderizando a la vez (paginación de a `PAGE_SIZE = 20`), una animación de entrada individual sería ruido visual, no un acierto de diseño — se descarta a propósito.
- **Restructuración de layout** (toolbar sticky, chips de categoría, etc.): más riesgo sin red de tests automática, y no aporta más que la consistencia visual que sí es el objetivo de esta pasada.

## Testing

Sin tests automáticos para estos componentes (ver restricción arriba). Verificación:
- `npx eslint . && npx tsc -b --noEmit && npx vitest run` — debe seguir en 311/311 (esta pasada no debería tocar ningún archivo con tests).
- `npm run build` — sin warnings nuevos.
- Revisión manual en el navegador contra el build real: catálogo completo (grid con productos, hover de card, foco por teclado en buscador/select/botón "Cargar más"), en mobile (320px)/tablet (768px)/desktop (1024px+), tema claro y oscuro, `prefers-reduced-motion` activado. Confirmar que buscar y filtrar por categoría siguen funcionando (comportamiento intacto, solo cambia el estilo).

## Archivos a tocar

- `src/index.css` (todas las reglas nuevas/extendidas)
- `src/components/ProductCard.tsx` (agregar `className`s, sin tocar JSX de texto)
- `src/components/SearchBar.tsx`, `src/components/CategoryFilter.tsx` (sin cambios de JSX esperados — solo CSS, ya tienen `className`s)
- `src/components/LoadMoreButton.tsx` (sin cambios de JSX esperados — solo CSS, ya tiene `className`)

Ningún archivo de test se crea ni se modifica.

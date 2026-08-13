# Rediseño visual: Header + Login/Signup

**Fecha**: 2026-07-09
**Estado**: aprobado por Hernán, pendiente de plan de implementación

## Contexto

El catálogo de productos (`index.css`) ya tiene un sistema de diseño real: variables CSS para paleta (claro/oscuro vía `prefers-color-scheme`), tipografía, estados de loading/error, grid responsive. El `Header`, `LoginPage`/`SignupPage` y sus formularios (`FormField`, `LoginForm`, `SignupForm`) no tienen ninguna clase CSS — son HTML sin estilizar, con el look por defecto del navegador.

Este documento define el rediseño visual de esas dos áreas, manteniendo intacta toda la lógica y accesibilidad ya construida.

## Objetivo

Estilo profesional y minimalista, mobile-first, que reutilice la paleta violeta existente en vez de reemplazarla. Sin librerías de UI ni fuentes externas (0 requests adicionales, 0 layout shift por fuente cargando tarde — coherente con el perfil de rendimiento del proyecto).

## Restricción no negociable: cero cambios de comportamiento

Todos los tests existentes (`Header.test.tsx`, `FormField.test.tsx`, `LoginForm.test.tsx`, `SignupForm.test.tsx`, `LoginPage.test.tsx`, `SignupPage.test.tsx`) consultan por **rol + nombre accesible + texto**, nunca por clase o estructura del DOM. Eso da libertad para agregar wrappers/clases, pero con un límite estricto:

- Ningún cambio puede alterar el **nombre accesible** de un elemento (ej: el link "Catálogo" tiene que seguir teniendo exactamente ese nombre accesible, no "🏷 Catálogo").
- Ningún cambio puede alterar el **texto visible** que los tests buscan (`"Cerrando sesión..."`, `"Iniciando sesión..."`, mensajes de error, etc.).
- Ningún cambio puede alterar **roles, estructura de labels (`htmlFor`/`id`), `aria-*` ya presentes**.

Consecuencia directa de diseño: el ícono de etiqueta (🏷, ver "Firma" más abajo) se implementa con `content` en un pseudo-elemento CSS (`::before`), nunca como texto real en el DOM — así nunca puede terminar formando parte del nombre accesible de un link o botón, y los tests no necesitan tocarse.

## Tokens de diseño

Se agregan a `:root` en `index.css`, sin tocar los tokens existentes:

```css
--surface-raised: /* superficie apenas más clara que --surface, para diferenciar
                      el card del formulario del fondo de la página */
--accent-soft: /* --accent al ~10-12% de opacidad, para fondos de hover/focus
                   sutiles en vez de solo cambiar el borde */
--shadow-card: /* sombra suave para el card de auth, distinta en claro/oscuro */
```

Cada uno se define dos veces (bloque `:root` y bloque `@media (prefers-color-scheme: dark)`), igual que los tokens actuales.

## Tipografía

Se mantiene `system-ui` (sin fuentes externas). La jerarquía visual sale de tratamiento, no de una tipografía distinta:

- **Títulos** (`h1`, marca del Header): peso 700, `letter-spacing` negativo (más apretado).
- **Etiquetas auxiliares** (categoría, hints de formulario, eyebrows): tamaño reducido, `text-transform: uppercase`, `letter-spacing` positivo, color `--text-muted`.

## Header

- Se vuelve `position: sticky; top: 0`, con `backdrop-filter: blur(...)` y fondo semitransparente sobre `--surface` para que el contenido se note por debajo al hacer scroll.
- El link "Catálogo" gana un ícono de etiqueta (🏷) como pseudo-elemento `::before` **decorativo**, sin afectar su nombre accesible ni sus tests.
- Los links de navegación ganan un subrayado que crece desde la izquierda al `:hover` (`transform: scaleX` sobre un pseudo-elemento, `transform-origin: left`), respetando `prefers-reduced-motion` (se desactiva la transición, el subrayado queda estático o ausente).
- Layout: en mobile se mantiene una sola fila con wrap si hace falta (no se introduce un menú hamburguesa — fuera de alcance, el nav actual es corto).

## Login / Signup

- Un solo card centrado (`max-width: ~420px`), sin layout split-screen. Fondo de página limpio (`--bg`), el card usa `--surface-raised` + `box-shadow: var(--shadow-card)` + `border-radius`.
- El card entra con una animación sutil al montar: `opacity` 0→1 + `translateY` 8px→0, ~150ms, respetando `prefers-reduced-motion` (sin animación si el usuario la tiene desactivada).
- Los inputs (`FormField`) y el botón de submit ganan el tratamiento visual ya usado en el catálogo (`--surface`, `--border`, `min-height: 44px`, `border-radius`), más el estado de foco/hover con `--accent-soft` como fondo sutil (el `outline` de foco visible definido globalmente en `:focus-visible` no se toca).
- El banner de error de sesión (`role="alert"`) y los errores de campo reusan los tokens `--error-*` ya existentes (mismo tratamiento visual que los estados de error del catálogo, para consistencia).
- El ícono de etiqueta se reutiliza, discreto, como acento decorativo en la esquina del card (mismo mecanismo `::before`, mismo criterio de no tocar accesibilidad).

## Fuera de alcance (decisión explícita, no un olvido)

- Catálogo de productos: ya tiene estilos base funcionales: se deja para una pasada futura si hace falta.
- `CartPage`/`CheckoutPage`/`AdminPage`: son placeholders (`<p>` con texto plano) que se van a reconstruir de fondo en una clase futura del bootcamp — estilizarlos ahora sería trabajo descartable.
- No se agrega ninguna librería (sin Tailwind, sin componentes de UI, sin fuentes de Google Fonts): todo en CSS plano sobre `index.css`, siguiendo el patrón ya usado.

## Testing

No se agregan tests nuevos (es un cambio puramente visual/CSS + `className`/wrappers). Se verifica que la suite completa existente (311 tests) sigue pasando sin modificaciones, más una revisión manual en el navegador (mobile 320px, tablet 768px, desktop 1024px+, tema claro y oscuro, `prefers-reduced-motion` activado) antes de dar el trabajo por terminado.

## Archivos a tocar

- `src/index.css` (tokens nuevos + estilos de Header y auth)
- `src/components/Header.tsx` (agregar `className`s, sin tocar JSX de texto/roles)
- `src/components/auth/FormField.tsx` (agregar `className`s)
- `src/components/auth/LoginForm.tsx` / `SignupForm.tsx` (agregar `className`s al `<form>`/wrapper)
- `src/pages/LoginPage.tsx` / `SignupPage.tsx` (agregar `className`s al contenedor del card)

Ningún archivo de test se modifica.

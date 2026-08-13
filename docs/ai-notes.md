# Notas de uso de IA — Catálogo escalable

Este documento deja evidencia de cómo se usó IA (Claude) durante el desarrollo: los prompts obligatorios del enunciado, un resumen de las respuestas, y qué se aceptó/rechazó de cada una y por qué. También incluye decisiones de arquitectura que surgieron durante la implementación real (no solo de los prompts "oficiales"), porque fueron parte real del proceso de auditoría con IA.

---

## Prompt 1 — getDocs vs onSnapshot (arquitectura y costo)

**Prompt (copiado tal cual del enunciado):**
> Estoy implementando un catálogo de productos en React+TS con Firestore. Necesito filtros por categoría, búsqueda por prefijo y paginación con "Cargar más". ¿Por qué conviene usar getDocs en vez de onSnapshot para este caso? Considerá costo de lecturas, UX, y simplicidad. Respondé con pros/contras y una recomendación final.

**Resumen de la respuesta:**

| | `getDocs` (lectura puntual) | `onSnapshot` (listener en tiempo real) |
|---|---|---|
| Costo | Predecible: una lectura por consulta explícita | Menos predecible: cada escritura que matchea la query recalcula el snapshot y cuenta como lectura adicional |
| Paginación con cursor | Encaja naturalmente: cada "página" es una llamada puntual con `startAfter(lastDoc)` | Se complica: el listener se re-dispara solo con cambios en tiempo real, hay que gestionar múltiples suscripciones por página o acumular estado manualmente |
| UX | Suficiente para un catálogo de lectura — el usuario dispara la carga (filtro, búsqueda, "cargar más") | Da actualizaciones en vivo si otro usuario cambia datos, pero eso no es un requisito de este catálogo |
| Simplicidad | Menos código: no hay que gestionar `unsubscribe()` en cleanup de cada página | Requiere manejar la desuscripción correctamente en cada `useEffect` para evitar leaks |

**Recomendación final de la IA:** usar `getDocs` para este caso — el catálogo es de solo lectura, no necesita sincronización en tiempo real, y la combinación filtro+búsqueda+paginación por cursor es mucho más simple de razonar con lecturas puntuales. `onSnapshot` tendría sentido en una pantalla donde la actualización en vivo es parte del valor del producto (ej: un dashboard colaborativo o un carrito compartido), no en un catálogo de navegación.

**Decisión: ACEPTADO.** Todo el proyecto usa `getDocs` (`src/services/productsService.ts`). No se usó `onSnapshot` en ningún punto.

---

## Prompt 2 — Validación de query, cursores e índices

**Prompt (copiado tal cual del enunciado):**
> Estoy armando una query en Firestore para: where(categoryId == X) opcional, orderBy(nameLower), búsqueda por prefijo con startAt(prefix) y endAt(prefix + ''), y paginación con limit(20) + startAfter(lastDoc DocumentSnapshot). ¿Qué errores típicos puedo cometer (duplicados, índices faltantes, orderBy inconsistente)? ¿Qué índices podrían ser necesarios y cómo se resuelve "Missing index" correctamente?

**Resumen de la respuesta:**
- **Duplicados**: usar `startAt(cursor)` en vez de `startAfter(cursor)` para "cargar más" repite el último documento de la página anterior, porque `startAt` es inclusivo y `startAfter` es exclusivo.
- **`orderBy` inconsistente**: si la query "sin búsqueda" no ordena por el mismo campo que la query "con búsqueda" (`nameLower`), el cursor (`lastDoc`) deja de tener sentido entre una página y la siguiente — hay que ordenar siempre por `nameLower`, haya o no búsqueda activa.
- **Índices compuestos faltantes**: combinar `where('categoryId', '==', ...)` con `orderBy('nameLower')` (más el rango de prefijo) requiere un índice compuesto que Firestore no crea automáticamente. La consulta falla con un error `failed-precondition` que incluye un link directo a la consola para crearlo con un click; el índice tarda 1-2 minutos en construirse.
- **Cursor por snapshot vs por valores de campo**: `startAfter` acepta un `DocumentSnapshot` completo (más robusto) o una lista de valores de campo en el mismo orden que el `orderBy` — mezclar ambos enfoques entre páginas rompe la paginación.

**Decisión: ACEPTADO, con evidencia real.** Durante la verificación manual de este proyecto, justo se disparó el error real de "missing index" al combinar filtro de categoría + búsqueda por prefijo (que no se había probado en conjunto hasta ese momento). Se resolvió siguiendo exactamente el flujo que describe esta respuesta: Firestore mostró el link, se creó el índice desde la consola, y la consulta combinada funcionó sin más cambios de código. Esto confirma que la recomendación era correcta y no solo teórica.

---

## Prompt opcional — Code review del service/context

**Prompt (copiado tal cual del enunciado):**
> Te paso las firmas y responsabilidades: ProductsService.listProducts(params) devuelve items + lastDoc; ProductsContext tiene loadFirstPage/loadMore, separa loading y loadingMore, resetea al cambiar params y deduplica por id. ¿Qué mejorarías sin agregar librerías ni salirte del alcance?

**Resumen de la respuesta / sugerencias recibidas:**
1. Tipar el `FirestoreDataConverter` con **dos genéricos** (`<Product, ProductDoc>`) en vez de uno solo, para distinguir explícitamente el modelo de dominio del modelo crudo de Firestore (sin `id`).
2. Evitar deduplicar con `.filter()` + `.findIndex()` (O(n²)) y usar un `Map` indexado por `id` (O(n)) al combinar páginas.
3. Guardar los parámetros vigentes (filtro/búsqueda) en un `ref`, no en el estado, ya que `loadMore` los necesita pero no deberían disparar un re-render por sí solos.
4. No memoizar el `value` del context de entrada — priorizar código simple y correcto primero; memoizar solo si aparece un problema de performance medible.

**Decisiones:**
- **ACEPTADO (1)**: se implementó `FirestoreDataConverter<Product, ProductDoc>` con los dos genéricos en `productsService.ts`.
- **ACEPTADO (2)**: `mergeUniqueById` en `ProductsContext.tsx` usa `Map`, no `filter`/`findIndex`.
- **ACEPTADO (3)**: `currentParamsRef` es un `useRef`, no un `useState`.
- **ACEPTADO (4)**: el `value` del `ProductsProvider` no está memoizado a propósito; es una decisión consciente de simplicidad para el alcance de esta homework, documentada como código a revisar si en el futuro se detectan re-renders innecesarios.

---

## Otras decisiones tomadas durante el desarrollo (con auditoría de IA)

Estas no vinieron de los tres prompts de arriba, sino de decisiones de diseño e implementación que se discutieron y verificaron en el momento, con el mismo criterio de "aceptar o rechazar con justificación".

### Aceptadas

- **Estructura de carpetas plana** (`types/`, `services/`, `contexts/`, `hooks/`, `components/`, `pages/`) en vez del patrón `features/`. Justificación: el proyecto tiene un solo dominio (productos); `features/products/...` agregaría un nivel de anidación sin beneficio real a este alcance.
- **`useProducts()` vive en el mismo archivo que `ProductsProvider`** (no en un archivo aparte en `hooks/`), por simplicidad. Esto dispara la regla de lint `react-refresh/only-export-components` (afecta granularidad de Fast Refresh en desarrollo); se silenció puntualmente con un comentario explicando el motivo, en vez de desactivar la regla globalmente.
- **`toFirestore` del converter lanza un error explícito** en vez de intentar mapear campos: la interfaz `FirestoreDataConverter` exige implementarlo, pero este catálogo nunca escribe productos desde el frontend (es de solo lectura). Se descubrió durante la implementación que un intento de mapeo con destructuring no compilaba (la interfaz tiene dos firmas superpuestas para escrituras completas y parciales); en vez de forzar los tipos, se optó por la solución más simple y honesta.
- **`endAt(prefix + '')`** con el carácter Unicode de "fin de rango", tal como documenta Firebase oficialmente. Nota curiosa: ese carácter pertenece a un rango Unicode de uso privado y no tiene glifo visible, por lo que en el editor y en las herramientas de lectura de archivos aparece "vacío" — se verificó a nivel de bytes (codificación UTF-8 `EF A3 BF`) que el carácter correcto sí estaba presente antes de asumir que había un bug.
- **Script de seed con su propia inicialización de Firebase y su propia carga de variables de entorno** (no reutiliza `src/lib/firebase.ts` ni importa directamente `src/lib/env.ts`). Motivo técnico real: el script corre con Node bajo resolución de módulos `nodenext` (exige extensión `.js` en imports relativos), mientras que el resto de la app usa la resolución `bundler` de Vite (extensión opcional); además `env.ts` lee `import.meta.env`, que solo existe en el contexto de Vite, no en un script de Node plano. Se extrajo el schema de Zod a `src/lib/envSchema.ts` (sin efectos secundarios) para que ambos entornos lo reutilicen sin duplicar la lista de variables, y el script carga `.env` con `process.loadEnvFile()` (API nativa de Node) parseando contra `process.env`.
- **Categorías centralizadas en `src/constants/categories.ts`**, usadas tanto por `CategoryFilter` (UI) como por `scripts/seed.ts` (datos), para que nunca queden desincronizadas.
- **Reglas de Firestore abiertas (`allow read, write: if true`) sin fecha de expiración**, en vez del "modo de prueba" estándar (que expira solo). Aceptado únicamente porque este proyecto es una entrega educativa que no se va a desplegar públicamente ni subir a un repositorio compartido; si se reutilizara el proyecto Firebase para algo real, habría que volver a poner reglas con expiración o basadas en autenticación.

### Rechazadas (fuera de alcance, tal como pide el enunciado)

- **Full-text / fuzzy search / "contains"**: Firestore no lo soporta nativamente; se necesitaría un servicio externo (Algolia, Meilisearch, Typesense). Mencionado solo como alternativa conceptual, nunca implementado.
- **Paginación hacia atrás (`endBefore`/`limitToLast`)**: fuera del alcance del enunciado.
- **Infinite scroll**: se implementó con botón "Cargar más", tal como pide el enunciado.
- **Optimistic UI**: no aplica a un catálogo de solo lectura.
- **TanStack Query / Zustand**: Context API alcanza para un solo dominio de datos server-side con esta complejidad; se dejó como alternativa descartada, no como necesidad futura inmediata.
- **`onSnapshot`**: ver Prompt 1.

---

## Revisión de código con IA (post-implementación)

Una vez terminada la implementación (con todos los escenarios verificados manualmente en el navegador), se corrió una revisión de código asistida por IA sobre todo `src/` y `scripts/` — 8 agentes en paralelo cubriendo ángulos distintos (correctness línea por línea, comportamiento eliminado, rastreo cruzado entre archivos, reutilización, simplificación, eficiencia, "altitude"/profundidad de la solución, y cumplimiento de las reglas del CLAUDE.md), seguido de una verificación independiente de cada candidato antes de aceptarlo.

### Falso positivo notable (rechazado tras verificar)

Tres de los ocho agentes marcaron de forma independiente `endAt(prefix + '')` en `productsService.ts` como un bug ("falta el carácter, es un string vacío"). Se verificó con `charCodeAt` a nivel de bytes: el carácter Unicode `U+F8FF` está presente y es correcto — simplemente no tiene glifo visible en ningún editor o terminal (es un carácter del rango "uso privado" de Unicode), por lo que tanto humanos como IAs leyendo el archivo lo perciben como "vacío" sin estarlo. **Rechazado**: no se tocó ese código. Se documenta como advertencia para quien revise este archivo en el futuro (un profesor, otra herramienta) y se confunda con el mismo espejismo.

### Hallazgos confirmados y aceptados

1. **Race condition en `loadFirstPage`** (`ProductsContext.tsx`): si el usuario cambiaba de filtro antes de que resolviera la consulta anterior, y la respuesta vieja resolvía después que la nueva, pisaba el estado con datos que ya no correspondían al filtro visible — violaba el requisito explícito del enunciado de "no mezclar resultados" al cambiar filtros. **Aceptado**: se agregó un contador de "generación" (`requestIdRef`) que descarta respuestas que quedaron obsoletas.
2. **Mismo problema en `loadMore`**: una página pedida antes de cambiar de filtro podía mezclarse con los resultados del filtro nuevo y corromper el cursor de paginación. **Aceptado**: mismo mecanismo de generación aplicado.
3. **Flash de `EmptyState` antes de `LoadingState`**: `initialState.loading` arrancaba en `false`, así que había un instante (antes de que el `useEffect` disparara la primera carga) donde se pintaba "Todavía no hay productos" en vez del spinner, anunciado de más a lectores de pantalla por el `aria-live="polite"`. **Aceptado**: `initialState.loading` ahora arranca en `true`.
4. **Duplicación de la búsqueda `categoryId → label`** entre `ProductCard.tsx` y `ProductsPage.tsx`. **Aceptado**: se extrajo `getCategoryLabel()` a `constants/categories.ts`.
5. **Magic number duplicado** (`2`, el mínimo de caracteres de búsqueda) entre `ProductsPage.tsx` (ya lo tenía como constante) y `productsService.ts` (lo repetía crudo) — violación directa de la regla "no magic numbers" del CLAUDE.md. **Aceptado**: constante `MIN_SEARCH_CHARS` centralizada en `constants/search.ts`.
6. **Guard de `loadMore` vulnerable a doble-click**: leía `state.loadingMore`, que solo se actualiza en el próximo render de React, no al instante. Un doble click muy rápido podía disparar dos lecturas a Firestore para la misma página. **Aceptado**: reemplazado por un `useRef` que se lee/escribe sincrónicamente.

Se agregaron 2 tests de regresión nuevos en `ProductsContext.test.tsx` que simulan resolución de promesas fuera de orden — reproducen exactamente los escenarios de los hallazgos 1 y 2, y fallarían sin el fix aplicado.

# Production Checklist — E-commerce Release Candidate

**URL de producción:** https://homework-l7-release-candidate-del-e.vercel.app/
**Repositorio:** https://github.com/HRamiroAlbornoz/Homework-L7-Release-Candidate-del-E-commerce
**Fecha de verificación:** 13 de agosto de 2026

> Cada ítem marcado en este documento se **ejecutó**, no se dio por supuesto. Donde hubo algo que resolver, queda la nota.

---

## Build & Quality Gates

- [x] `npm run build` pasa localmente
  > 208 módulos, sin errores. El aviso sobre el tamaño del chunk de Firebase (~567 kB) está diagnosticado desde el Homework L4: es el peso irreducible del SDK, ya aislado en su propio chunk para que el navegador pueda cachearlo aparte del código de la app.

- [x] `npm run test` pasa (3 corridas seguidas)
  > 23 archivos, 417 tests, verde en las tres. Salida completa en [`docs/test-output.txt`](docs/test-output.txt).

- [x] `npm run lint` y `npx tsc -b --noEmit` sin errores
  > El type-check cubre los tres proyectos declarados en `tsconfig.json`: `src/`, `scripts/` y `api/`.
  > **Nota:** `api/` no estaba cubierto por ningún proyecto de TypeScript. Los errores de tipos del código que maneja los secretos habrían aparecido recién en producción. Se creó `tsconfig.api.json` y se verificó introduciendo un error a propósito para confirmar que ahora sí lo detecta.

- [x] Tests deterministas (sin llamadas reales a internet, Firebase o S3)
  > Firebase se mockea con `vi.mock`; las requests HTTP las intercepta MSW con `onUnhandledRequest: "error"`, así que cualquier request sin handler **rompe** el test en lugar de salir a la red.

- [x] **La suite pasa con el Wi-Fi desconectado**
  > Verificado cortando la conexión de red por completo: **390 tests en verde, 17.83s** — prácticamente el mismo tiempo que con internet, lo que confirma que ningún test estaba esperando una respuesta remota.
  >
  > (Eran 390 al momento de esa medición; los 27 tests que se sumaron después, al corregir los hallazgos del code review, tampoco tocan la red: mockean el SDK o usan MSW.)
  >
  > Dos verificaciones más apuntan a lo mismo desde otro ángulo: la suite pasa **sin archivo `.env`**, y el CI la corre en una máquina limpia sin ningún secreto configurado.

- [x] CI en verde antes de cada merge
  > GitHub Actions corre lint, type-check, tests y build en cada push y pull request. Ningún PR se mergeó en rojo.

---

## Seguridad & Variables de Entorno

- [x] No hay secretos en el repositorio
  > `.env` está en `.gitignore` (verificado con `git check-ignore -v .env` **antes** del primer commit, no después: un secreto commiteado queda en el historial para siempre aunque se borre luego).

- [x] `.env.example` documenta todas las variables, sin valores reales

- [x] Las variables públicas usan `VITE_` y se consumen con `import.meta.env`
  > Las 6 de configuración de Firebase. Son públicas **por diseño**: identifican al proyecto, no autorizan nada. Lo que protege los datos es `firestore.rules`, no ocultar estos valores.

- [x] Los secretos NO usan `VITE_` y solo se leen en el servidor con `process.env`
  > `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID` y `S3_SECRET_ACCESS_KEY`, leídas únicamente por `api/uploads/presign.ts`.
  > **Nota:** no se pueden llamar `AWS_ACCESS_KEY_ID` ni `AWS_SECRET_ACCESS_KEY`. Las Vercel Functions corren sobre AWS Lambda, donde esos nombres están **reservados por el runtime** y serían pisados. De ahí el prefijo `S3_`.

- [x] **Se buscaron los secretos en el bundle de producción antes de deployar**
  > `npm run build` seguido de un grep sobre `dist/` con los patrones `AKIA`, `S3_SECRET`, `S3_ACCESS`, `SECRET_ACCESS_KEY`, `BEGIN PRIVATE KEY`, `service_account`, `private_key` y `firebase-adminsdk`: **0 coincidencias**.
  > El resultado negativo se validó buscando también el id del proyecto de Firebase —que sí debe estar— y encontrándolo. Sin esa contraprueba, un "no encontré nada" no distingue entre "no hay secretos" y "el método no busca bien".

- [x] Variables cargadas en **todos** los entornos de Vercel (Production, Preview y Development)
  > Olvidar Preview hace fallar los deploys de rama con una pantalla en blanco mientras producción funciona: un síntoma que no señala la causa.

- [x] Se redeployó después de cargar las variables
  > Las variables de entorno **no se aplican a deploys ya construidos**. El build existente sigue sin ellas hasta que se reconstruya.

- [x] La credencial de AWS tiene el mínimo privilegio posible
  > El usuario IAM `l7-ecommerce-presign` solo puede `s3:PutObject`, y solo bajo `products/*` de un único bucket. No puede leer, listar ni borrar. Si se filtrara, el daño posible es acotado.

- [x] La URL firmada es de corta duración y con el `Content-Type` firmado
  > `expiresIn: 300` (5 minutos) y `signableHeaders: new Set(["content-type"])`. Sin lo segundo, el cliente podría subir declarando cualquier tipo y saltearse la whitelist de imágenes.

- [x] El endpoint de subida verifica identidad y permisos
  > 401 si falta el token o es inválido, 403 si el usuario no es admin, 400 si los datos no cumplen. Los tres verificados contra producción.

- [x] Las reglas de Firestore están desplegadas y son la protección real
  > `firebase deploy --only firestore:rules,firestore:indexes`. Impiden que un usuario se autoasigne el rol admin, que cree órdenes a nombre de otro, y validan la forma de cada documento.

- [x] Se corrigieron los hallazgos de dos rondas de code review
  > Once hallazgos en total (5 sobre la Vercel Function, 6 sobre el resto), todos corregidos y cubiertos con tests. Ver la sección de notas de debugging.

- [ ] **El precio de la orden se calcula en el servidor**
  > **No implementado.** Es la limitación de seguridad conocida de este release candidate.
  >
  > **El riesgo, con precisión:** el precio de cada ítem viaja desde el navegador. Un usuario logueado que edite `ecommerce:cart:v1` en su `localStorage` puede registrar una orden con precios más bajos que los del catálogo.
  >
  > **Lo que sí se cerró** (verificado en producción manipulando el `localStorage` a propósito): no puede hacerla por $0 (`totalPrice > 0`), no puede inyectar campos que la app no espera como un `paid: true` (`keys().hasOnly`), y no puede inflar el documento (tope de 50 líneas). El intento se rechaza con un mensaje genérico, que no le revela a quien lo intenta qué fue lo que se detectó.
  >
  > **Por qué no alcanza con las reglas:** el lenguaje de `firestore.rules` no permite recorrer un array ni sumar sus elementos, así que es imposible verificar ahí que `totalPrice` coincida con los ítems, ni que cada precio sea el del catálogo.
  >
  > **La solución completa:** una Vercel Function que reciba únicamente ids y cantidades, lea los precios desde el catálogo, calcule el total y escriba la orden con el SDK de Admin. La regla pasaría entonces a `allow create: if false`, porque el cliente dejaría de escribir órdenes.

- [ ] Vulnerabilidades de dependencias resueltas
  > **Quedan 6 moderadas**, todas la misma: `uuid` a través de `firebase-admin → @google-cloud/storage`. Se dejan a conciencia:
  > 1. Son **moderadas**, no altas ni críticas.
  > 2. El fallo es un chequeo de límites en `uuid` v3/v5/v6 **cuando se le pasa un buffer propio**, algo que ni `firebase-admin` ni este código hacen.
  > 3. El único arreglo disponible sería bajar `firebase-admin` de la 14 a la 10, lo cual es peor que el problema.
  > 4. `firebase-admin` es **devDependency**: solo lo usa `scripts/seed.ts`, que corre localmente. **No se instala en producción.**
  >
  > Las 7 vulnerabilidades **altas** que aparecieron al instalar dependencias sí se resolvieron, quitando `@vercel/node` (ver notas de debugging).

---

## App Smoke Tests (Production)

Verificados sobre la URL de producción, con la consola del navegador abierta.

- [x] La home/catálogo carga sin errores
  > 20 productos desde Firestore, con paginación y búsqueda.

- [x] Los deep links funcionan (`/cart`, `/checkout`, `/admin`)
  > Sin 404: el rewrite de `vercel.json` devuelve `index.html` para cualquier ruta y React Router resuelve el resto.

- [x] Registro, login y logout funcionan
  > **Nota:** hubo que agregar el dominio de Vercel en Firebase Console → Authentication → Configuración → Dominios autorizados. Sin eso el login falla en producción con `auth/unauthorized-domain` aunque las credenciales sean correctas.

- [x] El perfil nuevo se crea con rol `customer` forzado por las reglas

- [x] Carrito: agregar, cambiar cantidad, eliminar y vaciar con confirmación
  > La confirmación de vaciado nombra los productos que se van a perder.

- [x] El carrito persiste entre navegaciones y recargas (`localStorage`)

- [x] Checkout crea una orden real y muestra la confirmación
  > Orden `5VGoWnWBDMyUKHfEGgUX` creada en Firestore. Valida de punta a punta las reglas desplegadas: `userId == request.auth.uid`, `status == 'created'` y `createdAt == request.time`.

- [x] El carrito se vacía **solo** si la compra se registró

- [x] Un usuario `customer` no puede acceder al panel de administración
  > Verificado con una cuenta de prueba de rol `customer`: `/admin` redirige a `/`, y el link tampoco aparece en el header.

- [x] Admin crea un producto con imagen
  > Secuencia verificada en la pestaña Network: `POST /api/uploads/presign` (200) → `PUT` a S3 (200) → escritura en Firestore (200) → `GET` público de la imagen (200). El producto aparece en el catálogo con su imagen.

- [x] Consola del navegador sin errores ni advertencias en todos los flujos

---

## Observabilidad mínima (manual)

- [x] Se revisó la pestaña Network ante fallos
  > Fue lo que confirmó el orden de las requests del flujo de subida y que el `PUT` a S3 devolvía 200.

- [x] Se revisaron los logs de Vercel (Build / Runtime / Functions) ante fallos
  > **Fue determinante.** Los dos errores de la Vercel Function devolvían al cliente un `500 FUNCTION_INVOCATION_FAILED` sin ningún detalle — a propósito, para no filtrar información interna. La causa real (`ERR_MODULE_NOT_FOUND` y después `ERR_REQUIRE_ESM`) solo estaba en los logs del servidor.

- [x] Se verificó que el commit desplegado coincide con el HEAD de `main`
  > ```bash
  > gh api repos/HRamiroAlbornoz/Homework-L7-Release-Candidate-del-E-commerce/deployments \
  >   --jq '[.[] | select(.environment=="Production")][0].ref[0:7]'
  > git rev-parse --short HEAD
  > ```
  > **Nota:** este chequeo se agregó porque el problema ocurrió de verdad (ver nota de debugging 3).

---

## Plan de rollback

Si un deploy rompe producción:

1. **Vercel → Deployments → el último deployment estable → ⋯ → Promote to Production.** Es instantáneo: reusa un build que ya existe, sin recompilar.
2. Si el problema está en las reglas de Firestore, `firebase deploy --only firestore:rules` desde un commit anterior.
3. Recién después, investigar con calma sobre una rama.

El orden importa: primero se restablece el servicio, después se busca la causa.

---

## Notas de debugging

### 1. La función crasheaba con `ERR_MODULE_NOT_FOUND`

**Síntoma:** todo el endpoint devolvía `500 FUNCTION_INVOCATION_FAILED`, sin detalle.

**Causa:** `package.json` declara `"type": "module"`, así que la función corre como ESM. El resolvedor de ESM de Node **no completa extensiones**, y el import era `from "../../src/constants/uploads"`. Vite sí las completa, y por eso en desarrollo nunca se notó.

**Corrección:** `from "../../src/constants/uploads.js"` — con la extensión del archivo **compilado**, que es el que existe en tiempo de ejecución.

**Por qué ningún test lo detectó:** los tests con MSW interceptan la request HTTP y devuelven una respuesta falsa, así que **el código de la función nunca se ejecuta**. Los tests cubren el contrato entre el frontend y el endpoint, no el interior del endpoint. Solo un smoke test contra el despliegue real podía encontrarlo.

### 2. `ERR_REQUIRE_ESM` por una dependencia de `firebase-admin`

**Síntoma:** el mismo 500 opaco, con otra causa en los logs.

**Causa:** `firebase-admin` → `jwks-rsa` (CommonJS) → `require("jose")`, pero `jose` 6 es **solo ESM**. Node 24 admite `require()` de ESM; el runtime de las Vercel Functions no.

**Corrección:** se sacó `firebase-admin` de la función y se verifica el token con `jose` directamente. El rol se lee por la API REST de Firestore **con el token del propio usuario**, así que quien autoriza es `firestore.rules` y no un SDK con acceso total.

**Beneficio inesperado:** desapareció la necesidad de tener el service account en Vercel. Una credencial con acceso total al proyecto que deja de vivir en un servidor es una superficie de ataque menos.

### 3. Un merge en verde con producción sirviendo código viejo

**Síntoma:** PR mergeado, CI en verde, y el endpoint seguía fallando igual.

**Causa:** Vercel no disparó el build de producción. El árbol de archivos del merge era idéntico al de un Preview que ya existía, así que dedupllicó el build — pero tampoco movió el alias de producción. Nada lo señalaba: ni error, ni deploy fallido, ni aviso.

**Corrección:** promover el Preview a Production desde el dashboard.

**Lección, ahora en el checklist:** "el CI está verde y mergeé" **no** significa "producción tiene mi código". La verificación correcta es comparar el commit desplegado contra el HEAD de `main`.

### 4. Conflicto de git imposible de resolver tras un squash merge

**Síntoma:** `gh pr merge` respondía *"the merge commit cannot be cleanly created"* en un PR de un solo archivo.

**Causa:** el `--squash` del PR anterior comprimió 18 commits en uno solo sobre `main`; los originales nunca llegaron ahí. Al seguir trabajando sobre la misma rama, git veía dos historias independientes tocando los mismos archivos.

**Corrección:** reconstruir la rama sobre `main` (`git checkout -B rama origin/main`) y traer solo el commit de la corrección con `cherry-pick`.

**Regla que lo evita:** después de un squash merge, la rama se descarta. Rama nueva desde `main` actualizado para cada PR.

### 5. Fallo intermitente local: la suite entera no carga (solo en Windows)

**Síntoma:** ocasionalmente, `npm run test` reporta que **los 22 archivos fallaron** y `Tests no tests`, con un error apuntando al `afterEach` de `src/test/setup.ts` (*"Vitest failed to find the current suite"*). La corrida siguiente pasa en verde sin tocar nada.

**Lo que se pudo determinar con evidencia:**

- Ocurrió **5 veces**, siempre en la ejecución **inmediatamente posterior a escribir varios archivos**.
- Nunca ocurrió en una corrida aislada: entre incidentes se encadenaron más de 20 ejecuciones limpias seguidas.
- **Nunca ocurrió en el CI** (Ubuntu), en ninguna de sus corridas.
- No se pudo reproducir a demanda, ni editando un archivo y ejecutando de inmediato, ni forzando la recompilación con `touch`.

**Hipótesis (no confirmada):** una carrera entre el proceso que escribe los archivos y Vitest leyéndolos. El error señala un hook sin suite a la que engancharse, que es lo que ocurre cuando **ningún archivo de test pudo evaluarse**. En Windows, el antivirus bloquea brevemente los archivos recién escritos para escanearlos, lo que explicaría la intermitencia, la exclusividad de la plataforma y la imposibilidad de reproducirlo a voluntad.

**Estado:** no afecta a la entrega. El CI —que descarga los archivos una vez y recién después ejecuta, sin escrituras concurrentes— nunca lo manifestó. Si aparece localmente, volver a correr la suite.

Se registra igual, y sin conclusión forzada: **un problema que no se pudo reproducir se documenta como hipótesis, no como causa.** Escribir "era el antivirus" sin haberlo demostrado le haría creer al próximo que el asunto está cerrado.

### 6. Un total de $0 registrable manipulando el localStorage

**Detectado por:** code review (`/code-review high 1`), no por los tests.

**Causa:** la regla de creación de `orders` validaba `totalPrice >= 0` y no restringía qué campos podía traer el documento. Y una defensa propia lo volvía invisible: `loadCartState` recalcula los totales a partir de los ítems, así que un `unitPrice: 0` editado a mano en el `localStorage` producía un estado **internamente coherente** que pasaba la validación de Zod sin problema.

La lección: **recalcular no es lo mismo que verificar.** Los totales eran consistentes con los ítems; lo que nunca se comprobó fue que los ítems tuvieran el precio real.

**Corrección:** `keys().hasOnly([...])` para rechazar campos ajenos, tope de 50 líneas por orden, y `totalPrice > 0`.

**Verificado en producción**, en las dos direcciones:

| Escenario | Resultado |
|---|---|
| Compra legítima de $75.410 | Orden `oo4OoRqye0rLpluUj0zr` creada ✅ |
| `localStorage` manipulado a `unitPrice: 0` | Rechazado por Firestore, con mensaje genérico ✅ |

**Lo que queda abierto:** los precios distintos de cero siguen viniendo del cliente. Ver el ítem sin tildar en la sección de seguridad.

### 7. Una configuración de TypeScript que permitía el bug de la nota 1

**Detectado por:** code review, al revisar `tsconfig.api.json`.

**Causa:** `moduleResolution: "bundler"` para código que corre como ESM real de Node. Con esa opción, un import relativo sin extensión pasa `tsc`, el lint y el CI, y recién falla en producción — que es exactamente lo que había ocurrido en la nota 1, corregido a mano sin tocar la causa.

**Corrección:** `nodenext`. Verificado quitando la extensión a propósito:

```
error TS2835: Relative import paths need explicit file extensions in ECMAScript
imports when '--moduleResolution' is 'node16' or 'nodenext'.
Did you mean '../../src/constants/uploads.js'?
```

Es la nota más útil de todas, porque no arregla un error: **elimina la posibilidad de cometerlo**. Arreglar el bug sin arreglar lo que lo permitió deja el mismo bug esperando a la próxima persona.

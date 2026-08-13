import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // El SDK de Firebase (Auth + Firestore) pesa ~567kB minificado (~167kB
    // gzipped) por sí solo. Separarlo del código propio de la app no baja el
    // peso total que descarga el navegador, pero sí trae dos beneficios
    // reales: el navegador puede cachear ese chunk de forma independiente
    // (cambia solo cuando se actualiza la versión de Firebase, no en cada
    // deploy de la app), y el chunk de código propio bajó de 883kB a 316kB,
    // quedando por debajo del umbral por primera vez. `manualChunks` está
    // deprecado en Vite 8 (Rolldown); la forma actual es `codeSplitting.groups`.
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            {
              name: 'firebase-vendor',
              test: /[\\/]node_modules[\\/](@firebase|firebase)[\\/]/,
            },
          ],
        },
      },
    },
    // El chunk de firebase-vendor (~567kB) sigue superando el umbral default
    // de 500kB, pero ya no es "código nuestro creciendo sin control": es el
    // peso real e irreducible del SDK completo de Auth + Firestore, ya
    // aislado en su propio chunk (ver arriba). Subir el límite acá evita que
    // Vite siga avisando sobre algo ya diagnosticado y sin margen de mejora
    // real dentro del alcance de este proyecto, sin ocultar una regresión
    // futura: si el chunk de la APP (no el de vendor) volviera a crecer más
    // allá de 600kB, el warning volvería a aparecer.
    chunkSizeWarningLimit: 600,
  },
  test: {
    // jsdom simula un DOM de navegador: lo necesitan los tests de hooks/componentes.
    environment: 'jsdom',
    // Matchers de jest-dom (toBeInTheDocument, etc.) + limpieza del DOM entre tests.
    setupFiles: ['./src/setupTests.ts'],
    // .worktrees/ contiene checkouts completos del proyecto (superpowers:using-git-worktrees):
    // sin esto, vitest corre también los tests de esas copias como si fueran del repo actual.
    exclude: [...configDefaults.exclude, '.worktrees/**'],
  },
})

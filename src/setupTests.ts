import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Registra los matchers de jest-dom (toBeInTheDocument, etc.) en el "expect"
// de Vitest, y desmonta cada componente renderizado después de cada test.
// Sin este cleanup explícito, los renders de un test quedan pegados en el
// DOM del siguiente (este proyecto no usa "test.globals: true", así que
// @testing-library/react no detecta un "afterEach" global para hacerlo solo).
afterEach(() => {
  cleanup();
});

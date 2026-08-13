import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./contexts/AuthContext.tsx";

// AuthProvider envuelve toda la app (adentro de BrowserRouter): así useAuth()
// está disponible en cualquier ruta, incluidos el Header y los guards
// (ProtectedRoute/AdminRoute), sin importar qué página esté activa.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);

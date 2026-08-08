import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./styles/japandi-theme.css";
import "./styles/dashboard.css";
import "katex/dist/katex.min.css";
import "@/services/i18n";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);

if ("serviceWorker" in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("[Service Worker] Registered with scope:", reg.scope))
        .catch((err) => console.error("[Service Worker] Registration failed:", err));
    });
  } else {
    // In development mode, unregister active service worker to prevent stale dev caching
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    });
  }
}

// Detect PWA standalone mode and apply class to html element
if (
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone
) {
  document.documentElement.classList.add("pwa-standalone");
}



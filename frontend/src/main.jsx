import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./styles/japandi-theme.css";
import "katex/dist/katex.min.css";
import "@/services/i18n";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => console.log("[Service Worker] Registered with scope:", reg.scope))
      .catch((err) => console.error("[Service Worker] Registration failed:", err));
  });
}

// Detect PWA standalone mode and apply class to html element
if (
  window.matchMedia("(display-mode: standalone)").matches ||
  window.navigator.standalone
) {
  document.documentElement.classList.add("pwa-standalone");
}



import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { ToastProvider } from "@/components/ui/toast";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);

// Fade out the indigo splash once the app has rendered (shown for at least ~0.7 s).
const splash = document.getElementById("splash");
if (splash) {
  const started = performance.now();
  requestAnimationFrame(() =>
    setTimeout(() => {
      splash.style.opacity = "0";
      setTimeout(() => splash.remove(), 400);
    }, Math.max(0, 700 - (performance.now() - started))),
  );
}

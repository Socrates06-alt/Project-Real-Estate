import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "@/app/App";
import { ToastProvider } from "@/shared/ui/toast";
import "@/shared/styles/index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);

// Fade out the indigo splash as soon as the app has rendered (no minimum wait).
const splash = document.getElementById("splash");
if (splash) {
  requestAnimationFrame(() => {
    splash.style.opacity = "0";
    setTimeout(() => splash.remove(), 160);
  });
}

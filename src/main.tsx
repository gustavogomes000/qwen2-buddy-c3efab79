import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import App from "./App.tsx";
import "./index.css";
import { initWebVitals } from "./lib/webVitals";

const t0 = performance.now();
console.log(`[Main] ⏱ Script start: ${t0.toFixed(1)}ms`);

// ── Sentry ──────────────────────────────────────────
const isProduction = import.meta.env.PROD;

if (isProduction) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN || "",
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 0.2,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    environment: "production",
  });
}

// ── PWA Guard: never register SW in iframe/preview ──
const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((registrations) => {
    registrations.forEach((r) => r.unregister());
  });
}

// ── PWA Update Prompt (vite-plugin-pwa handles registration) ──
// The SW is registered by the virtual:pwa-register module imported in App.tsx
// No manual /sw.js registration needed anymore.

// ── Render ──
console.log(`[Main] ⏱ Before render: ${(performance.now() - t0).toFixed(1)}ms`);
createRoot(document.getElementById("root")!).render(<App />);
console.log(`[Main] ⏱ After render call: ${(performance.now() - t0).toFixed(1)}ms`);

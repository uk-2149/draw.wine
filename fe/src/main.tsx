import { createRoot } from "react-dom/client";
import "./index.css";
import { App } from "./App.tsx";
import { registerSW } from "virtual:pwa-register";
import { initPWAInstall } from "./hooks/usePWAInstall";
import { SolanaProvider } from "./providers/SolanaProvider";
import { Buffer } from "buffer";

// Polyfill for Solana Web3
window.Buffer = Buffer;

initPWAInstall();

registerSW({
  immediate: true,
});

createRoot(document.getElementById("root")!).render(
  <SolanaProvider>
    <App />
  </SolanaProvider>
);

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initSupabase } from "./lib/supabase";

async function fetchConfigWithRetry(retries = 5, delayMs = 800): Promise<{ supabaseUrl: string; supabaseAnonKey: string } | null> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch("/api/config");
      if (res.ok) {
        return await res.json() as { supabaseUrl: string; supabaseAnonKey: string };
      }
    } catch {
      // network error — retry
    }
    if (i < retries - 1) await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

async function bootstrap() {
  const config = await fetchConfigWithRetry();
  if (config?.supabaseUrl && config?.supabaseAnonKey) {
    initSupabase(config.supabaseUrl, config.supabaseAnonKey);
  }

  createRoot(document.getElementById("root")!).render(<App />);
}

bootstrap();

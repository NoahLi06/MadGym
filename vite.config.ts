import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/**
 * GitHub Pages lives at https://<user>.github.io/<repo>/ — the `base` path must be `/<repo>/`.
 * CI sets PAGES_BASE from the repo name so renames don’t require editing this file.
 * Local production build: `PAGES_BASE=/YourRepo/ npm run build` or rely on the fallback.
 */
const prodBase =
  process.env.PAGES_BASE?.replace(/\/?$/, "/") || "/HustlerFit/";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // `vite dev` uses "/" so local preview stays at http://localhost:5173/
  base: command === "serve" ? "/" : prodBase,
}));

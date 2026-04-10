import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** GitHub Pages project URL is https://<user>.github.io/<repo>/ — must match repo name */
const GITHUB_PAGES_BASE = "/HustlerFit/";

export default defineConfig(({ command }) => ({
  plugins: [react()],
  // `vite dev` uses "/" so local preview stays at http://localhost:5173/
  base: command === "serve" ? "/" : GITHUB_PAGES_BASE,
}));

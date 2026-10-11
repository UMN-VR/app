import { configDefaults, defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { babylonShaderChunks } from "@foss-earth/renderer/vite";

export default defineConfig({
  publicDir: false,
  plugins: [react(), babylonShaderChunks()],
  resolve: { dedupe: ["@babylonjs/core", "@babylonjs/loaders", "react", "react-dom"] },
  test: { exclude: [...configDefaults.exclude, ".local/**", "public/**", "tools/release/**/*.test.mjs"] },
});

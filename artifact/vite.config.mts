/**
 * Builds CRAVE as a single static page (claude.ai Artifact preview).
 * Same UI and ranking/hours/pricing code as the Next.js app; the server pieces
 * (API routes, Supabase, OSM refresh) are replaced by src/api-local.ts.
 * React 18 UMD comes from cdnjs (see index.html); everything else is bundled.
 */
import path from "node:path";
import tailwind from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const here = (p: string) => path.resolve(import.meta.dirname, p);

export default defineConfig({
  root: import.meta.dirname,
  plugins: [react(), tailwind(), viteSingleFile()],
  resolve: {
    alias: [
      { find: /^react$/, replacement: here("src/shims/react.ts") },
      { find: /^react\/jsx(-dev)?-runtime$/, replacement: here("src/shims/jsx-runtime.ts") },
      { find: /^react-dom\/client$/, replacement: here("src/shims/react-dom-client.ts") },
      { find: /^react-dom$/, replacement: here("src/shims/react-dom.ts") },
      { find: /^next\/link$/, replacement: here("src/shims/next-link.tsx") },
      { find: /^next\/navigation$/, replacement: here("src/shims/next-navigation.ts") },
      { find: /^server-only$/, replacement: here("src/shims/empty.ts") },
      // OSM hours parsing only runs in the server refresh job.
      { find: /^opening_hours$/, replacement: here("src/shims/empty.ts") },
      { find: "@/lib/client/api", replacement: here("src/api-local.ts") },
      { find: /^@\//, replacement: `${here("../src")}/` },
    ],
  },
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env": "{}",
  },
  build: {
    outDir: here("dist"),
    emptyOutDir: true,
    target: "es2022",
    cssCodeSplit: false,
    assetsInlineLimit: 100_000_000,
    chunkSizeWarningLimit: 5000,
  },
});

import { defineConfig } from "vite";
import { resolve } from "node:path";

/**
 * Bundles to a single framework-agnostic IIFE — the file a merchant drops
 * in with <script src="https://checkout.zelapay.xyz/widget.js">. Authored
 * in TS (no React — the widget itself renders a plain-DOM modal/iframe that
 * loads the Next.js hosted checkout page from apps/web, it does not
 * reimplement the checkout UI) so it stays small and dependency-free.
 */
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "ZelaCheckout",
      fileName: () => "zela-checkout.js",
      formats: ["iife"],
    },
  },
});

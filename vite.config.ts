import { defineConfig } from "vite";

// Shared proxy rules — used by both dev server and preview
const proxyRules = {
    "/awc-api": {
          target: "https://aviationweather.gov",
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/awc-api/, "/api"),
    },
    "/faa-api": {
          target: "https://api.faa.gov",
          changeOrigin: true,
          rewrite: (p: string) => p.replace(/^\/faa-api/, ""),
    },
};

export default defineConfig({
    base: "./",
    publicDir: "public",
    server: {
          // Explicit IPv4 bind — on some Windows/LAN setups `true` is flaky for 10.x access.
      host: "0.0.0.0",
          // Restrict to known tunnel/local hosts — avoids DNS-rebinding via `true`.
          allowedHosts: ["localhost", "127.0.0.1", ".tunnelmole.net", ".loca.lt", ".ngrok.io"],
          // AWC JSON API does not send Access-Control-Allow-Origin; proxy to same-origin.
          proxy: proxyRules,
    },
    preview: {
          host: "0.0.0.0",
          allowedHosts: ["localhost", "127.0.0.1", ".tunnelmole.net", ".loca.lt", ".ngrok.io"],
          proxy: proxyRules,
    },
    build: {
          outDir: "dist",
          // "hidden" writes maps to disk but does not link them in the bundle,
          // keeping source private while still enabling error-monitoring tools.
          sourcemap: "hidden",
    },
});

import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  publicDir: "public",
  server: {
    // Explicit IPv4 bind — on some Windows/LAN setups `true` is flaky for 10.x access from other devices.
    host: "0.0.0.0",
    // tunnelmole / localtunnel / ngrok send a different Host header than localhost
    allowedHosts: true,
    // AWC JSON API does not send Access-Control-Allow-Origin; browser fetch must be same-origin.
    proxy: {
      "/awc-api": {
        target: "https://aviationweather.gov",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/awc-api/, "/api"),
      },
      "/faa-api": {
        target: "https://api.faa.gov",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/faa-api/, ""),
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    allowedHosts: true,
    proxy: {
      "/awc-api": {
        target: "https://aviationweather.gov",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/awc-api/, "/api"),
      },
      "/faa-api": {
        target: "https://api.faa.gov",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/faa-api/, ""),
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});

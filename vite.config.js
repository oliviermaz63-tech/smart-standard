import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),

    VitePWA({
      registerType: "autoUpdate",

      manifest: {
        name: "Smart Standard",
        short_name: "SmartStd",

        theme_color: "#0f172a",

        background_color: "#ffffff",

        display: "standalone",

        start_url: "/",

        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
          },

          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
          },
        ],
      },
    }),
  ],

  server: {
  host: "0.0.0.0",
  port: 5173,

  allowedHosts: [
    "fridge-proclaim-enzyme.ngrok-free.dev",
  ],
},
});
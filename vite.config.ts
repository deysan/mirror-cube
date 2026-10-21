import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            // Stable UI libraries also let Rolldown share helpers outside the app entry.
            { name: "react", test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/, priority: 30 },
            // Split at Three.js's existing module boundary, not arbitrary byte limits.
            // Higher priority keeps the renderer's core dependency in its own chunk.
            { name: "three-core", test: /node_modules[\\/]three[\\/]build[\\/]three\.core\.js$/, priority: 20 },
            { name: "three-renderer", test: /node_modules[\\/]three[\\/]build[\\/]three\.module\.js$/, priority: 10 },
          ],
        },
      },
    },
  },
});

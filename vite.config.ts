import { defineConfig } from 'vite'

// Relative base → works on GitHub Pages project sites without knowing the repo name.
// BASE_PATH overrides it for hosts that need an absolute base, e.g.
// `BASE_PATH=/planet-hopper/ npm run build`.
export default defineConfig({
  base: process.env['BASE_PATH'] ?? './',
  build: {
    rolldownOptions: {
      output: {
        // Vendor split: three.js changes far less often than game code, so a redeploy only
        // invalidates the small app chunk. three alone is 550 kB minified — over the 500 kB
        // warning — so its core module gets its own chunk instead of raising the limit;
        // the warning stays armed for real regressions.
        codeSplitting: {
          groups: [
            { name: 'three-core', test: /[\\/]node_modules[\\/]three[\\/]build[\\/]three\.core/ },
            { name: 'three', test: /[\\/]node_modules[\\/]three[\\/]/ },
          ],
        },
      },
    },
  },
})

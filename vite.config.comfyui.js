import { resolve } from 'path'
import glsl from 'vite-plugin-glsl' // allows us to use external shaders files to be imported into our materials

/**
 * Vite config for ComfyUI build
 * Outputs to mesh2motion-ui directory for serving via ComfyUI backend
 */
export default {
  root: 'src/',
  publicDir: '../static/',
  base: '/mesh2motion/',
  define: {
    // expose all Cloudflare environment variables to client from window object
    PROCESS_ENV: JSON.stringify(process.env || 'unknown')
  },
  build:
    {
      // Output to mesh2motion-ui for ComfyUI
      outDir: '../../mesh2motion-ui',
      emptyOutDir: true,
      sourcemap: false,
      minify: true,
      assetsDir: 'assets',
      rollupOptions: {
        input: {
          // For ComfyUI, build Explore, Create, and Retarget pages
          index: resolve(__dirname, 'src/index-comfyui.html'),
          create: resolve(__dirname, 'src/create-comfyui.html'),
          retarget: resolve(__dirname, 'src/retarget-comfyui.html')
        }
      }
    },
  plugins:
    [
      glsl()
    ]
}

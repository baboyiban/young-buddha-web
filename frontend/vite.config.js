import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig(({ mode }) => {
  // Load environment variables from root directory
  const rootEnv = loadEnv(mode, resolve(__dirname, '../'), '');

  return {
    define: {
      // Make root environment variables available to the frontend
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(rootEnv.VITE_API_BASE_URL || rootEnv.API_BASE_URL || 'http://localhost:8080')
    },
    server: {
      host: true,
      port: 3000,
    },
    build: {
      outDir: 'dist',
      assetsDir: 'assets',
    },
  };
});

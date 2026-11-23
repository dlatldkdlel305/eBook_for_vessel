import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer as createViteServer } from 'vite';
import { getServerEnv } from './server/env.js';
import {
  handleCover,
  handleDiscoverLibraries,
  handleHealth,
  handlePresets,
  handleSearch,
  handleTestLibrary,
} from './server/handlers.js';
import type { ApiRequest, ApiResponse } from './server/vercelTypes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type ApiHandler = (req: ApiRequest, res: ApiResponse) => Promise<void>;

function adaptExpress(handler: ApiHandler): express.RequestHandler {
  return async (req, res, next) => {
    try {
      await handler(req as unknown as ApiRequest, res as unknown as ApiResponse);
    } catch (err) {
      next(err);
    }
  };
}

async function startServer() {
  const env = getServerEnv();
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.all('/api/health', adaptExpress(handleHealth));
  app.all('/api/presets', adaptExpress(handlePresets));
  app.all('/api/discover-libraries', adaptExpress(handleDiscoverLibraries));
  app.all('/api/search', adaptExpress(handleSearch));
  app.all('/api/test-library', adaptExpress(handleTestLibrary));
  app.all('/api/cover', adaptExpress(handleCover));

  if (!env.isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(env.port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${env.port}`);
  });
}

startServer();

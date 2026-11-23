/**
 * Server-side environment configuration.
 * All sensitive credentials (e.g. GEMINI_API_KEY) are read exclusively
 * from `process.env` on the server and are never exposed to the browser bundle.
 */

export interface ServerEnv {
  nodeEnv: string;
  isProduction: boolean;
  port: number;
  geminiApiKey: string | undefined;
  appUrl: string | undefined;
  allowedOrigins: string[];
}

function parseAllowedOrigins(): string[] {
  const candidates = new Set<string>();

  const envList = [
    process.env.ALLOWED_ORIGIN,
    process.env.APP_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    process.env.VERCEL_BRANCH_URL
      ? `https://${process.env.VERCEL_BRANCH_URL}`
      : undefined,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
  ];

  for (const raw of envList) {
    if (!raw) continue;
    for (const part of raw.split(',')) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      try {
        const parsed = new URL(trimmed);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
          candidates.add(parsed.origin);
        }
      } catch {
        // Ignore malformed origin strings
      }
    }
  }

  return Array.from(candidates);
}

export function getServerEnv(): ServerEnv {
  const nodeEnv = process.env.NODE_ENV || 'development';
  return {
    nodeEnv,
    isProduction: nodeEnv === 'production' || Boolean(process.env.VERCEL),
    port: Number(process.env.PORT) || 3000,
    geminiApiKey: process.env.GEMINI_API_KEY?.trim() || undefined,
    appUrl: process.env.APP_URL?.trim() || undefined,
    allowedOrigins: parseAllowedOrigins(),
  };
}

import dns from 'node:dns/promises';
import net from 'node:net';
import { getServerEnv } from './env.js';
import type { ApiRequest, ApiResponse } from './vercelTypes.js';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
  'metadata',
]);

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split('.').map((n) => Number(n));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }
  const [a, b] = parts;
  if (a === 0) return true; // 0.0.0.0/8
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a === 127) return true; // 127.0.0.0/8 loopback
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local & cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 0 && parts[2] === 0) return true; // 192.0.0.0/24
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmark
  if (a >= 224) return true; // Multicast & reserved
  return false;
}

function isPrivateOrReservedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::' || normalized === '::1') return true;
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    if (net.isIPv4(mapped)) {
      return isPrivateOrReservedIpv4(mapped);
    }
  }
  if (normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd')) {
    return true;
  }
  return false;
}

export function isPrivateIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) return isPrivateOrReservedIpv4(ip);
  if (version === 6) return isPrivateOrReservedIpv6(ip);
  return true;
}

/**
 * Validates that a URL is an external HTTP(S) URL and does not point to
 * loopback, private network, or cloud metadata endpoints.
 */
export async function assertSafePublicUrl(rawUrl: string): Promise<URL> {
  const parsed = new URL(rawUrl);

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Credentials in URL are not allowed');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (
    !hostname ||
    BLOCKED_HOSTNAMES.has(hostname) ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.localhost')
  ) {
    throw new Error('Blocked internal hostname');
  }

  if (net.isIP(hostname) !== 0) {
    if (isPrivateIp(hostname)) {
      throw new Error('Blocked private IP address');
    }
    return parsed;
  }

  // Resolve DNS to guard against internal DNS records / rebinding
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!records || records.length === 0) {
    throw new Error('Hostname resolution failed');
  }
  for (const record of records) {
    if (isPrivateIp(record.address)) {
      throw new Error('Blocked resolved private IP');
    }
  }

  return parsed;
}

/**
 * Synchronous scheme validation for URLs returned to the client UI.
 */
export function sanitizeHttpUrl(rawUrl: string | undefined, fallback = ''): string {
  if (!rawUrl) return fallback;
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    // Ignore invalid URL
  }
  return fallback;
}

/**
 * Applies strict CORS headers for same-origin and explicitly allowed origins,
 * and handles OPTIONS preflight requests cleanly.
 */
export function applyCors(
  req: ApiRequest,
  res: ApiResponse,
  methods: string[]
): boolean {
  const originHeader = req.headers.origin;
  const origin = Array.isArray(originHeader) ? originHeader[0] : originHeader;
  const env = getServerEnv();

  const hostHeader = req.headers['x-forwarded-host'] || req.headers.host;
  const host = Array.isArray(hostHeader) ? hostHeader[0] : hostHeader;

  if (origin) {
    let allowed = false;
    try {
      const originUrl = new URL(origin);
      if (host && originUrl.host === host) {
        allowed = true;
      } else if (env.allowedOrigins.includes(originUrl.origin)) {
        allowed = true;
      } else if (
        !env.isProduction &&
        (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1')
      ) {
        allowed = true;
      }
    } catch {
      allowed = false;
    }

    if (allowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
  }

  res.setHeader('Access-Control-Allow-Methods', [...methods, 'OPTIONS'].join(', '));
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }

  return false;
}

/**
 * Reads and parses JSON request body safely on both Express (already parsed)
 * and raw Node/Vercel requests.
 */
export async function readJsonBody<T = Record<string, unknown>>(
  req: ApiRequest
): Promise<T> {
  if (req.body && typeof req.body === 'object') {
    return req.body as T;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body) as T;
  }

  const chunks: Buffer[] = [];
  let totalSize = 0;
  const maxBytes = 1024 * 1024; // 1MB limit

  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalSize += buf.length;
    if (totalSize > maxBytes) {
      throw new Error('Request payload too large');
    }
    chunks.push(buf);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {} as T;
  return JSON.parse(raw) as T;
}

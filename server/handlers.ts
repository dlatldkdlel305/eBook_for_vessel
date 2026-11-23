import {
  DEFAULT_LIBRARIES,
  PRESET_LIBRARIES,
  discoverLibrariesByName,
  searchLibraries,
  testCustomLibraryConnection,
} from './libraryAdapters.js';
import {
  applyCors,
  assertSafePublicUrl,
  readJsonBody,
} from './security.js';
import type { ApiRequest, ApiResponse } from './vercelTypes.js';
import type { LibraryConfig, SearchField } from '../src/types.js';

const VALID_ADAPTERS = new Set<LibraryConfig['adapter']>([
  'kyobo-elibrary',
  'kyobo-root',
  'gangnam-asp',
  'kyobo-subscription',
  'custom-link',
]);

function getQueryString(
  query: Record<string, string | string[] | undefined> | undefined,
  key: string
): string {
  const value = query?.[key];
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return '';
}

function sanitizeLibrariesInput(raw: unknown): LibraryConfig[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_LIBRARIES;
  }

  const sanitized: LibraryConfig[] = [];
  for (const item of raw.slice(0, 25)) {
    if (!item || typeof item !== 'object') continue;
    const candidate = item as Partial<LibraryConfig>;
    if (
      typeof candidate.id !== 'string' ||
      typeof candidate.name !== 'string' ||
      typeof candidate.baseUrl !== 'string' ||
      !VALID_ADAPTERS.has(candidate.adapter as LibraryConfig['adapter'])
    ) {
      continue;
    }

    try {
      const parsed = new URL(candidate.baseUrl);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        continue;
      }
    } catch {
      continue;
    }

    sanitized.push({
      id: candidate.id.slice(0, 80),
      name: candidate.name.slice(0, 80),
      shortName:
        typeof candidate.shortName === 'string'
          ? candidate.shortName.slice(0, 20)
          : candidate.name.slice(0, 8),
      category: candidate.category === 'subscription' ? 'subscription' : 'owned',
      adapter: candidate.adapter as LibraryConfig['adapter'],
      baseUrl: candidate.baseUrl,
      searchUrlTemplate:
        typeof candidate.searchUrlTemplate === 'string'
          ? candidate.searchUrlTemplate.slice(0, 300)
          : undefined,
      enabled: Boolean(candidate.enabled),
      isDefault: Boolean(candidate.isDefault),
      description:
        typeof candidate.description === 'string'
          ? candidate.description.slice(0, 200)
          : undefined,
    });
  }

  return sanitized.length > 0 ? sanitized : DEFAULT_LIBRARIES;
}

export async function handleHealth(
  req: ApiRequest,
  res: ApiResponse
): Promise<void> {
  if (applyCors(req, res, ['GET'])) return;
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  res.status(200).json({
    ok: true,
    nodeVersion: process.version,
    environment: process.env.VERCEL ? 'vercel' : process.env.NODE_ENV || 'development',
  });
}

export async function handlePresets(
  req: ApiRequest,
  res: ApiResponse
): Promise<void> {
  if (applyCors(req, res, ['GET'])) return;
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }
  res.setHeader('Cache-Control', 'public, s-maxage=3600, max-age=600');
  res.status(200).json({
    defaultLibraries: DEFAULT_LIBRARIES,
    presetLibraries: PRESET_LIBRARIES,
  });
}

export async function handleDiscoverLibraries(
  req: ApiRequest,
  res: ApiResponse
): Promise<void> {
  if (applyCors(req, res, ['GET'])) return;
  if (req.method && req.method !== 'GET') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const q = getQueryString(req.query, 'q').slice(0, 100);
    const candidates = await discoverLibrariesByName(q);
    res.status(200).json({ query: q, candidates });
  } catch (error) {
    console.error('Discover library error:', error);
    res.status(500).json({
      error: '도서관 검색 중 오류가 발생했습니다.',
      candidates: [],
    });
  }
}

export async function handleSearch(
  req: ApiRequest,
  res: ApiResponse
): Promise<void> {
  if (applyCors(req, res, ['POST'])) return;
  if (req.method && req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    const body = await readJsonBody<{
      query?: string;
      field?: SearchField;
      libraries?: unknown;
    }>(req);

    const { query, field, libraries } = body;

    if (!query || typeof query !== 'string' || !query.trim()) {
      res.status(400).json({ error: '검색어를 입력해 주세요.' });
      return;
    }

    const validField: SearchField =
      field === 'title' || field === 'author' ? field : 'all';
    const activeList = sanitizeLibrariesInput(libraries);

    const result = await searchLibraries(query, validField, activeList);
    res.status(200).json(result);
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({
      error: '도서관 검색 중 일시적인 오류가 발생했습니다.',
    });
  }
}

export async function handleTestLibrary(
  req: ApiRequest,
  res: ApiResponse
): Promise<void> {
  if (applyCors(req, res, ['POST'])) return;
  if (req.method && req.method !== 'POST') {
    res.status(405).json({ ok: false, message: 'Method Not Allowed' });
    return;
  }

  try {
    const body = await readJsonBody<{
      baseUrl?: string;
      adapter?: LibraryConfig['adapter'];
    }>(req);

    const { baseUrl, adapter } = body;
    if (!baseUrl || typeof baseUrl !== 'string') {
      res.status(400).json({
        ok: false,
        sampleCount: 0,
        message: '도서관 URL을 입력해 주세요.',
      });
      return;
    }

    const validAdapter: LibraryConfig['adapter'] =
      adapter && VALID_ADAPTERS.has(adapter) ? adapter : 'kyobo-elibrary';

    const result = await testCustomLibraryConnection(baseUrl, validAdapter);
    res.status(200).json(result);
  } catch (error) {
    console.error('Test library error:', error);
    res.status(500).json({
      ok: false,
      sampleCount: 0,
      message: '연결 테스트 중 오류가 발생했습니다.',
    });
  }
}

export async function handleCover(
  req: ApiRequest,
  res: ApiResponse
): Promise<void> {
  if (applyCors(req, res, ['GET'])) return;
  if (req.method && req.method !== 'GET') {
    res.status(405).end();
    return;
  }

  const rawUrl = getQueryString(req.query, 'url');
  if (!rawUrl) {
    res.status(400).end();
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4500);

  try {
    let currentUrl = await assertSafePublicUrl(rawUrl);
    let response: Response | null = null;

    for (let hop = 0; hop <= 3; hop += 1) {
      response = await fetch(currentUrl.toString(), {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          Referer: currentUrl.origin,
        },
        redirect: 'manual',
        signal: controller.signal,
      });

      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.get('location')
      ) {
        if (hop === 3) {
          res.status(404).end();
          return;
        }
        const nextCandidate = new URL(
          response.headers.get('location')!,
          currentUrl.toString()
        ).toString();
        currentUrl = await assertSafePublicUrl(nextCandidate);
        continue;
      }
      break;
    }

    if (!response || !response.ok) {
      res.status(404).end();
      return;
    }

    const contentType = (
      response.headers.get('content-type') || 'image/jpeg'
    ).toLowerCase();
    if (!contentType.startsWith('image/') || contentType.includes('svg')) {
      res.status(404).end();
      return;
    }

    const contentLength = Number(response.headers.get('content-length') || 0);
    if (contentLength > 5 * 1024 * 1024) {
      res.status(413).end();
      return;
    }

    const buf = Buffer.from(await response.arrayBuffer());
    if (buf.byteLength > 5 * 1024 * 1024) {
      res.status(413).end();
      return;
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=3600');
    res.status(200).send(buf);
  } catch {
    res.status(404).end();
  } finally {
    clearTimeout(timer);
  }
}

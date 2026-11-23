import type {
  DiscoveredLibraryCandidate,
  LibraryAdapterType,
  LibraryConfig,
  SearchField,
  SearchResponse,
} from '../types';

/**
 * Optional base URL for split frontend/backend deployments.
 * When deployed together on Vercel (SPA + /api Serverless Functions),
 * leave VITE_API_BASE_URL unset so requests go to same-origin `/api/*`.
 */
const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

function buildApiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

export function resolveCoverUrl(coverPath?: string): string {
  if (!coverPath) return '';
  if (coverPath.startsWith('/api/')) {
    return buildApiUrl(coverPath);
  }
  return coverPath;
}

export function isSafeExternalUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl) return false;
  try {
    const parsed = new URL(rawUrl);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

async function parseJsonSafe<T>(res: Response): Promise<T | null> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function searchBooksApi(params: {
  query: string;
  field: SearchField;
  libraries: LibraryConfig[];
  signal?: AbortSignal;
}): Promise<SearchResponse> {
  const res = await fetch(buildApiUrl('/api/search'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: params.query,
      field: params.field,
      libraries: params.libraries,
    }),
    signal: params.signal,
  });

  const payload = await parseJsonSafe<SearchResponse & { error?: string }>(res);
  if (!res.ok || !payload) {
    throw new Error(payload?.error || '검색 요청 처리에 실패했습니다.');
  }
  return payload;
}

export async function discoverLibrariesApi(params: {
  query: string;
  signal?: AbortSignal;
}): Promise<DiscoveredLibraryCandidate[]> {
  const res = await fetch(
    buildApiUrl(`/api/discover-libraries?q=${encodeURIComponent(params.query)}`),
    { signal: params.signal }
  );

  const payload = await parseJsonSafe<{
    candidates?: DiscoveredLibraryCandidate[];
    error?: string;
  }>(res);
  if (!res.ok) {
    throw new Error(payload?.error || '도서관 검색에 실패했습니다.');
  }
  return Array.isArray(payload?.candidates) ? payload.candidates : [];
}

export async function testLibraryConnectionApi(params: {
  baseUrl: string;
  adapter: LibraryAdapterType;
}): Promise<{
  ok: boolean;
  message: string;
  detectedAdapter?: LibraryAdapterType;
}> {
  const res = await fetch(buildApiUrl('/api/test-library'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      baseUrl: params.baseUrl,
      adapter: params.adapter,
    }),
  });

  const payload = await parseJsonSafe<{
    ok: boolean;
    message: string;
    detectedAdapter?: LibraryAdapterType;
  }>(res);

  if (!payload) {
    return {
      ok: false,
      message: '연결 테스트 응답을 해석할 수 없습니다.',
    };
  }
  return payload;
}

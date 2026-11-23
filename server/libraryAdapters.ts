import * as cheerio from 'cheerio';
import iconv from 'iconv-lite';
import type {
  AggregatedBook,
  AvailabilityStatus,
  DiscoveredLibraryCandidate,
  LibraryAvailability,
  LibraryConfig,
  LibrarySearchSummary,
  RawLibraryBook,
  SearchField,
  SearchResponse,
} from '../src/types.js';
import { assertSafePublicUrl, sanitizeHttpUrl } from './security.js';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

export const DEFAULT_LIBRARIES: LibraryConfig[] = [
  {
    id: 'seocho-owned',
    name: '서초구 전자도서관',
    shortName: '서초(소장)',
    category: 'owned',
    adapter: 'kyobo-elibrary',
    baseUrl: 'https://ebook.seocholib.or.kr/elibrary-front',
    enabled: true,
    isDefault: true,
    description: '서초구립도서관 소장형 전자책 (교보문고)',
  },
  {
    id: 'seocho-sub',
    name: '서초구 전자도서관(구독)',
    shortName: '서초(구독)',
    category: 'subscription',
    adapter: 'kyobo-subscription',
    baseUrl: 'https://ebook.seocholib.or.kr/elibrary-front',
    enabled: true,
    isDefault: true,
    description: '서초구립도서관 구독형 전자책 (정회원 로그인 연동)',
  },
  {
    id: 'gangnam',
    name: '강남구 전자도서관',
    shortName: '강남구',
    category: 'owned',
    adapter: 'gangnam-asp',
    baseUrl: 'https://ebook.gangnam.go.kr',
    enabled: true,
    isDefault: true,
    description: '강남구통합도서관 전자책 (교보·YES24·웅진)',
  },
  {
    id: 'onbook',
    name: '온책방',
    shortName: '온책방',
    category: 'subscription',
    adapter: 'kyobo-root',
    baseUrl: 'https://onbook.dkyobobook.co.kr',
    enabled: true,
    isDefault: true,
    description: '한국출판문화산업진흥원 디지털도서관 (교보 기반)',
  },
  {
    id: 'suwon',
    name: '수원시 전자도서관',
    shortName: '수원시',
    category: 'owned',
    adapter: 'kyobo-elibrary',
    baseUrl: 'https://ebook.suwonlib.go.kr/elibrary-front',
    enabled: true,
    isDefault: true,
    description: '수원시 도서관 소장형 전자책 (교보문고)',
  },
];

export const PRESET_LIBRARIES: LibraryConfig[] = [
  {
    id: 'yongin',
    name: '용인시 전자도서관',
    shortName: '용인시',
    category: 'owned',
    adapter: 'kyobo-elibrary',
    baseUrl: 'https://ebook.yongin.go.kr/elibrary-front',
    enabled: true,
    description: '용인시 도서관 소장형 전자책 (실시간 검색 지원)',
  },
  {
    id: 'mapo',
    name: '마포구 전자도서관',
    shortName: '마포구',
    category: 'owned',
    adapter: 'kyobo-elibrary',
    baseUrl: 'https://ebook.mapo.go.kr/elibrary-front',
    enabled: true,
    description: '마포구립도서관 소장형 전자책 (실시간 검색 지원)',
  },
  {
    id: 'songpa',
    name: '송파구 전자도서관',
    shortName: '송파구',
    category: 'owned',
    adapter: 'custom-link',
    baseUrl: 'https://ebook.splib.or.kr',
    enabled: true,
    description: '송파구통합도서관 전자도서관 바로가기',
  },
  {
    id: 'seongnam',
    name: '성남시 전자도서관',
    shortName: '성남시',
    category: 'owned',
    adapter: 'custom-link',
    baseUrl: 'https://ebook.snlib.go.kr/elibrary-front',
    enabled: true,
    description: '성남시 도서관 전자책 포털 연동',
  },
  {
    id: 'eunpyeong',
    name: '은평구 전자도서관',
    shortName: '은평구',
    category: 'owned',
    adapter: 'custom-link',
    baseUrl: 'https://epbook.eplib.or.kr',
    enabled: true,
    description: '은평구립도서관 전자도서관 포털 연동',
  },
  {
    id: 'seoul-lib',
    name: '서울도서관 전자책',
    shortName: '서울도서관',
    category: 'owned',
    adapter: 'custom-link',
    baseUrl: 'https://lib.seoul.go.kr',
    searchUrlTemplate: 'https://lib.seoul.go.kr/search/tot/result?st=KWRD&si=TOTAL&q={query}',
    enabled: true,
    description: '서울시 통합 검색 링크 연동',
  },
  {
    id: 'gyeonggi-cyber',
    name: '경기도사이버도서관',
    shortName: '경기도',
    category: 'owned',
    adapter: 'custom-link',
    baseUrl: 'https://www.library.kr',
    searchUrlTemplate: 'https://www.library.kr/cyber/ebook/ebookList.do?searchKeyword={query}',
    enabled: true,
    description: '경기도사이버도서관 전자책 검색 연동',
  },
  {
    id: 'national-sejong',
    name: '국립중앙도서관',
    shortName: '국립중앙',
    category: 'owned',
    adapter: 'custom-link',
    baseUrl: 'https://www.nl.go.kr',
    searchUrlTemplate: 'https://www.nl.go.kr/NL/contents/search.do?kwd={query}',
    enabled: true,
    description: '국립중앙도서관 자료 검색 링크 연동',
  },
  {
    id: 'assembly-lib',
    name: '국회전자도서관',
    shortName: '국회도서관',
    category: 'owned',
    adapter: 'custom-link',
    baseUrl: 'https://dl.nanet.go.kr',
    searchUrlTemplate: 'https://dl.nanet.go.kr/search/searchInnerList.do?searchType=SIMPLE&queryText={query}',
    enabled: true,
    description: '국회전자도서관 통합 검색 링크 연동',
  },
];

function cleanText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeCoverUrl(rawSrc: string | undefined, origin: string): string {
  if (!rawSrc) return '';
  const trimmed = rawSrc.trim();
  if (!trimmed || trimmed.includes('L_NOBOOK') || trimmed.includes('nobook')) {
    return '';
  }
  let full = trimmed;
  if (trimmed.startsWith('//')) {
    full = `https:${trimmed}`;
  } else if (trimmed.startsWith('/')) {
    full = `${origin}${trimmed}`;
  } else if (!trimmed.startsWith('http')) {
    full = `${origin}/${trimmed}`;
  }
  return `/api/cover?url=${encodeURIComponent(full)}`;
}

function encodeEucKrQuery(query: string): string {
  const buf = iconv.encode(query, 'euc-kr');
  return Array.from(buf)
    .map((b) => `%${b.toString(16).toUpperCase().padStart(2, '0')}`)
    .join('');
}

async function fetchWithTimeout(
  url: string,
  timeoutMs = 5500,
  maxRedirects = 3
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let currentUrl = (await assertSafePublicUrl(url)).toString();

    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      const response = await fetch(currentUrl, {
        headers: {
          'User-Agent': USER_AGENT,
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
        },
        redirect: 'manual',
        signal: controller.signal,
      });

      if (
        response.status >= 300 &&
        response.status < 400 &&
        response.headers.get('location')
      ) {
        if (hop === maxRedirects) {
          throw new Error('Too many redirects');
        }
        const nextUrl = new URL(
          response.headers.get('location')!,
          currentUrl
        ).toString();
        currentUrl = (await assertSafePublicUrl(nextUrl)).toString();
        continue;
      }

      return response;
    }

    throw new Error('Redirect resolution failed');
  } finally {
    clearTimeout(timer);
  }
}

function parseKyoboHtml(
  html: string,
  library: LibraryConfig,
  query: string,
  searchUrl: string
): RawLibraryBook[] {
  const $ = cheerio.load(html);
  const origin = new URL(library.baseUrl).origin;
  const results: RawLibraryBook[] = [];

  $('.book_resultList > li').each((_, el) => {
    const $el = $(el);
    const title = cleanText($el.find('li.tit a').first().text());
    if (!title) return;

    const $writer = $el.find('li.writer').first();
    const publisher = cleanText($writer.find('span').first().text());

    // Extract text nodes around the publisher span
    const writerClone = $writer.clone();
    writerClone.find('span').remove();
    const rawWriterText = cleanText(writerClone.text());
    const dateMatch = rawWriterText.match(/\d{4}-\d{2}-\d{2}/);
    const publishDate = dateMatch ? dateMatch[0] : '';
    const author = cleanText(
      dateMatch ? rawWriterText.replace(dateMatch[0], '') : rawWriterText
    );

    const description = cleanText($el.find('li.txt').first().text());
    const imgSrc = $el.find('.img img').first().attr('src');
    const coverUrl = normalizeCoverUrl(imgSrc, origin);
    const format = cleanText($el.find('span.small').first().text()) || '전자책';
    const vendor = cleanText($el.find('span.store').first().text()) || '교보문고';

    const useText = cleanText($el.find('p.use').text());
    const loanMatch = useText.match(/대출\s*:\s*(\d+)\s*\/\s*(\d+)/);
    const reserveMatch = useText.match(/예약\s*:\s*(\d+)/);

    const buttonLabels = $el
      .find('input[type="button"]')
      .map((__, btn) => cleanText($(btn).val() as string))
      .get();

    let status: AvailabilityStatus = 'available';
    let loanedCopies: number | undefined;
    let totalCopies: number | undefined;
    let availableCopies: number | undefined;
    let reservedCount: number | undefined;

    if (loanMatch) {
      loanedCopies = parseInt(loanMatch[1], 10);
      totalCopies = parseInt(loanMatch[2], 10);
      reservedCount = reserveMatch ? parseInt(reserveMatch[1], 10) : 0;
      availableCopies = Math.max(0, totalCopies - loanedCopies);
      status = availableCopies > 0 ? 'available' : 'loaned';
    } else if (library.category === 'subscription' || buttonLabels.includes('대출')) {
      status =
        library.category === 'subscription'
          ? 'subscription_available'
          : 'available';
    } else if (buttonLabels.includes('예약')) {
      status = 'loaned';
    }

    // Build a reliable direct search link to that book in the library
    const directSearchUrl = sanitizeHttpUrl(
      `${library.baseUrl.replace(/\/$/, '')}/search/searchList.ink?schDvsn=000&schTxt=${encodeURIComponent(title)}`,
      searchUrl
    );

    results.push({
      libraryId: library.id,
      title,
      author: author || '저자 미상',
      publisher: publisher || '출판사 정보 없음',
      publishDate,
      description,
      coverUrl,
      detailUrl: directSearchUrl,
      vendor,
      format,
      status,
      totalCopies,
      loanedCopies,
      availableCopies,
      reservedCount,
    });
  });

  return results;
}

async function searchKyoboLibrary(
  library: LibraryConfig,
  query: string,
  field: SearchField
): Promise<{ books: RawLibraryBook[]; summary: LibrarySearchSummary }> {
  const base = library.baseUrl.replace(/\/$/, '');
  const schDvsn = field === 'title' ? '001' : field === 'author' ? '002' : '000';
  const searchUrl = `${base}/search/searchList.ink?schDvsn=${schDvsn}&schTxt=${encodeURIComponent(query)}&selViewCnt=40`;

  try {
    const res = await fetchWithTimeout(searchUrl);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const html = await res.text();
    let books = parseKyoboHtml(html, library, query, searchUrl);

    // Some Kyobo libraries return fewer matches on schDvsn=001/002; fallback to 000 if empty
    if (books.length === 0 && schDvsn !== '000') {
      const fallbackUrl = `${base}/search/searchList.ink?schDvsn=000&schTxt=${encodeURIComponent(query)}&selViewCnt=40`;
      const fallbackRes = await fetchWithTimeout(fallbackUrl);
      if (fallbackRes.ok) {
        const fallbackHtml = await fallbackRes.text();
        books = parseKyoboHtml(fallbackHtml, library, query, fallbackUrl);
      }
    }

    const availableCount = books.filter(
      (b) => b.status === 'available' || b.status === 'subscription_available'
    ).length;

    return {
      books,
      summary: {
        libraryId: library.id,
        libraryName: library.name,
        resultCount: books.length,
        availableCount,
        status: 'ok',
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : '검색 연결 오류';
    return {
      books: [],
      summary: {
        libraryId: library.id,
        libraryName: library.name,
        resultCount: 0,
        availableCount: 0,
        status: 'error',
        errorMessage: message,
      },
    };
  }
}

async function fetchGangnamSingle(
  library: LibraryConfig,
  query: string,
  searchParam: 'title' | 'author'
): Promise<RawLibraryBook[]> {
  const base = library.baseUrl.replace(/\/$/, '');
  const encoded = encodeEucKrQuery(query);
  const searchUrl = `${base}/elibbook/book_info.asp?search=${searchParam}&strSearch=${encoded}`;
  const res = await fetchWithTimeout(searchUrl);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const html = iconv.decode(buffer, 'euc-kr');
  const $ = cheerio.load(html);
  const results: RawLibraryBook[] = [];

  $('.book:not(:has(.book))').each((_, el) => {
    const $el = $(el);
    const $titleLink = $el.find('.book_title a').first();
    const title = cleanText($titleLink.text());
    if (!title) return;

    const href = $titleLink.attr('href') || '';
    const candidateDetailUrl = href.startsWith('http')
      ? href
      : `${base}/elibbook/${href.replace(/^\//, '')}`;
    const detailUrl = sanitizeHttpUrl(candidateDetailUrl, base);

    const imgSrc = $el.find('.book_frame img').first().attr('src');
    const coverUrl = normalizeCoverUrl(imgSrc, base);

    const author = cleanText($el.find('.writer').first().text()) || '저자 미상';
    const pubRaw = cleanText($el.find('.publish_date').first().text());
    const pubParts = pubRaw.split('·').map((s) => s.trim());
    const publisher = pubParts[0] || '출판사 정보 없음';
    const publishDate = pubParts[1] || '';

    const currents = $el
      .find('.current')
      .map((__, c) => cleanText($(c).text()))
      .get();
    const vendor = currents[0] || '전자책';
    const countsLine = currents.find((c) => c.includes('보유')) || '';
    const countMatch = countsLine.match(
      /보유\s*(\d+).*?대출\s*(\d+).*?예약\s*(\d+)/
    );

    let totalCopies: number | undefined;
    let loanedCopies: number | undefined;
    let reservedCount: number | undefined;
    let availableCopies: number | undefined;
    let status: AvailabilityStatus = 'available';

    if (countMatch) {
      totalCopies = parseInt(countMatch[1], 10);
      loanedCopies = parseInt(countMatch[2], 10);
      reservedCount = parseInt(countMatch[3], 10);
      availableCopies = Math.max(0, totalCopies - loanedCopies);
      status = availableCopies > 0 ? 'available' : 'loaned';
    }

    const description = cleanText($el.find('.info_text').first().text());

    results.push({
      libraryId: library.id,
      title,
      author,
      publisher,
      publishDate,
      description,
      coverUrl,
      detailUrl,
      vendor,
      format: '전자책',
      status,
      totalCopies,
      loanedCopies,
      availableCopies,
      reservedCount,
    });
  });

  return results;
}

async function searchGangnamLibrary(
  library: LibraryConfig,
  query: string,
  field: SearchField
): Promise<{ books: RawLibraryBook[]; summary: LibrarySearchSummary }> {
  try {
    let books: RawLibraryBook[] = [];
    if (field === 'title') {
      books = await fetchGangnamSingle(library, query, 'title');
    } else if (field === 'author') {
      books = await fetchGangnamSingle(library, query, 'author');
    } else {
      const [byTitle, byAuthor] = await Promise.all([
        fetchGangnamSingle(library, query, 'title'),
        fetchGangnamSingle(library, query, 'author'),
      ]);
      const seen = new Set<string>();
      for (const b of [...byAuthor, ...byTitle]) {
        const key = `${b.detailUrl}|${b.title}`;
        if (!seen.has(key)) {
          seen.add(key);
          books.push(b);
        }
      }
    }

    const availableCount = books.filter(
      (b) => b.status === 'available' || b.status === 'subscription_available'
    ).length;

    return {
      books,
      summary: {
        libraryId: library.id,
        libraryName: library.name,
        resultCount: books.length,
        availableCount,
        status: 'ok',
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : '검색 연결 오류';
    return {
      books: [],
      summary: {
        libraryId: library.id,
        libraryName: library.name,
        resultCount: 0,
        availableCount: 0,
        status: 'error',
        errorMessage: message,
      },
    };
  }
}

function normalizeBookKey(title: string, author: string): string {
  const cleanTitle = title
    .replace(/\[.*?\]/g, '')
    .replace(/\(.*?(전자책|무선\s*보급판|리커버|특별판|개정판).*?\)/gi, '')
    .replace(/[:\-·.,!?'"“”‘’\s]/g, '')
    .toLowerCase();

  const firstAuthor = author
    .split(/[,/·]/)[0]
    .replace(/\(.*?\)/g, '')
    .replace(/(지음|글|저|역|옮김)/g, '')
    .replace(/\s+/g, '')
    .toLowerCase();

  return `${cleanTitle}__${firstAuthor.slice(0, 6)}`;
}

function statusPriority(status: AvailabilityStatus): number {
  switch (status) {
    case 'available':
      return 6;
    case 'subscription_available':
      return 5;
    case 'loaned':
      return 4;
    case 'login_required':
      return 3;
    case 'external_link':
      return 2;
    case 'not_held':
      return 1;
    case 'error':
      return 0;
  }
}

function buildLibraryDirectSearchUrl(library: LibraryConfig, query: string): string {
  if (library.searchUrlTemplate) {
    return library.searchUrlTemplate.replace('{query}', encodeURIComponent(query));
  }
  const base = library.baseUrl.replace(/\/$/, '');
  if (library.adapter === 'gangnam-asp') {
    return `${base}/elibbook/book_info.asp?search=title&strSearch=${encodeEucKrQuery(query)}`;
  }
  if (library.adapter === 'kyobo-elibrary' || library.adapter === 'kyobo-root') {
    return `${base}/search/searchList.ink?schDvsn=000&schTxt=${encodeURIComponent(query)}`;
  }
  return base;
}

export async function searchLibraries(
  query: string,
  field: SearchField,
  libraries: LibraryConfig[]
): Promise<SearchResponse> {
  const trimmed = query.trim().slice(0, 200);
  const activeLibraries = libraries.filter((l) => l.enabled).slice(0, 25);

  if (!trimmed || activeLibraries.length === 0) {
    return {
      query: trimmed,
      field,
      searchedAt: new Date().toISOString(),
      books: [],
      librarySummaries: [],
    };
  }

  const settled = await Promise.allSettled(
    activeLibraries.map(async (lib) => {
      if (lib.adapter === 'kyobo-elibrary' || lib.adapter === 'kyobo-root') {
        return searchKyoboLibrary(lib, trimmed, field);
      }
      if (lib.adapter === 'gangnam-asp') {
        return searchGangnamLibrary(lib, trimmed, field);
      }
      if (lib.adapter === 'kyobo-subscription') {
        return {
          books: [] as RawLibraryBook[],
          summary: {
            libraryId: lib.id,
            libraryName: lib.name,
            resultCount: 0,
            availableCount: 0,
            status: 'auth_required' as const,
          },
        };
      }
      return {
        books: [] as RawLibraryBook[],
        summary: {
          libraryId: lib.id,
          libraryName: lib.name,
          resultCount: 0,
          availableCount: 0,
          status: 'external' as const,
        },
      };
    })
  );

  const libraryResults = settled.map((item, idx) => {
    const lib = activeLibraries[idx];
    if (item.status === 'fulfilled') {
      return item.value;
    }
    return {
      books: [] as RawLibraryBook[],
      summary: {
        libraryId: lib.id,
        libraryName: lib.name,
        resultCount: 0,
        availableCount: 0,
        status: 'error' as const,
        errorMessage:
          item.reason instanceof Error ? item.reason.message : '검색 연결 오류',
      },
    };
  });

  // Group books across libraries
  const bookMap = new Map<
    string,
    {
      canonical: RawLibraryBook;
      byLibrary: Map<string, RawLibraryBook[]>;
    }
  >();

  for (const res of libraryResults) {
    for (const book of res.books) {
      const key = normalizeBookKey(book.title, book.author);
      let entry = bookMap.get(key);
      if (!entry) {
        entry = {
          canonical: book,
          byLibrary: new Map(),
        };
        bookMap.set(key, entry);
      } else {
        // Prefer richer cover/description
        if (!entry.canonical.coverUrl && book.coverUrl) {
          entry.canonical.coverUrl = book.coverUrl;
        }
        if (
          book.description.length > entry.canonical.description.length
        ) {
          entry.canonical.description = book.description;
        }
      }
      const libList = entry.byLibrary.get(book.libraryId) || [];
      libList.push(book);
      entry.byLibrary.set(book.libraryId, libList);
    }
  }

  const summaryMap = new Map(
    libraryResults.map((r) => [r.summary.libraryId, r.summary])
  );

  const aggregatedBooks: AggregatedBook[] = [];

  for (const [key, entry] of bookMap.entries()) {
    const availabilities: LibraryAvailability[] = activeLibraries.map((lib) => {
      const libSummary = summaryMap.get(lib.id);
      const matches = entry.byLibrary.get(lib.id);

      if (matches && matches.length > 0) {
        const sorted = [...matches].sort(
          (a, b) =>
            statusPriority(b.status) - statusPriority(a.status) ||
            (b.availableCopies ?? 0) - (a.availableCopies ?? 0)
        );
        const best = sorted[0];
        return {
          libraryId: lib.id,
          libraryName: lib.name,
          category: lib.category,
          status: best.status,
          totalCopies: best.totalCopies,
          loanedCopies: best.loanedCopies,
          availableCopies: best.availableCopies,
          reservedCount: best.reservedCount,
          vendor: best.vendor,
          matchedTitle: best.title,
          detailUrl: best.detailUrl,
          editions:
            sorted.length > 1
              ? sorted.map((m) => ({
                  title: m.title,
                  vendor: m.vendor,
                  status: m.status,
                  totalCopies: m.totalCopies,
                  loanedCopies: m.loanedCopies,
                  availableCopies: m.availableCopies,
                  reservedCount: m.reservedCount,
                  detailUrl: m.detailUrl,
                }))
              : undefined,
        };
      }

      if (lib.adapter === 'kyobo-subscription') {
        return {
          libraryId: lib.id,
          libraryName: lib.name,
          category: lib.category,
          status: 'login_required',
          detailUrl: buildLibraryDirectSearchUrl(lib, entry.canonical.title),
          note: '구독형 서비스는 정회원 로그인 후 도서관/교보 앱에서 즉시 대출 여부를 확인할 수 있습니다.',
        };
      }

      if (lib.adapter === 'custom-link') {
        return {
          libraryId: lib.id,
          libraryName: lib.name,
          category: lib.category,
          status: 'external_link',
          detailUrl: buildLibraryDirectSearchUrl(lib, entry.canonical.title),
          note: '외부 도서관 검색 페이지로 이동해 소장 여부를 확인하세요.',
        };
      }

      if (libSummary?.status === 'error') {
        return {
          libraryId: lib.id,
          libraryName: lib.name,
          category: lib.category,
          status: 'error',
          detailUrl: buildLibraryDirectSearchUrl(lib, entry.canonical.title),
          note: `조회 실패 (${libSummary.errorMessage || '네트워크 오류'})`,
        };
      }

      return {
        libraryId: lib.id,
        libraryName: lib.name,
        category: lib.category,
        status: 'not_held',
        detailUrl: buildLibraryDirectSearchUrl(lib, entry.canonical.title),
      };
    });

    const availableLibraryCount = availabilities.filter(
      (a) => a.status === 'available' || a.status === 'subscription_available'
    ).length;

    const heldLibraryCount = availabilities.filter(
      (a) =>
        a.status === 'available' ||
        a.status === 'subscription_available' ||
        a.status === 'loaned'
    ).length;

    aggregatedBooks.push({
      id: key,
      title: entry.canonical.title,
      author: entry.canonical.author,
      publisher: entry.canonical.publisher,
      publishDate: entry.canonical.publishDate,
      description: entry.canonical.description,
      coverUrl: entry.canonical.coverUrl,
      format: entry.canonical.format || '전자책',
      availableLibraryCount,
      heldLibraryCount,
      availabilities,
    });
  }

  // Relevance + availability sorting
  const lowerQuery = trimmed.toLowerCase();
  aggregatedBooks.sort((a, b) => {
    const aExact =
      a.title.toLowerCase().includes(lowerQuery) ||
      a.author.toLowerCase().includes(lowerQuery)
        ? 1
        : 0;
    const bExact =
      b.title.toLowerCase().includes(lowerQuery) ||
      b.author.toLowerCase().includes(lowerQuery)
        ? 1
        : 0;
    if (aExact !== bExact) return bExact - aExact;
    if (a.availableLibraryCount !== b.availableLibraryCount) {
      return b.availableLibraryCount - a.availableLibraryCount;
    }
    return b.heldLibraryCount - a.heldLibraryCount;
  });

  return {
    query: trimmed,
    field,
    searchedAt: new Date().toISOString(),
    books: aggregatedBooks,
    librarySummaries: libraryResults.map((r) => r.summary),
  };
}

export async function testCustomLibraryConnection(
  baseUrl: string,
  adapter: LibraryConfig['adapter']
): Promise<{ ok: boolean; detectedAdapter?: LibraryConfig['adapter']; sampleCount: number; message: string }> {
  const normalized = baseUrl.trim().replace(/\/$/, '');
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    return { ok: false, sampleCount: 0, message: 'http:// 또는 https:// 로 시작하는 주소를 입력해 주세요.' };
  }

  try {
    await assertSafePublicUrl(normalized);
  } catch {
    return { ok: false, sampleCount: 0, message: '올바른 외부 도서관 웹 주소를 입력해 주세요.' };
  }

  if (adapter === 'custom-link' || adapter === 'kyobo-subscription') {
    return {
      ok: true,
      detectedAdapter: adapter,
      sampleCount: 0,
      message: '외부 검색 / 로그인 연동 방식으로 등록할 수 있습니다.',
    };
  }

  const candidates: Array<{ adapter: LibraryConfig['adapter']; url: string }> =
    adapter === 'kyobo-root'
      ? [
          { adapter: 'kyobo-root', url: normalized },
          { adapter: 'kyobo-elibrary', url: `${normalized}/elibrary-front` },
        ]
      : [
          {
            adapter: 'kyobo-elibrary',
            url: normalized.endsWith('/elibrary-front')
              ? normalized
              : `${normalized}/elibrary-front`,
          },
          { adapter: 'kyobo-root', url: normalized },
        ];

  for (const candidate of candidates) {
    try {
      const testUrl = `${candidate.url}/search/searchList.ink?schDvsn=000&schTxt=${encodeURIComponent('책')}`;
      const res = await fetchWithTimeout(testUrl, 4500);
      if (res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);
        const count = $('.book_resultList > li').length;
        if (html.includes('book_resultList') || count > 0) {
          return {
            ok: true,
            detectedAdapter: candidate.adapter,
            sampleCount: count,
            message: `실시간 검색 연동 확인 완료 (테스트 검색 ${count}건)`,
          };
        }
      }
    } catch {
      // Try next candidate
    }
  }

  return {
    ok: false,
    sampleCount: 0,
    message: '교보문고 전자도서관 검색 페이지에 연결할 수 없습니다. 외부 검색 링크 방식으로 등록할 수 있습니다.',
  };
}

const IGNORED_WEB_HOSTS = [
  'naver.com',
  'daum.net',
  'kakao.com',
  'tistory.com',
  'youtube.com',
  'youtu.be',
  'google.com',
  'namu.wiki',
  'wikipedia.org',
  'instagram.com',
  'facebook.com',
  'x.com',
  'twitter.com',
  'play.google.com',
  'apps.apple.com',
  'yes24.com',
  'aladin.co.kr',
  'www.kyobobook.co.kr',
  'brunch.co.kr',
  'velog.io',
  'visitkorea.or.kr',
];

function sanitizeLibraryName(raw: string): string {
  return raw
    .replace(/새\s*창\s*열림/g, '')
    .replace(/\s*[-|:]\s*(홈페이지|메인|안내).*$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isRelevantLibraryHost(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (IGNORED_WEB_HOSTS.some((bad) => lower === bad || lower.endsWith(`.${bad}`))) {
    return false;
  }
  return (
    lower.includes('lib') ||
    lower.includes('ebook') ||
    lower.includes('elib') ||
    lower.includes('book') ||
    lower.includes('dkyobobook') ||
    lower.includes('bookcube') ||
    lower.includes('nanet')
  );
}

async function probeDiscoveredOrigin(
  origin: string,
  fallbackName: string
): Promise<DiscoveredLibraryCandidate | null> {
  const cleanFallback = sanitizeLibraryName(fallbackName);

  // 1. Check Kyobo /elibrary-front & root in parallel
  const kyoboCandidates: Array<{ adapter: 'kyobo-elibrary' | 'kyobo-root'; baseUrl: string }> = [
    { adapter: 'kyobo-elibrary', baseUrl: `${origin}/elibrary-front` },
    { adapter: 'kyobo-root', baseUrl: origin },
  ];

  const kyoboHits = await Promise.all(
    kyoboCandidates.map(async (candidate) => {
      try {
        const testUrl = `${candidate.baseUrl}/search/searchList.ink?schDvsn=000&schTxt=${encodeURIComponent('책')}`;
        const res = await fetchWithTimeout(testUrl, 2200);
        if (res.ok) {
          const html = await res.text();
          if (html.includes('book_resultList')) {
            const $ = cheerio.load(html);
            const metaTitle = sanitizeLibraryName(
              cleanText($('meta[name="title"]').attr('content') || '') ||
                cleanText($('title').text().split('|').pop() || '')
            );
            const cleanName = metaTitle && metaTitle.length >= 2 ? metaTitle : cleanFallback;
            return {
              library: {
                id: `web-${origin.replace(/[^a-z0-9]/gi, '-')}`,
                name: cleanName,
                shortName: cleanName.replace(/\s*전자도서관.*$/, '').slice(0, 8) || cleanName.slice(0, 8),
                category: 'owned' as const,
                adapter: candidate.adapter,
                baseUrl: candidate.baseUrl,
                enabled: true,
                description: `${cleanName} (실시간 소장·대출 조회)`,
              },
              supportLevel: 'realtime' as const,
              supportLabel: '실시간 대출여부 조회 지원',
              source: 'web' as const,
            };
          }
        }
      } catch {
        // Ignore timeout/errors
      }
      return null;
    })
  );

  const firstKyobo = kyoboHits.find((h) => h !== null);
  if (firstKyobo) return firstKyobo;

  // 2. Fallback: fetch homepage title for clean official library link
  try {
    const res = await fetchWithTimeout(origin, 2200);
    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      const pageTitle = sanitizeLibraryName(
        cleanText($('title').text()).split(/[:|>]/)[0]
      );
      const usableTitle =
        pageTitle &&
        pageTitle.length >= 2 &&
        pageTitle.length <= 36 &&
        !pageTitle.includes('\uFFFD')
          ? pageTitle
          : cleanFallback;

      return {
        library: {
          id: `web-${origin.replace(/[^a-z0-9]/gi, '-')}`,
          name: usableTitle,
          shortName: usableTitle.replace(/\s*전자도서관.*$/, '').slice(0, 8) || usableTitle.slice(0, 8),
          category: usableTitle.includes('구독') ? 'subscription' : 'owned',
          adapter: 'custom-link',
          baseUrl: origin,
          enabled: true,
          description: `${new URL(origin).hostname} 공식 전자도서관`,
        },
        supportLevel: 'link',
        supportLabel: '공식 도서관 링크 연동',
        source: 'web',
      };
    }
  } catch {
    // Ignore unreachable origins
  }

  return null;
}

export async function discoverLibrariesByName(
  query: string
): Promise<DiscoveredLibraryCandidate[]> {
  const trimmed = query.trim();
  const catalog = [...PRESET_LIBRARIES, ...DEFAULT_LIBRARIES].filter(
    (item, index, self) => self.findIndex((x) => x.id === item.id) === index
  );

  const toCandidate = (lib: LibraryConfig): DiscoveredLibraryCandidate => {
    const isRealtime =
      lib.adapter === 'kyobo-elibrary' ||
      lib.adapter === 'kyobo-root' ||
      lib.adapter === 'gangnam-asp';
    return {
      library: { ...lib, enabled: true },
      supportLevel: isRealtime ? 'realtime' : 'link',
      supportLabel: isRealtime
        ? '실시간 대출여부 조회 지원'
        : lib.adapter === 'kyobo-subscription'
          ? '구독형 로그인 연동'
          : '외부 도서관 검색 연동',
      source: 'directory',
    };
  };

  if (!trimmed) {
    return catalog.map(toCandidate);
  }

  const normalizedQuery = trimmed.replace(/\s+/g, '').toLowerCase();
  const directoryMatches = catalog
    .filter((lib) => {
      const haystack = `${lib.name} ${lib.shortName} ${lib.description || ''}`
        .replace(/\s+/g, '')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    })
    .map(toCandidate);

  const seenOrigins = new Set<string>();
  for (const m of directoryMatches) {
    try {
      seenOrigins.add(new URL(m.library.baseUrl).origin);
    } catch {
      // Ignore
    }
  }

  // Live web discovery for any Korean library name
  const webMatches: DiscoveredLibraryCandidate[] = [];
  try {
    const searchKeyword = trimmed.includes('도서관')
      ? trimmed
      : `${trimmed} 전자도서관`;
    const searchUrl = `https://search.naver.com/search.naver?query=${encodeURIComponent(searchKeyword)}`;
    const res = await fetchWithTimeout(searchUrl, 3500);
    if (res.ok) {
      const html = await res.text();
      const $ = cheerio.load(html);
      const candidateMap = new Map<string, string>();

      $('a[href^="http"]').each((_, el) => {
        const href = $(el).attr('href') || '';
        try {
          const parsed = new URL(href);
          if (!isRelevantLibraryHost(parsed.hostname)) return;
          if (seenOrigins.has(parsed.origin) || candidateMap.has(parsed.origin)) {
            return;
          }
          const anchorText = cleanText($(el).text());
          const scoreBoost =
            parsed.hostname.includes('ebook') ||
            parsed.hostname.includes('elib') ||
            parsed.hostname.includes('dkyobobook');

          if (scoreBoost || anchorText.includes('도서관')) {
            const cleanedText =
              anchorText.length >= 2 && anchorText.length <= 32
                ? anchorText
                : searchKeyword;
            candidateMap.set(parsed.origin, cleanedText);
          }
        } catch {
          // Ignore invalid URLs
        }
      });

      // Prioritize ebook./elib./dkyobobook subdomains
      const sortedOrigins = Array.from(candidateMap.entries())
        .sort((a, b) => {
          const aScore = /ebook|elib|dkyobobook|book/i.test(a[0]) ? 1 : 0;
          const bScore = /ebook|elib|dkyobobook|book/i.test(b[0]) ? 1 : 0;
          return bScore - aScore;
        })
        .slice(0, 5);

      const probed = await Promise.all(
        sortedOrigins.map(([origin, label]) => probeDiscoveredOrigin(origin, label))
      );

      for (const item of probed) {
        if (item) {
          webMatches.push(item);
        }
      }
    }
  } catch {
    // Web discovery is best-effort; directory matches still return cleanly
  }

  return [...directoryMatches, ...webMatches];
}


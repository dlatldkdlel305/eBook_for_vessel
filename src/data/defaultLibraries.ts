import type { LibraryConfig } from '../types.ts';

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
    searchUrlTemplate:
      'https://lib.seoul.go.kr/search/tot/result?st=KWRD&si=TOTAL&q={query}',
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
    searchUrlTemplate:
      'https://www.library.kr/cyber/ebook/ebookList.do?searchKeyword={query}',
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
    searchUrlTemplate:
      'https://dl.nanet.go.kr/search/searchInnerList.do?searchType=SIMPLE&queryText={query}',
    enabled: true,
    description: '국회전자도서관 통합 검색 링크 연동',
  },
];

const STORAGE_KEY = 'chaekmaru_libraries_v1';

export function loadSavedLibraries(): LibraryConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LIBRARIES;
    const parsed = JSON.parse(raw) as LibraryConfig[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_LIBRARIES;
    }
    return parsed;
  } catch {
    return DEFAULT_LIBRARIES;
  }
}

export function saveLibraries(libraries: LibraryConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(libraries));
  } catch {
    // Ignore storage errors
  }
}

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Globe,
  Loader2,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { DEFAULT_LIBRARIES, PRESET_LIBRARIES } from '../data/defaultLibraries.ts';
import {
  discoverLibrariesApi,
  testLibraryConnectionApi,
} from '../lib/api.ts';
import type {
  DiscoveredLibraryCandidate,
  LibraryAdapterType,
  LibraryCategory,
  LibraryConfig,
} from '../types.ts';

interface AddLibraryModalProps {
  isOpen: boolean;
  libraries: LibraryConfig[];
  onClose: () => void;
  onAddLibrary: (library: LibraryConfig) => void;
}

const SUGGESTED_LIBRARY_TERMS = [
  '용인시',
  '마포구',
  '송파구',
  '성남시',
  '경기도',
  '부산',
];

export function AddLibraryModal({
  isOpen,
  libraries,
  onClose,
  onAddLibrary,
}: AddLibraryModalProps) {
  const [activeTab, setActiveTab] = useState<'search' | 'custom'>('search');

  // Search-by-name state
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [webCandidates, setWebCandidates] = useState<
    DiscoveredLibraryCandidate[]
  >([]);
  const [hasQueriedWeb, setHasQueriedWeb] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Manual URL tab state
  const [name, setName] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [category, setCategory] = useState<LibraryCategory>('owned');
  const [adapter, setAdapter] = useState<LibraryAdapterType>('kyobo-elibrary');
  const [searchTemplate, setSearchTemplate] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    detectedAdapter?: LibraryAdapterType;
  } | null>(null);

  const localCatalog = useMemo<DiscoveredLibraryCandidate[]>(() => {
    const merged = [...PRESET_LIBRARIES, ...DEFAULT_LIBRARIES].filter(
      (item, index, self) => self.findIndex((x) => x.id === item.id) === index
    );
    return merged.map((lib) => {
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
    });
  }, []);

  const filteredLocal = useMemo(() => {
    const trimmed = searchQuery.trim().replace(/\s+/g, '').toLowerCase();
    if (!trimmed) return localCatalog;
    return localCatalog.filter((item) => {
      const hay = `${item.library.name} ${item.library.shortName} ${item.library.description || ''}`
        .replace(/\s+/g, '')
        .toLowerCase();
      return hay.includes(trimmed);
    });
  }, [localCatalog, searchQuery]);

  async function runLibraryDiscovery(keyword: string) {
    const trimmed = keyword.trim();
    if (!trimmed) {
      setWebCandidates([]);
      setHasQueriedWeb(false);
      setSearchError(null);
      return;
    }

    if (abortRef.current) {
      abortRef.current.abort();
    }
    const controller = new AbortController();
    abortRef.current = controller;

    setIsSearching(true);
    setSearchError(null);

    try {
      const candidates = await discoverLibrariesApi({
        query: trimmed,
        signal: controller.signal,
      });
      setWebCandidates(candidates);
      setHasQueriedWeb(true);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setSearchError('도서관 검색 중 일시적인 오류가 발생했습니다.');
    } finally {
      if (!controller.signal.aborted) {
        setIsSearching(false);
      }
    }
  }

  // Debounced automatic discovery when user types a library name
  useEffect(() => {
    if (!isOpen || activeTab !== 'search') return;
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setWebCandidates([]);
      setHasQueriedWeb(false);
      return;
    }

    const timer = setTimeout(() => {
      runLibraryDiscovery(trimmed);
    }, 450);

    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, activeTab]);

  if (!isOpen) return null;

  const existingIds = new Set(libraries.map((l) => l.id));
  const existingUrls = new Set(
    libraries.map((l) => l.baseUrl.replace(/\/$/, '').toLowerCase())
  );

  function isAlreadyAdded(lib: LibraryConfig): boolean {
    if (existingIds.has(lib.id)) return true;
    return existingUrls.has(lib.baseUrl.replace(/\/$/, '').toLowerCase());
  }

  // Merge instant local directory matches with live discovered candidates
  const displayedCandidates: DiscoveredLibraryCandidate[] = (() => {
    if (!searchQuery.trim()) return localCatalog;
    if (hasQueriedWeb && webCandidates.length > 0) {
      const seen = new Set(webCandidates.map((c) => c.library.id));
      return [
        ...webCandidates,
        ...filteredLocal.filter((c) => !seen.has(c.library.id)),
      ];
    }
    return filteredLocal;
  })();

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    runLibraryDiscovery(searchQuery);
  }

  async function handleTestConnection() {
    if (!baseUrl.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const data = await testLibraryConnectionApi({
        baseUrl: baseUrl.trim(),
        adapter,
      });
      setTestResult(data);
      if (data.ok && data.detectedAdapter) {
        setAdapter(data.detectedAdapter);
      }
    } catch {
      setTestResult({
        ok: false,
        message: '연결 테스트 요청에 실패했습니다.',
      });
    } finally {
      setTesting(false);
    }
  }

  function handleCustomSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !baseUrl.trim()) return;

    let cleanUrl = baseUrl.trim().replace(/\/$/, '');
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = `https://${cleanUrl}`;
    }

    if (
      adapter === 'kyobo-elibrary' &&
      !cleanUrl.endsWith('/elibrary-front')
    ) {
      cleanUrl = `${cleanUrl}/elibrary-front`;
    }

    const newLib: LibraryConfig = {
      id: `custom-${Date.now()}`,
      name: name.trim(),
      shortName: name.trim().slice(0, 8),
      category,
      adapter,
      baseUrl: cleanUrl,
      searchUrlTemplate:
        adapter === 'custom-link' && searchTemplate.trim()
          ? searchTemplate.trim()
          : undefined,
      enabled: true,
      description:
        adapter === 'custom-link'
          ? '사용자 지정 검색 링크 연동'
          : '사용자 추가 전자도서관',
    };

    onAddLibrary(newLib);
    setName('');
    setBaseUrl('');
    setSearchTemplate('');
    setTestResult(null);
    onClose();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-library-title"
    >
      <div className="w-full max-w-xl bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden flex flex-col max-h-[90dvh]">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2
              id="add-library-title"
              className="text-base font-bold text-slate-900"
            >
              전자도서관 검색 · 추가
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              도서관 이름만 입력하면 자동으로 전자도서관 주소를 찾아 추가합니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="창 닫기"
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-5 pt-3 border-b border-slate-100 flex gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('search')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'search'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            도서관 명으로 검색
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('custom')}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === 'custom'
                ? 'border-blue-700 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            직접 URL로 추가
          </button>
        </div>

        <div className="p-5 overflow-y-auto overscroll-contain flex-1 flex flex-col gap-4 [-webkit-overflow-scrolling:touch]">
          {activeTab === 'search' ? (
            <>
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <div className="relative flex-1 flex items-center border border-slate-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600">
                  <Search className="w-4 h-4 text-slate-400 ml-3 shrink-0" />
                  <label htmlFor="discover-library-input" className="sr-only">
                    도서관 이름 검색
                  </label>
                  <input
                    id="discover-library-input"
                    type="search"
                    enterKeyHint="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="도서관 명을 입력하세요 (예: 용인시, 송파구, 부산, 성남시)"
                    className="w-full px-3 py-2 text-[16px] sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none appearance-none"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setWebCandidates([]);
                        setHasQueriedWeb(false);
                      }}
                      aria-label="검색어 지우기"
                      className="p-1.5 mr-1 text-slate-400 hover:text-slate-700 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5"
                >
                  {isSearching && (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  )}
                  <span>검색</span>
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-slate-500">빠른 찾기:</span>
                {SUGGESTED_LIBRARY_TERMS.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      setSearchQuery(term);
                      runLibraryDiscovery(term);
                    }}
                    className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
                      searchQuery === term
                        ? 'bg-blue-50 text-blue-700 font-semibold'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
                    }`}
                  >
                    {term}
                  </button>
                ))}
              </div>

              {searchError && (
                <p className="text-xs text-rose-600">{searchError}</p>
              )}

              {isSearching && displayedCandidates.length === 0 ? (
                <div className="py-10 flex flex-col items-center justify-center text-center gap-2 text-xs text-slate-500 border border-slate-200 rounded-lg">
                  <Loader2 className="w-5 h-5 animate-spin text-blue-700" />
                  <span>
                    &ldquo;{searchQuery}&rdquo; 공식 전자도서관 주소를 검색하고 있습니다...
                  </span>
                </div>
              ) : displayedCandidates.length === 0 ? (
                <div className="py-10 px-4 text-center border border-slate-200 rounded-lg">
                  <p className="text-sm font-semibold text-slate-900">
                    일치하는 전자도서관을 찾지 못했습니다
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    도서관 전체 이름(예: OO구 전자도서관, OO시립도서관)으로 검색하거나, 상단 &lsquo;직접 URL로 추가&rsquo; 탭에서 주소를 등록할 수 있습니다.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      {searchQuery.trim()
                        ? `검색 결과 ${displayedCandidates.length}곳`
                        : `주요 추천 전자도서관 ${displayedCandidates.length}곳`}
                    </span>
                    {isSearching && (
                      <span className="inline-flex items-center gap-1 text-blue-700">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        웹에서 추가 탐색 중...
                      </span>
                    )}
                  </div>

                  <ul className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
                    {displayedCandidates.map((item) => {
                      const lib = item.library;
                      const added = isAlreadyAdded(lib);
                      let hostname = lib.baseUrl;
                      try {
                        hostname = new URL(lib.baseUrl).hostname;
                      } catch {
                        // Keep raw
                      }

                      return (
                        <li
                          key={`${lib.id}-${lib.baseUrl}`}
                          className="px-4 py-3 flex items-center justify-between gap-3 bg-white hover:bg-slate-50/60 transition-colors"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-slate-900 truncate">
                                {lib.name}
                              </span>
                              <span
                                className={`text-[11px] font-medium ${
                                  item.supportLevel === 'realtime'
                                    ? 'text-emerald-700'
                                    : 'text-slate-500'
                                }`}
                              >
                                {item.supportLabel}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 truncate">
                              <Globe className="w-3 h-3 shrink-0 text-slate-400" />
                              <span className="truncate">{hostname}</span>
                              {lib.description && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="truncate">
                                    {lib.description}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {added ? (
                            <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 px-2.5 py-1.5 whitespace-nowrap shrink-0">
                              <Check className="w-3.5 h-3.5" />
                              추가됨
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                onAddLibrary({ ...lib, enabled: true })
                              }
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-blue-700 transition-colors whitespace-nowrap shrink-0"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              추가
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <form onSubmit={handleCustomSubmit} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="lib-name"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  도서관 이름
                </label>
                <input
                  id="lib-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="예: 성남시 전자도서관, 사내 전자도서관"
                  className="w-full px-3 py-2 text-[16px] sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="lib-category"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    운영 방식
                  </label>
                  <select
                    id="lib-category"
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as LibraryCategory)
                    }
                    className="w-full px-3 py-2 text-[16px] sm:text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="owned">소장형 전자책</option>
                    <option value="subscription">구독형 전자책</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="lib-adapter"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    연동 플랫폼
                  </label>
                  <select
                    id="lib-adapter"
                    value={adapter}
                    onChange={(e) =>
                      setAdapter(e.target.value as LibraryAdapterType)
                    }
                    className="w-full px-3 py-2 text-[16px] sm:text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    <option value="kyobo-elibrary">
                      교보문고 (/elibrary-front)
                    </option>
                    <option value="kyobo-root">교보문고 (독립 도메인)</option>
                    <option value="kyobo-subscription">
                      구독형 (로그인 연동)
                    </option>
                    <option value="custom-link">외부 검색 링크</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="lib-url"
                  className="block text-xs font-semibold text-slate-700 mb-1.5"
                >
                  도서관 웹 주소 (URL)
                </label>
                <div className="flex gap-2">
                  <input
                    id="lib-url"
                    type="url"
                    required
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://ebook.example.go.kr"
                    className="flex-1 px-3 py-2 text-[16px] sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  {adapter !== 'custom-link' &&
                    adapter !== 'kyobo-subscription' && (
                      <button
                        type="button"
                        onClick={handleTestConnection}
                        disabled={testing || !baseUrl.trim()}
                        className="px-3 py-2 text-xs font-medium border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap shrink-0 flex items-center gap-1.5"
                      >
                        {testing && (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        )}
                        연결 테스트
                      </button>
                    )}
                </div>
                {testResult && (
                  <p
                    className={`mt-1.5 text-xs flex items-center gap-1.5 ${
                      testResult.ok ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {testResult.ok && (
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    )}
                    <span>{testResult.message}</span>
                  </p>
                )}
              </div>

              {adapter === 'custom-link' && (
                <div>
                  <label
                    htmlFor="lib-template"
                    className="block text-xs font-semibold text-slate-700 mb-1.5"
                  >
                    검색 URL 템플릿 (선택)
                  </label>
                  <input
                    id="lib-template"
                    type="text"
                    value={searchTemplate}
                    onChange={(e) => setSearchTemplate(e.target.value)}
                    placeholder="https://lib.example.kr/search?q={query}"
                    className="w-full px-3 py-2 text-[16px] sm:text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    {'{query}'} 위치에 선택한 도서 제목이 자동으로 입력됩니다.
                  </p>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-blue-700 text-white rounded-lg hover:bg-blue-800 transition-colors whitespace-nowrap"
                >
                  도서관 추가하기
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

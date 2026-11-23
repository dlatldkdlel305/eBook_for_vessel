import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Clock,
  Library,
  Plus,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { AddLibraryModal } from './components/AddLibraryModal.tsx';
import { BookCover } from './components/BookCover.tsx';
import { BookDetailPanel } from './components/BookDetailPanel.tsx';
import { LibrarySidebar } from './components/LibrarySidebar.tsx';
import {
  DEFAULT_LIBRARIES,
  loadSavedLibraries,
  saveLibraries,
} from './data/defaultLibraries.ts';
import { searchBooksApi } from './lib/api.ts';
import type {
  AggregatedBook,
  LibraryConfig,
  LibrarySearchSummary,
  SearchField,
} from './types.ts';

const QUICK_KEYWORDS = [
  '한강',
  '불편한 편의점',
  '물고기는 존재하지 않는다',
  '모순',
  '아몬드',
  '트렌드 코리아',
];

type ResultFilter = 'all' | 'available' | 'multi';
type SortOrder = 'relevance' | 'libraries' | 'newest';

export default function App() {
  const [libraries, setLibraries] = useState<LibraryConfig[]>(() =>
    loadSavedLibraries()
  );
  const [queryInput, setQueryInput] = useState('');
  const [activeQuery, setActiveQuery] = useState('');
  const [searchField, setSearchField] = useState<SearchField>('all');
  const [books, setBooks] = useState<AggregatedBook[]>([]);
  const [summaries, setSummaries] = useState<LibrarySearchSummary[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [resultFilter, setResultFilter] = useState<ResultFilter>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('relevance');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const librarySectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    saveLibraries(libraries);
  }, [libraries]);

  const executeSearch = useCallback(
    async (
      targetQuery: string,
      targetField: SearchField,
      targetLibraries: LibraryConfig[]
    ) => {
      const trimmed = targetQuery.trim();
      if (!trimmed) {
        setBooks([]);
        setSummaries([]);
        setSelectedBookId(null);
        setActiveQuery('');
        return;
      }

      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setErrorMessage(null);
      setActiveQuery(trimmed);

      try {
        const data = await searchBooksApi({
          query: trimmed,
          field: targetField,
          libraries: targetLibraries,
          signal: controller.signal,
        });
        setBooks(data.books);
        setSummaries(data.librarySummaries);
        setSelectedBookId((prev) => {
          if (prev && data.books.some((b) => b.id === prev)) {
            return prev;
          }
          return data.books[0]?.id ?? null;
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setErrorMessage(
          err instanceof Error
            ? err.message
            : '도서관 서버와 통신 중 오류가 발생했습니다.'
        );
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    []
  );

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    executeSearch(queryInput, searchField, libraries);
  }

  function handleQuickKeyword(keyword: string) {
    setQueryInput(keyword);
    executeSearch(keyword, searchField, libraries);
  }

  function handleToggleLibrary(id: string) {
    const updated = libraries.map((lib) =>
      lib.id === id ? { ...lib, enabled: !lib.enabled } : lib
    );
    setLibraries(updated);
    if (activeQuery) {
      executeSearch(activeQuery, searchField, updated);
    }
  }

  function handleRemoveLibrary(id: string) {
    const updated = libraries.filter((lib) => lib.id !== id);
    setLibraries(updated);
    if (activeQuery) {
      executeSearch(activeQuery, searchField, updated);
    }
  }

  function handleAddLibrary(newLib: LibraryConfig) {
    if (libraries.some((l) => l.id === newLib.id)) return;
    const updated = [...libraries, newLib];
    setLibraries(updated);
    if (activeQuery) {
      executeSearch(activeQuery, searchField, updated);
    }
  }

  function handleResetDefaults() {
    setLibraries(DEFAULT_LIBRARIES);
    if (activeQuery) {
      executeSearch(activeQuery, searchField, DEFAULT_LIBRARIES);
    }
  }

  const filteredAndSortedBooks = useMemo(() => {
    let list = books;
    if (resultFilter === 'available') {
      list = list.filter((b) => b.availableLibraryCount > 0);
    } else if (resultFilter === 'multi') {
      list = list.filter((b) => b.heldLibraryCount >= 2);
    }

    if (sortOrder === 'libraries') {
      return [...list].sort(
        (a, b) =>
          b.heldLibraryCount - a.heldLibraryCount ||
          b.availableLibraryCount - a.availableLibraryCount
      );
    }
    if (sortOrder === 'newest') {
      return [...list].sort((a, b) =>
        (b.publishDate || '').localeCompare(a.publishDate || '')
      );
    }
    return list;
  }, [books, resultFilter, sortOrder]);

  const selectedBook = useMemo(() => {
    if (!selectedBookId) return filteredAndSortedBooks[0] ?? null;
    return (
      filteredAndSortedBooks.find((b) => b.id === selectedBookId) ??
      books.find((b) => b.id === selectedBookId) ??
      filteredAndSortedBooks[0] ??
      null
    );
  }, [books, filteredAndSortedBooks, selectedBookId]);

  const availableBookCount = useMemo(
    () => books.filter((b) => b.availableLibraryCount > 0).length,
    [books]
  );

  const enabledLibrariesCount = libraries.filter((l) => l.enabled).length;

  return (
    <div className="min-h-[100dvh] flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones separated cleanly */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200 pt-[env(safe-area-inset-top)]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-15 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Brand wordmark */}
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              setResultFilter('all');
            }}
            className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 flex items-center gap-2"
          >
            <BookOpen className="w-5 h-5 text-blue-700" />
            <span>책마루</span>
          </a>

          {/* Zone 2: Concise single-line navigation links */}
          <nav
            className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600"
            aria-label="주요 보기"
          >
            <button
              type="button"
              onClick={() => setResultFilter('all')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                resultFilter === 'all'
                  ? 'border-blue-700 text-slate-900'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              통합 검색
            </button>
            <button
              type="button"
              onClick={() => setResultFilter('available')}
              className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                resultFilter === 'available'
                  ? 'border-blue-700 text-slate-900'
                  : 'border-transparent hover:text-slate-900'
              }`}
            >
              대출 가능 도서
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileSidebarOpen(true);
                librarySectionRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="whitespace-nowrap shrink-0 py-1 border-b-2 border-transparent hover:text-slate-900 transition-colors"
            >
              내 도서관 목록
            </button>
          </nav>

          {/* Zone 3: 1 Primary CTA */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>도서관 추가</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {/* Search Bar Hero Strip */}
        <section
          aria-label="전자책 통합 검색"
          className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6"
        >
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-4">
            <div>
              <h1
                className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight"
                style={{ textWrap: 'balance' }}
              >
                가입한 전자도서관 한 번에 검색하기
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                책 제목, 저자, 키워드를 입력하면 내 도서관별 소장 여부와 실시간 대출 가능 권수를 바로 확인합니다.
              </p>
            </div>
            <div className="flex items-center gap-2 lg:hidden">
              <button
                type="button"
                onClick={() => setMobileSidebarOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[40px] rounded-lg border border-slate-200 text-xs font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 whitespace-nowrap"
              >
                <Library className="w-3.5 h-3.5" />
                <span>검색 도서관 {enabledLibrariesCount}곳 설정</span>
              </button>
            </div>
          </div>

          <form
            onSubmit={handleSearchSubmit}
            className="flex flex-col sm:flex-row gap-2.5"
          >
            <div className="flex flex-1 border border-slate-300 rounded-lg bg-white focus-within:ring-2 focus-within:ring-blue-600 focus-within:border-blue-600 overflow-hidden">
              <label htmlFor="search-field" className="sr-only">
                검색 기준
              </label>
              <select
                id="search-field"
                value={searchField}
                onChange={(e) => setSearchField(e.target.value as SearchField)}
                className="px-3 py-2.5 text-[16px] sm:text-sm font-medium text-slate-700 bg-slate-50 border-r border-slate-200 focus:outline-none shrink-0 rounded-none"
              >
                <option value="all">통합검색</option>
                <option value="title">도서명</option>
                <option value="author">저자</option>
              </select>

              <div className="relative flex-1 flex items-center min-w-0">
                <Search className="w-4 h-4 text-slate-400 ml-3 shrink-0" />
                <label htmlFor="book-search-input" className="sr-only">
                  도서 검색어 입력
                </label>
                <input
                  id="book-search-input"
                  type="search"
                  enterKeyHint="search"
                  value={queryInput}
                  onChange={(e) => setQueryInput(e.target.value)}
                  placeholder="책 제목, 저자, 키워드를 입력하세요"
                  className="w-full min-w-0 px-3 py-2.5 text-[16px] sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none appearance-none bg-transparent"
                />
                {queryInput && (
                  <button
                    type="button"
                    onClick={() => setQueryInput('')}
                    aria-label="검색어 지우기"
                    className="p-2 mr-1 text-slate-400 hover:text-slate-700 rounded"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !queryInput.trim() || enabledLibrariesCount === 0}
              className="px-6 py-2.5 min-h-[44px] rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
            >
              {isLoading ? '검색 중...' : '통합 검색'}
            </button>
          </form>

          {/* Quick Search Keywords */}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">빠른 검색:</span>
            {QUICK_KEYWORDS.map((kw) => (
              <button
                key={kw}
                type="button"
                onClick={() => handleQuickKeyword(kw)}
                className={`px-2.5 py-1 rounded-md transition-colors whitespace-nowrap ${
                  activeQuery === kw
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200/70'
                }`}
              >
                {kw}
              </button>
            ))}
          </div>
        </section>

        {/* Main Workspace: Sidebar + Results + Sticky Detail */}
        <div className="flex flex-col lg:flex-row items-start gap-6">
          {/* Left Library Roster */}
          <div
            ref={librarySectionRef}
            className={`${
              mobileSidebarOpen ? 'block' : 'hidden'
            } lg:block w-full lg:w-auto`}
          >
            <LibrarySidebar
              libraries={libraries}
              summaries={summaries}
              isSearching={isLoading}
              onToggleLibrary={handleToggleLibrary}
              onRemoveLibrary={handleRemoveLibrary}
              onOpenAddModal={() => setIsAddModalOpen(true)}
              onResetDefaults={handleResetDefaults}
            />
          </div>

          {/* Center + Right Split Workspace */}
          <div className="flex-1 min-w-0 w-full flex flex-col gap-4">
            {/* Toolbar & Filter Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg max-w-full overflow-x-auto">
                <button
                  type="button"
                  onClick={() => setResultFilter('all')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap tabular-nums ${
                    resultFilter === 'all'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  전체 ({books.length})
                </button>
                <button
                  type="button"
                  onClick={() => setResultFilter('available')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap tabular-nums ${
                    resultFilter === 'available'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  지금 대출 가능 ({availableBookCount})
                </button>
                <button
                  type="button"
                  onClick={() => setResultFilter('multi')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    resultFilter === 'multi'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  2곳 이상 소장
                </button>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-600">
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
                <label htmlFor="sort-order" className="sr-only">
                  정렬 기준
                </label>
                <select
                  id="sort-order"
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                  className="bg-transparent font-medium text-slate-700 focus:outline-none cursor-pointer"
                >
                  <option value="relevance">관련도 · 대출가능순</option>
                  <option value="libraries">보유 도서관 많은순</option>
                  <option value="newest">최신 출간순</option>
                </select>
              </div>
            </div>

            {errorMessage && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center justify-between gap-3 text-sm text-rose-800">
                <div className="flex items-center gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
                <button
                  type="button"
                  onClick={() => executeSearch(activeQuery, searchField, libraries)}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-rose-200 rounded-lg hover:bg-rose-100 whitespace-nowrap"
                >
                  다시 시도
                </button>
              </div>
            )}

            {enabledLibrariesCount === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                <p className="text-sm font-semibold text-slate-900">
                  선택된 검색 도서관이 없습니다
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  왼쪽 목록에서 도서관을 선택하거나 새로운 도서관을 추가해 주세요.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-start">
                {/* Search Results List */}
                <div className="xl:col-span-7 flex flex-col gap-2.5">
                  {isLoading ? (
                    Array.from({ length: 6 }).map((_, idx) => (
                      <div
                        key={idx}
                        className="bg-white border border-slate-200 rounded-xl p-4 flex gap-4 animate-pulse"
                      >
                        <div className="w-16 h-23 bg-slate-200 rounded-md shrink-0" />
                        <div className="flex-1 flex flex-col gap-2 py-1">
                          <div className="h-4 bg-slate-200 rounded w-3/5" />
                          <div className="h-3 bg-slate-100 rounded w-2/5" />
                          <div className="h-3 bg-slate-100 rounded w-4/5 mt-1" />
                        </div>
                      </div>
                    ))
                  ) : filteredAndSortedBooks.length === 0 ? (
                    <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                      <p className="text-sm font-semibold text-slate-900">
                        {activeQuery
                          ? `"${activeQuery}"에 대한 검색 결과가 없습니다`
                          : '검색어를 입력해 도서를 찾아보세요'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1.5">
                        {resultFilter !== 'all'
                          ? '필터를 "전체"로 변경하거나 다른 검색어를 입력해 보세요.'
                          : '도서명이나 저자명 일부만 입력해 보시거나 검색 대상 도서관을 추가해 보세요.'}
                      </p>
                      {resultFilter !== 'all' && books.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setResultFilter('all')}
                          className="mt-4 px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          전체 결과 보기
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredAndSortedBooks.map((book) => {
                      const isSelected = selectedBook?.id === book.id;
                      const heldNames = book.availabilities
                        .filter(
                          (a) =>
                            a.status === 'available' ||
                            a.status === 'subscription_available' ||
                            a.status === 'loaned'
                        )
                        .map((a) => {
                          const lib = libraries.find((l) => l.id === a.libraryId);
                          return lib?.shortName || a.libraryName;
                        });

                      return (
                        <button
                          key={book.id}
                          type="button"
                          onClick={() => {
                            setSelectedBookId(book.id);
                            setMobileDetailOpen(true);
                          }}
                          className={`w-full text-left rounded-xl border p-4 flex items-start gap-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 ${
                            isSelected
                              ? 'bg-blue-50/45 border-blue-600'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                          }`}
                        >
                          <BookCover
                            src={book.coverUrl}
                            title={book.title}
                            size="md"
                          />

                          <div className="min-w-0 flex-1">
                            <h3 className="text-[15px] font-bold text-slate-900 leading-snug line-clamp-2 break-keep">
                              {book.title}
                            </h3>

                            <div className="mt-1 text-xs text-slate-600 flex flex-wrap items-center gap-1.5">
                              <span className="font-medium text-slate-800">
                                {book.author}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{book.publisher}</span>
                              {book.publishDate && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span className="tabular-nums text-slate-500">
                                    {book.publishDate}
                                  </span>
                                </>
                              )}
                            </div>

                            {book.description && (
                              <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed">
                                {book.description}
                              </p>
                            )}

                            <div className="mt-3 pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                {book.availableLibraryCount > 0 ? (
                                  <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 tabular-nums shrink-0">
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                                    <span>
                                      대출 가능 {book.availableLibraryCount}곳
                                    </span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 font-semibold text-amber-700 shrink-0">
                                    <Clock className="w-3.5 h-3.5 shrink-0" />
                                    <span>소장처 모두 대출중</span>
                                  </span>
                                )}
                                <span aria-hidden="true" className="text-slate-300 shrink-0">
                                  ·
                                </span>
                                <span className="text-slate-600 truncate min-w-0">
                                  {heldNames.join(', ')}
                                </span>
                              </div>

                              <span className="text-[11px] font-medium text-blue-700 whitespace-nowrap">
                                대출여부 확인 →
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {/* Desktop Sticky Availability Inspection Panel */}
                <div className="hidden xl:block xl:col-span-5 sticky top-20">
                  <BookDetailPanel book={selectedBook} />
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Mobile / Tablet Book Detail Sheet */}
      {mobileDetailOpen && selectedBook && (
        <div
          className="xl:hidden fixed inset-0 z-40 bg-slate-900/45 flex items-end sm:items-center justify-center p-0 sm:p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl max-h-[88dvh] overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch] rounded-t-2xl sm:rounded-xl bg-white shadow-2xl pb-[env(safe-area-inset-bottom)]">
            <BookDetailPanel
              book={selectedBook}
              onCloseMobile={() => setMobileDetailOpen(false)}
            />
          </div>
        </div>
      )}

      <AddLibraryModal
        isOpen={isAddModalOpen}
        libraries={libraries}
        onClose={() => setIsAddModalOpen(false)}
        onAddLibrary={handleAddLibrary}
      />
    </div>
  );
}

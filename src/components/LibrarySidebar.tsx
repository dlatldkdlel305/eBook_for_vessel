import { Check, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { LibraryConfig, LibrarySearchSummary } from '../types.ts';

interface LibrarySidebarProps {
  libraries: LibraryConfig[];
  summaries: LibrarySearchSummary[];
  isSearching: boolean;
  onToggleLibrary: (id: string) => void;
  onRemoveLibrary: (id: string) => void;
  onOpenAddModal: () => void;
  onResetDefaults: () => void;
}

export function LibrarySidebar({
  libraries,
  summaries,
  isSearching,
  onToggleLibrary,
  onRemoveLibrary,
  onOpenAddModal,
  onResetDefaults,
}: LibrarySidebarProps) {
  const enabledCount = libraries.filter((l) => l.enabled).length;
  const summaryMap = new Map(summaries.map((s) => [s.libraryId, s]));

  return (
    <aside className="w-full lg:w-[276px] shrink-0 bg-white border border-slate-200 rounded-xl p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">내 가입 도서관</h2>
          <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
            {enabledCount}/{libraries.length}개 검색 대상 포함
          </p>
        </div>
        <button
          type="button"
          onClick={onResetDefaults}
          title="기본 5개 도서관 목록으로 복원"
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      <ul className="flex flex-col gap-1.5" role="list">
        {libraries.map((lib) => {
          const summary = summaryMap.get(lib.id);
          return (
            <li
              key={lib.id}
              className={`group flex items-start justify-between gap-2 rounded-lg px-2.5 py-2 transition-colors ${
                lib.enabled
                  ? 'bg-slate-50/80 hover:bg-slate-100/80'
                  : 'opacity-60 hover:opacity-85 hover:bg-slate-50'
              }`}
            >
              <button
                type="button"
                onClick={() => onToggleLibrary(lib.id)}
                className="flex items-start gap-2.5 text-left flex-1 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
              >
                <span
                  className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    lib.enabled
                      ? 'bg-blue-700 border-blue-700 text-white'
                      : 'bg-white border-slate-300 text-transparent'
                  }`}
                >
                  <Check className="w-3 h-3 stroke-[2.5]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-medium text-slate-900 truncate">
                    {lib.name}
                  </div>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                    <span>
                      {lib.category === 'subscription' ? '구독형' : '소장형'}
                    </span>
                    <span aria-hidden="true">·</span>
                    {isSearching && lib.enabled ? (
                      <span className="text-blue-700">조회 중...</span>
                    ) : summary && lib.enabled ? (
                      summary.status === 'ok' ? (
                        <span className="tabular-nums text-slate-600">
                          {summary.resultCount}건
                          {summary.availableCount > 0
                            ? ` (대출가능 ${summary.availableCount})`
                            : ''}
                        </span>
                      ) : summary.status === 'auth_required' ? (
                        <span className="text-blue-700">로그인 연동</span>
                      ) : summary.status === 'external' ? (
                        <span className="text-slate-500">외부 링크</span>
                      ) : (
                        <span className="text-rose-600">연결 지연</span>
                      )
                    ) : (
                      <span>{lib.enabled ? '검색 대기' : '제외됨'}</span>
                    )}
                  </div>
                </div>
              </button>

              {libraries.length > 1 && (
                <button
                  type="button"
                  onClick={() => onRemoveLibrary(lib.id)}
                  aria-label={`${lib.name} 목록에서 제거`}
                  className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus:opacity-100 p-2 -mr-1 text-slate-400 hover:text-rose-600 rounded-lg transition-opacity min-w-[36px] min-h-[36px] flex items-center justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onOpenAddModal}
        className="w-full min-h-[44px] py-2.5 px-3 rounded-lg border border-dashed border-slate-300 text-[13px] font-medium text-slate-700 hover:border-blue-600 hover:text-blue-700 hover:bg-blue-50/40 transition-colors flex items-center justify-center gap-1.5 whitespace-nowrap"
      >
        <Plus className="w-4 h-4" />
        <span>도서관 목록 추가</span>
      </button>
    </aside>
  );
}

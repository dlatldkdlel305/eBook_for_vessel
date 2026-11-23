import {
  AlertCircle,
  BookMarked,
  CheckCircle2,
  Clock,
  ExternalLink,
  KeyRound,
  MinusCircle,
  X,
} from 'lucide-react';
import { isSafeExternalUrl } from '../lib/api.ts';
import type { AggregatedBook, AvailabilityStatus, LibraryAvailability } from '../types.ts';
import { BookCover } from './BookCover.tsx';

interface BookDetailPanelProps {
  book: AggregatedBook | null;
  onCloseMobile?: () => void;
}

function StatusIndicator({ status }: { status: AvailabilityStatus }) {
  switch (status) {
    case 'available':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>대출 가능</span>
        </span>
      );
    case 'subscription_available':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 whitespace-nowrap">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>구독형 · 즉시 대출</span>
        </span>
      );
    case 'loaned':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
          <Clock className="w-4 h-4 shrink-0" />
          <span>대출중 · 예약 가능</span>
        </span>
      );
    case 'login_required':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 whitespace-nowrap">
          <KeyRound className="w-4 h-4 shrink-0" />
          <span>구독형 · 로그인 확인</span>
        </span>
      );
    case 'external_link':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 whitespace-nowrap">
          <ExternalLink className="w-4 h-4 shrink-0" />
          <span>외부 검색 확인</span>
        </span>
      );
    case 'error':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 whitespace-nowrap">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>조회 오류</span>
        </span>
      );
    case 'not_held':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 whitespace-nowrap">
          <MinusCircle className="w-4 h-4 shrink-0" />
          <span>미소장</span>
        </span>
      );
  }
}

function formatCopyMetrics(item: LibraryAvailability): string | null {
  if (
    typeof item.totalCopies === 'number' &&
    typeof item.loanedCopies === 'number'
  ) {
    const remaining = item.availableCopies ?? Math.max(0, item.totalCopies - item.loanedCopies);
    const reserveText =
      typeof item.reservedCount === 'number' ? ` · 예약 ${item.reservedCount}명` : '';
    return `잔여 ${remaining}권 (대출 ${item.loanedCopies}/${item.totalCopies}${reserveText})`;
  }
  return null;
}

export function BookDetailPanel({ book, onCloseMobile }: BookDetailPanelProps) {
  if (!book) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center min-h-[420px]">
        <div className="w-11 h-11 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
          <BookMarked className="w-5 h-5" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900">
          도서를 선택해 주세요
        </h3>
        <p className="text-xs text-slate-500 mt-1.5 max-w-[260px] leading-relaxed">
          검색 결과에서 책을 선택하면 가입한 도서관별 소장 여부와 실시간 대출 가능 권수를 한눈에 비교할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-4 min-w-0">
            <BookCover src={book.coverUrl} title={book.title} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                <span>{book.format}</span>
                <span aria-hidden="true">·</span>
                <span>{book.publisher}</span>
                {book.publishDate && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{book.publishDate}</span>
                  </>
                )}
              </div>
              <h2
                className="text-lg font-bold text-slate-900 mt-1 leading-snug break-keep"
                style={{ textWrap: 'balance' }}
              >
                {book.title}
              </h2>
              <p className="text-sm text-slate-700 mt-1 font-medium">
                {book.author}
              </p>
              <div className="mt-3 text-xs font-medium text-slate-600 tabular-nums">
                {book.availableLibraryCount > 0 ? (
                  <span className="text-emerald-700">
                    현재 {book.availableLibraryCount}개 도서관에서 바로 대출 가능
                  </span>
                ) : book.heldLibraryCount > 0 ? (
                  <span className="text-amber-700">
                    소장 {book.heldLibraryCount}곳 모두 대출중 (예약 가능)
                  </span>
                ) : (
                  <span>도서관별 확인 필요</span>
                )}
              </div>
            </div>
          </div>

          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="상세 패널 닫기"
              className="xl:hidden min-w-[40px] min-h-[40px] flex items-center justify-center shrink-0 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {book.description && (
          <p className="mt-4 text-xs text-slate-600 leading-relaxed line-clamp-3">
            {book.description}
          </p>
        )}
      </div>

      <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-slate-800">
          도서관별 대출 가능여부 ({book.availabilities.length}곳)
        </h3>
        <span className="text-[11px] text-slate-500">실시간 조회 기준</span>
      </div>

      <ul className="divide-y divide-slate-100" role="list">
        {book.availabilities.map((item) => {
          const metrics = formatCopyMetrics(item);
          const isActionable =
            item.status === 'available' ||
            item.status === 'subscription_available' ||
            item.status === 'loaned' ||
            item.status === 'login_required' ||
            item.status === 'external_link';

          return (
            <li
              key={item.libraryId}
              className={`px-5 py-3.5 transition-colors ${
                item.status === 'available' || item.status === 'subscription_available'
                  ? 'bg-emerald-50/25'
                  : 'bg-white'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-900">
                      {item.libraryName}
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {item.category === 'subscription' ? '구독형' : '소장형'}
                      {item.vendor ? ` · ${item.vendor}` : ''}
                    </span>
                  </div>

                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <StatusIndicator status={item.status} />
                    {metrics && (
                      <span className="text-xs text-slate-600 tabular-nums font-mono">
                        {metrics}
                      </span>
                    )}
                  </div>

                  {item.matchedTitle && item.matchedTitle !== book.title && (
                    <p className="text-[11px] text-slate-500 mt-1 truncate">
                      도서관 표기: {item.matchedTitle}
                    </p>
                  )}

                  {item.note && (
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                      {item.note}
                    </p>
                  )}

                  {item.editions && item.editions.length > 1 && (
                    <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col gap-1">
                      {item.editions.map((ed, idx) => (
                        <div
                          key={`${ed.detailUrl}-${idx}`}
                          className="flex items-center justify-between text-[11px] text-slate-600 gap-2"
                        >
                          <span className="truncate">
                            {ed.vendor || '전자책'} · {ed.title}
                          </span>
                          <span className="tabular-nums shrink-0 font-mono">
                            {typeof ed.totalCopies === 'number'
                              ? `잔여 ${ed.availableCopies ?? 0}/${ed.totalCopies}`
                              : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {!isSafeExternalUrl(item.detailUrl) ? null : isActionable ? (
                  <a
                    href={item.detailUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`shrink-0 inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                      item.status === 'available' ||
                      item.status === 'subscription_available'
                        ? 'bg-blue-700 text-white hover:bg-blue-800'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span>
                      {item.status === 'available' ||
                      item.status === 'subscription_available'
                        ? '대출하기'
                        : item.status === 'loaned'
                          ? '예약하기'
                          : '도서관 열기'}
                    </span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <a
                    href={item.detailUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 text-xs text-slate-400 hover:text-slate-700 px-2 py-1.5 whitespace-nowrap"
                  >
                    직접 검색
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

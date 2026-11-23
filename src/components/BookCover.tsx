import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import { resolveCoverUrl } from '../lib/api.ts';

interface BookCoverProps {
  src?: string;
  title: string;
  size?: 'sm' | 'md' | 'lg';
}

export function BookCover({ src, title, size = 'md' }: BookCoverProps) {
  const [failed, setFailed] = useState(false);
  const resolvedSrc = resolveCoverUrl(src);

  const dimensions =
    size === 'sm'
      ? 'w-12 h-17'
      : size === 'lg'
        ? 'w-24 h-34'
        : 'w-16 h-23';

  if (!resolvedSrc || failed) {
    return (
      <div
        className={`${dimensions} shrink-0 rounded-md border border-slate-200 bg-gradient-to-br from-slate-100 via-slate-50 to-slate-200/80 flex flex-col items-center justify-center p-1.5 text-center select-none overflow-hidden`}
        aria-label={title}
      >
        <BookOpen className="w-4 h-4 text-slate-400 mb-1 shrink-0" />
        <span className="text-[10px] leading-tight font-medium text-slate-500 line-clamp-3 break-keep">
          {title}
        </span>
      </div>
    );
  }

  return (
    <div
      className={`${dimensions} shrink-0 rounded-md border border-slate-200/90 bg-slate-100 overflow-hidden relative`}
    >
      <img
        src={resolvedSrc}
        alt={title}
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-full h-full object-cover"
      />
    </div>
  );
}

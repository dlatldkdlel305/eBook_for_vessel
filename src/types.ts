export type LibraryAdapterType =
  | 'kyobo-elibrary'
  | 'kyobo-root'
  | 'gangnam-asp'
  | 'kyobo-subscription'
  | 'custom-link';

export type LibraryCategory = 'owned' | 'subscription';

export interface LibraryConfig {
  id: string;
  name: string;
  shortName: string;
  category: LibraryCategory;
  adapter: LibraryAdapterType;
  baseUrl: string;
  searchUrlTemplate?: string;
  enabled: boolean;
  isDefault?: boolean;
  description?: string;
}

export type SearchField = 'all' | 'title' | 'author';

export type AvailabilityStatus =
  | 'available'
  | 'loaned'
  | 'subscription_available'
  | 'login_required'
  | 'not_held'
  | 'external_link'
  | 'error';

export interface RawLibraryBook {
  libraryId: string;
  title: string;
  author: string;
  publisher: string;
  publishDate: string;
  description: string;
  coverUrl: string;
  detailUrl: string;
  vendor?: string;
  format?: string;
  status: AvailabilityStatus;
  totalCopies?: number;
  loanedCopies?: number;
  availableCopies?: number;
  reservedCount?: number;
  note?: string;
}

export interface LibraryAvailability {
  libraryId: string;
  libraryName: string;
  category: LibraryCategory;
  status: AvailabilityStatus;
  totalCopies?: number;
  loanedCopies?: number;
  availableCopies?: number;
  reservedCount?: number;
  vendor?: string;
  matchedTitle?: string;
  detailUrl: string;
  note?: string;
  editions?: Array<{
    title: string;
    vendor?: string;
    status: AvailabilityStatus;
    totalCopies?: number;
    loanedCopies?: number;
    availableCopies?: number;
    reservedCount?: number;
    detailUrl: string;
  }>;
}

export interface AggregatedBook {
  id: string;
  title: string;
  author: string;
  publisher: string;
  publishDate: string;
  description: string;
  coverUrl: string;
  format: string;
  availableLibraryCount: number;
  heldLibraryCount: number;
  availabilities: LibraryAvailability[];
}

export interface LibrarySearchSummary {
  libraryId: string;
  libraryName: string;
  resultCount: number;
  availableCount: number;
  status: 'ok' | 'auth_required' | 'external' | 'error';
  errorMessage?: string;
}

export interface SearchResponse {
  query: string;
  field: SearchField;
  searchedAt: string;
  books: AggregatedBook[];
  librarySummaries: LibrarySearchSummary[];
}

export interface DiscoveredLibraryCandidate {
  library: LibraryConfig;
  supportLevel: 'realtime' | 'link';
  supportLabel: string;
  source: 'directory' | 'web';
}


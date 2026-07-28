export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Why a search returned what it did. `[]` alone cannot distinguish "the web has
 * nothing" from "the endpoint refused us", and telling the user to rephrase when
 * DuckDuckGo rate-limited the app is a lie.
 */
export type SearchStatus = 'ok' | 'no-results' | 'blocked' | 'offline';

export interface SearchResponse {
  results: SearchResult[];
  status: SearchStatus;
}

export interface FetchedSource {
  url: string;
  title: string;
  /** Cleaned plain text, capped at MAX_CONTENT_CHARS. Empty string on failure. */
  content: string;
  fetchedAt: number;
}

export interface Citation {
  /** 1-based index as it appears in the answer ([1], [2], …). */
  index: number;
  url: string;
  title: string;
}

/** Live state of one source while research is running. */
export type SourceState = 'reading' | 'read' | 'failed';

export interface ProgressSource {
  url: string;
  title: string;
  state: SourceState;
}

/** Everything the UI needs to render research in flight. */
export interface ResearchProgress {
  phase: 'searching' | 'reading' | 'writing' | 'done';
  /** What was actually sent to the search engine, after contextualisation. */
  searchedQuery: string;
  sources: ProgressSource[];
  /** Sources successfully read so far, and how many are wanted. */
  read: number;
  target: number;
}

export interface ResearchResult {
  query: string;
  /** The standalone query actually searched; differs when a follow-up was rewritten. */
  searchedQuery: string;
  sources: FetchedSource[];
  /** Model-generated answer carrying inline [n] citation markers. */
  answer: string;
  citations: Citation[];
  searchStatus: SearchStatus;
}

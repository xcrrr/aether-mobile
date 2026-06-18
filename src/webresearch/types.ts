export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
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

export interface ResearchResult {
  query: string;
  sources: FetchedSource[];
  /** Model-generated answer with inline [n] citations. */
  answer: string;
  citations: Citation[];
}

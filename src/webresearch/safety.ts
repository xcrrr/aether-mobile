/**
 * Security primitives for Local Web Research.
 *
 * Everything the research flow touches from the network is untrusted: the URLs
 * come from search results an attacker can rank, and the page bodies are fully
 * attacker-controlled. This module is the single chokepoint that decides what is
 * safe to fetch and sanitises any web text before it reaches the LLM prompt.
 */

/** Hard caps — keep memory and prompt size bounded on untrusted input. */
export const MAX_HTML_BYTES = 1_500_000;
export const MAX_CONTENT_CHARS = 2000;
export const FETCH_TIMEOUT_MS = 5000;
// Fewer sources -> shorter prompt -> much faster prefill on a CPU model. Three
// good sources are plenty for a grounded answer and keep research snappy.
export const MAX_SOURCES = 3;

/** A plain desktop UA so sites serve their normal HTML (no app fingerprint). */
export const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const ALLOWED_SCHEMES = new Set(['http', 'https']);

/** Gemma/SentencePiece control tokens — never let web text smuggle these in. */
const MODEL_TOKENS = [
  '<start_of_turn>', '<end_of_turn>', '<bos>', '<eos>', '<pad>', '<unk>',
];

export interface ParsedUrl {
  scheme: string;
  host: string;
  port: number | null;
}

/**
 * Minimal, deterministic URL parser. We avoid the platform `URL` (its behaviour
 * differs between Node and React Native) and only pull out what the safety check
 * needs: scheme, host, port. Host is lower-cased; userinfo is dropped; bracketed
 * IPv6 is unwrapped.
 */
export function parseUrl(raw: string): ParsedUrl | null {
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/([^/?#]*)/.exec(raw.trim());
  if (!m) return null;
  const scheme = m[1].toLowerCase();
  let authority = m[2];
  if (!authority) return null;

  // Drop userinfo (everything before the last '@').
  const at = authority.lastIndexOf('@');
  if (at !== -1) authority = authority.slice(at + 1);
  if (!authority) return null;

  let host: string;
  let port: number | null = null;
  if (authority.startsWith('[')) {
    // Bracketed IPv6: [host] or [host]:port
    const close = authority.indexOf(']');
    if (close === -1) return null;
    host = authority.slice(1, close);
    const rest = authority.slice(close + 1);
    if (rest.startsWith(':')) port = Number(rest.slice(1)) || null;
  } else {
    const colon = authority.indexOf(':');
    if (colon === -1) {
      host = authority;
    } else {
      host = authority.slice(0, colon);
      port = Number(authority.slice(colon + 1)) || null;
    }
  }

  host = host.toLowerCase();
  if (!host) return null;
  return { scheme, host, port };
}

function ipv4Parts(host: string): number[] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!m) return null;
  const parts = m.slice(1, 5).map(Number);
  if (parts.some((n) => n > 255)) return null;
  return parts;
}

/**
 * True for any host we must never fetch: loopback, private/RFC-1918, link-local
 * (incl. the 169.254.169.254 cloud-metadata address), CGNAT, and the common
 * internal name suffixes / IPv6 reserved ranges.
 */
export function isPrivateHost(host: string): boolean {
  const h = host.toLowerCase();

  if (h === 'localhost') return true;
  if (/\.(local|localhost|internal|lan|home|intranet)$/.test(h)) return true;

  const v4 = ipv4Parts(h);
  if (v4) {
    const [a, b] = v4;
    if (a === 0) return true;                         // 0.0.0.0/8
    if (a === 127) return true;                       // loopback
    if (a === 10) return true;                        // private
    if (a === 192 && b === 168) return true;          // private
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 169 && b === 254) return true;          // link-local + metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }

  // IPv6 (host already unbracketed by parseUrl).
  if (h.includes(':')) {
    if (h === '::1' || h === '::') return true;       // loopback / unspecified
    if (h.startsWith('fe80')) return true;            // link-local
    if (h.startsWith('fc') || h.startsWith('fd')) return true; // unique-local fc00::/7
    if (h.startsWith('::ffff:')) {                    // IPv4-mapped
      const mapped = h.slice(7);
      if (ipv4Parts(mapped)) return isPrivateHost(mapped);
    }
    return false;
  }

  return false;
}

/** A URL is safe to fetch only if it is http(s) to a public host. */
export function isSafeFetchUrl(raw: string): boolean {
  const u = parseUrl(raw);
  if (!u) return false;
  if (!ALLOWED_SCHEMES.has(u.scheme)) return false;
  if (isPrivateHost(u.host)) return false;
  return true;
}

/**
 * Strip model control tokens from untrusted text so a malicious page cannot
 * break out of the source block and inject its own turn into the Gemma prompt.
 */
export function sanitizeModelText(text: string): string {
  let out = text;
  for (const t of MODEL_TOKENS) out = out.split(t).join('');
  return out;
}

/** Truncate to a hard character budget. */
export function clampChars(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

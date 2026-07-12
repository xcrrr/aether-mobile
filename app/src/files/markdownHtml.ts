/**
 * Minimal, dependency-free Markdown -> HTML converter for artifact PDF export.
 *
 * Artifacts are model-authored Markdown. expo-print renders HTML through the
 * platform WebView, so we only need a compact, correct subset: headings, bold,
 * italic, inline/blocked code, links, ordered/unordered lists, blockquotes,
 * horizontal rules and paragraphs. Everything is HTML-escaped first so artifact
 * text can never inject markup into the print document.
 */

const ESC: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => ESC[ch]);
}

/** Inline spans: code, bold, italic, links. Operates on already-escaped text. */
function renderInline(escaped: string): string {
  let out = escaped;
  // Inline code first so its content is not further transformed.
  out = out.replace(/`([^`]+)`/g, (_m, code: string) => `<code>${code}</code>`);
  // Links [text](url) — allow only http(s)/mailto to avoid javascript: URIs.
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, text: string, url: string) => {
    if (!/^(https?:|mailto:)/i.test(url)) return text;
    return `<a href="${url}">${text}</a>`;
  });
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  return out;
}

export function markdownToHtml(markdown: string): string {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];

  let inCode = false;
  let codeBuf: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let paraBuf: string[] = [];

  const flushPara = () => {
    if (paraBuf.length) {
      html.push(`<p>${renderInline(escapeHtml(paraBuf.join(' ')))}</p>`);
      paraBuf = [];
    }
  };
  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };

  for (const raw of lines) {
    const line = raw;

    // Fenced code blocks.
    if (/^\s*```/.test(line)) {
      if (inCode) {
        html.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
        codeBuf = [];
        inCode = false;
      } else {
        flushPara();
        closeList();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      codeBuf.push(line);
      continue;
    }

    // Blank line: paragraph / list break.
    if (/^\s*$/.test(line)) {
      flushPara();
      closeList();
      continue;
    }

    // Horizontal rule.
    if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      flushPara();
      closeList();
      html.push('<hr />');
      continue;
    }

    // Headings.
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flushPara();
      closeList();
      const level = heading[1].length;
      html.push(`<h${level}>${renderInline(escapeHtml(heading[2].trim()))}</h${level}>`);
      continue;
    }

    // Blockquote.
    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (quote) {
      flushPara();
      closeList();
      html.push(`<blockquote>${renderInline(escapeHtml(quote[1]))}</blockquote>`);
      continue;
    }

    // Ordered list.
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ol) {
      flushPara();
      if (listType !== 'ol') {
        closeList();
        listType = 'ol';
        html.push('<ol>');
      }
      html.push(`<li>${renderInline(escapeHtml(ol[1]))}</li>`);
      continue;
    }

    // Unordered list.
    const ul = /^\s*[-*+]\s+(.*)$/.exec(line);
    if (ul) {
      flushPara();
      if (listType !== 'ul') {
        closeList();
        listType = 'ul';
        html.push('<ul>');
      }
      html.push(`<li>${renderInline(escapeHtml(ul[1]))}</li>`);
      continue;
    }

    // Otherwise accumulate into the current paragraph.
    closeList();
    paraBuf.push(line.trim());
  }

  if (inCode) html.push(`<pre><code>${escapeHtml(codeBuf.join('\n'))}</code></pre>`);
  flushPara();
  closeList();

  return html.join('\n');
}

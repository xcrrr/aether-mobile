import * as Print from 'expo-print';
import { escapeHtml, markdownToHtml } from './markdownHtml';
import { formatDate } from './artifactFilename';

/**
 * Renders an artifact's Markdown into a real PDF via expo-print (platform
 * WebView -> print framework). This produces genuine, structurally valid PDF
 * bytes with correct Unicode shaping (including Polish diacritics) — never
 * plain text renamed to `.pdf`.
 *
 * The output lands in the app cache; the export pipeline is responsible for
 * moving it into the user-visible Downloads collection.
 */

export interface RenderablePdfArtifact {
  title: string;
  content: string;
}

/** On-brand print stylesheet — calm, readable, light paper (print is never dark). */
function documentHtml(artifact: RenderablePdfArtifact): string {
  const body = markdownToHtml(artifact.content);
  const title = escapeHtml(artifact.title.trim() || 'Artifact');
  const date = formatDate();
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  @page { margin: 56px 48px; }
  * { box-sizing: border-box; }
  html { -webkit-text-size-adjust: 100%; }
  body {
    font-family: -apple-system, "Helvetica Neue", "Roboto", "Noto Sans", sans-serif;
    color: #1a1a1a;
    line-height: 1.6;
    font-size: 15px;
    margin: 0;
  }
  header.doc { border-bottom: 1px solid #e6e2d8; padding-bottom: 16px; margin-bottom: 28px; }
  header.doc .kicker {
    font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase;
    color: #8a8577; margin: 0 0 6px;
  }
  header.doc h1.title { font-size: 26px; line-height: 1.25; margin: 0; color: #141414; font-weight: 700; }
  h1, h2, h3, h4, h5, h6 { line-height: 1.3; color: #141414; margin: 26px 0 10px; }
  h1 { font-size: 22px; } h2 { font-size: 19px; } h3 { font-size: 17px; }
  h4, h5, h6 { font-size: 15px; }
  p { margin: 0 0 12px; }
  ul, ol { margin: 0 0 12px; padding-left: 22px; }
  li { margin: 4px 0; }
  blockquote {
    margin: 0 0 12px; padding: 4px 16px; border-left: 3px solid #d9d3c6;
    color: #55503f;
  }
  code {
    font-family: "SFMono-Regular", "Roboto Mono", monospace; font-size: 0.88em;
    background: #f3f0e8; padding: 1px 5px; border-radius: 4px;
  }
  pre {
    background: #f3f0e8; border-radius: 8px; padding: 12px 14px; overflow-x: auto;
    margin: 0 0 12px;
  }
  pre code { background: none; padding: 0; font-size: 0.85em; line-height: 1.5; }
  a { color: #6d5bd0; text-decoration: none; }
  hr { border: none; border-top: 1px solid #e6e2d8; margin: 22px 0; }
  footer.doc {
    margin-top: 36px; padding-top: 14px; border-top: 1px solid #e6e2d8;
    font-size: 11px; color: #a29c8c;
  }
</style>
</head>
<body>
  <header class="doc">
    <p class="kicker">Aether</p>
    <h1 class="title">${title}</h1>
  </header>
  <main>${body}</main>
  <footer class="doc">Exported from Aether · ${date}</footer>
</body>
</html>`;
}

/** Render the artifact to a PDF in the app cache. Returns its `file://` uri. */
export async function renderArtifactPdf(artifact: RenderablePdfArtifact): Promise<string> {
  const { uri } = await Print.printToFileAsync({
    html: documentHtml(artifact),
    base64: false,
  });
  return uri;
}

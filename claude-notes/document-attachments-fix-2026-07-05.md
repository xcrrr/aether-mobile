# Document attachments: fixed the silent-drop bug (2026-07-05)

## What was actually broken

Document attachments (PDF/DOCX/TXT) looked broken end-to-end ("preprocessing
failure"), but the extraction pipeline was already fully built and correct:
`src/files/FileProcessor.ts` + `src/files/pdf.ts` extract text on-device (pure-JS,
`pako` inflate + PDF `Tj`/`TJ` regex parsing, no native PDF lib needed), and
`src/llm/prompt.ts:buildUserContent()` already knew how to format that text into
the prompt — tested and passing in `promptAttachments.test.ts`.

The actual bug: `LiteRtService.ts:splitConversation()` — the function that builds
the *live* chat prompt sent to the native `generate()` call — never called
`buildUserContent()`. It used `messageModelText(m)` (history) and raw
`message.content` (last turn), both of which ignore `message.attachments`
entirely. So a document's extracted text was computed, stored on the attachment,
rendered in the UI chip... and then thrown away before the model ever saw it.
Images "worked" only because they're delivered through a separate path
(`writeImagePaths()` → native `Content.ImageBytes`) that doesn't go through
`splitConversation()`'s text at all.

## The fix

- `prompt.ts`: factored the non-image attachment formatting out of
  `buildUserContent()` into a new exported `buildDocumentContext(attachments)`,
  so it's one shared function instead of duplicated logic.
- `LiteRtService.ts`: `splitConversation()` now calls `buildDocumentContext()`
  for every user turn (history *and* the live turn), prepending the document
  block before `"User's message: ..."`. Images are untouched — they still go
  through `writeImagePaths()`, no marker text needed for LiteRT.
- Regression tests added directly in `LiteRtService.test.ts` asserting a PDF
  attachment's `extractedText` reaches `lastText`/`historyJson`.

## Hardening added alongside the fix

- `FileProcessor.ts`: PDF/DOCX now reject files over 20 MB *before* reading them
  (matches the existing image cap) — previously only images had a size gate, so
  a huge PDF/DOCX would read fully into a JS string with no bound.
- `pdf.ts`: added explicit `/Encrypt` detection → `FileProcessor` now returns
  "This PDF is password-protected. Remove the password and try again." instead
  of the misleading generic "couldn't read this PDF's text" message.
- `AttachmentChip.tsx`: added `accessibilityLabel`/`accessibilityLiveRegion` (there
  were none before), and changed the shared "Processing..." copy to "Reading
  locally…" for the calmer, on-device tone the design mission asks for.
- New tests: `src/files/pdf.test.ts`, `src/files/FileProcessor.test.ts` (neither
  existed before — extraction/classification had zero unit coverage).

## Deliberately NOT done in this pass — and why

**Scanned/image-only PDF → vision fallback** (rendering pages to images and
routing them through the existing Gemma vision path) is still not built. It's
architecturally feasible — `LiteRtModule.kt`'s single-thread `Executor` pattern
is a clean template to extend with `android.graphics.pdf.PdfRenderer` — but it
requires new native Kotlin code, and **this session ran on the Linux box, which
has no `JAVA_HOME`/Android SDK** (`android/local.properties` points at
`C:/Users/PC/Android/Sdk` — the toolchain lives on the Windows dev box per
`claude-notes/dev-environment.md`). Writing native module code I cannot compile
or run is worse than not writing it. Next step for whoever's on the Windows box:
add a `renderPdfPage(path, pageIndex, maxDim): Promise<string /* base64 JPEG */>`
native method, cap at ~8 pages / long-edge ~1600px, feed through the same
`imagePaths` array `writeImagePaths()` already builds for real images.

Also not attempted: improving `pdf.ts`'s text-showing-operator regex to handle
hex-string operators (`<...>Tj`) used by some PDFs with embedded/subset fonts.
I don't have a way to generate or source a real-world sample PDF in this
environment (no reportlab/fpdf/libreoffice on this box) to verify a fix
actually helps rather than emitting garbled text from misdecoded CID bytes —
shipping a guess here risks quietly feeding the model wrong "extracted text",
which is worse than the current honest "couldn't read this PDF" fallback. Flag
for next session if real-world PDFs still come back empty after this fix.

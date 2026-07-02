# Model Loading Background Art

Date: 2026-06-29

The model-loading visual was changed from a fully code-drawn SVG sphere to the clean full-screen PNG supplied by the user at `app/assets/model-loading-background.png`.

Intent:

- Preserve the supplied image literally: Aether mark, subtle upper stars, purple plasma planet, and black lower field.
- Keep only the live loading percentage and centered progress bar code-native in `ModelLoadingOverlay.tsx`.
- Do not reintroduce the older SVG-only planet or extra generated background glow unless a new approved visual target exists.

Verification in this pass:

- `app/src/components/common/ModelLoadingOverlay.tsx` typechecked with `tsc --noEmit`.
- Full app Jest suite passed: 23 suites, 207 tests.
- Preview artifact generated at `design-artifacts/model-loading/model-loading-clean-background-preview.png`.

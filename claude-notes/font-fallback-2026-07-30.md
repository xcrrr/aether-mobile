# Bold text rendered in the wrong typeface (2026-07-30)

Adam's report: body text in assistant replies was the serif, but anything bold was the sans, so a
single paragraph could change typeface mid-sentence.

## Why it happened, and why nothing warned about it

Android cannot synthesize a bold or italic face for a custom font. Asked for a weight or slant the
registered family has no file for, it **silently substitutes the system font** rather than erroring
or approximating. There is no warning in Metro, in logcat, or in a typecheck — the only symptom is
the wrong typeface on screen.

`react-native-marked` merges its own defaults *underneath* the styles it is given
(`node_modules/react-native-marked/dist/module/theme/styles.js`):

- `strong` → `fontWeight: 'bold'`
- every heading → `fontWeight: '500'`, via a shared `heading` base style
- `em`, `link`, `codespan` → `fontStyle: 'italic'`

`Markdown.tsx` set `fontFamily` on each of these but never overrode the weight or the slant, so the
merged style was our serif family paired with a weight it had no file for. Only
`Newsreader_400Regular`, `_400Regular_Italic` and `_500Medium` were registered in `useFonts` — no
bold face existed at all.

This is why body text was fine and bold was not: the library's `regular` base style sets no
`fontWeight`, so plain paragraphs asked for nothing the family could not provide.

**Headings h1–h6 were broken by the same mechanism** and nobody had noticed, because the fallback
sans at weight 500 still looks like a heading. `h5` and `h6` had no app styles at all and were
inheriting the library defaults untouched.

## The fix

Two halves, and both are needed:

1. Register real bold faces — `Newsreader_600SemiBold` and `Newsreader_700Bold` — in
   `app/_layout.tsx`, exposed as `fonts.serifSemibold` and `fonts.serifBold`.
2. A `face(fontFamily)` helper in `Markdown.tsx` that returns the family together with
   `fontWeight: 'normal'` and `fontStyle: 'normal'`. Every markdown style that names a font file
   spreads it, so the library's weight cannot merge through. The weight comes from the file, which
   is the only thing Android will honour for a custom family.

`h5` and `h6` are now styled explicitly rather than left to the library.

## Two things worth carrying forward

**The fix costs zero bytes.** `@expo-google-fonts/*` packages `require()` every weight
unconditionally in their `index.js`, so all 14 Newsreader and 8 Instrument Sans files were already
packaged. Verified by counting `.ttf` entries in both APKs: 22 in 2.2.0, 22 in 2.2.1. The font data
was always shipping; only the `useFonts` registration was missing, which left React Native with no
family name to resolve it by. Adding a weight from a font package that is already a dependency is
free.

**`displayBold` and `displayHeavy` deliberately still resolve to `Newsreader-Medium`.** The
temptation was to point them at the new real bold files, but the sidebar wordmark, the logo and the
chat greeting use them and were never broken — the app's own source contains **zero** occurrences
of `fontWeight` anywhere, which is exactly why only rendered markdown was affected. Changing those
tokens would have been an unrequested visual change to surfaces that were already correct.

That zero-occurrence grep is the useful invariant here: the app is disciplined about naming font
files directly. The bug came entirely from a third-party renderer's defaults, and the guard against
a recurrence is to neutralise weight and slant whenever a library is allowed to merge styles under
ours.

## State

Strict typecheck clean, Jest 49 suites / 642 tests green. Shipped in 2.2.1.

Not verified on a device. The reasoning is read directly from the library source and the platform
behaviour is well documented, but the whole point of this bug is that it is invisible except on a
screen — so it should be confirmed by looking at a bold word in a reply on the S25.

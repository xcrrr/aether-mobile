# Aether Typography System

## Font Families

Aether uses two loaded Google font families in the Expo app:

- **Newsreader** for the assistant/editorial voice.
- **Instrument Sans** for interface, controls, labels, settings, metadata, and compact utility UI.

Source Serif 4 is no longer the app serif. Playfair Display is not used.

## Loaded Variants

The root layout loads fonts through `expo-font` in `app/app/_layout.tsx`.

Loaded Newsreader variants:

- `Newsreader` -> `Newsreader_400Regular`
- `Newsreader-Italic` -> `Newsreader_400Regular_Italic`
- `Newsreader-Medium` -> `Newsreader_500Medium`

Loaded Instrument Sans variants:

- `InstrumentSans` -> `InstrumentSans_400Regular`
- `InstrumentSans-Medium` -> `InstrumentSans_500Medium`
- `InstrumentSans-SemiBold` -> `InstrumentSans_600SemiBold`

Do not request font weights or family names outside this list unless the matching physical font file is also loaded.

## Semantic Roles

Typography roles live in `app/src/theme/index.ts` as `typography`.

Editorial / Newsreader roles:

- `assistantBody`
- `assistantBodyCompact`
- `assistantHeading`
- `editorialTitle`
- `editorialSubtitle`

Interface / Instrument Sans roles:

- `screenTitle`
- `sectionTitle`
- `body`
- `bodySmall`
- `label`
- `button`
- `chip`
- `input`
- `metadata`
- `caption`
- `receipt`
- `status`

Legacy `fonts.display*` aliases map to `Newsreader-Medium`, and legacy `fonts.sansBold` / `fonts.sansHeavy` map to `InstrumentSans-SemiBold`. This keeps older styles from triggering Android synthetic bold while components are moved toward semantic roles.

## Where Newsreader Belongs

Use Newsreader for:

- Assistant markdown body and assistant headings.
- Editorial onboarding headlines.
- The Aether wordmark and selected product copy.
- Thoughtful empty states where a warmer assistant voice helps.
- Selected Core/Second Brain explanatory text.

Newsreader should stay light. Prefer Regular for body text and Medium only for restrained emphasis.

## Where Instrument Sans Belongs

Use Instrument Sans for:

- Chat input and user messages.
- Buttons, tabs, chips, sheets, settings, navigation, and labels.
- Question options and compact status text.
- Agent task cards and receipts.
- Copy controls, metadata, timestamps, and graph/status labels.
- Model manager rows and storage UI.

## Code And Copy Blocks

Code, commands, JSON, URLs, and Copy Block payloads should remain monospace. Do not apply Newsreader to technical payloads or anything intended to be copied verbatim.

## Adding A New Role

1. Add a semantic role to `typography` in `app/src/theme/index.ts`.
2. Use one of the loaded family names from this document.
3. Set size and line height together.
4. Apply the role in components instead of adding one-off `fontFamily`, `fontWeight`, or `fontStyle`.
5. Run `npm.cmd run typecheck` and visually check the preview route in development.

## Android Weight Rule

React Native on Android can synthesize weight or style when a custom `fontFamily` is combined with a `fontWeight` or `fontStyle` that does not have a real loaded font file. Avoid raw `fontWeight` and `fontStyle` in app text styles. Choose the correct loaded family variant instead, for example `typography.button`, `fonts.sansSemibold`, or `fonts.serifItalic`.

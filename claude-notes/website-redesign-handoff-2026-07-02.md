# Website redesign handoff (2026-07-02)

Claude Code rebuilt `website/` from the ground up. Read `website/REDESIGN_NOTES.md`
before touching the site — it has the narrative structure, claim sources, and QA list.

TL;DR for Codex:

- Cinematic space theme is gone (planet, starfield, FlyingPhone warp, Playfair, lenis,
  the dead SignupForm). Don't restore any of it.
- New system: warm paper base + deep-ink closing act via the `.ink` CSS-variable scope in
  `app/globals.css`. Typography = the app's own Newsreader + Instrument Sans (variable
  woff2 self-hosted in `public/fonts/`).
- The sticky phone demo lives in `components/sections/PhoneStory.tsx`; the phone mock in
  `components/phone/` mirrors the real app UI (bare serif assistant turns, quiet dark
  user bubbles per `MessageBubble.tsx`). Keep it in sync if the app's chat UI changes.
- Copy is deliberately scoped — no absolute privacy claims. Jest guards
  (`__tests__/script.test.ts`, `__tests__/page.test.tsx`) fail on "100%", "nothing ever
  leaves", "fully offline/private/secure", "no cloud". Keep them passing.
- Gotcha: Turbopack's LightningCSS strips `color: var(--x)` declarations it considers
  redundant across variable scopes. `.ink` uses a literal hex for `color` because of
  this.
- Still needed: OG image (1200×630) and a real favicon.

Verify: `cd website && npm test && npm run build` (21/21, clean as of handoff).

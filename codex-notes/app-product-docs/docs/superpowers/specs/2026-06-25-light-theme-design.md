# Light Theme — Design Spec

**Date:** 2026-06-25
**Project:** aetherbeta (Aether Mobile, Expo SDK 52 / RN 0.76 bridgeless)
**Goal:** Add a user-switchable light ("warm paper") theme covering every screen, surface, font color, and the aurora gradient backdrop. Dark stays default.

## Decisions (user-approved)
- **Background:** warm paper `#F6F5F2` (subtle beige-gray, no yellow/pink cast).
- **Switching:** Settings toggle with three states — Light / Dark / **Follow system** (tracks OS dark-mode via `Appearance`).
- **Accent:** keep Aether violet, deepened to `#6D28D9` for AA contrast on white. User bubbles stay violet with white text.

## Problem / current state
- `src/theme/index.ts` exports one static `colors` object (dark only).
- 36 files `import { colors } from '@/theme'`; ~350 `colors.x` references across ~22 keys.
- 30 files build module-level `StyleSheet.create({...})` — **frozen at module load**, so they cannot react to a runtime theme change. This is the core obstacle.

## Architecture

### 1. Palette split (`src/theme/index.ts`)
- Define `darkColors` (current values) and `lightColors` (new, table below). Both satisfy a shared `Palette` type (keys identical).
- Keep `export const colors = darkColors` so any not-yet-migrated reference still compiles and renders dark during the migration.
- `spacing`, `radius`, `fontSize`, `fonts`, `motion` unchanged (theme-independent).

### 2. Theme state (`useProfileStore`)
- Add `themePref: 'light' | 'dark' | 'system'` (default `'dark'`), persisted via existing profile storage.
- Add `setThemePref(pref)`.
- Hydrate `themePref` alongside profile on startup.

### 3. `useColors()` hook (`src/theme/useColors.ts`)
- Reads `themePref` from `useProfileStore` and, when `'system'`, the OS scheme via `useColorScheme()` (react-native `Appearance`).
- Resolves to `lightColors` or `darkColors`. Returns the active `Palette`.
- Also export `useIsDark()` (boolean) for StatusBar / icon-tint decisions.

### 4. Component migration pattern (30 stylesheet files + 6 inline-only)
Convert each module-level stylesheet to a factory:
```ts
// before
const styles = StyleSheet.create({ safe: { backgroundColor: colors.bg }, ... });
// after
const makeStyles = (c: Palette) => StyleSheet.create({ safe: { backgroundColor: c.bg }, ... });
function Comp() {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  ...
}
```
- Inline color props (`color={colors.violet}`) → `color={c.violet}`.
- Layout-only stylesheets (no `colors.` reference) are left untouched.

### 5. Aurora (`src/components/ds/Aurora.tsx`)
- Take colors from `useColors()` instead of the static import.
- In light mode the blob colors become `aurora1/2/3` lavender tints on `bg` paper-white; vignette uses light `bg`. Opacity logic unchanged — already low.

### 6. StatusBar / system chrome
- Root layout (`app/_layout.tsx`) sets StatusBar style from `useIsDark()` → `light` icons on dark bg, `dark` icons on light bg. SafeAreaView/Screen background follows `c.bg`.

### 7. Settings UI
- Add an "Appearance" row in the settings screen: segmented Light / Dark / System control wired to `setThemePref`.

## Light palette (`lightColors`)

| token | dark | light |
|---|---|---|
| bg | `#1C1C1C` | `#F6F5F2` |
| bgSidebar | `#161616` | `#EEEDE9` |
| bgCard | `#252525` | `#FFFFFF` |
| bgInput | `#252525` | `#FFFFFF` |
| assistantBubble | `#252525` | `#FFFFFF` |
| border | `#2E2E2E` | `#E3E1DC` |
| separator | `#2E2E2E` | `#E8E6E1` |
| text | `#FFFFFF` | `#1B1B1A` |
| textMuted | `#8E8E8E` | `#6B6A65` |
| textCode | `#E2E2E2` | `#2A2A2A` |
| violet | `#7C3AED` | `#6D28D9` |
| violetStrong | `#6D28D9` | `#5B21B6` |
| violetDim | `rgba(124,58,237,0.14)` | `rgba(109,40,217,0.10)` |
| blue | `#4285F4` | `#1A73E8` |
| danger | `#EF4444` | `#DC2626` |
| dangerBg | `#2A1414` | `#FCEBEB` |
| success | `#22C55E` | `#16A34A` |
| warning | `#EAB308` | `#B7791F` |
| warningBg | `rgba(234,179,8,0.12)` | `rgba(183,121,31,0.12)` |
| aurora1 | `#7C3AED` | `#C4B5FD` |
| aurora2 | `#5B21B6` | `#DDD6FE` |
| aurora3 | `#9333EA` | `#A78BFA` |
| purple | `#7C3AED` | `#6D28D9` |
| userBubble | `#7C3AED` | `#6D28D9` |
| scrim | `rgba(11,11,15,0.96)` | `rgba(247,246,242,0.94)` |
| black | `#000000` | `#000000` |
| white | `#FFFFFF` | `#FFFFFF` |

## Testing
- `npm run typecheck` — `Palette` type forces both palettes to keep identical keys; catches missed conversions.
- `npm test` — existing suite stays green. Add a unit test for `useColors` resolution (light/dark/system→scheme).
- Manual: toggle each mode, walk every screen (onboarding, chat, sidebar, settings, second brain, model manager) — confirm text legible, surfaces light, aurora lavender, StatusBar icons dark.

## Out of scope
- No new brand colors beyond the table. No per-screen custom theming. No theme-aware images/icons beyond tint props already in code.

## Risks
- Missed `colors.x` left static → renders dark-on-light. Mitigated by grepping for residual `from '@/theme'` `colors` usage after migration and by the typecheck pass.
- `react-native-marked` markdown styles: ensure its color props come from `c`, not static, so code/links are legible in light mode.
</content>
</invoke>

# Aether Beta 2 Mobile MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a clean, Android-only, offline-first AI chat app where all inference runs on-device via `llama.rn`, with two downloadable Gemma 4 GGUF models, onboarding-driven memory, conversation history, a sliding sidebar, and Settings with real-device storage management.

**Architecture:** Expo SDK 52 + Expo Router (file-based) with a Drawer sidebar. Three pure service boundaries — `storage/` (AsyncStorage CRUD), `models/` (registry + download manager), `llm/` (single LlamaContext + prompt assembly) — consumed by the UI only through Zustand stores and two hooks. Pure logic is built test-first; native modules (inference, downloads) are integration-verified on a dev client.

**Tech Stack:** Expo SDK 52 (RN 0.76, New Arch), TypeScript strict, expo-router v4, llama.rn ~0.11, @kesha-antonov/react-native-background-downloader ~4.5, @react-native-async-storage/async-storage, expo-file-system, zustand, react-native-marked.

**Reference:** Spec at `docs/superpowers/specs/2026-06-16-aether-mobile-mvp-design.md`. Proven Beta-1 source lives at `/home/xcrr1/aether-app-mvp/src/` (read-only reference — do NOT copy files; reimplement cleanly).

**Working directory:** `/home/xcrr1/aetherbeta` (its own git repo).

---

## Conventions for every task

- Run commands from `/home/xcrr1/aetherbeta`.
- Unit tests: `npx jest <path>`. Pure-logic modules are TDD (test → fail → implement → pass → commit).
- Native modules (llama.rn, background-downloader) can't run under Jest — mock them in unit tests; verify the real behavior on a device dev client in Phase 8.
- Commit after every task with the message shown in its final step.
- TypeScript strict must stay green: `npx tsc --noEmit` before each commit in code-only tasks.

---

## Phase 0 — Project scaffold

### Task 0.1: Initialize the Expo SDK 52 app

**Files:**
- Create: `package.json`, `app.json`, `tsconfig.json`, `babel.config.js`, `index.ts`, `.gitignore` (exists)

- [ ] **Step 1: Scaffold into the existing repo**

The repo dir already exists with `docs/` and `.git`. Create the Expo app in a temp dir and move files in (so we keep git history):

```bash
cd /home/xcrr1
npx create-expo-app@latest _aether_tmp --template blank-typescript
# Move everything except node_modules into aetherbeta, then clean up
rsync -a --exclude node_modules --exclude .git _aether_tmp/ aetherbeta/
rm -rf _aether_tmp
cd aetherbeta
```

- [ ] **Step 2: Install Expo Router + SDK-pinned native deps**

```bash
cd /home/xcrr1/aetherbeta
npx expo install expo-router react-native-safe-area-context react-native-screens \
  react-native-gesture-handler react-native-reanimated expo-file-system \
  @react-native-async-storage/async-storage expo-haptics
npm install zustand react-native-marked llama.rn@^0.11.0 \
  @kesha-antonov/react-native-background-downloader@^4.5.0
npm install -D @types/react jest jest-expo @testing-library/react-native
```

- [ ] **Step 3: Configure `package.json` main + scripts + jest**

Set `"main": "expo-router/entry"`, remove the old `index.ts` entry. Add:

```json
{
  "scripts": {
    "start": "expo start --dev-client",
    "android": "expo run:android",
    "test": "jest",
    "typecheck": "tsc --noEmit"
  },
  "jest": { "preset": "jest-expo" }
}
```

Delete `App.tsx` and any `index.ts` from the template (expo-router uses `app/`).

- [ ] **Step 4: `tsconfig.json` — strict + path alias**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 5: `babel.config.js` — reanimated plugin last**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: ['react-native-reanimated/plugin'],
  };
};
```

- [ ] **Step 6: Verify install**

Run: `npx tsc --noEmit`
Expected: no errors (no app code yet besides template removal).

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: scaffold Expo SDK 52 app with router + core deps"
```

### Task 0.2: Configure Android build (minSdk 29, arm64-v8a, AsyncStorage size)

**Files:**
- Create: `plugins/withAetherAndroid.js`
- Modify: `app.json`

- [ ] **Step 1: Write the config plugin**

Create `plugins/withAetherAndroid.js`:

```js
const { withGradleProperties } = require('@expo/config-plugins');

/**
 * Android build tweaks for Aether:
 *  - build only the arm64-v8a ABI (our sole target → smaller APK)
 *  - raise AsyncStorage's SQLite ceiling so long histories fit
 */
module.exports = function withAetherAndroid(config) {
  return withGradleProperties(config, (cfg) => {
    const set = (key, value) => {
      const i = cfg.modResults.findIndex(
        (p) => p.type === 'property' && p.key === key,
      );
      const entry = { type: 'property', key, value };
      if (i >= 0) cfg.modResults[i] = entry;
      else cfg.modResults.push(entry);
    };
    set('reactNativeArchitectures', 'arm64-v8a');
    set('AsyncStorage_db_size_in_MB', '64');
    return cfg;
  });
};
```

- [ ] **Step 2: Wire `app.json`**

Set name/slug, Android package, plugins, permissions:

```json
{
  "expo": {
    "name": "Aether",
    "slug": "aether",
    "scheme": "aether",
    "version": "2.0.0",
    "orientation": "portrait",
    "newArchEnabled": true,
    "android": {
      "package": "com.aether.app",
      "permissions": ["INTERNET", "FOREGROUND_SERVICE", "FOREGROUND_SERVICE_DATA_SYNC"]
    },
    "plugins": [
      "expo-router",
      ["expo-build-properties", { "android": { "minSdkVersion": 29 } }],
      "./plugins/withAetherAndroid.js"
    ]
  }
}
```

Install build-properties: `npx expo install expo-build-properties`

- [ ] **Step 3: Verify prebuild config resolves**

Run: `npx expo prebuild -p android --no-install` (generates `android/`)
Expected: completes; `android/gradle.properties` contains `reactNativeArchitectures=arm64-v8a` and `AsyncStorage_db_size_in_MB=64`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: android build config (minSdk 29, arm64-only, async-storage size)"
```

---

## Phase 1 — Foundations (pure logic, TDD)

### Task 1.1: Domain types

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Write the types**

```ts
export type MessageRole = 'user' | 'assistant';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
}

export interface Conversation {
  id: string;
  modelId: string;
  messages: Message[];
}

export interface ConversationMeta {
  id: string;
  title: string;
  modelId: string;
  createdAt: number;
  updatedAt: number;
  preview: string;
}

export interface UserProfile {
  name: string;
  occupation: string;
  project: string;
  goals: string;
  language: string;
}

export interface AppSettings {
  activeModelId: string | null;
}

export interface ModelDef {
  id: string;
  name: string;
  maker: string;
  description: string;
  sizeBytes: number;
  sizeLabel: string;
  minRamGb: number;
  contextLength: number;
  downloadUrl: string;
  filename: string;
  color: string;
  badge: string;
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: domain types"
```

### Task 1.2: Model registry (TDD)

**Files:**
- Create: `src/models/registry.ts`
- Test: `src/models/registry.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { MODELS, getModelById, DEFAULT_MODEL_ID } from './registry';

describe('model registry', () => {
  it('has exactly the two Gemma 4 models', () => {
    expect(MODELS.map((m) => m.id).sort()).toEqual(['gemma4-e2b', 'gemma4-e4b']);
  });
  it('default model is E2B (safe on 8GB)', () => {
    expect(DEFAULT_MODEL_ID).toBe('gemma4-e2b');
  });
  it('every model URL ends with its filename', () => {
    for (const m of MODELS) expect(m.downloadUrl.endsWith(m.filename)).toBe(true);
  });
  it('sizes are the verified byte counts', () => {
    expect(getModelById('gemma4-e2b')!.sizeBytes).toBe(3462678272);
    expect(getModelById('gemma4-e4b')!.sizeBytes).toBe(5405168384);
  });
  it('getModelById returns undefined for unknown ids', () => {
    expect(getModelById('nope')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/models/registry.test.ts`
Expected: FAIL ("Cannot find module './registry'").

- [ ] **Step 3: Implement the registry**

```ts
import { ModelDef } from '@/types';

const HF = (variant: 'E2B' | 'E4B', filename: string) =>
  `https://huggingface.co/bartowski/google_gemma-4-${variant}-it-GGUF/resolve/main/${filename}`;

export const MODELS: ModelDef[] = [
  {
    id: 'gemma4-e2b',
    name: 'Gemma 4 E2B',
    maker: 'Google',
    description: 'Compact on-device model. Fast and reliable on 8 GB phones.',
    sizeBytes: 3462678272,
    sizeLabel: '3.46 GB',
    minRamGb: 8,
    contextLength: 131072,
    filename: 'google_gemma-4-E2B-it-Q4_K_M.gguf',
    downloadUrl: HF('E2B', 'google_gemma-4-E2B-it-Q4_K_M.gguf'),
    color: '#4285F4',
    badge: 'Recommended',
  },
  {
    id: 'gemma4-e4b',
    name: 'Gemma 4 E4B',
    maker: 'Google',
    description: 'Most capable. Needs RAM headroom — best on higher-end devices.',
    sizeBytes: 5405168384,
    sizeLabel: '5.41 GB',
    minRamGb: 8,
    contextLength: 131072,
    filename: 'google_gemma-4-E4B-it-Q4_K_M.gguf',
    downloadUrl: HF('E4B', 'google_gemma-4-E4B-it-Q4_K_M.gguf'),
    color: '#7C3AED',
    badge: 'Most capable',
  },
];

export const DEFAULT_MODEL_ID = 'gemma4-e2b';

export const getModelById = (id: string): ModelDef | undefined =>
  MODELS.find((m) => m.id === id);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/models/registry.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/models/registry.ts src/models/registry.test.ts
git commit -m "feat: hardcoded Gemma 4 model registry"
```

### Task 1.3: Storage keys + safe JSON helpers (TDD)

**Files:**
- Create: `src/storage/keys.ts`, `src/storage/json.ts`
- Test: `src/storage/json.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { safeParse } from './json';

describe('safeParse', () => {
  it('parses valid JSON', () => {
    expect(safeParse('{"a":1}', { a: 0 })).toEqual({ a: 1 });
  });
  it('returns the fallback on null', () => {
    expect(safeParse(null, { a: 9 })).toEqual({ a: 9 });
  });
  it('returns the fallback on corrupt JSON', () => {
    expect(safeParse('{bad', { a: 9 })).toEqual({ a: 9 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/storage/json.test.ts`
Expected: FAIL ("Cannot find module './json'").

- [ ] **Step 3: Implement keys + json helper**

`src/storage/keys.ts`:

```ts
export const KEYS = {
  onboardingComplete: '@aether/onboarding_complete',
  profile: '@aether/profile',
  settings: '@aether/settings',
  conversationsIndex: '@aether/conversations_index',
  conversation: (id: string) => `@aether/conversation/${id}`,
} as const;
```

`src/storage/json.ts`:

```ts
export function safeParse<T>(raw: string | null, fallback: T): T {
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/storage/json.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/storage/keys.ts src/storage/json.ts src/storage/json.test.ts
git commit -m "feat: storage keys + safe JSON parse"
```

### Task 1.4: Profile + settings storage (TDD with mocked AsyncStorage)

**Files:**
- Create: `src/storage/profile.ts`, `src/storage/settings.ts`
- Create: `jest.setup.js` (mock AsyncStorage), update `package.json` jest config
- Test: `src/storage/profile.test.ts`

- [ ] **Step 1: Add the AsyncStorage mock + setup**

In `package.json` jest block:

```json
"jest": {
  "preset": "jest-expo",
  "setupFiles": ["<rootDir>/jest.setup.js"]
}
```

`jest.setup.js`:

```js
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
```

- [ ] **Step 2: Write the failing test**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadProfile, saveProfile, isOnboardingComplete, setOnboardingComplete } from './profile';

beforeEach(() => AsyncStorage.clear());

describe('profile storage', () => {
  it('returns null when no profile saved', async () => {
    expect(await loadProfile()).toBeNull();
  });
  it('round-trips a profile', async () => {
    const p = { name: 'Adam', occupation: 'Builder', project: 'Aether', goals: 'ship', language: 'English' };
    await saveProfile(p);
    expect(await loadProfile()).toEqual(p);
  });
  it('tracks onboarding completion', async () => {
    expect(await isOnboardingComplete()).toBe(false);
    await setOnboardingComplete();
    expect(await isOnboardingComplete()).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest src/storage/profile.test.ts`
Expected: FAIL ("Cannot find module './profile'").

- [ ] **Step 4: Implement profile + settings storage**

`src/storage/profile.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KEYS } from './keys';
import { safeParse } from './json';
import { UserProfile } from '@/types';

export async function loadProfile(): Promise<UserProfile | null> {
  return safeParse<UserProfile | null>(await AsyncStorage.getItem(KEYS.profile), null);
}

export async function saveProfile(profile: UserProfile): Promise<void> {
  await AsyncStorage.setItem(KEYS.profile, JSON.stringify(profile));
}

export async function isOnboardingComplete(): Promise<boolean> {
  return (await AsyncStorage.getItem(KEYS.onboardingComplete)) === 'true';
}

export async function setOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(KEYS.onboardingComplete, 'true');
}
```

`src/storage/settings.ts`:

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KEYS } from './keys';
import { safeParse } from './json';
import { AppSettings } from '@/types';

const DEFAULT_SETTINGS: AppSettings = { activeModelId: null };

export async function loadSettings(): Promise<AppSettings> {
  return safeParse<AppSettings>(await AsyncStorage.getItem(KEYS.settings), DEFAULT_SETTINGS);
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(KEYS.settings, JSON.stringify(settings));
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest src/storage/profile.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/storage/profile.ts src/storage/settings.ts src/storage/profile.test.ts jest.setup.js package.json
git commit -m "feat: profile + settings persistence"
```

### Task 1.5: Conversation storage (TDD)

**Files:**
- Create: `src/storage/conversations.ts`
- Test: `src/storage/conversations.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createConversation, saveConversation, loadConversation,
  loadIndex, deleteConversation,
} from './conversations';

beforeEach(() => AsyncStorage.clear());

describe('conversation storage', () => {
  it('creates a conversation and indexes it', async () => {
    const c = await createConversation('gemma4-e2b');
    expect(c.modelId).toBe('gemma4-e2b');
    expect(c.messages).toEqual([]);
    const index = await loadIndex();
    expect(index).toHaveLength(1);
    expect(index[0].id).toBe(c.id);
  });
  it('saves messages and updates the index preview/title', async () => {
    const c = await createConversation('gemma4-e2b');
    c.messages.push({ id: 'm1', role: 'user', content: 'Hello world', createdAt: 1 });
    await saveConversation(c);
    expect((await loadConversation(c.id))!.messages).toHaveLength(1);
    const meta = (await loadIndex())[0];
    expect(meta.title).toBe('Hello world');
    expect(meta.preview).toBe('Hello world');
  });
  it('deletes a conversation and removes it from the index', async () => {
    const c = await createConversation('gemma4-e2b');
    await deleteConversation(c.id);
    expect(await loadConversation(c.id)).toBeNull();
    expect(await loadIndex()).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/storage/conversations.test.ts`
Expected: FAIL ("Cannot find module './conversations'").

- [ ] **Step 3: Implement conversation storage**

```ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { KEYS } from './keys';
import { safeParse } from './json';
import { Conversation, ConversationMeta } from '@/types';

const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export async function loadIndex(): Promise<ConversationMeta[]> {
  const list = safeParse<ConversationMeta[]>(
    await AsyncStorage.getItem(KEYS.conversationsIndex), [],
  );
  return list.sort((a, b) => b.updatedAt - a.updatedAt);
}

async function saveIndex(index: ConversationMeta[]): Promise<void> {
  await AsyncStorage.setItem(KEYS.conversationsIndex, JSON.stringify(index));
}

export async function createConversation(modelId: string): Promise<Conversation> {
  const now = Date.now();
  const convo: Conversation = { id: newId(), modelId, messages: [] };
  await saveConversation(convo);
  const meta: ConversationMeta = {
    id: convo.id, title: 'New chat', modelId, createdAt: now, updatedAt: now, preview: '',
  };
  await saveIndex([meta, ...(await loadIndex())]);
  return convo;
}

export async function loadConversation(id: string): Promise<Conversation | null> {
  return safeParse<Conversation | null>(
    await AsyncStorage.getItem(KEYS.conversation(id)), null,
  );
}

export async function saveConversation(convo: Conversation): Promise<void> {
  await AsyncStorage.setItem(KEYS.conversation(convo.id), JSON.stringify(convo));
  const firstUser = convo.messages.find((m) => m.role === 'user');
  const last = convo.messages[convo.messages.length - 1];
  const index = await loadIndex();
  const i = index.findIndex((m) => m.id === convo.id);
  if (i >= 0) {
    index[i] = {
      ...index[i],
      modelId: convo.modelId,
      updatedAt: Date.now(),
      title: firstUser ? firstUser.content.slice(0, 40) : index[i].title,
      preview: last ? last.content.slice(0, 60) : '',
    };
    await saveIndex(index);
  }
}

export async function deleteConversation(id: string): Promise<void> {
  await AsyncStorage.removeItem(KEYS.conversation(id));
  await saveIndex((await loadIndex()).filter((m) => m.id !== id));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/storage/conversations.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/storage/conversations.ts src/storage/conversations.test.ts
git commit -m "feat: conversation history persistence"
```

### Task 1.6: Prompt assembly (TDD)

**Files:**
- Create: `src/llm/prompt.ts`
- Test: `src/llm/prompt.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { buildSystemPrompt, buildGemmaPrompt, trimToContext } from './prompt';
import { Message, UserProfile } from '@/types';

const profile: UserProfile = {
  name: 'Adam', occupation: 'Builder', project: 'Aether', goals: 'ship it', language: 'English',
};

describe('prompt assembly', () => {
  it('injects profile fields into the system prompt', () => {
    const s = buildSystemPrompt(profile);
    expect(s).toContain('Adam');
    expect(s).toContain('Builder');
    expect(s).toContain('Aether');
    expect(s).toContain('English');
  });
  it('prepends system content to the first user turn (Gemma format)', () => {
    const msgs: Message[] = [{ id: '1', role: 'user', content: 'Hi', createdAt: 0 }];
    const p = buildGemmaPrompt('SYS', msgs);
    expect(p).toBe('<start_of_turn>user\nSYS\n\nHi<end_of_turn>\n<start_of_turn>model\n');
  });
  it('formats a multi-turn conversation', () => {
    const msgs: Message[] = [
      { id: '1', role: 'user', content: 'Hi', createdAt: 0 },
      { id: '2', role: 'assistant', content: 'Hello', createdAt: 1 },
      { id: '3', role: 'user', content: 'Bye', createdAt: 2 },
    ];
    const p = buildGemmaPrompt('SYS', msgs);
    expect(p).toContain('<start_of_turn>model\nHello<end_of_turn>');
    expect(p.endsWith('<start_of_turn>user\nBye<end_of_turn>\n<start_of_turn>model\n')).toBe(true);
  });
  it('trims oldest messages when over the limit, keeping the newest', () => {
    const msgs: Message[] = Array.from({ length: 10 }, (_, i) => ({
      id: String(i), role: i % 2 === 0 ? 'user' : 'assistant', content: 'x'.repeat(2000), createdAt: i,
    }));
    const trimmed = trimToContext(msgs, 2048);
    expect(trimmed.length).toBeLessThan(msgs.length);
    expect(trimmed[trimmed.length - 1].id).toBe('9');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/llm/prompt.test.ts`
Expected: FAIL ("Cannot find module './prompt'").

- [ ] **Step 3: Implement prompt assembly**

```ts
import { Message, UserProfile } from '@/types';

const BASE =
  'You are Aether, a private on-device AI assistant with no internet access. ' +
  'Be helpful, honest, and concise. Use markdown when it improves clarity.';

export function buildSystemPrompt(profile: UserProfile | null): string {
  if (!profile) return BASE;
  const parts = [BASE];
  if (profile.name) parts.push(`The user's name is ${profile.name}.`);
  if (profile.occupation) parts.push(`They work as ${profile.occupation}.`);
  if (profile.project) parts.push(`They are working on: ${profile.project}.`);
  if (profile.goals) parts.push(`They want help with: ${profile.goals}.`);
  if (profile.language) parts.push(`Always reply in ${profile.language}.`);
  return parts.join(' ');
}

/** Gemma has no system role — prepend system text to the first user turn. */
export function buildGemmaPrompt(system: string, messages: Message[]): string {
  let pending = system;
  let out = '';
  for (const m of messages) {
    if (m.role === 'user') {
      const text = pending ? `${pending}\n\n${m.content}` : m.content;
      pending = '';
      out += `<start_of_turn>user\n${text}<end_of_turn>\n<start_of_turn>model\n`;
    } else {
      out += `${m.content}<end_of_turn>\n`;
    }
  }
  return out;
}

/** Rough char-budget trim (~4 chars/token), always keeping the newest messages. */
export function trimToContext(messages: Message[], nCtx: number): Message[] {
  const budget = nCtx * 4 * 0.6; // leave room for the reply
  let total = 0;
  const kept: Message[] = [];
  for (let i = messages.length - 1; i >= 0; i--) {
    total += messages[i].content.length;
    if (total > budget && kept.length > 0) break;
    kept.unshift(messages[i]);
  }
  return kept;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/llm/prompt.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/llm/prompt.ts src/llm/prompt.test.ts
git commit -m "feat: system prompt + Gemma prompt formatting + context trim"
```

---

## Phase 2 — Native services

### Task 2.1: ModelManager (paths, space, verify, delete) + TDD for pure helpers

**Files:**
- Create: `src/models/ModelManager.ts`
- Test: `src/models/paths.test.ts`
- Create: `src/models/paths.ts`

- [ ] **Step 1: Write the failing test for pure path/verify helpers**

```ts
import { modelDestPath, stripFileUri, isVerifiedSize } from './paths';

describe('model paths', () => {
  it('builds a plain dest path under the models dir', () => {
    expect(modelDestPath('/data/user/0/app/files', 'm.gguf')).toBe('/data/user/0/app/files/models/m.gguf');
  });
  it('strips file:// for llama.rn', () => {
    expect(stripFileUri('file:///data/x')).toBe('/data/x');
    expect(stripFileUri('/data/x')).toBe('/data/x');
  });
  it('accepts a file within 1% of expected size', () => {
    expect(isVerifiedSize(99, 100)).toBe(true);
    expect(isVerifiedSize(80, 100)).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/models/paths.test.ts`
Expected: FAIL ("Cannot find module './paths'").

- [ ] **Step 3: Implement pure helpers**

`src/models/paths.ts`:

```ts
export const stripFileUri = (p: string): string => p.replace(/^file:\/\//, '');

export const modelsDir = (docDir: string): string =>
  `${stripFileUri(docDir).replace(/\/$/, '')}/models`;

export const modelDestPath = (docDir: string, filename: string): string =>
  `${modelsDir(docDir)}/${filename}`;

export const isVerifiedSize = (actual: number, expected: number): boolean =>
  actual >= expected * 0.99;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/models/paths.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement ModelManager (native — not unit tested here)**

`src/models/ModelManager.ts`:

```ts
import * as FileSystem from 'expo-file-system';
import {
  createDownloadTask, getExistingDownloadTasks,
} from '@kesha-antonov/react-native-background-downloader';
import type { DownloadTask } from '@kesha-antonov/react-native-background-downloader';
import { ModelDef } from '@/types';
import { MODELS, getModelById } from './registry';
import { modelsDir, modelDestPath, stripFileUri, isVerifiedSize } from './paths';

const DOC = FileSystem.documentDirectory ?? 'file:///';
const DIR = modelsDir(DOC);

const active = new Map<string, DownloadTask>();
const speed = new Map<string, { bytes: number; time: number; mbps: number }>();

export async function ensureDir(): Promise<void> {
  const info = await FileSystem.getInfoAsync(`file://${DIR}`);
  if (!info.exists) await FileSystem.makeDirectoryAsync(`file://${DIR}`, { intermediates: true });
}

export function localPath(model: ModelDef): string {
  return modelDestPath(DOC, model.filename);
}

export async function isInstalled(model: ModelDef): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(`file://${localPath(model)}`, { size: true });
  if (!info.exists) return false;
  return isVerifiedSize((info as { size?: number }).size ?? 0, model.sizeBytes);
}

export async function freeBytes(): Promise<number> {
  return FileSystem.getFreeDiskStorageAsync();
}

export async function totalBytes(): Promise<number> {
  return FileSystem.getTotalDiskCapacityAsync();
}

export async function installedBytes(): Promise<number> {
  let sum = 0;
  for (const m of MODELS) {
    const info = await FileSystem.getInfoAsync(`file://${localPath(m)}`, { size: true });
    if (info.exists) sum += (info as { size?: number }).size ?? 0;
  }
  return sum;
}

export interface DownloadHandlers {
  onProgress: (pct: number, downloaded: number, total: number, mbps: number) => void;
  onDone: (path: string) => void;
  onError: (msg: string) => void;
}

export async function startDownload(model: ModelDef, h: DownloadHandlers): Promise<void> {
  if (active.has(model.id)) return;
  await ensureDir();
  const dest = localPath(model);
  speed.set(model.id, { bytes: 0, time: Date.now(), mbps: 0 });

  const task = createDownloadTask({
    id: model.id,
    url: model.downloadUrl,
    destination: dest,
    isAllowedOverRoaming: true,
    isAllowedOverMetered: true,
    metadata: { filename: model.filename },
  });
  active.set(model.id, task);

  task
    .begin(({ expectedBytes }) => h.onProgress(0, 0, expectedBytes, 0))
    .progress(({ bytesDownloaded, bytesTotal }) => {
      const pct = bytesTotal > 0 ? (bytesDownloaded / bytesTotal) * 100 : 0;
      const t = speed.get(model.id);
      let mbps = 0;
      if (t) {
        const now = Date.now();
        const elapsed = (now - t.time) / 1000;
        if (elapsed >= 0.5) {
          const inst = (bytesDownloaded - t.bytes) / elapsed / 1e6;
          mbps = Math.max(0, t.mbps * 0.7 + inst * 0.3);
          speed.set(model.id, { bytes: bytesDownloaded, time: now, mbps });
        } else {
          mbps = t.mbps;
        }
      }
      h.onProgress(pct, bytesDownloaded, bytesTotal, mbps);
    })
    .done(({ location }) => {
      active.delete(model.id);
      speed.delete(model.id);
      h.onDone(stripFileUri(location || dest));
    })
    .error(({ error }) => {
      active.delete(model.id);
      speed.delete(model.id);
      const msg = typeof error === 'string' ? error : 'Download failed';
      if (!/cancel|stopped/i.test(msg)) h.onError(msg);
    });

  task.start();
}

export function cancelDownload(id: string): void {
  active.get(id)?.stop();
  active.delete(id);
  speed.delete(id);
}

export async function deleteModel(model: ModelDef): Promise<void> {
  const uri = `file://${localPath(model)}`;
  const info = await FileSystem.getInfoAsync(uri);
  if (info.exists) await FileSystem.deleteAsync(uri, { idempotent: true });
}

/** Reattach handlers to downloads that ran while the app was closed. */
export async function reattachDownloads(
  onProgress: (id: string, pct: number) => void,
  onDone: (id: string, path: string) => void,
): Promise<void> {
  try {
    for (const task of await getExistingDownloadTasks()) {
      const id = task.id;
      const model = getModelById(id);
      if (!model) continue;
      if (task.state === 'DONE') {
        onDone(id, stripFileUri(task.destination || localPath(model)));
        continue;
      }
      active.set(id, task);
      task
        .progress(({ bytesDownloaded, bytesTotal }) =>
          onProgress(id, bytesTotal > 0 ? (bytesDownloaded / bytesTotal) * 100 : 0))
        .done(({ location }) => {
          active.delete(id);
          onDone(id, stripFileUri(location || localPath(model)));
        })
        .error(() => active.delete(id));
    }
  } catch (e) {
    console.error('[ModelManager] reattach error', e);
  }
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/models/ModelManager.ts src/models/paths.ts src/models/paths.test.ts
git commit -m "feat: ModelManager download/verify/delete + storage queries"
```

### Task 2.2: LlamaService (single-context lifecycle + streaming)

**Files:**
- Create: `src/llm/LlamaService.ts`

- [ ] **Step 1: Implement LlamaService (native — verified on device in Phase 8)**

```ts
import { initLlama, type LlamaContext } from 'llama.rn';
import { Message } from '@/types';
import { buildGemmaPrompt, trimToContext } from './prompt';

let context: LlamaContext | null = null;
let currentPath: string | null = null;
let generating = false;
let completion: Promise<void> | null = null;
let initPromise: Promise<void> | null = null;

const N_CTX = 2048;
const STOP = ['<end_of_turn>', '<start_of_turn>'];

async function doInit(path: string): Promise<void> {
  try {
    context = await initLlama({
      model: path,
      n_ctx: N_CTX,
      n_batch: 32,
      n_threads: 4,
      n_gpu_layers: 0,
      use_mlock: false,
      use_mmap: true,
    });
    currentPath = path;
  } catch (err) {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
    if (/memory|oom|out of mem|failed to allocate/.test(msg)) throw new Error('INSUFFICIENT_RAM');
    if (/no such file|not found|open failed|enoent/.test(msg)) throw new Error('MODEL_NOT_FOUND');
    throw new Error(`MODEL_LOAD_FAILED: ${msg}`);
  }
}

/** Load a model. Concurrent calls await the same init (prevents the Beta-1 crash). */
export function initLlm(modelPath: string): Promise<void> {
  const path = modelPath.replace(/^file:\/\//, '');
  if (context && currentPath === path) return Promise.resolve();
  if (initPromise) {
    return initPromise.then(() =>
      context && currentPath === path ? undefined : initLlm(path),
    );
  }
  initPromise = (async () => {
    try {
      await releaseLlm();
      await doInit(path);
    } finally {
      initPromise = null;
    }
  })();
  return initPromise;
}

export async function generate(
  system: string,
  messages: Message[],
  onToken: (t: string) => void,
  onDone: () => void,
  onError: (e: string) => void,
): Promise<void> {
  if (!context) return onError('No model loaded.');
  const prompt = buildGemmaPrompt(system, trimToContext(messages, N_CTX));
  generating = true;
  completion = context
    .completion(
      { prompt, n_predict: 1024, temperature: 0.7, top_p: 0.9, top_k: 40, penalty_repeat: 1.1, stop: STOP },
      (tr) => { if (tr.token != null) onToken(tr.token); },
    )
    .then(() => { generating = false; completion = null; onDone(); })
    .catch((err) => {
      generating = false; completion = null;
      const msg = err instanceof Error ? err.message : 'generation failed';
      if (/abort|cancel|stop/i.test(msg)) onDone(); else onError(msg);
    });
}

export function stopGeneration(): void {
  try { context?.stopCompletion(); } catch {}
  generating = false;
}

export async function releaseLlm(): Promise<void> {
  if (!context) return;
  if (generating) {
    stopGeneration();
    if (completion) { try { await completion; } catch {} }
  }
  try { await context.release(); } catch (e) { console.error('[LlamaService] release', e); }
  context = null; currentPath = null; generating = false; completion = null;
}

export const isModelLoaded = (): boolean => context !== null;
export const isLoading = (): boolean => initPromise !== null;
export const getLoadedPath = (): string | null => currentPath;
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/llm/LlamaService.ts
git commit -m "feat: LlamaService single-context lifecycle + streaming"
```

---

## Phase 3 — State stores (Zustand)

### Task 3.1: Profile store

**Files:**
- Create: `src/state/useProfileStore.ts`

- [ ] **Step 1: Implement**

```ts
import { create } from 'zustand';
import { UserProfile } from '@/types';
import { loadProfile, saveProfile, isOnboardingComplete, setOnboardingComplete } from '@/storage/profile';

interface ProfileState {
  profile: UserProfile | null;
  onboarded: boolean;
  hydrated: boolean;
  hydrate: () => Promise<void>;
  completeOnboarding: (p: UserProfile) => Promise<void>;
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  onboarded: false,
  hydrated: false,
  hydrate: async () => {
    const [profile, onboarded] = await Promise.all([loadProfile(), isOnboardingComplete()]);
    set({ profile, onboarded, hydrated: true });
  },
  completeOnboarding: async (p) => {
    await saveProfile(p);
    await setOnboardingComplete();
    set({ profile: p, onboarded: true });
  },
}));
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (Expected: PASS)

```bash
git add src/state/useProfileStore.ts
git commit -m "feat: profile store"
```

### Task 3.2: Model store

**Files:**
- Create: `src/state/useModelStore.ts`

- [ ] **Step 1: Implement**

```ts
import { create } from 'zustand';
import { MODELS, DEFAULT_MODEL_ID } from '@/models/registry';
import * as MM from '@/models/ModelManager';
import { loadSettings, saveSettings } from '@/storage/settings';

interface DownloadState { pct: number; mbps: number; downloading: boolean; }
interface ModelState {
  installed: Record<string, boolean>;
  downloads: Record<string, DownloadState>;
  activeModelId: string | null;
  hydrate: () => Promise<void>;
  refreshInstalled: () => Promise<void>;
  setActive: (id: string) => Promise<void>;
  download: (id: string) => Promise<void>;
  cancel: (id: string) => void;
  remove: (id: string) => Promise<void>;
}

export const useModelStore = create<ModelState>((set, get) => ({
  installed: {},
  downloads: {},
  activeModelId: null,
  hydrate: async () => {
    const settings = await loadSettings();
    await get().refreshInstalled();
    const installed = get().installed;
    const active = settings.activeModelId && installed[settings.activeModelId]
      ? settings.activeModelId
      : (installed[DEFAULT_MODEL_ID] ? DEFAULT_MODEL_ID : null);
    set({ activeModelId: active });
    await MM.reattachDownloads(
      (id, pct) => set((s) => ({ downloads: { ...s.downloads, [id]: { pct, mbps: 0, downloading: true } } })),
      async (id) => { await get().refreshInstalled(); set((s) => ({ downloads: { ...s.downloads, [id]: { pct: 100, mbps: 0, downloading: false } } })); },
    );
  },
  refreshInstalled: async () => {
    const entries = await Promise.all(MODELS.map(async (m) => [m.id, await MM.isInstalled(m)] as const));
    set({ installed: Object.fromEntries(entries) });
  },
  setActive: async (id) => { set({ activeModelId: id }); await saveSettings({ activeModelId: id }); },
  download: async (id) => {
    const model = MODELS.find((m) => m.id === id);
    if (!model) return;
    set((s) => ({ downloads: { ...s.downloads, [id]: { pct: 0, mbps: 0, downloading: true } } }));
    await MM.startDownload(model, {
      onProgress: (pct, _d, _t, mbps) => set((s) => ({ downloads: { ...s.downloads, [id]: { pct, mbps, downloading: true } } })),
      onDone: async () => {
        await get().refreshInstalled();
        set((s) => ({ downloads: { ...s.downloads, [id]: { pct: 100, mbps: 0, downloading: false } } }));
        if (!get().activeModelId) await get().setActive(id);
      },
      onError: () => set((s) => ({ downloads: { ...s.downloads, [id]: { pct: 0, mbps: 0, downloading: false } } })),
    });
  },
  cancel: (id) => { MM.cancelDownload(id); set((s) => ({ downloads: { ...s.downloads, [id]: { pct: 0, mbps: 0, downloading: false } } })); },
  remove: async (id) => {
    const model = MODELS.find((m) => m.id === id);
    if (!model) return;
    await MM.deleteModel(model);
    await get().refreshInstalled();
    if (get().activeModelId === id) await get().setActive(DEFAULT_MODEL_ID);
  },
}));
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (Expected: PASS)

```bash
git add src/state/useModelStore.ts
git commit -m "feat: model store (install state, downloads, active model)"
```

### Task 3.3: Chat store

**Files:**
- Create: `src/state/useChatStore.ts`

- [ ] **Step 1: Implement**

```ts
import { create } from 'zustand';
import { Conversation, ConversationMeta, Message } from '@/types';
import {
  loadIndex, loadConversation, saveConversation, createConversation, deleteConversation,
} from '@/storage/conversations';

interface ChatState {
  index: ConversationMeta[];
  current: Conversation | null;
  generating: boolean;
  refreshIndex: () => Promise<void>;
  newChat: (modelId: string) => Promise<string>;
  open: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  appendUser: (content: string) => Promise<void>;
  startAssistant: () => void;
  appendToken: (token: string) => void;
  finishAssistant: () => Promise<void>;
  setGenerating: (g: boolean) => void;
}

const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

export const useChatStore = create<ChatState>((set, get) => ({
  index: [],
  current: null,
  generating: false,
  refreshIndex: async () => set({ index: await loadIndex() }),
  newChat: async (modelId) => {
    const c = await createConversation(modelId);
    set({ current: c });
    await get().refreshIndex();
    return c.id;
  },
  open: async (id) => {
    set({ current: await loadConversation(id) });
  },
  remove: async (id) => {
    await deleteConversation(id);
    if (get().current?.id === id) set({ current: null });
    await get().refreshIndex();
  },
  appendUser: async (content) => {
    const c = get().current;
    if (!c) return;
    const msg: Message = { id: uid(), role: 'user', content, createdAt: Date.now() };
    const updated = { ...c, messages: [...c.messages, msg] };
    set({ current: updated });
    await saveConversation(updated);
    await get().refreshIndex();
  },
  startAssistant: () => {
    const c = get().current;
    if (!c) return;
    const msg: Message = { id: uid(), role: 'assistant', content: '', createdAt: Date.now() };
    set({ current: { ...c, messages: [...c.messages, msg] }, generating: true });
  },
  appendToken: (token) => {
    const c = get().current;
    if (!c) return;
    const messages = [...c.messages];
    const last = messages[messages.length - 1];
    messages[messages.length - 1] = { ...last, content: last.content + token };
    set({ current: { ...c, messages } });
  },
  finishAssistant: async () => {
    const c = get().current;
    set({ generating: false });
    if (c) { await saveConversation(c); await get().refreshIndex(); }
  },
  setGenerating: (g) => set({ generating: g }),
}));
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (Expected: PASS)

```bash
git add src/state/useChatStore.ts
git commit -m "feat: chat store (history, streaming message buffer)"
```

---

## Phase 4 — Theme + common UI

### Task 4.1: Theme tokens

**Files:**
- Create: `src/theme/index.ts`

- [ ] **Step 1: Implement**

```ts
export const colors = {
  bg: '#0B0B0F',
  bgCard: '#16161D',
  border: '#26262F',
  text: '#F5F5F7',
  textMuted: '#9A9AA8',
  purple: '#7C3AED',
  userBubble: '#7C3AED',
  assistantBubble: '#1C1C24',
  danger: '#EF4444',
};
export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 16, xl: 24 };
```

- [ ] **Step 2: Commit**

```bash
git add src/theme/index.ts
git commit -m "feat: theme tokens"
```

### Task 4.2: Common components (Button, ProgressBar, Screen)

**Files:**
- Create: `src/components/common/Button.tsx`, `ProgressBar.tsx`, `Screen.tsx`

- [ ] **Step 1: Implement Button**

```tsx
import { Pressable, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors, radius, spacing } from '@/theme';

export function Button({ label, onPress, disabled, loading }: {
  label: string; onPress: () => void; disabled?: boolean; loading?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[styles.btn, (disabled || loading) && styles.disabled]}
    >
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.label}>{label}</Text>}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  btn: { backgroundColor: colors.purple, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  disabled: { opacity: 0.5 },
  label: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
```

- [ ] **Step 2: Implement ProgressBar**

```tsx
import { View, StyleSheet } from 'react-native';
import { colors, radius } from '@/theme';

export function ProgressBar({ percent }: { percent: number }) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { width: `${Math.min(100, Math.max(0, percent))}%` }]} />
    </View>
  );
}
const styles = StyleSheet.create({
  track: { height: 8, backgroundColor: colors.border, borderRadius: radius.sm, overflow: 'hidden' },
  fill: { height: '100%', backgroundColor: colors.purple, borderRadius: radius.sm },
});
```

- [ ] **Step 3: Implement Screen**

```tsx
import { View, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.inner}>{children}</View>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  inner: { flex: 1, padding: spacing.lg },
});
```

- [ ] **Step 4: Typecheck + commit**

Run: `npx tsc --noEmit` (Expected: PASS)

```bash
git add src/components/common/
git commit -m "feat: common UI components"
```

### Task 4.3: ModelLoadingOverlay

**Files:**
- Create: `src/components/common/ModelLoadingOverlay.tsx`

- [ ] **Step 1: Implement (eased fake progress + cycling messages)**

```tsx
import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '@/theme';
import { ProgressBar } from './ProgressBar';

const MESSAGES = [
  'Initializing neural engine...', 'Loading model weights...',
  'Mapping memory layers...', 'Warming up inference...', 'Almost ready...',
];

export function ModelLoadingOverlay({ modelName, sizeLabel, sizeGb }: {
  modelName: string; sizeLabel: string; sizeGb: number;
}) {
  const [pct, setPct] = useState(0);
  const [msg, setMsg] = useState(0);
  const ref = useRef(0);

  useEffect(() => {
    const tick = setInterval(() => {
      ref.current = Math.min(92, ref.current + (92 - ref.current) * 0.03 + 0.15);
      setPct(Math.round(ref.current));
    }, Math.max(60, (sizeGb * 2600) / 92));
    const cycle = setInterval(() => setMsg((m) => (m + 1) % MESSAGES.length), 1900);
    return () => { clearInterval(tick); clearInterval(cycle); };
  }, [sizeGb]);

  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <Text style={styles.app}>Aether</Text>
        <Text style={styles.model} numberOfLines={1}>{modelName}</Text>
        <Text style={styles.size}>{sizeLabel}</Text>
        <ProgressBar percent={pct} />
        <Text style={styles.pct}>{pct}%</Text>
        <Text style={styles.msg}>{MESSAGES[msg]}</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0B0B0FF5', justifyContent: 'center', alignItems: 'center', zIndex: 20 },
  card: { width: '78%', maxWidth: 320, backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1, borderRadius: radius.xl, padding: spacing.xl },
  app: { color: colors.text, fontWeight: '700', textAlign: 'center', marginBottom: spacing.md },
  model: { color: colors.text, fontWeight: '700', fontSize: 16, textAlign: 'center' },
  size: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginBottom: spacing.lg },
  pct: { color: colors.purple, fontWeight: '700', textAlign: 'right', marginTop: spacing.xs, marginBottom: spacing.md },
  msg: { color: colors.textMuted, fontStyle: 'italic', fontSize: 12, textAlign: 'center' },
});
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (Expected: PASS)

```bash
git add src/components/common/ModelLoadingOverlay.tsx
git commit -m "feat: model loading overlay"
```

---

## Phase 5 — Routing, onboarding, sidebar

### Task 5.1: Root layout + boot gating

**Files:**
- Create: `app/_layout.tsx`, `app/index.tsx`

- [ ] **Step 1: Root layout hydrates stores**

`app/_layout.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Slot } from 'expo-router';
import { View } from 'react-native';
import { useProfileStore } from '@/state/useProfileStore';
import { useModelStore } from '@/state/useModelStore';
import { useChatStore } from '@/state/useChatStore';
import { colors } from '@/theme';

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      await Promise.all([
        useProfileStore.getState().hydrate(),
        useModelStore.getState().hydrate(),
        useChatStore.getState().refreshIndex(),
      ]);
      setReady(true);
    })();
  }, []);
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Slot />
    </GestureHandlerRootView>
  );
}
```

`app/index.tsx`:

```tsx
import { Redirect } from 'expo-router';
import { useProfileStore } from '@/state/useProfileStore';

export default function Index() {
  const onboarded = useProfileStore((s) => s.onboarded);
  return <Redirect href={onboarded ? '/(main)' : '/onboarding/name'} />;
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (Expected: PASS)

```bash
git add app/_layout.tsx app/index.tsx
git commit -m "feat: root layout + onboarding gate"
```

### Task 5.2: Onboarding flow (5 steps)

**Files:**
- Create: `app/onboarding/_layout.tsx`, `src/components/onboarding/OnboardingStep.tsx`
- Create: `app/onboarding/name.tsx`, `occupation.tsx`, `project.tsx`, `goals.tsx`, `language.tsx`
- Create: `src/state/useOnboardingDraft.ts`

- [ ] **Step 1: Onboarding draft store**

`src/state/useOnboardingDraft.ts`:

```ts
import { create } from 'zustand';
import { UserProfile } from '@/types';

type Draft = Partial<UserProfile>;
interface DraftState { draft: Draft; set: (patch: Draft) => void; }
export const useOnboardingDraft = create<DraftState>((set) => ({
  draft: {},
  set: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
}));
```

- [ ] **Step 2: Onboarding stack layout**

`app/onboarding/_layout.tsx`:

```tsx
import { Stack } from 'expo-router';
import { colors } from '@/theme';
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />;
}
```

- [ ] **Step 3: Shared step scaffold**

`src/components/onboarding/OnboardingStep.tsx`:

```tsx
import { useState } from 'react';
import { Text, TextInput, StyleSheet, View } from 'react-native';
import { Screen } from '@/components/common/Screen';
import { Button } from '@/components/common/Button';
import { colors, radius, spacing } from '@/theme';

export function OnboardingStep({ title, subtitle, placeholder, initial, onNext, cta = 'Continue' }: {
  title: string; subtitle: string; placeholder: string; initial?: string;
  onNext: (value: string) => void; cta?: string;
}) {
  const [value, setValue] = useState(initial ?? '');
  return (
    <Screen>
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={colors.textMuted}
          value={value}
          onChangeText={setValue}
          autoFocus
        />
      </View>
      <Button label={cta} onPress={() => onNext(value.trim())} disabled={value.trim().length === 0} />
    </Screen>
  );
}
const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 28, fontWeight: '800', marginBottom: spacing.sm },
  subtitle: { color: colors.textMuted, fontSize: 15, marginBottom: spacing.xl },
  input: { backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, color: colors.text, padding: spacing.lg, fontSize: 16 },
});
```

- [ ] **Step 4: The five step screens**

`app/onboarding/name.tsx`:

```tsx
import { router } from 'expo-router';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { useOnboardingDraft } from '@/state/useOnboardingDraft';
export default function Name() {
  const set = useOnboardingDraft((s) => s.set);
  return <OnboardingStep title="Welcome to Aether" subtitle="What should I call you?" placeholder="Your name"
    onNext={(v) => { set({ name: v }); router.push('/onboarding/occupation'); }} />;
}
```

`app/onboarding/occupation.tsx`:

```tsx
import { router } from 'expo-router';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { useOnboardingDraft } from '@/state/useOnboardingDraft';
export default function Occupation() {
  const set = useOnboardingDraft((s) => s.set);
  return <OnboardingStep title="What do you do?" subtitle="Your role or occupation." placeholder="e.g. Software engineer"
    onNext={(v) => { set({ occupation: v }); router.push('/onboarding/project'); }} />;
}
```

`app/onboarding/project.tsx`:

```tsx
import { router } from 'expo-router';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { useOnboardingDraft } from '@/state/useOnboardingDraft';
export default function Project() {
  const set = useOnboardingDraft((s) => s.set);
  return <OnboardingStep title="What are you working on?" subtitle="Your current project." placeholder="e.g. A mobile app"
    onNext={(v) => { set({ project: v }); router.push('/onboarding/goals'); }} />;
}
```

`app/onboarding/goals.tsx`:

```tsx
import { router } from 'expo-router';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { useOnboardingDraft } from '@/state/useOnboardingDraft';
export default function Goals() {
  const set = useOnboardingDraft((s) => s.set);
  return <OnboardingStep title="How can I help?" subtitle="What do you want help with?" placeholder="e.g. Writing code"
    onNext={(v) => { set({ goals: v }); router.push('/onboarding/language'); }} />;
}
```

`app/onboarding/language.tsx`:

```tsx
import { router } from 'expo-router';
import { OnboardingStep } from '@/components/onboarding/OnboardingStep';
import { useOnboardingDraft } from '@/state/useOnboardingDraft';
import { useProfileStore } from '@/state/useProfileStore';
export default function Language() {
  const draft = useOnboardingDraft((s) => s.draft);
  const complete = useProfileStore((s) => s.completeOnboarding);
  return <OnboardingStep title="Preferred language" subtitle="I'll always reply in this language." placeholder="e.g. English"
    cta="Finish" initial="English"
    onNext={async (v) => {
      await complete({
        name: draft.name ?? '', occupation: draft.occupation ?? '',
        project: draft.project ?? '', goals: draft.goals ?? '', language: v,
      });
      router.replace('/(main)');
    }} />;
}
```

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` (Expected: PASS)

```bash
git add app/onboarding/ src/components/onboarding/ src/state/useOnboardingDraft.ts
git commit -m "feat: 5-step onboarding flow"
```

### Task 5.3: Drawer (sidebar) layout

**Files:**
- Create: `app/(main)/_layout.tsx`, `src/components/sidebar/SidebarContent.tsx`, `src/components/sidebar/ConversationRow.tsx`, `src/components/sidebar/ModelSelector.tsx`
- Install: `npm install @react-navigation/drawer`

- [ ] **Step 1: Drawer layout**

`app/(main)/_layout.tsx`:

```tsx
import { Drawer } from 'expo-router/drawer';
import { SidebarContent } from '@/components/sidebar/SidebarContent';
import { colors } from '@/theme';

export default function MainLayout() {
  return (
    <Drawer
      drawerContent={(props) => <SidebarContent {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitle: 'Aether',
        drawerStyle: { backgroundColor: colors.bgCard, width: 300 },
        sceneContainerStyle: { backgroundColor: colors.bg },
      }}
    >
      <Drawer.Screen name="index" options={{ title: 'Aether' }} />
      <Drawer.Screen name="chat/[id]" options={{ title: 'Chat', drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="settings" options={{ title: 'Settings', drawerItemStyle: { display: 'none' } }} />
    </Drawer>
  );
}
```

- [ ] **Step 2: ConversationRow**

`src/components/sidebar/ConversationRow.tsx`:

```tsx
import { Pressable, Text, StyleSheet } from 'react-native';
import { ConversationMeta } from '@/types';
import { colors, radius, spacing } from '@/theme';

export function ConversationRow({ meta, onPress, onLongPress }: {
  meta: ConversationMeta; onPress: () => void; onLongPress: () => void;
}) {
  return (
    <Pressable style={styles.row} onPress={onPress} onLongPress={onLongPress}>
      <Text style={styles.title} numberOfLines={1}>{meta.title}</Text>
      {!!meta.preview && <Text style={styles.preview} numberOfLines={1}>{meta.preview}</Text>}
    </Pressable>
  );
}
const styles = StyleSheet.create({
  row: { paddingVertical: spacing.md, paddingHorizontal: spacing.md, borderRadius: radius.md, marginBottom: spacing.xs },
  title: { color: colors.text, fontSize: 14, fontWeight: '600' },
  preview: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
});
```

- [ ] **Step 3: ModelSelector**

`src/components/sidebar/ModelSelector.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { MODELS } from '@/models/registry';
import { useModelStore } from '@/state/useModelStore';
import { colors, radius, spacing } from '@/theme';

export function ModelSelector() {
  const { installed, activeModelId, setActive } = useModelStore();
  return (
    <View style={styles.box}>
      <Text style={styles.label}>Model</Text>
      {MODELS.map((m) => {
        const ready = installed[m.id];
        const active = activeModelId === m.id;
        return (
          <Pressable
            key={m.id}
            disabled={!ready}
            onPress={() => setActive(m.id)}
            style={[styles.row, active && styles.active, !ready && styles.disabled]}
          >
            <Text style={[styles.name, { color: active ? colors.purple : colors.text }]}>{m.name}</Text>
            <Text style={styles.meta}>{ready ? (active ? 'Active' : 'Tap to use') : 'Not installed'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
const styles = StyleSheet.create({
  box: { marginTop: spacing.md },
  label: { color: colors.textMuted, fontSize: 12, marginBottom: spacing.sm, textTransform: 'uppercase' },
  row: { padding: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.sm },
  active: { borderColor: colors.purple },
  disabled: { opacity: 0.45 },
  name: { fontSize: 14, fontWeight: '700' },
  meta: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
});
```

- [ ] **Step 4: SidebarContent**

`src/components/sidebar/SidebarContent.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { DrawerContentScrollView, DrawerContentComponentProps } from '@react-navigation/drawer';
import { router } from 'expo-router';
import { useChatStore } from '@/state/useChatStore';
import { useModelStore } from '@/state/useModelStore';
import { ConversationRow } from './ConversationRow';
import { ModelSelector } from './ModelSelector';
import { colors, radius, spacing } from '@/theme';

export function SidebarContent(props: DrawerContentComponentProps) {
  const { index, newChat, remove } = useChatStore();
  const activeModelId = useModelStore((s) => s.activeModelId);

  const onNew = async () => {
    if (!activeModelId) { router.push('/(main)/settings'); props.navigation.closeDrawer(); return; }
    const id = await newChat(activeModelId);
    router.push(`/(main)/chat/${id}`);
    props.navigation.closeDrawer();
  };

  return (
    <DrawerContentScrollView {...props} style={{ backgroundColor: colors.bgCard }}>
      <View style={styles.pad}>
        <Pressable style={styles.newBtn} onPress={onNew}>
          <Text style={styles.newLabel}>+ New chat</Text>
        </Pressable>

        <Text style={styles.section}>Conversations</Text>
        {index.length === 0 && <Text style={styles.empty}>No conversations yet</Text>}
        {index.map((meta) => (
          <ConversationRow
            key={meta.id}
            meta={meta}
            onPress={() => { router.push(`/(main)/chat/${meta.id}`); props.navigation.closeDrawer(); }}
            onLongPress={() => remove(meta.id)}
          />
        ))}

        <ModelSelector />

        <Pressable style={styles.settingsBtn} onPress={() => { router.push('/(main)/settings'); props.navigation.closeDrawer(); }}>
          <Text style={styles.settingsLabel}>⚙  Settings & Storage</Text>
        </Pressable>
      </View>
    </DrawerContentScrollView>
  );
}
const styles = StyleSheet.create({
  pad: { padding: spacing.md },
  newBtn: { backgroundColor: colors.purple, borderRadius: radius.md, padding: spacing.md, alignItems: 'center', marginBottom: spacing.lg },
  newLabel: { color: '#fff', fontWeight: '700' },
  section: { color: colors.textMuted, fontSize: 12, textTransform: 'uppercase', marginBottom: spacing.sm },
  empty: { color: colors.textMuted, fontSize: 13, fontStyle: 'italic', marginBottom: spacing.md },
  settingsBtn: { marginTop: spacing.xl, padding: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  settingsLabel: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
```

- [ ] **Step 5: Typecheck + commit**

Run: `npx tsc --noEmit` (Expected: PASS)

```bash
git add app/\(main\)/_layout.tsx src/components/sidebar/ package.json package-lock.json
git commit -m "feat: drawer sidebar with conversations + model selector"
```

### Task 5.4: Main index (empty / new-chat surface)

**Files:**
- Create: `app/(main)/index.tsx`

- [ ] **Step 1: Implement**

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@/components/common/Button';
import { useChatStore } from '@/state/useChatStore';
import { useModelStore } from '@/state/useModelStore';
import { colors, spacing } from '@/theme';

export default function MainIndex() {
  const newChat = useChatStore((s) => s.newChat);
  const activeModelId = useModelStore((s) => s.activeModelId);

  const start = async () => {
    if (!activeModelId) return router.push('/(main)/settings');
    const id = await newChat(activeModelId);
    router.push(`/(main)/chat/${id}`);
  };

  return (
    <View style={styles.c}>
      <Text style={styles.h}>Aether</Text>
      <Text style={styles.sub}>
        {activeModelId ? 'Private, on-device AI. Start a conversation.' : 'Download a model to begin.'}
      </Text>
      <View style={{ height: spacing.xl }} />
      <Button label={activeModelId ? 'New chat' : 'Get a model'} onPress={start} />
    </View>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  h: { color: colors.text, fontSize: 32, fontWeight: '800' },
  sub: { color: colors.textMuted, fontSize: 15, textAlign: 'center', marginTop: spacing.sm },
});
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (Expected: PASS)

```bash
git add app/\(main\)/index.tsx
git commit -m "feat: main landing screen"
```

---

## Phase 6 — Chat

### Task 6.1: Chat components (Markdown, MessageBubble, MessageList, ChatInput, TypingIndicator)

**Files:**
- Create: `src/components/common/Markdown.tsx`
- Create: `src/components/chat/MessageBubble.tsx`, `MessageList.tsx`, `ChatInput.tsx`, `TypingIndicator.tsx`

- [ ] **Step 1: Markdown wrapper**

`src/components/common/Markdown.tsx`:

```tsx
import Markdown from 'react-native-marked';
import { colors } from '@/theme';

export function MarkdownView({ content }: { content: string }) {
  return (
    <Markdown
      value={content}
      flatListProps={{ scrollEnabled: false, style: { backgroundColor: 'transparent' } }}
      styles={{
        text: { color: colors.text, fontSize: 15 },
        code: { backgroundColor: '#000', color: '#E2E2E2' },
        codeBlock: { backgroundColor: '#000', color: '#E2E2E2', borderRadius: 8, padding: 10 },
      }}
    />
  );
}
```

- [ ] **Step 2: MessageBubble (user = plain, assistant = markdown)**

`src/components/chat/MessageBubble.tsx`:

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { Message } from '@/types';
import { MarkdownView } from '@/components/common/Markdown';
import { colors, radius, spacing } from '@/theme';

export function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  return (
    <View style={[styles.row, isUser ? styles.right : styles.left]}>
      <View style={[styles.bubble, isUser ? styles.user : styles.assistant]}>
        {isUser
          ? <Text style={styles.userText}>{message.content}</Text>
          : <MarkdownView content={message.content || '…'} />}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  row: { marginBottom: spacing.md, flexDirection: 'row' },
  left: { justifyContent: 'flex-start' },
  right: { justifyContent: 'flex-end' },
  bubble: { maxWidth: '85%', borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  user: { backgroundColor: colors.userBubble },
  assistant: { backgroundColor: colors.assistantBubble },
  userText: { color: '#fff', fontSize: 15 },
});
```

- [ ] **Step 3: TypingIndicator**

`src/components/chat/TypingIndicator.tsx`:

```tsx
import { Text, StyleSheet } from 'react-native';
import { colors, spacing } from '@/theme';
export function TypingIndicator() {
  return <Text style={styles.t}>Aether is thinking…</Text>;
}
const styles = StyleSheet.create({ t: { color: colors.textMuted, fontStyle: 'italic', marginBottom: spacing.sm } });
```

- [ ] **Step 4: MessageList**

`src/components/chat/MessageList.tsx`:

```tsx
import { useRef, useEffect } from 'react';
import { FlatList } from 'react-native';
import { Message } from '@/types';
import { MessageBubble } from './MessageBubble';
import { spacing } from '@/theme';

export function MessageList({ messages }: { messages: Message[] }) {
  const ref = useRef<FlatList<Message>>(null);
  useEffect(() => { ref.current?.scrollToEnd({ animated: true }); }, [messages.length, messages[messages.length - 1]?.content]);
  return (
    <FlatList
      ref={ref}
      data={messages}
      keyExtractor={(m) => m.id}
      renderItem={({ item }) => <MessageBubble message={item} />}
      contentContainerStyle={{ padding: spacing.lg }}
      onContentSizeChange={() => ref.current?.scrollToEnd({ animated: true })}
    />
  );
}
```

- [ ] **Step 5: ChatInput**

`src/components/chat/ChatInput.tsx`:

```tsx
import { useState } from 'react';
import { View, TextInput, Pressable, Text, StyleSheet } from 'react-native';
import { colors, radius, spacing } from '@/theme';

export function ChatInput({ onSend, onStop, generating, disabled }: {
  onSend: (text: string) => void; onStop: () => void; generating: boolean; disabled?: boolean;
}) {
  const [text, setText] = useState('');
  const send = () => { const t = text.trim(); if (!t) return; setText(''); onSend(t); };
  return (
    <View style={styles.bar}>
      <TextInput
        style={styles.input}
        value={text}
        onChangeText={setText}
        placeholder={disabled ? 'Loading model…' : 'Message Aether'}
        placeholderTextColor={colors.textMuted}
        editable={!disabled}
        multiline
      />
      {generating ? (
        <Pressable style={styles.send} onPress={onStop}><Text style={styles.sendLabel}>■</Text></Pressable>
      ) : (
        <Pressable style={[styles.send, (disabled || !text.trim()) && styles.disabled]} onPress={send} disabled={disabled || !text.trim()}>
          <Text style={styles.sendLabel}>↑</Text>
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-end', padding: spacing.sm, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  input: { flex: 1, maxHeight: 120, backgroundColor: colors.bgCard, borderRadius: radius.lg, color: colors.text, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 15 },
  send: { marginLeft: spacing.sm, width: 44, height: 44, borderRadius: 22, backgroundColor: colors.purple, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.4 },
  sendLabel: { color: '#fff', fontSize: 18, fontWeight: '800' },
});
```

- [ ] **Step 6: Typecheck + commit**

Run: `npx tsc --noEmit` (Expected: PASS)

```bash
git add src/components/chat/ src/components/common/Markdown.tsx
git commit -m "feat: chat UI components with markdown rendering"
```

### Task 6.2: useInference hook (load-on-open + streaming)

**Files:**
- Create: `src/hooks/useInference.ts`

- [ ] **Step 1: Implement**

```ts
import { useEffect, useState, useCallback } from 'react';
import * as Llama from '@/llm/LlamaService';
import { buildSystemPrompt } from '@/llm/prompt';
import { useChatStore } from '@/state/useChatStore';
import { useProfileStore } from '@/state/useProfileStore';
import { getModelById } from '@/models/registry';
import * as MM from '@/models/ModelManager';

export function useInference(modelId: string | undefined) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profile = useProfileStore((s) => s.profile);
  const chat = useChatStore();

  // Load the model whenever the chat (model) opens.
  useEffect(() => {
    const model = modelId ? getModelById(modelId) : undefined;
    if (!model) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        await Llama.initLlm(MM.localPath(model));
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'MODEL_LOAD_FAILED';
        if (!cancelled) setError(
          msg === 'INSUFFICIENT_RAM' ? 'Not enough memory — try Gemma 4 E2B.'
          : msg === 'MODEL_NOT_FOUND' ? 'Model file missing — re-download it in Settings.'
          : 'Failed to load the model.',
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [modelId]);

  const send = useCallback(async (text: string) => {
    await chat.appendUser(text);
    const system = buildSystemPrompt(profile);
    const messages = useChatStore.getState().current?.messages ?? [];
    chat.startAssistant();
    await Llama.generate(
      system,
      messages,
      (token) => useChatStore.getState().appendToken(token),
      () => useChatStore.getState().finishAssistant(),
      (e) => { useChatStore.getState().appendToken(`\n\n_Error: ${e}_`); useChatStore.getState().finishAssistant(); },
    );
  }, [chat, profile]);

  const stop = useCallback(() => { Llama.stopGeneration(); }, []);

  return { loading, error, send, stop };
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (Expected: PASS)

```bash
git add src/hooks/useInference.ts
git commit -m "feat: useInference hook (load-on-open + streaming send)"
```

### Task 6.3: Chat screen

**Files:**
- Create: `app/(main)/chat/[id].tsx`

- [ ] **Step 1: Implement**

```tsx
import { useEffect } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useChatStore } from '@/state/useChatStore';
import { useInference } from '@/hooks/useInference';
import { getModelById } from '@/models/registry';
import { MessageList } from '@/components/chat/MessageList';
import { ChatInput } from '@/components/chat/ChatInput';
import { TypingIndicator } from '@/components/chat/TypingIndicator';
import { ModelLoadingOverlay } from '@/components/common/ModelLoadingOverlay';
import { colors, spacing } from '@/theme';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { current, open, generating } = useChatStore();
  useEffect(() => { if (id) open(id); }, [id]);

  const modelId = current?.modelId;
  const model = modelId ? getModelById(modelId) : undefined;
  const { loading, error, send, stop } = useInference(modelId);

  return (
    <KeyboardAvoidingView style={styles.c} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {current && <MessageList messages={current.messages} />}
      {generating && <View style={{ paddingHorizontal: spacing.lg }}><TypingIndicator /></View>}
      {error && <Text style={styles.err}>{error}</Text>}
      <ChatInput onSend={send} onStop={stop} generating={generating} disabled={loading || !!error} />
      {loading && model && (
        <ModelLoadingOverlay modelName={model.name} sizeLabel={model.sizeLabel} sizeGb={model.sizeBytes / 1e9} />
      )}
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  err: { color: colors.danger, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, fontSize: 13 },
});
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (Expected: PASS)

```bash
git add app/\(main\)/chat/
git commit -m "feat: chat screen with load-on-open overlay + streaming"
```

---

## Phase 7 — Settings & storage management

### Task 7.1: Storage formatting helper (TDD)

**Files:**
- Create: `src/components/settings/format.ts`
- Test: `src/components/settings/format.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { formatBytes } from './format';
describe('formatBytes', () => {
  it('formats GB', () => expect(formatBytes(3462678272)).toBe('3.5 GB'));
  it('formats MB', () => expect(formatBytes(5_000_000)).toBe('5.0 MB'));
  it('formats KB', () => expect(formatBytes(2048)).toBe('2 KB'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/components/settings/format.test.ts`
Expected: FAIL ("Cannot find module './format'").

- [ ] **Step 3: Implement**

```ts
export function formatBytes(bytes: number): string {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(1)} GB`;
  if (bytes >= 1e6) return `${(bytes / 1e6).toFixed(1)} MB`;
  return `${(bytes / 1e3).toFixed(0)} KB`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest src/components/settings/format.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/settings/format.ts src/components/settings/format.test.ts
git commit -m "feat: byte formatting helper"
```

### Task 7.2: StorageBar + ModelManagerRow components

**Files:**
- Create: `src/components/settings/StorageBar.tsx`, `src/components/settings/ModelManagerRow.tsx`

- [ ] **Step 1: StorageBar**

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { ProgressBar } from '@/components/common/ProgressBar';
import { formatBytes } from './format';
import { colors, radius, spacing } from '@/theme';

export function StorageBar({ total, free, aetherUsed }: { total: number; free: number; aetherUsed: number }) {
  const used = total - free;
  const pct = total > 0 ? (used / total) * 100 : 0;
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Text style={styles.title}>Device Storage</Text>
        <Text style={styles.muted}>{formatBytes(used)} used</Text>
      </View>
      <ProgressBar percent={pct} />
      <Text style={styles.sub}>{formatBytes(used)} / {formatBytes(total)} total · {formatBytes(free)} free</Text>
      <Text style={styles.aether}>Aether models: {formatBytes(aetherUsed)}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.lg },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.sm },
  title: { color: colors.text, fontWeight: '700' },
  muted: { color: colors.textMuted, fontSize: 13 },
  sub: { color: colors.textMuted, fontSize: 12, marginTop: spacing.sm },
  aether: { color: colors.purple, fontSize: 12, marginTop: spacing.xs, fontWeight: '600' },
});
```

- [ ] **Step 2: ModelManagerRow**

```tsx
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { ModelDef } from '@/types';
import { ProgressBar } from '@/components/common/ProgressBar';
import { colors, radius, spacing } from '@/theme';

export function ModelManagerRow({ model, installed, download, onDownload, onCancel, onDelete }: {
  model: ModelDef;
  installed: boolean;
  download?: { pct: number; mbps: number; downloading: boolean };
  onDownload: () => void; onCancel: () => void; onDelete: () => void;
}) {
  const confirmDelete = () => Alert.alert(`Delete ${model.name}?`, "You'll need to download it again.",
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: onDelete }]);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{model.name}</Text>
          <Text style={styles.meta}>{model.maker} · {model.sizeLabel} · {model.badge}</Text>
        </View>
        {installed ? (
          <Pressable style={styles.del} onPress={confirmDelete}><Text style={styles.delTxt}>Delete</Text></Pressable>
        ) : download?.downloading ? (
          <Pressable style={styles.cancel} onPress={onCancel}><Text style={styles.cancelTxt}>Cancel</Text></Pressable>
        ) : (
          <Pressable style={styles.get} onPress={onDownload}><Text style={styles.getTxt}>Download</Text></Pressable>
        )}
      </View>
      <Text style={styles.desc}>{model.description}</Text>
      {download?.downloading && (
        <View style={{ marginTop: spacing.sm }}>
          <ProgressBar percent={download.pct} />
          <Text style={styles.meta}>{Math.round(download.pct)}% · {download.mbps.toFixed(1)} MB/s</Text>
        </View>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { backgroundColor: colors.bgCard, borderColor: colors.border, borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md },
  head: { flexDirection: 'row', alignItems: 'center' },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  meta: { color: colors.textMuted, fontSize: 12, marginTop: 2 },
  desc: { color: colors.textMuted, fontSize: 13, marginTop: spacing.sm },
  get: { backgroundColor: colors.purple, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  getTxt: { color: '#fff', fontWeight: '700', fontSize: 13 },
  cancel: { borderColor: colors.border, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  cancelTxt: { color: colors.text, fontSize: 13 },
  del: { backgroundColor: '#2A1414', borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  delTxt: { color: colors.danger, fontWeight: '700', fontSize: 13 },
});
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx tsc --noEmit` (Expected: PASS)

```bash
git add src/components/settings/StorageBar.tsx src/components/settings/ModelManagerRow.tsx
git commit -m "feat: settings storage bar + model manager row"
```

### Task 7.3: Settings screen

**Files:**
- Create: `app/(main)/settings.tsx`

- [ ] **Step 1: Implement**

```tsx
import { useCallback, useState } from 'react';
import { ScrollView, Text, StyleSheet } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { MODELS } from '@/models/registry';
import * as MM from '@/models/ModelManager';
import { useModelStore } from '@/state/useModelStore';
import * as Llama from '@/llm/LlamaService';
import { StorageBar } from '@/components/settings/StorageBar';
import { ModelManagerRow } from '@/components/settings/ModelManagerRow';
import { colors, spacing } from '@/theme';

export default function Settings() {
  const { installed, downloads, download, cancel, remove } = useModelStore();
  const [disk, setDisk] = useState({ total: 0, free: 0, used: 0 });

  const refresh = useCallback(() => {
    (async () => {
      const [total, free, used] = await Promise.all([MM.totalBytes(), MM.freeBytes(), MM.installedBytes()]);
      setDisk({ total, free, used });
    })();
  }, []);
  useFocusEffect(refresh);

  return (
    <ScrollView style={styles.c} contentContainerStyle={{ padding: spacing.lg }}>
      <StorageBar total={disk.total} free={disk.free} aetherUsed={disk.used} />
      <Text style={styles.h}>Models</Text>
      {MODELS.map((m) => (
        <ModelManagerRow
          key={m.id}
          model={m}
          installed={!!installed[m.id]}
          download={downloads[m.id]}
          onDownload={() => download(m.id)}
          onCancel={() => cancel(m.id)}
          onDelete={async () => { await Llama.releaseLlm(); await remove(m.id); refresh(); }}
        />
      ))}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: colors.bg },
  h: { color: colors.text, fontSize: 18, fontWeight: '800', marginBottom: spacing.md },
});
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx tsc --noEmit` (Expected: PASS)

```bash
git add app/\(main\)/settings.tsx
git commit -m "feat: settings screen with real-device storage + model management"
```

---

## Phase 8 — Build, smoke test, verify on device

### Task 8.1: Full type + unit test sweep

- [ ] **Step 1: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS, zero errors.

- [ ] **Step 2: All unit tests**

Run: `npx jest`
Expected: PASS — registry, json, profile, conversations, prompt, paths, format suites all green.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A && git commit -m "test: green typecheck + unit suite" || echo "nothing to commit"
```

### Task 8.2: Build the dev client and verify the critical native path

> This step needs the physical Android device (8 GB RAM, API 29+, arm64) connected via USB with USB debugging on. `llama.rn` and background-downloader cannot run in Expo Go or Jest.

- [ ] **Step 1: Prebuild + run**

```bash
npx expo prebuild -p android
npx expo run:android
```

Expected: app installs and launches; onboarding appears on first run.

- [ ] **Step 2: Manual verification checklist** (record results in the PR description)

- [ ] Onboarding: complete all 5 steps → lands on main; relaunch skips onboarding.
- [ ] Settings → Download **Gemma 4 E2B** → progress + MB/s update; survives backgrounding the app.
- [ ] Kill app mid-download, relaunch → download resumes / completes (reattach works).
- [ ] Storage card shows real device total/free and "Aether models" size matching the file.
- [ ] New chat → **ModelLoadingOverlay** shows, then dismisses → first token streams in.
- [ ] Assistant message renders markdown + code blocks.
- [ ] Reopen the chat from the sidebar → model reloads (overlay shows) → continues.
- [ ] Switch active model to E4B (if downloaded) → new chat uses it; old context released (no crash).
- [ ] Delete a model in Settings → file removed; storage figures drop; active model handled gracefully.
- [ ] Airplane mode → existing model still chats fully offline.

- [ ] **Step 3: Tag the verified build**

```bash
git tag -a v2.0.0-beta.1 -m "Aether Beta 2 MVP — verified on device"
```

---

## Self-review notes (coverage check)

- Spec §2 stack → Task 0.1/0.2 (deps, build config) ✓
- Spec §4 file structure → Phases 1–7 create every listed file ✓
- Spec §5 persistence → Tasks 1.3–1.5 ✓
- Spec §6 registry (exact URLs/sizes) → Task 1.2 ✓
- Spec §7 download (createDownloadTask, reattach, verify, delete, space) → Tasks 2.1, 3.2 ✓
- Spec §8 inference (init guard, Gemma manual prompt, params, release) → Tasks 1.6, 2.2 ✓
- Spec §9 load-on-chat-open + overlay → Tasks 4.3, 6.2, 6.3 ✓
- Spec §10 settings + real-device storage → Tasks 7.1–7.3 ✓
- Spec §11 native/build (arm64, minSdk29, async-storage size, dev client) → Tasks 0.2, 8.2 ✓
- Spec §12 error handling → error mapping (2.2), safe JSON (1.3), corrupt-data tests (1.4/1.5) ✓
- Spec §13 testing → TDD tasks + 8.1 + manual 8.2 ✓
- Markdown rendering (in-scope) → Tasks 6.1 ✓
```

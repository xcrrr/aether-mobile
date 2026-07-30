# Release Notes

## 2.2.0

First release-signed build, and the first APK since `2.1.0` (built 2026-07-02 from commit
`aa89bab`). Everything below landed in between.

Android, arm64-v8a only, `minSdkVersion` 29.

### Scope

The shipped app is **Chat, Core, Research, images and files, and voice**.

Task — a local multi-step agent — and Library, its saved outputs, are implemented and still
tested in `app/src/agent/`, but are hidden behind `TASK_UI_ENABLED = false` in
`app/src/release/features.ts`. This is a scope decision, not a removal. Task is the surface with
the least real-device verification behind it, and this first release focuses on the two features
that define Aether. The code stays in place, compiles under strict TypeScript, and runs in the
test suite on every change.

### Core

- **Every saved memory is visible again.** The knowledge graph was capping labels at roughly six
  regardless of how many facts existed. Every node was always drawn — only the names were
  budgeted — so twenty saved memories read as six. The budget now scales with the graph, and
  label collision is the only thing that hides a name.
- **Two facts sharing a key no longer destroy each other.** Nodes were keyed on the memory key
  alone while the store enforces uniqueness per category *and* key, so two unrelated facts that
  happened to share a key collapsed into one and one of them vanished from the only surface meant
  to show everything saved.
- **A second, unrelated six-memory ceiling is gone.** Asking Core directly — "what do you know
  about me?" — was capped by the same small limit used for ambient recall during ordinary chat:
  six notes on Thinking, three on Fast. Explicit profile questions now get their own, much larger
  envelope.
- **Memories save without pressing "Analyze now".** Automatic extraction yields the shared model
  session rather than interrupting a reply, and it used to discard the work entirely if the
  session was busy — so a fast follow-up message silently threw the memory away. A single
  extraction queue now owns retry state and keeps the work until the session is idle.
- **Extraction reaches Core from every path.** It was only queued after a fully successful reply,
  so errors, stops and Research exchanges never reached Core at all. It also read whichever
  conversation was currently open rather than the one the message came from, so navigating away
  mid-extraction could skip the chat or inspect the wrong one.
- **Evidence really is a verbatim quote now.** Grounding accepted an unordered 80% bag of words
  drawn from across all your messages, which does not match the promise the feature makes. A fact
  must now quote a contiguous span from a single user message.
- **A deleted fact can't be revived by an unrelated later message.** Authority was compared
  against the newest turn in the transcript instead of the message that actually supplied the
  evidence. Re-reading the same message also counted as fresh reinforcement; it no longer does.
- **Facts that merely share a value stay separate.** `birth_city = Warsaw` and
  `current_city = Warsaw` were treated as the same fact and collapsed. Related-but-distinct facts
  like a marathon date and a marathon training routine no longer merge either.
- **Core search returns every node**, not the first 40. Android Back closes the memory list
  before leaving Core. Filters for categories that no longer exist are pruned.
- **Extraction sees the right facts.** The list of known facts sent to the model for
  deduplication was capped by count in insertion order, so past fifty memories it saw the oldest
  fifty and never the ones being discussed. It could also overflow the context window and make
  extraction silently return nothing. It is now relevance-ranked and budgeted in characters.
- **Recall matches word forms.** "climb" now finds a note about "climbing"; "projects" finds
  "project".
- A prompt-injection path through JavaScript's `$`-substitution in `String.replace` was closed.
  Two silent link-dropping bugs — case-sensitive key matching, and canonicalised keys not being
  tracked — were fixed.

### Research

- **Three sources, delivered rather than attempted.** The source limit was being applied to the
  number of results *searched*, so every failed page fetch was a permanent loss and answers
  routinely came back with one or two sources. Candidates are now over-fetched in parallel until
  three have real content.
- **Real citations.** The prompt used to forbid `[n]` markers while the extractor scanned for
  exactly those, so Research shipped with no per-claim attribution at all. Markers are now
  required, bounded to the number of sources, and map to numbered source cards.
- **A real interface.** Research previously had no UI — progress was italic markdown written into
  the message body, and sources were a rule, a bold heading and a list of links. There is now a
  live card showing each source's domain, title, and whether it was read or failed, and numbered
  source cards under the finished answer.
- **Honest failures.** The search layer returned an empty list for "the web has nothing",
  "DuckDuckGo rate-limited us" and "there is no network" alike, and the app told you to rephrase
  in all three cases. Those are now four distinct messages, none of which blames your phrasing
  for someone else's refusal.

### Chat and models

- **Sampling tuned for assistant work.** Defaults were Gemma's published creative-generation
  settings (temperature 1.0, top-k 64, top-p 0.95). On a 2–4B model answering questions those
  show up as drift, invented detail and self-contradiction. Now 0.7 / 40 / 0.9.
- **The system prompt counts against the context window.** It never used to, so a long
  conversation with a full Core block could push past the window, and what gets dropped there is
  not the app's choice.
- **Gray screen on system back is fixed.** Backing out of Settings or Core showed an empty gray
  screen instead of returning to the last chat.
- **Sending after scrolling up jumps to the newest message again.** Scrolling up during
  streaming still leaves you where you are.

### Privacy and permissions

- Three permissions are no longer requested: `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`
  and `SYSTEM_ALERT_WINDOW`. None were needed — models download to app-private storage and
  attachments arrive as content URIs — and none were declared by the app itself; all three
  arrived through library manifest merging.

Aether makes an outbound network call in exactly two situations: downloading a model from
Hugging Face when you ask it to, and Research when you turn it on for a message. There is no
account system, no analytics and no crash reporting.

### Known limitations

Read these before installing.

- **The in-app legal documents are drafts.** All four — Closed Beta Terms, Privacy Notice,
  Research Disclosure, AI Safety Notice — are version `2026.07.02-draft.1` and are marked in the
  app as requiring publisher and legal review. Publisher identity, support contact and privacy
  contact are not yet set. See `docs/aether-legal-review-required.md`.
- **Voice input has not been verified on real hardware.**
- **Extraction quality is unmeasured.** There is no fixture set of real conversations with
  expected extractions, so a change to Core's extractor can be shown to be different but not
  better.
- **The sampling change is a considered default, not a measurement.** It has not been A/B tested
  on hardware.
- As of the last dependency audit (2026-07-14), `npm ci` reported 24 vulnerabilities (17
  moderate, 6 high, 1 critical). None have been addressed and it has not been re-audited.
- `expo-print` is still a dependency for the now-unreachable PDF export.

### Requirements

- Android 10 or newer, arm64-v8a. It will not install on a 32-bit or x86 device.
- A model download over the internet on first use: Gemma 4 E2B (Fast) is 2.6 GB, Gemma 4 E4B
  (Thinking) is 3.7 GB. Both are recommended for devices with at least 8 GB of RAM. Chat works
  offline afterwards.

---

## 2.1.0

Built 2026-07-02 from commit `aa89bab`. Superseded by 2.2.0.

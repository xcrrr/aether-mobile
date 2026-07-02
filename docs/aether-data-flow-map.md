# Aether Data Flow Map

Last audited: 2026-07-02  
Scope: `app/` mobile app plus a light source check of `website/`. This is implementation-backed release documentation, not a legal compliance claim.

## Summary

No account/auth flow, analytics SDK, crash reporting SDK, or mobile backend API was identified in the active mobile app source. The proven mobile network surfaces are user-started model downloads and online Research. Agent Actions can call the same Research pipeline. The website has static outbound links and a local-only beta email form in source; no signup submission endpoint was identified.

## Mobile App Flows

| Flow | Data involved | Local or networked | Initiation | Purpose | Storage | Retention/deletion visible in code | Third party | Disclosure required | Confidence |
|---|---|---|---|---|---|---|---|---|---|
| Closed beta legal acceptance | Document id/version, accepted timestamp, app version/build | Local | User taps accept | Gate beta access and re-accept changed terms | AsyncStorage `@aether/legal_acceptance` | Reset local data removes it; app data clear removes it | None | Beta Terms gate and Legal Center | Proven |
| Profile onboarding | Name, goals, language placeholders | Local | User onboarding | Personalize local prompts | AsyncStorage `@aether/profile`, `@aether/onboarding_complete` | Reset local data or app data clear | None | Privacy Notice | Proven |
| Theme/settings | Theme preference, active model id | Local | User settings/model choice | App settings | AsyncStorage `@aether/theme_pref`, `@aether/settings` | Reset local data or app data clear | None | Privacy Notice | Proven |
| Regular chat generation | User messages, attachments, selected Core recall, model id | Local after model installed | User sends chat | On-device LiteRT response | AsyncStorage conversation rows and app document files | Conversations can be deleted individually; reset local data clears rows/media | LiteRT native library from Google AI Edge included in app | Beta Notice, Privacy Notice, AI Safety Notice | Proven |
| Conversation persistence | Message text, assistant text, question cards, attachment metadata, source links in Research answers | Local | Automatic after chat | Resume chats | `@aether/conversations_index`, `@aether/conversation/{id}` | Delete conversation removes row; reset local data clears all | None | Privacy Notice | Proven |
| Image attachments | Picked/camera/pasted image URI, transient base64, durable copied image | Local | User chooses image/camera/paste | Vision input and conversation display | `documentDirectory/chat-media/{id}.jpg`; conversation metadata | Reset local data deletes `chat-media`; conversation delete does not currently delete media file | Expo image picker / clipboard APIs | Permission explanation and Privacy Notice | Proven |
| File/document attachments | Picked file URI/name/type/size, extracted text for txt/pdf/docx | Local | User opens file picker | Provide document context | Conversation attachment metadata/extracted text | Reset local data clears conversations; picker cache behavior OS-controlled | Expo document picker; `mammoth` for docx; local PDF parser | Permission explanation and Privacy Notice | Proven |
| Voice input | Microphone audio handled by device speech recognizer; recognized text | Potentially local or networked depending OS recognizer | User taps Voice | Dictation into message box | Recognized text only if user sends it | Not persisted unless sent in chat | Android speech recognition provider may be Google/Samsung/device service | Microphone explanation and Privacy Notice | Inferred/unknown provider behavior |
| Core / Second Brain | Extracted user facts, edges, evidence/reasons, enabled flag | Local | Automatic after replies and manual Core actions | Personal memory/recall | AsyncStorage `aether_second_brain` | Core UI can clear entries; reset local data clears store | None | Privacy Notice | Proven |
| Core extraction | Recent conversation text into local model extract call | Local | Automatic after assistant reply when model available | Save useful facts | Same Core store | Same as Core | None | Privacy Notice, AI Safety Notice | Proven |
| Agent task records | Goal, steps, approvals/questions, final answer, receipts, saved artifacts | Local, except tools may use Research | User starts Act mode | Run structured tasks with local receipts | `@aether/agent-tasks-index`, `@aether/agent-task/{id}`, `@aether/agent-artifacts`, `@aether/agent-mode` | Bounded task/artifact history; reset local data clears keys | None unless Research tool executes | AI Safety Notice, Research Disclosure if online sources may be used | Proven |
| Agent web research tool | Research query, fetched public pages, source URLs | Networked | Agent task chooses `web_research` after user starts Act | Use online sources for a task | Final answer/receipt/source links may persist in conversation/task | Reset local data clears persisted records | DuckDuckGo and fetched websites | Research Disclosure before Act/Research use | Proven |
| Online Research search | Query text, User-Agent, request metadata | Networked | User accepts disclosure and starts Research, or Act uses web research | Search public web | Query persisted as user message; result/source list in assistant message | Conversation delete/reset local data | DuckDuckGo HTML endpoint `https://html.duckduckgo.com/html/?q=` | Research Disclosure | Proven |
| Online Research page fetch | Public result URLs, fetched page text | Networked | Research pipeline after search | Ground cited answer | Fetched text used in prompt; answer/sources persist, raw fetched pages not separately stored | Conversation delete/reset local data removes answer/source list | Result websites | Research Disclosure | Proven |
| Research safety filters | URLs and fetched text | Local processing around network calls | Automatic in Research | Block unsafe/private URLs and sanitize prompt text | Not separately stored | N/A | None | Research Disclosure and security docs | Proven |
| Model downloads | Model id, Hugging Face URL, file bytes, notification permission on Android | Networked | User taps model download | Install `.litertlm` file | `documentDirectory/models/{filename}` | Settings delete model; reset local data deletes models | Hugging Face `litert-community/.../resolve/main/...`; redirects unknown | Beta Notice, Privacy Notice, permission explanation | Proven |
| Model loading/inference | Local model path, prompt/messages/images copied to cache | Local | User opens chat with installed model | Run LiteRT session | Temporary image files in cache; model file in document directory | Cache OS-controlled; model delete/reset removes model file | LiteRT native runtime | AI Safety Notice | Proven |
| Clipboard copy | Assistant/code text copied to OS clipboard | Local OS clipboard | User taps copy | User convenience | OS clipboard outside app control | OS clipboard retention unknown | OS clipboard | Privacy Notice | Proven/unknown retention |
| App logs/debug telemetry | Console warnings/errors only in source; no remote log SDK found | Local developer/runtime logs | Automatic on error | Diagnostics | Android logcat/dev console | OS/dev tooling retention unknown | None identified | Release checklist | Proven/unknown retention |
| Fonts/assets in mobile | Bundled Expo Google Font packages and app assets | Local bundled assets at runtime | App startup | UI rendering | App bundle | Removed with app | Font packages from npm at build/install time | Data-flow inventory | Proven |
| Android permissions in manifest | INTERNET, foreground service/data sync, POST_NOTIFICATIONS, READ/WRITE_EXTERNAL_STORAGE, RECORD_AUDIO, SYSTEM_ALERT_WINDOW, VIBRATE | Permission declarations | Build/runtime | Network, downloads, voice, OS capabilities | Android manifest | N/A | Android OS | Permission disclosures and Play Data Safety review | Proven |

## Website Source Check

| Flow | Data involved | Local or networked | Initiation | Purpose | Storage | Third party | Confidence |
|---|---|---|---|---|---|---|---|
| Discord link | Navigation to Discord invite | Networked after click | User click | Community link | None in source | Discord | Proven |
| GitHub release link | Navigation to GitHub release | Networked after click | User click | Download/release info | None in source | GitHub | Proven |
| CloudFront video asset | Browser requests remote MP4 in cinematic component | Networked when component/page loads | Page render | Marketing visual | Browser cache | CloudFront host `d8j0ntlcm91z4.cloudfront.net` | Proven |
| Signup form | Email typed into form | Local React state only | User input | Beta updates UI placeholder | No submission endpoint identified | None identified | Proven |
| Website analytics/auth/crash | None identified in source search | Unknown absent | N/A | N/A | N/A | N/A | Proven absence from source search |

## Unknowns Requiring Manual Verification

- Final publisher/developer identity, privacy contact, support contact, jurisdiction, and age/minor policy.
- Whether Android speech recognition on target beta devices processes audio locally or through a Google/Samsung/cloud service.
- Runtime behavior of transitive native SDKs beyond source-level dependency review.
- Google Play Data Safety answers and whether the app will be distributed only by APK/GitHub, Play internal testing, or another channel.
- Final public Privacy Policy URL and Terms URL.
- Whether website signup will later connect to an email service; current source does not submit emails.


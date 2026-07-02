# Aether audit przed duzym update'em

Data: 2026-06-27  
Zrodlo: `C:\Users\PC\Desktop\aether.zip`  
Wypakowane zrodla: `C:\Users\PC\Documents\Aether\_analysis\aether_source\aetherbeta`

## Status rozpakowania

- Pelne rozpakowanie archiwum nie bylo mozliwe, bo zip zawiera `node_modules`, buildy Androida, cache Expo i `.claude/worktrees`; pelny extract zapelnil dysk zanim doszly kluczowe pliki `app/...`.
- Usunalem czesciowy extract i wypakowalem selektywnie kod zrodlowy, konfiguracje, dokumenty, assets, patche i natywne pliki Androida.
- Swiadomie pominiete w extract: `node_modules`, `android/app/build`, `android/build`, `android/.gradle`, `.expo`, `.git`, `.claude/worktrees`.
- To wystarcza do audytu produktu i kodu. Do uruchomienia appki lokalnie trzeba bedzie ponownie zainstalowac zaleznosci albo pracowac w pelnym repo z miejscem na dysku.

## Executive summary

Aether ma bardzo mocny produktowy rdzen: lokalny AI assistant na Androidzie, modele on-device, web research, vision, voice, pliki, pamiec/Core i 3D graph. Potencjal jest wysoki, bo obietnica "private AI that runs on your phone" jest realnie inna niz Claude/ChatGPT.

Najwiekszy problem nie jest funkcjonalny, tylko estetyczno-produktowy. UI probuje byc Claude-like, ale czesto wyglada jak port AI-prototypu: duzo fioletu, aurora, duze logo, mocne pigułki, za duzo copy o prywatnosci, efektowny 3D graph i komponenty, ktore czuja sie bardziej jak demo niz spokojna aplikacja do codziennej pracy.

Kierunek na wielki update:

1. Zrobic z Aether cichy, neutralny, tekstowy produkt w stylu Claude App.
2. Aurora zostaje tylko tam, gdzie ustalono: homepage, onboarding, thinking indicator w chacie.
3. Usunac wrazenie "AI slop": mniej gradientow, mniej hero-logo, mniej pigułek, mniej marketingowego tekstu, mniej widowiskowych kart.
4. Uspojnic stary swiat `llama.rn/mmproj` z nowym `LiteRT`.
5. Naprawic kilka realnych ryzyk technicznych przed redesignem, zeby piekny UI nie przykrywal bledow modelu/downloadu.

## Benchmark: Claude App

Sprawdzilem aktualne publiczne materialy Claude:

- App Store opisuje Claude jako "AI assistant for life and work" oraz "thinking partner"; akcent jest na prace, myslenie, pisanie, research, kod i visual analysis.
- Google Play na 2026-06-27 pokazuje Claude jako top productivity app i komunikuje writing, coding, research, visual analysis, voice oraz "trusted and reliable".
- Uiland indeksuje setki ekranow Claude jako referencje UI, co potwierdza, ze wzorzec jest realnym produktem, nie tylko landing page'em.

Zrodla benchmarku:

- https://apps.apple.com/us/app/claude-by-anthropic/id6473753684
- https://play.google.com/store/apps/details?hl=en_US&id=com.anthropic.claude
- https://uiland.design/screens/claude/screens/d19b7252-42c5-45a9-b6a7-be2db6bd51ad

Przeklad na Aether:

- Claude-like nie oznacza "duzy serif + kremowy/purpurowy vibe". To raczej: spokoj, przewidywalnosc, duzo powietrza, tekst jako pierwsza warstwa, subtelne kontrole, malo efektow specjalnych.
- Claude ma premium-feel przez restraint. Aether teraz ma premium intencje, ale zbyt czesto pokazuje "patrz, jestem AI appka".

## Co jest mocne

### Produkt

- Bardzo jasna roznica wzgledem Claude: prywatne, lokalne, offline, bez konta.
- Dwie klasy modeli: Fast/Thinking sa zrozumiale dla uzytkownika.
- Vision wbudowane w modele LiteRT, bez osobnego packa, to mocny feature.
- Web research ma pipeline search -> fetch -> sanitize -> grounded answer -> sources.
- Attachments: obraz, PDF, docx, text. To daje realna uzytecznosc od razu.
- Voice jest dobrym mobile-native dodatkiem.
- Core/pamiec ma potencjal na unikalna ceche, jesli bedzie pokazana spokojnie i wiarygodnie.

### Technicznie

- Expo/RN app jest dobrze podzielona: `app/`, `src/llm`, `src/models`, `src/webresearch`, `src/secondbrain`, `src/components`.
- Jest sensowny zestaw testow pure logic: webresearch, storage, prompt, model registry, secondbrain, graph math.
- `webresearch/safety.ts` ma realne zabezpieczenia przed SSRF/private hosts i prompt-token injection.
- AsyncStorage CursorWindow problem dla obrazow jest rozpoznany i obraz base64 jest stripowany przed zapisem.
- `ExtractionQueue` to dobry kierunek: pamiec probuje uczyc sie w idle, bez konkurencji z chatem.
- LiteRT native module ma fallback ladder GPU/CPU + vision/no-vision.

## Glowne problemy designu

### 1. Za duzo "AI app" sygnalow

Problem:

- Fioletowa aurora, fioletowe CTA, fioletowe user bubble, fioletowe badge, fioletowe segmenty i duze logo razem tworza vibe "generated AI startup".
- Komentarze w kodzie mowia "Claude-style", ale komponenty nadal wygladaja jak efektowny prototype port.

Przyklady:

- `src/components/ds/Aurora.tsx`: trzy duze radialne blobsy, stale aktywne na onboarding/home, w chacie aktywowane podczas generowania.
- `app/(main)/index.tsx`: logo + tytul + aurora + CTA = bardziej landing/hero niz app surface.
- `app/onboarding/index.tsx`: duze logo/halo/kicker/brand robi bardzo promocyjny onboarding.
- `src/components/common/ModelLoadingOverlay.tsx`: ring, glow, procenty, statusy typu "Initializing neural engine..." sa efektowne, ale mocno AI-generated.

Docelowo:

- Aurora tylko jako controlled brand moment: homepage, onboarding, thinking.
- Zredukowac fiolet do akcentu, nie glownego koloru interfejsu.
- Loading modelu ma byc spokojny i informacyjny, nie sci-fi.

### 2. Copy krzyczy prywatnoscia zbyt czesto

Problem:

- Prawie kazdy ekran przypomina: private, on-device, nothing leaves your phone, no telemetry.
- To jest kluczowa wartosc, ale powtarzana za czesto zaczyna brzmiec jak marketing i zmniejsza zaufanie.

Przyklady:

- `README.md`, `app/onboarding/index.tsx`, `app/(main)/index.tsx`, `app/(main)/chat/[id].tsx`, `app/(main)/settings.tsx`, `SecondBrainScreen.tsx`.

Docelowo:

- Jedno mocne wyjasnienie prywatnosci w onboarding/settings.
- W chacie tylko bardzo subtelny footer albo brak, jesli UI juz komunikuje stan lokalny.
- Zamiast "no cloud, no telemetry, ever" w wielu miejscach: bardziej ludzkie, neutralne komunikaty.

### 3. Claude-like chat jest zaczety, ale nie domkniety

Dobre:

- Assistant message jest bare text, bez klasycznej banki.
- Header jest prosty.
- Composer ma plus button i akcje.

Problemy:

- User bubble jest bardzo mocno fioletowa. Claude jest bardziej neutralny i mniej brand-heavy.
- Label "Aether" nad kazda odpowiedzia moze wygladac prototypowo, szczegolnie w dlugich rozmowach.
- Empty state z logo i tekstem nadal ma marketingowy charakter.
- Input jest pigułkowy i "mobile AI app", mniej Claude.
- Action pills `Attach / Research / Voice` sa za duze/wyraziste jak na narzedzia pomocnicze.

Pliki:

- `app/(main)/chat/[id].tsx`
- `src/components/chat/MessageBubble.tsx`
- `src/components/chat/ChatInput.tsx`
- `src/components/chat/ModeSelector.tsx`
- `src/components/chat/TypingIndicator.tsx`

Docelowo:

- Neutralny user bubble albo bardzo ciemny/lekki surface, bez dominujacego violet.
- Assistant label tylko gdy potrzebne albo w subtelnej postaci.
- Composer bardziej jak dolny text surface, mniej jak dekoracyjna pigułka.
- Narzedzia jako ikonowe/compact controls, z opisem dopiero w sheet/menu.

### 4. Core/Second Brain jest mocne, ale obecnie zbyt "wow demo"

Problem:

- 3D graph jako primary view moze wygladac jak technologiczna demonstracja.
- Nazwa `Core` jest ciekawa, ale komunikaty i graph potrzebuja wiekszego zaufania i kontroli.
- Uzytkownik moze bardziej potrzebowac: "co Aether wie?", "dlaczego?", "usun/edytuj", "kiedy zapamietane?" niz obracajacej sie kuli.

Pliki:

- `src/components/settings/SecondBrainScreen.tsx`
- `src/components/secondbrain/Graph3D.tsx`
- `src/secondbrain/MemoryExtractor.ts`
- `src/secondbrain/MemoryStore.ts`

Docelowo:

- Primary: czytelna lista memory z kategoria, confidence, zrodlem i kontrolami.
- Graph jako "Explore" / secondary, nie domyslnie glowna wartosc.
- Usunac nadmiar kolorowych chipow i efektow glow.
- Zmienic teksty z "thought graph" / "glowing in the graph" na bardziej spokojne.

### 5. Typografia idzie w dobrym kierunku, ale miesza sygnaly

Obecnie:

- Inter + Literata.
- Literata uzyta dla assistant body, headings, title, rows.

Ryzyko:

- Literata nadaje editorial feel, ale zbyt szerokie uzycie robi "designed by AI" albo blogowy charakter.
- Claude feeling to nie tylko serif. To przede wszystkim line-height, rhythm, spacing, restraint.

Docelowo:

- Assistant prose moze zostac serif, ale UI controls powinny byc prawie calkowicie Inter.
- Ograniczyc display/serif w listach, sidebarze, settings i model rows.
- Zrobic typographic scale mniejszy i bardziej konsekwentny.

## Funkcje i przydatnosc

### Chat

Ocena: bardzo przydatny rdzen.  
Ryzyka: lokalny model moze byc wolniejszy/gorszy niz cloud Claude, wiec UI musi byc uczciwy i cierpliwy.

Najwazniejsze do update'u:

- Lepszy first-run, ktory prowadzi do downloadu modelu.
- Jasne stany: no model, downloading, loading, ready, generating, stopped, error.
- Mniej promocyjny empty state.
- Lepsza obsluga braku aktywnego/zainstalowanego modelu.

### Modele

Ocena: logicznie czytelne: Fast i Thinking.

Problemy:

- `package.json` i `app.json` maja wersje `2.0.0`, a `android/app/build.gradle` ma `versionName "2.1.0"`.
- `CLAUDE.md` mowi `2.0.0`, ale Android build mowi `2.1.0`.
- `CLAUDE.md` wspomina `*-web.task`, a registry sciaga `.litertlm`.
- `src/state/useModelStore.ts`: po usunieciu aktywnego modelu ustawia active na DEFAULT_MODEL_ID nawet jesli nie jest zainstalowany.

Do poprawy:

- Ujednolic wersje.
- Ujednolic dokumentacje modeli.
- Po usunieciu modelu ustawic active na inny zainstalowany albo `null`.
- W UI home/chat traktowac `activeModelId && installed[activeModelId]` jako ready, nie samo `activeModelId`.

### Vision

Ocena: duzy potencjal, ale trzeba usunac stare komunikaty.

Problem:

- Aktualny registry i README mowia: vision built-in, no extra downloads.
- `src/llm/prompt.ts` fallback nadal mowi userowi, ze moze "enable image understanding to download the vision pack".
- Stare `LlamaService.ts` i stare docs nadal mowia o mmproj/vision pack.

Do poprawy:

- Usunac/zaktualizowac wszystkie user-facing wzmianki o vision pack.
- Pokazac status vision jako ceche modelu, nie osobny download.
- Jesli LiteRT zaladuje text-only fallback, UI powinien uczciwie powiedziec "image analysis unavailable on this device/session", bez obietnicy downloadu.

### Web research

Ocena: bardzo przydatna funkcja, dobrze pomyslana technicznie.

Dobre:

- Search query contextualization.
- Sanitization i private host blocking.
- Max 3 sources, caps dla promptu.
- Sources list na koncu.

Ryzyka:

- Research w lokalnym modelu moze byc wolny.
- Progress text w bubble jest dobry, ale powinien byc bardziej Claude-like: cichy, bez krzyku.
- DuckDuckGo scraping moze byc niestabilny.

Do poprawy:

- UI research mode jako subtelny toggle, nie duza pill.
- Pokazac sources/progress w bardziej skanowalny sposob.
- Dodac user-facing retry/error states.

### Attachments

Ocena: mocne i praktyczne.

Dobre:

- Obrazy sa przenoszone do durable `documentDirectory/chat-media`.
- PDF/docx/text sa ekstraktowane i truncowane.
- Unsupported types maja friendly error.

Problemy:

- `AttachmentSheet` subcopy "PDF, Word, text, and more" obiecuje za duzo, bo arkusze/slajdy/audio/video sa odrzucane.
- Attachment chips sa ok, ale moga byc mniej card-like.

Do poprawy:

- Zmienic copy na "PDF, Word, text".
- Dodac bardziej Claude-like compact attachment preview.

### Voice

Ocena: przydatne na mobile, ale jeszcze ryzykowne.

Problemy:

- Domyslny locale `en-US`; onboarding ustawia `language: English`, nie ma realnego i18n wyboru.
- README mowi offline speech; na Androidzie to zalezy od device/service.
- Voice errors sa czesciowo mute'owane, ale dobre.

Do poprawy:

- Uczciwy opis: "device speech recognition" zamiast gwarancji offline wszedzie.
- Locale powiazac z profile/language albo system locale.

### Core / Memory

Ocena: najwiekszy potencjal roznicujacy, ale tez najwieksze ryzyko zaufania.

Dobre:

- Dedupe, reinforcement, stale marking.
- Manual add/edit/delete.
- Memory injection do promptu.
- Dirty queue.

Ryzyka:

- Automatyczne zapamietywanie jest delikatne prywatnosciowo, nawet on-device.
- User musi widziec i kontrolowac co zostalo zapamietane.
- Confidence i categories moga wygladac technicznie.

Do poprawy:

- Onboarding musi bardzo prosto pytac o memory/Core permission.
- Core screen powinien zaczynac od listy "Saved about you".
- Graph jako opcjonalny widok.
- Pokazac source conversation/time.

## Techniczne ryzyka / bugi do sprawdzenia

### P0/P1

1. `LiteRtService.ts` uzywa `NativeModules.LiteRt` w aplikacji z New Architecture bridgeless.
   - `CLAUDE.md` ostrzega, ze `NativeModules.X` jest null pod bridgeless.
   - Voice/downloader byly patchowane pod `TurboModuleRegistry`, ale LiteRT nie.
   - Do zweryfikowania na device/buildzie: czy `LiteRt` jest dostepny, czy app pokazuje "LiteRT engine unavailable".
   - Jesli problem realny: przepisac bridge pod TurboModule/codegen albo poprawnie udostepnic legacy module w tej konfiguracji.

2. Brak miejsca/deps uniemozliwil mi uruchomienie appki i testow w tym extract.
   - Nie ma `node_modules` w selektywnym extract.
   - Pelny zip zapelnia dysk.
   - Przed implementacja trzeba zapewnic miejsce i odtworzyc `npm install`.

3. Stare `LlamaService.ts` pozostaje w repo i ma testy, chociaz `engine.ts` eksportuje LiteRT.
   - To miesza mental model.
   - Moze powodowac, ze testy przechodza dla nieuzywanego engine, a prawdziwy LiteRT nie jest pokryty.
   - Decyzja: usunac stary service/testy albo przeniesc do `legacy/` i jasno oznaczyc.

4. Version drift.
   - `package.json`: 2.0.0
   - `app.json`: 2.0.0
   - `android/app/build.gradle`: 2.1.0
   - `CLAUDE.md`: 2.0.0

### P2

5. `useModelStore.remove`: po usunieciu aktywnego modelu aktywuje domyslny model bez sprawdzenia instalacji.
6. Vision fallback copy wspomina vision pack, choc aktualna architektura ma vision wbudowane.
7. `CLAUDE.md` file layout mowi `download/verify/delete/mmproj`, mimo ze registry nie ma mmproj.
8. Patches sa ogromne (`@react-native-voice` ok. 4.26 MB, downloader ok. 4.76 MB) i zawieraja build/resource dumpy; `rg` bez ignorowania `patches` generuje absurdalny szum.
9. `app.json` ma `userInterfaceStyle: "dark"`, mimo ze dodano light/system theme. Trzeba sprawdzic czy OS-level chrome/splash nie konfliktuje z light mode.
10. `Graph3D.tsx` ma stale `VOID = #0D0D0D`, wiec light theme graph dalej jest hard-dark. Moze byc intencjonalne, ale w light app wyglada jak obcy embed.
11. `ImageViewer.tsx` nadal importuje static `colors`, ale to modal full black, wiec prawdopodobnie akceptowalne.

## Design update: reguly docelowe

### Paleta

- Base dark: cieply near-black/charcoal, nie pure black wszedzie.
- Light: off-white/paper moze zostac, ale unikac bezu/cream jako dominanty marketingowej.
- Violet: tylko accent i thinking state.
- User bubble: neutral/quiet albo bardzo subtelny violet tylko jesli konieczne.
- Danger/success/warning: minimalne, systemowe.

### Shape

- Mniej `radius.full` pigułek.
- Radius 8-12 dla inputow/kart; 16 tylko modal/sheet.
- No nested cards.
- Listy i settings jako flat sections z hairline separators.

### Motion

- Aurora tylko onboarding/home/thinking.
- Animacje krotkie i funkcjonalne.
- Loading bez sci-fi tekstow.

### Typography

- Inter jako UI default.
- Serif tylko assistant prose albo wybrane title moments.
- Bez duzych hero titles poza onboarding.
- Mniej letter spacing i uppercase labels, bo latwo robi sie dashboard/AI-template.

### Copy

- Mniej "private/on-device/no telemetry" powtarzanego wszedzie.
- Bardziej Claude-like: pomocne, konkretne, ciche.
- "Core" wyjasnic raz, potem uzywac prostych etykiet: Memory, Saved facts, Sources, Models.

## Proponowany zakres jednego wielkiego update'u

### Phase 1: cleanup przed UI

- Ujednolic wersje.
- Zweryfikowac/fix LiteRT bridge.
- Usunac albo odseparowac legacy `LlamaService`.
- Naprawic active model fallback po delete.
- Usunac stare mmproj/vision pack user-facing copy.
- Oczyscic lub zminimalizowac patche.

### Phase 2: Claude-like visual foundation

- Nowe tokens: bardziej neutralne surfaces, slabs, border, textMuted.
- Ujednolic radius/spacing.
- Ograniczyc violet.
- Zrobic common primitives: IconButton, TextButton, Field, SegmentedControl, Sheet, Row, SectionHeader.
- Przerobic DS Button/Badge pod restrained app controls.

### Phase 3: chat redesign

- Header: bardziej minimalny, mniej wordmark-heavy.
- Mode selector: compact, spokojny.
- Empty state: bez hero-logo; bardziej "What can I help with?"
- Message bubbles: assistant bare text, user neutral, lepsze spacing.
- Composer: Claude-like text area + compact tools.
- Thinking: aurora/indicator tylko while generating, subtelnie.

### Phase 4: onboarding/home

- Onboarding jako spokojny product setup, nie marketing deck.
- Model download flow jako centralny first-run.
- Core permission/control jako jasny krok.
- Homepage po onboarding: utility entry, nie hero page.

### Phase 5: settings/models/Core

- Settings: flat utility screen.
- Models: clearer installed/downloading/loading states.
- Core: list-first, graph secondary.
- Memory controls: edit/delete/clear, source/time, confidence translated to human text.

### Phase 6: QA

- Typecheck + Jest.
- Manual Android run.
- Screenshots: onboarding, no model, model download, empty chat, active chat, thinking, research, attachments, settings dark/light, Core list/graph.
- Compare against Claude screenshots for restraint: if it looks like a generated landing page, reject.

## File map reviewed

Najwazniejsze przejrzane obszary:

- `package.json`, `app.json`, `CLAUDE.md`, `README.md`
- `app/index.tsx`, `app/_layout.tsx`, `app/onboarding/index.tsx`
- `app/(main)/_layout.tsx`, `app/(main)/index.tsx`, `app/(main)/chat/[id].tsx`, `app/(main)/settings.tsx`
- `src/theme/*`
- `src/components/ds/*`
- `src/components/chat/*`
- `src/components/common/*`
- `src/components/sidebar/*`
- `src/components/settings/*`
- `src/components/secondbrain/*`
- `src/llm/*`
- `src/models/*`
- `src/webresearch/*`
- `src/secondbrain/*`
- `src/files/*`
- `src/voice/*`
- `src/storage/*`
- `src/state/*`
- `android/app/src/main/java/com/aether/app/*`
- `plugins/withAetherAndroid.js`
- `docs/superpowers/specs/*`
- `docs/superpowers/plans/*`
- `patches/*` rozpoznane pod katem rozmiaru/szumu, nie jako miejsce redesignu.

## Notatka o testach

Nie uruchomilem `npm test` ani `npm run typecheck`, bo selektywny extract celowo nie zawiera `node_modules`, a pelny extract z vendorami zapelnil dysk. W repo jest jednak widoczny zestaw testow, szczegolnie dla pure logic:

- webresearch
- secondbrain
- storage
- llm prompt/parse
- model registry/paths
- graph math
- settings format

Przed kodowaniem update'u: odtworzyc zaleznosci i zrobic baseline test/typecheck.

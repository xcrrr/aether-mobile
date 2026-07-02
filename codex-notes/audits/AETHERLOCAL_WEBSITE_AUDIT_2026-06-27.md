# AetherLocal website audit przed duzym update'em

Data: 2026-06-27  
Zrodlo: `C:\Users\PC\Desktop\aether-website.zip`  
Wypakowane do: `C:\Users\PC\Documents\Aether\_website_audit\aether-website\aether-website`  
Screenshoty QA: `C:\Users\PC\Documents\Aether\_website_audit\aether-website\screenshots`

## Executive summary

Aktualna strona ma bardzo dobry rdzen koncepcyjny, ale jest niedokonczona i wizualnie rozjechana. Najmocniejszy pomysl to hero z telefonem, ktory przechodzi w scroll-driven sticky demo AetherLocal. Ten koncept warto zachowac. Problem polega na tym, ze wykonanie wyglada jak polaczenie kilku prototypow: kosmiczne tlo, liquid glass, ogromny italic serif, mocny fiolet, sztuczne "partner words", dev-like telefon, niedopiete sekcje i brak jednego systemu.

Najwazniejsza diagnoza: strona nie jest slaba dlatego, ze idea jest zla. Strona jest slaba dlatego, ze nie ma jeszcze finalnej rezyserii. Brakuje art direction, dyscypliny typografii, kontroli warstw, stabilnych breakpointow i pelnej kompozycji strony pod produkt. W kodzie widac dwa rownolegle kierunki: starszy spec Playfair/Inter/dark app tokens oraz nowsza cinematic hero z Instrument Serif/Barlow/liquid glass/space scene. Te swiaty trzeba scalić albo jeden usunac.

Docelowy kierunek: AetherLabs osobno jako community/lab, AetherLocal jako produkt. Tak jak Anthropic i Claude: AetherLabs moze opowiadac misje i ruch, ale ta strona ma sprzedawac AetherLocal jako realna aplikacje na telefon: lokalny AI, prywatny, offline, Android, open beta, community-driven.

## Co jest mocne

- Koncept hero: telefon jako glowny produktowy obiekt jest trafiony. Strona od razu pokazuje, ze to aplikacja, nie abstrakcyjny AI brand.
- Koncept handoff/sticky phone CTA: latajacy telefon przechodzacy z hero do sticky demo ma duzy potencjal premium, jesli zostanie precyzyjnie wyrezyserowany.
- Scroll demo: rozmowa w telefonie jako interaktywny dowod obietnicy "runs on your phone" jest lepsza niz typowy feature grid.
- Product promise: "Your AI on your phone, not in the cloud" jest mocne, konkretne i rozroznia AetherLocal od Claude/ChatGPT.
- Telefon jest kodowany jako HTML/CSS, nie statyczny screenshot. To dobra decyzja, bo mozna streamowac tekst i synchronizowac UI ze scrollem.
- Kod ma juz duzo przydatnych elementow: `Mission`, `Features`, `HowItWorks`, `Compare`, `Community`, `Cta`, `Footer`, `FeatureDemo`, `SignupForm`.
- Repo zawiera wczesniejsze specy (`docs/specs/...`) i plan, ktore jasno mowia, ze celem bylo "zero AI slop". Material do dobrej wersji juz istnieje.
- Strona ma testy jednostkowe, lint i build script. To dobry fundament, mimo ze teraz failuja.
- App source istnieje w `C:\Users\PC\Documents\Aether\_analysis\aether_source\aetherbeta`, wiec mozna przeniesc realne tokeny/komponenty z AetherLocal zamiast zgadywac styl.

## Najwieksze problemy

### 1. Strona jest fizycznie niedokonczona

`app/page.tsx` renderuje tylko:

```tsx
<main className="bg-black">
  <LandingExperience />
</main>
```

`LandingExperience` renderuje hero, bridge, `HeroStage` i `FlyingPhone`. Sekcje `Mission`, `Features`, `HowItWorks`, `Compare`, `Community`, `Cta` i `Footer` istnieja w repo, ale nie sa podlaczone do strony. Dlatego obecnie strona konczy sie praktycznie na hero/demo, bez pelnego funnelu.

Priorytet: zbudowac pelna kompozycje strony od nowa:

1. Hero z telefonem.
2. Sticky product demo.
3. Mission/privacy/offline section.
4. Feature demos.
5. How it works / install APK / model download.
6. Community/AetherLabs bridge.
7. Final CTA / download / Discord / newsletter.
8. Footer.

### 2. Build produkcyjny nie przechodzi

`next build` kompiluje JS, ale pada na typechecku:

`components/landing/LandingExperience.tsx` importuje `@/components/hero/HeroStage`, a w folderze sa jednoczesnie:

- `components/hero/HeroStage.tsx`
- `components/hero/heroStage.ts`

Na Windowsie to case-insensitive collision. TypeScript/Next potrafi pomylic modul i zgubic export `HeroStage`. To jest P0 przed aktualizacja.

Fix:

- Zmienic `components/hero/heroStage.ts` na np. `heroStageState.ts`.
- Zaktualizowac importy.
- Dodac zasade: zero plikow rozniacych sie tylko wielkoscia liter.

### 3. Lint nie przechodzi

Wynik `eslint .`:

- `app/layout.tsx`: warning o Google Fonts w head zamiast Next font/local.
- `components/cinematic/CapabilitiesSection.tsx`: JSX comment textnode error.
- `components/features/useClock.ts`: React lint narzeka na synchroniczny `setState` w effect.
- `components/hero/HeroStage.tsx`: `performance.now()` w render/init ref, purity error.
- `lib/useReducedMotion.ts`: synchroniczny `setState` w effect.

Fix przed design polish:

- Przeniesc fonty na `next/font/local` z `public/fonts`.
- Usunac lub naprawic martwy `CapabilitiesSection`.
- Uzyc lazy initializer bez impure render albo inicjalizowac time ref w effect/event.
- `useReducedMotion` oprzec na `useSyncExternalStore` albo bezpiecznym initial state po mount.

### 4. Testy nie przechodza

Wynik `jest --runInBand`: 7 failed, 8 passed, 29 total tests.

Glowne klasy bledow:

- `SignupForm`: mock React/useState jest zepsuty albo test setup nadpisuje hook. Error: `number 1 is not iterable`.
- Sekcje z `motion.*`: `Expected ref to be a function, an object returned by React.createRef(), or undefined/null.` Prawdopodobnie Framer Motion/Jest/React 19 compatibility albo brak mocka Framer Motion.
- `page` i `smoke` failuja przez te same problemy.

Fix:

- Dodac stabilny mock Framer Motion w `jest.setup.ts` lub testowac sekcje bez motion runtime.
- Zweryfikowac czy nie ma wadliwego mocka React w testach.
- Po rename case-collision odpalic testy ponownie.

### 5. Design system jest niespojny

Spec mowi: Playfair Display + Inter, self-hosted, warm near-black `#1C1C1C`, app tokens.  
Aktualny `app/layout.tsx` laduje Google Fonts:

- `Instrument Serif`
- `Barlow`

Aktualny `globals.css` ustawia:

- `body background: #000`
- `font-heading = Instrument Serif`
- `font-body = Barlow`
- liquid glass everywhere

Jednoczesnie stare sekcje uzywaja:

- `var(--font-playfair)`
- `var(--font-inter)`
- tokens z `lib/tokens.ts`

To powoduje efekt "AI slop": nie dlatego, ze kazdy element jest fatalny, tylko dlatego, ze elementy pochodza z roznych estetyk.

Decyzja rekomendowana:

- UI/app/product: Inter.
- Display/editorial moments: Playfair albo Literata-inspired, ale bardzo oszczednie.
- Usunac Google Fonts z head.
- Uzyc `next/font/local` i istniejacych `public/fonts`.
- Tlo: nie pure black wszedzie. Strona moze miec czarne cinematic moments, ale product surface powinien byc blizej app tokenow.

## Visual audit ze screenshotow

Screenshoty zapisane:

- `01-hero-desktop.png`
- `02-transfer-desktop.png`
- `03-demo-desktop.png`
- `04-demo-deeper-desktop.png`
- `05-hero-mobile.png`
- `06-hero-mobile-settled.png`
- `07-transfer-mobile.png`
- `08-demo-mobile.png`
- `09-demo-mobile-deep.png`

### Desktop hero

Co dziala:

- Produkt jest widoczny w pierwszym viewportcie.
- Headline jest jasny i mocny.
- Telefon jako "hero object" ma potencjal.
- Tlo gwiazd/aurory robi cinematic mood.

Co nie dziala:

- Headline w duzym italic serif wyglada za bardzo jak AI-generated luxury tech mockup.
- Letter spacing i sklad tekstu sa zbyt dramatyczne.
- "New" pill i "Private beta..." pill sa generyczne.
- Liquid glass nav/CTA wyglada jak skopiowany trend, nie jak Aether.
- Partner strip `Local / Private / Offline / Yours / Beta` wyglada jak placeholder albo fake logos.
- Pierwszy viewport jest zbyt gesty na srodku i pusty na bokach.
- Telefon jest uciety na dole bez eleganckiego reveal/maski.

### Desktop transfer

Co dziala:

- Sam pomysl, ze telefon przejmuje scene, jest bardzo dobry.

Co nie dziala:

- Telefon wjezdza za wysoko i przykrywa nav/CTA.
- Nav zostaje nad scena i walczy z telefonem.
- Strip z `Local / Private / Offline / Yours / Beta` nadal jest pod telefonem.
- Z-indexy i timing wygladaja jak prototyp.
- Brakuje zaciemnienia/wyciszenia warstw, ktore juz powinny zejsc ze sceny.

### Desktop sticky demo

Co dziala:

- Gleboki stan demo, gdzie po lewej jest caption, a po prawej telefon, ma najwiekszy potencjal.
- Telefon z realnym chatem dobrze tlumaczy produkt.
- Caption "Not a privacy policy promise. Just how it's built." jest mocny.

Co nie dziala:

- Wczesniejsze stany z samym telefonem sa puste i bez kontekstu.
- Telefon jest za duzy w czesci stanow i za mocno dominuje.
- Stage UI pojawia sie pozno; przez dlugi czas nie wiadomo, co ogladamy.
- Glow za telefonem jest zbyt oczywisty.
- Background starfield jest monotematyczny i po chwili meczy.

### Mobile hero

Co dziala:

- Po pelnym czasie animacji da sie odczytac headline.
- Telefon jako dolna zapowiedz produktu ma sens.

Co nie dziala:

- W poczatkowym stanie headline jest rozmyty/uciety. Wyglada jak niedoladowany render.
- CTA sa scisniete i maja slaba hierarchie.
- Telefon zajmuje dol bardzo ciezko.
- Nav mobile ma tylko kolo z `a`; brak menu, brak jasnego product nav.
- Sticky "N" button w lewym dolnym rogu wyglada obco i nie wiadomo, po co jest.

### Mobile sticky demo

Co dziala:

- Gleboki stan `09-demo-mobile-deep.png` ma sens: telefon u gory, caption pod spodem.
- Rozmowa w telefonie jest czytelna w finalnym stanie.

Co nie dziala:

- Wczesniej user oglada bardzo dlugo sam telefon bez captionu.
- Telefon w `07` i `08` jest za samotny, za techniczny.
- Brakuje przejscia narracyjnego: gdzie jestesmy, co sie dzieje, dlaczego scrollujemy?
- Scroll height jest duzy, ale tresci malo. To daje wrazenie "scroll tax".

## Dlaczego wyglada jak AI slop

Nie przez jeden blad. To suma:

- Za duzo modnych efektow naraz: starfield, aurora, liquid glass, huge serif, blur reveal, glow, phone mockup, animated text.
- Brak jednego typograficznego systemu.
- Pure black + purple glow = generyczny AI startup.
- Badge "New", partner strip i big italic headline wygladaja jak domyslny prompt "premium AI landing page".
- Sekcje sa niepodlaczone, wiec nie ma pelnej narracji.
- Zbyt duzo elementow jest dekoracja, a za malo jest realnego produktu.
- App UI w telefonie jest blisko prawdy, ale otoczka strony jest bardziej cinematic-template niz AetherLocal.
- Brak wysokiej jakosci assetow. Strona uzywa kodowego starfield/glow zamiast jednego mocnego, kontrolowanego product visual.
- Copy jest dobre ideowo, ale momentami zbyt sloganowe.

## Co koniecznie zachowac

- Telefon jako glowny bohater strony.
- Scroll-driven demo rozmowy.
- Handoff hero phone -> sticky phone.
- Obietnice: local-first, on-device, no cloud, no account.
- CTA: Download beta + Discord/community.
- AetherLocal jako produkt, AetherLabs jako szerszy ruch/community.
- Captiony tlumaczace "why it matters" obok telefonu.
- Realny chat UI w HTML/CSS.
- Feature demos, ale po redesignie i dopieciu.

## Co usunac albo mocno ograniczyc

- Partner strip `Local / Private / Offline / Yours / Beta`.
- Generic "New" pill, chyba ze zostanie bardzo subtelnie przepisany.
- Liquid glass jako glowny styl UI.
- Nadmiar starfield/comets.
- Pure black jako jedyne tlo.
- Huge italic display headline w obecnej formie.
- Zbyt mocne purple glows.
- Sticky "N" floating control, jesli nie ma jasnej funkcji.
- Martwe/nieuzywane cinematic components, jesli nie wejda do nowej kompozycji.
- Google Fonts head.

## Rekomendowany kierunek art direction

### Strategia marki

AetherLabs:

- community, lab, manifesto, open building, experiments.
- osobna strona.

AetherLocal:

- produkt, telefon, prywatna praca, codzienny assistant.
- ta strona.

Przeklad Anthropic/Claude:

- AetherLabs = kto buduje i dlaczego.
- AetherLocal = co pobierasz, jak dziala, dlaczego warto.

### Visual tone

Slowa-klucze:

- private
- local
- calm
- technical but human
- product-first
- tactile phone
- open community

Nie:

- sci-fi
- neon AI
- glassmorphism template
- fake enterprise SaaS
- crypto/darkweb
- "premium purple landing page"

### Paleta

- Base: warm near-black z appki (`#1C1C1C`) plus kontrolowane czarne cinematic moments.
- Surfaces: `#252525`, `#2E2E2E`.
- Text: white plus muted `#8E8E8E`.
- Violet: `#7C3AED` tylko jako accent/CTA/user bubble/thinking.
- Dodatkowy neutral: graphite/ink/silver, z bardzo oszczednym lavender highlight.

### Typography

- Inter jako default UI/copy.
- Display font tylko dla 1-2 duzych momentow: hero claim i wybrane captions.
- Jesli zostaje Playfair/Literata vibe, uzyc go mniej dramatycznie niz obecny Instrument Serif.
- Zero negative tracking w malych elementach. Hero moze miec tight tracking, ale nie "fashion poster".
- Mobile headline musi byc projektowany osobno, nie tylko clamp.

## Proponowana finalna struktura strony

### 1. Header

- Minimalny product header.
- Brand: AetherLocal lub Aether by AetherLabs, ale nie tylko male `a`.
- Desktop: Product, Privacy, Features, Community, Download.
- Mobile: brand + Download + menu icon.
- Nav nie moze zaslaniac phone handoff. W demo powinien sie wyciszac albo morphowac.

### 2. Hero

Cel: w 5 sekund zrozumiec produkt.

Propozycja:

- H1: `AetherLocal`
- Supporting claim: `Private AI that runs on your Android phone.`
- Body: `Chat, see, research, and remember without sending your life to the cloud.`
- CTA: `Download beta` + `Watch it work`
- Produkt: telefon jako realny app preview.

Uwaga: obecny headline "Your AI Lives On Your Phone Not In The Cloud" jest mocny, ale moze stac sie subheadline albo hero statement po mniejszym typograficznym opanowaniu.

### 3. Sticky demo

Rezyseria:

- Telefon startuje jako czesc hero, nie jako osobna fixed warstwa widoczna za wczesnie.
- Podczas handoffu hero copy i nav fade/scale out.
- Telefon nie moze przykrywac nav ani CTA.
- Captiony wchodza wczesniej, nie dopiero po dlugiej pustce.
- Kazdy beat musi miec jasny sens:
  1. Offline question.
  2. Local answer.
  3. Privacy question.
  4. Nothing leaves device.
  5. Optional research/vision beat.
- Na mobile telefon i caption powinny byc projektowane jako pionowy duet, nie zmniejszona wersja desktopu.

### 4. Proof section

Nie powtarzac hero. Pokazac 3 konkretne dowody:

- Runs on-device.
- Works offline.
- Your data stays local.

Forma: spokojne product rows z mini UI, nie card bento.

### 5. Features

Wpiac i przebudowac istniejące `Features` / `FeatureDemo`.

Feature set:

- On-device chat.
- Vision.
- Web research with citations.
- Voice.
- Second Brain / Core.
- Files/docs if real in app.

Wazne: feature demos musza wygladac jak prawdziwe app fragments, nie jak mini dashboard cards.

### 6. How it works

Zamiast ogolnych kart:

1. Download APK.
2. Choose/download model.
3. Chat offline.
4. Join community for builds and feedback.

Pokazac wymagania: Android, arm64, RAM/storage, beta status.

### 7. Community bridge

Tutaj laczymy z AetherLabs:

- `AetherLocal is built by AetherLabs, an open AI community building private local tools.`
- CTA Discord.
- Nie robic z tej sekcji osobnej landing page AetherLabs.

### 8. Final CTA

- Download beta.
- Join Discord.
- Optional email signup, jesli backend/form jest gotowy lub jasno dummy.
- Footer z linkami.

## Technical implementation plan przed redesignem

### P0

1. Rename `components/hero/heroStage.ts` -> `components/hero/heroStageState.ts`.
2. Fix all imports.
3. Make `next build` pass.
4. Make `eslint .` pass.
5. Make Jest baseline pass or explicitly update mocks.
6. Remove Google Fonts from `app/layout.tsx`.
7. Restore `next/font/local` for Inter/Playfair or chosen final pair.
8. Connect full page sections into `app/page.tsx` or `LandingExperience`.

### P1

1. Build one design system file for web tokens from Aether app tokens.
2. Replace inline style sprawl with consistent classes/components where useful.
3. Rework hero layout for desktop and mobile separately.
4. Rework phone handoff math and z-indexes.
5. Add reduced-motion final static version that still shows full page, not just hero/demo.
6. Add a real mobile nav.
7. Fix nav anchors: `Features`, `Privacy`, `Beta` currently all point to `#demo`.
8. Remove or integrate unused components.

### P2

1. Polish feature demos.
2. Add FAQ.
3. Add community section.
4. Add final CTA/footer.
5. Add metadata/OG image.
6. Add screenshot regression notes.
7. Add accessibility pass: headings, focus states, aria labels, contrast.

## Code inventory

Currently rendered:

- `app/page.tsx`
- `components/landing/LandingExperience.tsx`
- `components/cinematic/HeroSection.tsx`
- `components/cinematic/Navbar.tsx`
- `components/cinematic/SpaceScene.tsx`
- `components/landing/FlyingPhone.tsx`
- `components/hero/HeroStage.tsx`
- `components/hero/heroStage.ts`
- `components/hero/Captions.tsx`
- `components/phone/ChatReplay.tsx`
- `components/phone/PhoneFrame.tsx`
- `components/phone/chat/*`
- `components/aurora/*`

Exists but not rendered in final page:

- `components/sections/Mission.tsx`
- `components/sections/Features.tsx`
- `components/sections/HowItWorks.tsx`
- `components/sections/Compare.tsx`
- `components/sections/Community.tsx`
- `components/sections/Cta.tsx`
- `components/ui/Footer.tsx`
- `components/ui/SiteNav.tsx`
- `components/features/FeatureDemo.tsx`
- `components/cinematic/CapabilitiesSection.tsx`
- `components/cinematic/FadingVideo.tsx`
- `components/providers/SmoothScroll.tsx`

Important content:

- `content/script.ts`
- `content/features.ts`
- `lib/tokens.ts`
- `lib/links.ts`
- `docs/specs/2026-06-24-aether-website-design.md`
- `docs/specs/2026-06-25-perplexity-pattern-blueprint.md`

## Notes from AetherLocal app source

App source is at:

`C:\Users\PC\Documents\Aether\_analysis\aether_source\aetherbeta`

Useful references:

- `src/theme/index.ts`: real app colors, spacing, fonts.
- `src/components/chat/MessageBubble.tsx`: actual user/assistant message treatment.
- `src/components/chat/ChatInput.tsx`: actual input/footer/actions.
- `src/components/ds/Aurora.tsx`: app aurora behavior.
- `app/(main)/chat/[id].tsx`: real chat shell.
- `src/components/secondbrain/*`: Core/Second Brain visuals and concepts.

Important app tokens:

- `bg`: `#1C1C1C`
- `bgCard`: `#252525`
- `border`: `#2E2E2E`
- `textMuted`: `#8E8E8E`
- `violet`: `#7C3AED`

The website should stop inventing a separate brand skin and become an elevated translation of the app.

## QA results

Environment:

- URL: `http://127.0.0.1:3000`
- Desktop viewport: default in-app browser, approx 1280x720.
- Mobile viewport: 390x844.
- Browser console: no relevant errors/warnings during visual run.
- Dev server: Next.js 16.2.9 Turbopack.

Checks:

- Page loads: pass in dev.
- Title: `Aether - Your AI, on your phone`: pass.
- Framework overlay: no overlay in dev render.
- Console errors: none observed.
- Production build: fail.
- Lint: fail.
- Jest: fail.
- Desktop visual: concept promising, execution rough.
- Mobile visual: significant issues in first viewport and handoff.

Commands run:

- `next build`: failed at typecheck because of `HeroStage.tsx` / `heroStage.ts` collision.
- `eslint .`: failed with 4 errors and 1 warning.
- `jest --runInBand`: 7 failed, 8 passed.

## Decision list for the update

Keep:

- phone-first hero
- scroll-driven live app demo
- local/private/offline product promise
- Discord/community CTA
- app-token color foundation
- real HTML/CSS phone UI

Change:

- rebuild typography around Inter + restrained display
- replace liquid glass trend with Aether product surfaces
- use fewer glows and fewer stars
- redesign hero mobile independently
- connect all sections
- make AetherLocal the brand signal, not just "a"
- make AetherLabs a bridge section, not the main story

Delete or quarantine:

- duplicate case-colliding file names
- unused cinematic components if not in final IA
- generic "New" badge treatment
- partner word strip
- Google Font head injection
- unscoped nav anchors

Final bar:

- Build/lint/tests pass.
- Desktop first viewport looks intentional without needing explanation.
- Mobile first viewport is readable after first paint and after animation.
- Phone handoff never covers nav/CTA awkwardly.
- Sticky demo has no empty scroll beats.
- Full page exists and tells the product story end to end.
- The page feels like AetherLocal, not like "premium AI landing page prompt".

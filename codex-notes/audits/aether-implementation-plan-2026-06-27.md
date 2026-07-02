# Aether implementation plan

Data: 2026-06-27  
Podstawa: `_analysis/aether-audit-2026-06-27.md`

## Decyzja architektoniczna

Aether ma zostac przy LiteRT jako jedynym aktywnym engine. Stary `llama.rn`/`mmproj` nie powinien byc czescia user-facing produktu ani glownej dokumentacji. Jesli zostaje w repo jako awaryjny legacy kod, musi byc wyraznie oznaczony i nie moze dyktowac promptow, testow ani komunikatow UI.

## Kolejnosc wdrozenia

1. **Stabilizacja przed redesignem**
   - ujednolic wersje `package.json`, `app.json`, `android/app/build.gradle`, `CLAUDE.md`
   - naprawic active-model fallback po usunieciu modelu
   - usunac user-facing wzmianki o vision pack/mmproj
   - dodac warstwe pobierania LiteRT przez `TurboModuleRegistry` z fallbackiem na `NativeModules`
   - ujednolic docs pod LiteRT `.litertlm`

2. **Claude-like design foundation**
   - zachowac obecna Claude'owa palete jako baze: cieply charcoal, neutralne surfaces, subtelny violet
   - zachowac serif/Literata jako istotny element charakteru, szczegolnie dla assistant prose i wybranych tytulow
   - nie robic nowej generycznej koncepcji ani "AI dashboardu"; poprawiac istniejacy kierunek
   - zmniejszyc promienie, pigulki i efekt glow tam, gdzie robia prototype/slop
   - zrobic neutralne surfaces i separators
   - stworzyc/przestroic prymitywy: button, badge, icon/action treatment, sections

3. **Chat jako glowny produkt**
   - spokojniejszy header
   - neutralny user bubble
   - subtelniejszy input i action bar
   - mniej marketingowy empty state
   - thinking indicator bez sci-fi pigulki

4. **Onboarding i home**
   - onboarding jako setup, nie deck marketingowy
   - home jako utility entry, nie hero
   - zachowac aurora tylko w onboarding/home

5. **Settings, models, Core**
   - settings jako flat utility screen
   - model rows bez marketingowych kart
   - zachowac obecny sidebar layout: Core wysoko, model selector tam gdzie jest, ustawienia i New chat w dolnym pasku
   - Core moze zostac dostepny tak jak teraz; ulepszac hierarchie i copy bez przestawiania calej nawigacji
   - mniej kolorowych chipow i glow

6. **Model loading**
   - zastapic obecny sci-fi ring/glow/status copy minimalistyczna animacja full-screen
   - uzyc kolorow aplikacji: charcoal/paper, muted text, subtelny violet
   - zachowac realna informacje: model name, size, progress estimate/state
   - zero "neural engine" copy, zero duzych logo i efektow startupowych

7. **Higiena**
   - oznaczyc legacy docs/specs jako historyczne
   - nie ruszac ogromnych patchy bez pelnego `node_modules` i mozliwosci ponownego `patch-package`

8. **Weryfikacja**
   - baseline `npm test` / `npm run typecheck`, jesli zaleznosci sa dostepne
   - w tej paczce zaleznosci nie sa wypakowane, wiec testy moga wymagac `npm install`
   - zrobic statyczne grep-checki dla `mmproj`, `vision pack`, `colors`, wersji

## Status wdrozenia

Zrobione:
- Aether zostal ustawiony na LiteRT-only w aktywnej architekturze JS/native bridge.
- Usuniete zostaly legacy `LlamaService` i zaleznosc `llama.rn`.
- Wersja projektu zostala ujednolicona do `2.1.0`.
- Naprawiony zostal fallback aktywnego modelu po usunieciu pliku modelu.
- Copy wokol wizji, modeli, prywatnosci, Core i onboarding zostalo uspokojone.
- Sidebar zachowal obecny layout: Core wysoko, recents pod spodem, Settings i New chat w dolnym pasku.
- Design zostal dopracowany bez zmiany ukladu: wiecej serifowego wordmarku, neutralny user bubble, spokojniejszy input, subtelniejszy action bar i thinking indicator.
- Dodana zostala minimalistyczna full-screen animacja ladowania modelu w kolorach aplikacji.
- README i CLAUDE.md zostaly odswiezone pod aktualny stan produktu.

Weryfikacja:
- `rg` nie znajduje juz aktywnych odniesien do `llama.rn`, `LlamaService`, `initLlama`, `.task`, "neural engine" ani obietnic typu "no telemetry" w produkcyjnych plikach app/src/README/CLAUDE/package.
- Zostaly tylko dwa negatywne techniczne odniesienia: `NO separate vision pack, no mmproj` w `CLAUDE.md` i test registry opisujacy brak osobnego vision packa.
- `package.json` parsuje sie przez PowerShell `ConvertFrom-Json`.
- Nie uruchomiono `npm test` ani `npm run typecheck`, bo w tym srodowisku nie ma `node`, `npm`, `python` ani `git`, a paczka byla wypakowana bez `node_modules`.

## Status kontynuacji 2026-06-28

Zrobione:
- Dopracowany zostal settings screen: normalna ikona powrotu, spokojniejszy segmented control, mniej agresywny aktywny stan.
- Model rows zostaly uspokojone: serifowa nazwa modelu, sansowy opis, neutralniejsze badge i separators.
- Mode selector zachowal miejsce w headerze chatu, ale dostal cichsze menu, mniejszy cien i neutralny active state.
- Core zachowal uklad oraz graph-first charakter, ale ma spokojniejsze Graph/List, search, Add fact, chipy, modal i back control.
- Attachment sheet/chip, toast, RAM warning i clarifying question zostaly dopracowane pod mniej pillowy, mniej neonowy styl.
- System prompt zostal urealniony: nie obiecuje juz absolutnego "no servers/no cloud", tylko lokalne regular chat po zaladowaniu modelu.
- Aurora zostala sprawdzona: wystepuje tylko na home, onboarding oraz w czacie jako thinking indicator podczas generowania.
- Wszystkie jawne `letterSpacing` w `app/` i `src/` sa ustawione na `0`.

Dodatkowa weryfikacja:
- `rg` nie znajduje `no cloud`, `fully sovereign`, `no telemetry`, `nothing leaves your phone`, `neural engine`, `llama.rn`, `LlamaService`, `initLlama` ani `.task` w aktywnych plikach produkcyjnych.
- `rg` nie znajduje mojibake `â` ani `Â` w aktualnie edytowanych aktywnych plikach UI/LLM.
- Nadal nie da sie uruchomic testow/typechecka, bo `node`, `npm` i `git` nie sa dostepne w tym srodowisku.

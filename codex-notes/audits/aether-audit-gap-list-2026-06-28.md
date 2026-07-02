# Aether audit gap list

Nie wszystko z audytu jest zakonczone. Duza czesc rdzenia i design pass zostaly wdrozone, ale pozostaja punkty, ktorych nie nalezy uznawac za domkniete.

## Nadal niedomkniete po wdrozeniu

- Brak realnej weryfikacji na Androidzie, screenshotow i testow, bo lokalnie brakuje `node`, `npm`, `git` i pelnych zaleznosci.
- Nie oczyszczono ogromnych patchy mechanicznie, bo bez pelnego `node_modules` i `patch-package` byloby to ryzykowne. Historyczne docs zostaly jednak oznaczone jako archived.

## Domkniete w ostatnim pass

- Core jest teraz list-first, z Graph jako secondary view.
- Core pokazuje czas zapisu/ostatniego zobaczenia i zrodlo pamieci, gdy tytul rozmowy jest dostepny.
- Voice startuje z locale z profilu/systemu zamiast stalego `en-US` jako jedynej sciezki.
- Research ma spokojniejsze progress states i lepszy fallback/error copy.
- `app.json` ma `userInterfaceStyle: automatic` i spojne charcoal backgroundy dla splash/native chrome.
- Graph3D jest theme-aware: light mode nie renderuje juz obcego hard-dark canvasa jako jedynej opcji.
- Historyczne docs/specs ze starym `llama.rn/mmproj` zostaly oznaczone jako archived/legacy context.

## Dodatkowo naprawione po ponownym porownaniu

- `AttachmentSheet` nie obiecuje juz "PDF, Word, text, and more"; copy zostalo zmienione na "PDF, Word, text".

# CLAUDE.md

Instruktioner för Claude Code i det här projektet. Läs hela filen innan du ändrar kod.

## Om projektet

Klassikerplaneraren är en webbsida som genererar ett personligt träningsprogram för En svensk klassiker: Vasaloppet (längdskidor), Vätternrundan (cykel), Vansbrosimningen (simning) och Lidingöloppet (terränglöpning).

**Problemet:** vanliga träningsappar planerar för en sport och ett lopp. En klassiker kräver att fyra grenar fasas in över ett år, med fyra loppdatum att toppa formen mot, och med hänsyn till säsong — det finns t.ex. inte snö året runt eller överallt.

**Användaren** äger projektet men skriver inte koden själv. Håll därför strukturen enkel och lättläst, och dokumentera i README hur appen fungerar och hur genereringslogiken är uppbyggd. Hellre uppenbar kod än smart kod.

## MVP — detta och inget mer

1. Formulär: fyra loppdatum, nuvarande nivå per gren, tillgängliga timmar per vecka.
2. Generering av program vecka för vecka, periodiserat mot varje lopp: uppbyggnad, toppning, nedtrappning inför lopp, återhämtning efter.
3. Säsongsanpassning: skidträning ersätts med alternativ (stakmaskin, rullskidor) utanför vintersäsong.
4. Tydlig vy per vecka.
5. Export till .ics för kalender.
6. Programmet sparas i webbläsaren och finns kvar efter omladdning.
7. Kort friskrivning: programmet ersätter inte medicinsk rådgivning.

Omfattning i MVP: **ett** program med **ett** set om fyra loppdatum. Flera sparade program hör till ett senare steg.

## Teknikstack

- TypeScript + Vite
- Vanlig CSS i egna filer, CSS-variabler för färger och mått
- Vitest för tester
- Ingen backend, ingen databas, inget UI-ramverk
- Deploy till GitHub Pages via GitHub Actions

Allt körs i webbläsaren: inget att drifta, inget att betala för. TypeScript och tester fångar fel tidigt.

Kräver Node och npm lokalt (inte installerat i miljön just nu — säg till användaren om kommandon nedan inte går att köra).

## Kommandon

```bash
npm install        # installera beroenden
npm run dev        # utvecklingsserver
npm run build      # produktionsbygge
npm test           # Vitest i watch-läge
npm run test:run   # Vitest en gång (används i CI och före commit)
npx tsc --noEmit   # typkontroll
```

## Struktur

```
src/
  generator/     ren genereringslogik — inga sidoeffekter, ingen DOM
  storage.ts     all läsning/skrivning av sparat program
  ics.ts         programobjekt -> .ics
  ui/            rendering och händelsehantering
  types.ts       delade typer (Program, Vecka, Pass, Gren, Nivå ...)
  main.ts        startpunkt: kopplar ihop UI, generator och storage
```

Lägg nya moduler i det lager de hör till. Om något känns svårt att placera: frågan är oftast om det är logik (generator), persistens (storage) eller presentation (ui).

## Arkitekturprinciper

- **Genereringen är ren.** `src/generator/` tar indata och returnerar ett program. Inga anrop till `localStorage`, `document`, `Date.now()` eller nätverk — behövs dagens datum skickas det in som argument. Logiken ska vara helt frikopplad från UI och testbar utan DOM.
- **Programmet är ett serialiserbart dataobjekt.** Rena JSON-vänliga värden: inga `Date`-instanser, `Map`, `Set` eller klasser i programobjektet. Datum som ISO-strängar (`YYYY-MM-DD`).
- **All lagring går via `storage.ts`.** Resten av koden anropar aldrig `localStorage` direkt. Modulen exponerar ett litet interface (t.ex. `sparaProgram`/`laddaProgram`/`rensaProgram`) så att backend kan ersätta localStorage senare utan att övrig kod ändras. Versionera det sparade objektet (t.ex. fältet `version`) så format kan migreras.
- **Inga globala variabler.** Inget delat muterbart tillstånd på modulnivå. Tillstånd skickas som argument eller returneras.
- **Funktioner gör en sak** och har beskrivande namn. Hellre fler små funktioner än en stor.
- **Inga `any`.** Typa indata och utdata explicit. Modellera grenar och faser som unionstyper, inte lösa strängar.

## Domänregler att respektera

- Fyra grenar, fyra loppdatum. Varje lopp har en egen topp — programmet är inte en enda lång uppbyggnad.
- Nedtrappning före lopp och återhämtning efter lopp är obligatoriska faser, också när nästa lopp ligger nära.
- Veckovolymen får aldrig överstiga användarens angivna timmar per vecka.
- Säsong styr skidträning: utanför vintersäsong ersätts skidpass med stakmaskin eller rullskidor, aldrig tas de bort.
- Programmet ska vara begripligt för en nybörjare: varje pass har gren, längd/omfattning och ett kort syfte.
- Friskrivningen ska synas i UI, inte bara i README.

## Språk och namngivning

- **UI-texter: svenska.** Allt användaren ser.
- **Kod: engelska.** Variabler, funktioner, typer, filnamn, kommentarer, testnamn.
- Domänord får behålla sin svenska innebörd i engelsk form: `discipline`/`sport` för gren, `taper` för nedtrappning, `peak` för toppning, `base` för uppbyggnad, `recovery` för återhämtning.
- Svenska strängar hålls samlade, inte utspridda i logiken.

## Testning

- All genereringslogik har Vitest-tester. Nya regler i generatorn kräver nya tester.
- Testa gärna egenskaper som ska gälla för hela program: veckotimmar inom budget, nedtrappning finns före varje lopp, återhämtning efter varje lopp, inga skidpass utanför snösäsong.
- UI behöver inte täckas av tester i MVP. `storage.ts` och `ics.ts` ska ha tester för serialisering och parsning.
- `npm run test:run` och `npx tsc --noEmit` ska vara gröna före varje commit.

## Arbetsflöde

- Committa själv i små, logiska steg när testerna går igenom — en sak per commit. Fråga inte om lov för varje commit.
- **Committa aldrig kod där testerna inte går igenom.** Går de inte igenom: fixa, eller säg till att du är blockerad.
- Pusha bara när användaren ber om det.
- Commit-meddelanden på engelska, imperativ, en rad: `add taper phase before each race`.
- Håll README uppdaterad när genereringslogiken ändras — det är användarens väg in i koden.

## Framtida utbyggnad (implementera inte)

Användarkonton och sparade program via Supabase. Bygg så att det går att lägga till: `storage.ts` som enda lagringspunkt, programmet som JSON, generatorn utan sidoeffekter. Skriv ingen auth-, nätverks- eller Supabase-kod förrän användaren ber om det.

## Gör inte detta

- Lägg inte till backend, databas, inloggning eller Supabase.
- Lägg inte till UI-ramverk (React, Vue, Svelte, Angular m.fl.).
- Lägg inte in API-nycklar eller hemligheter i koden — projektet behöver inga.
- Lägg inte till beroenden utan att fråga användaren först. Det gäller även små hjälpbibliotek för datum, .ics eller CSS.
- Bygg inte funktioner utanför MVP-listan utan att fråga.
- Anropa inte `localStorage` utanför `storage.ts`.
- Lägg inte DOM-beroenden eller sidoeffekter i `src/generator/`.

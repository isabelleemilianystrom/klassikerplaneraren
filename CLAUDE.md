# CLAUDE.md

Instruktioner för Claude Code i det här projektet. Läs hela filen innan du ändrar kod.

## Om projektet

Klassikerplaneraren är en webbsida som genererar ett personligt träningsprogram för En Svensk Klassiker: fyra grenar — längdskidor, cykel, simning och terränglöpning — som ska genomföras inom tolv månader.

**Problemet:** vanliga träningsappar planerar för en sport och ett lopp. En klassiker kräver att fyra grenar fasas in över ett år, med fyra loppdatum att toppa formen mot, och med hänsyn till säsong — det finns t.ex. inte snö året runt eller överallt.

**Användaren** äger projektet men skriver inte koden själv. Håll därför strukturen enkel och lättläst, och dokumentera i README hur appen fungerar och hur genereringslogiken är uppbyggd. Hellre uppenbar kod än smart kod.

## Varianterna

Det finns fyra officiella varianter. Vilken användaren valt avgör distanserna programmet tränar mot — det är därför varianten är det första användaren väljer.

| Variant (`ClassicVariant`) | Officiellt namn | Skidor | Cykel | Simning | Löpning |
| --- | --- | --- | --- | --- | --- |
| `full` | En Svensk Klassiker | 90 km | 315 km | 3 km | 30 km |
| `half` | En Svensk Klassiker – Halva | 45 km | 150 km | 1,5 km | 15 km |
| `short` | En Svensk Klassiker – Korta | 30 km | 100 km | 1 km | 10 km |
| `women` | En Svensk Klassiker – Tjej | 30 km | 100 km | 1 km | 10 km |

Distanserna bor i `src/variants.ts` med källa och kontrolldatum. Att veta:

- **Varje gren har flera godkända lopp** (skidor i `short` har sex alternativ), men distansen är densamma inom varianten. Vi modellerar distans, inte loppnamn — träningen styrs av distansen.
- **`short` och `women` har identiska distanser.** Programmen blir därför likadana. Båda finns ändå som val, så att användaren känner igen sin egen utmaning.
- **Engelbrektsloppet är ett undantag med egen kryssruta.** I `full` godkänns Engelbrektsloppet 60 km istället för Vasaloppets 90 km, så användaren kan kryssa i att hon åker det. Standard är 90 km. I övriga varianter har Engelbrektsloppet samma distans som de andra skidloppen — då är kryssrutan dold och valet ignoreras i `readForm`.
- **Vätternrundan är 315 km**, inte 300. Distansen ändrades 2020 och arrangörens marknadsföring släpar efter på sina håll.
- **Namnen har bytts.** Det heter inte längre "Halvklassikern" och "Tjejklassikern". Använd de officiella namnen i UI.

## MVP — detta och inget mer

1. Formulär: variant, fyra loppdatum, nuvarande nivå och mål per gren, tillgängliga timmar och dagar per vecka, dag för långpass, dagar som inte fungerar, snöperiod och utrustning.
2. Generering av program vecka för vecka, periodiserat mot varje lopp: uppbyggnad, toppning, nedtrappning inför lopp, återhämtning efter.
3. Säsongsanpassning: skidträning ersätts med alternativ (stakmaskin, rullskidor) utanför användarens snöperiod.
4. Tydlig vy per vecka, grupperad i block.
5. Export till .ics för kalender.
6. Programmet sparas i webbläsaren och finns kvar efter omladdning.
7. Kort friskrivning: programmet ersätter inte medicinsk rådgivning.

Omfattning i MVP: **ett** program med **en** variant och **ett** set om fyra loppdatum. Flera sparade program hör till ett senare steg.

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
                 dates, timeline, phases, blocks, schedule, sessions, season
  storage.ts     all läsning/skrivning av sparat program
  ics.ts         programobjekt -> .ics
  ui/            rendering och händelsehantering
  variants.ts    de fyra varianterna och deras distanser (ren domändata)
  race-schedule.ts  kommande loppdatum som förslag (uppdateras för hand)
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

## Träningsmodell

Genereringen vilar på allmänt vedertagen uthållighetsmetodik. Principerna nedan styr hur veckor och pass byggs — ändra dem inte utan att fråga användaren.

- **Trappan: uppbyggnad → bygge → toppning.** Att träna likadant vecka efter vecka ger ingen utveckling. Fasen sätter fokus för alla pass under perioden.
- **Polariserad intensitet.** Ungefär 70–80 % av tiden lugnt (prattempo), 20–30 % hårt (tröskel och intervaller). Mittemellan hela tiden ger sämre resultat än lätt + hårt.
- **Veckan har tre till fyra nyckelpass:** ett kvalitetspass (intervaller eller tröskel), ett långpass, ett till två lugna pass, och styrka som komplement. Måste något prioriteras bort är det de lugna passen — kvalitetspasset och långpasset är de som bygger formen.
- **Progression med tak.** Volymen ökar högst cirka 10 % per vecka, och långpasset byggs upp separat mot loppet — det är det enda som förbereder kroppen på elva timmar i sadeln.
- **Loppet är träning.** Loppets uppskattade tid räknas av från loppveckans budget, annars planeras pass in ovanpå nio mil skidor. Långa lopp (över fem timmar) kräver två veckors återhämtning, inte en.
- **Passens längd begränsas av grenen, inte av budgeten.** Simning max 1,5 h, löpning 2,5 h, skidor 4 h, cykel 8 h. Timmar som inte får plats fördelas på fler pass.
- **Loppdagen är fredad.** Inga pass på loppdagen, och dagen före bara ett kort öppningspass.
- **Styrka delar dag med ett konditionspass.** Den ska inte kosta en träningsdag — då blir den bortvald.
- **Återhämtning är träning.** Var fjärde vecka dras volymen ner även mitt i en uppbyggnad (`DELOAD_EVERY`), och minst en till två vilodagar per vecka.
- **Nedtrappning sänker volymen men behåller intensiteten.** Målet är att vara utvilad utan att tappa skärpa.
- **Teknik före fart i teknikgrenarna.** Klassisk skidåkning och crawl avgörs mer av teknik än av motor för den som inte är rutinerad. Skidor och simning får därför teknikpass så länge nivån inte är `advanced`.
- **Varje pass har en intensitet och ett upplägg.** Zon och en konkret struktur ("4 × 8 min tröskel, 3 min lugnt emellan"). Utan det blir 70/30-fördelningen en siffra i dokumentationen i stället för något användaren utför.
- **Öppet vatten är ett eget krav.** Simpassen flyttas ut i vattnet med våtdräkt under användarens öppet vatten-period före simloppet, med siktträning. Hinner inga sådana pass med varnar programmet — att möta våtdräkt och kallt vatten första gången på loppdagen är den vanligaste orsaken till att folk bryter i Vansbro.
- **Nivån och varianten styr dosen.** Nivån justerar andelen hård träning och var långpassets uppbyggnad startar. Långpassets mål är en andel av loppets uppskattade tid, så 90 km Vasaloppet ger längre pass än 30 km Tjejvasan.
- **Pass kan bytas mot annan gren i motsvarande intensitet.** Det är grunden för säsongsanpassningen: ett skidpass utanför snöperioden blir samma intensitet på stakmaskin eller rullskidor.

## Så presenteras programmet

Hur programmet skrivs ut är en del av produkten, inte bara formgivning. Tre regler:

- **Fokuset sitter på blocket, aldrig på passet.** Blocket säger "fokus Skidloppet"; passet säger bara kondition eller styrka, längd och syfte. Skriver vi "intervaller mot Vasaloppet" på varje pass känns ett missat pass som ett missat lopp. Folk blir sjuka och livet kommer emellan.
- **Varje pass märks som nyckelpass eller stödpass.** Räcker inte veckan till ska det vara uppenbart vad som ska strykas: långpasset och kvalitetspasset står kvar, resten får gå. Det står utskrivet en gång per vecka.
- **Passen har en veckodag.** Användaren anger hur många dagar hon kan träna, vilken dag långpasset ska ligga på och vilka dagar som är omöjliga. Programmet respekterar det.

## Domänregler att respektera

- Fyra grenar, fyra loppdatum. Varje lopp har en egen topp — programmet är inte en enda lång uppbyggnad.
- **Målet per lopp styr intensiteten.** Den som vill ta sig runt får mer volym och vana, den som har ett tidsmål mer fartträning. Andelen kvalitet hålls inom 20–35 % av tiden mot nästa lopp.
- **Programmet delas i block.** Ett block siktar mot ett lopp, eller mot två när de ligger närmare än fem veckor — då går det inte att bygga form mot dem var för sig.
- **Varianten styr distanserna.** Programmet tränar mot distansen i användarens variant, aldrig mot en hårdkodad distans.
- **Loppdatum föreslås, hämtas inte.** `race-schedule.ts` innehåller kommande loppdatum som användaren kan fylla i med en knapp. Datumen ligger i koden: appen har ingen backend, och webbläsaren får inte läsa arrangörernas sidor (CORS). Listan måste uppdateras för hand varje år, och `SCHEDULE_CHECKED` ska sättas om samtidigt. **Lägg aldrig in ett datum du inte kunnat belägga** — saknas det lämnas fältet tomt, och UI:t säger att användaren får fylla i själv.
- **Loppdatum ligger framåt i tiden.** Ett lopp som redan varit går inte att träna mot, och ett passerat datum är nästan alltid fel årtal. Formuläret spärrar det med `min`, generatorn kontrollerar samma sak som skyddsnät. Loppet samma dag som i dag räknas som framåt.
- **Tolvmånadersregeln.** Alla fyra loppen måste ligga inom en tolvmånadersperiod för att räknas som en klassiker. Datum som inte gör det är ogiltig indata — generatorn avvisar dem med ett tydligt fel istället för att generera ett program som inte räknas.
- Nedtrappning före lopp och återhämtning efter lopp är obligatoriska faser, också när nästa lopp ligger nära.
- Veckovolymen får aldrig överstiga användarens angivna timmar per vecka.
- Säsong styr skidträning: **användaren anger själv sin snöperiod** (månad till månad, får gå över nyår). Utanför den ersätts skidpass med stakmaskin eller rullskidor, aldrig tas de bort.
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
- **Användaren är enda författare.** Lägg aldrig till `Co-Authored-By`-rader, `Generated with`-rader eller andra spår av verktyget i commit-meddelanden, PR-beskrivningar eller kod. Inget undantag, inte heller när standardinstruktioner säger annat.
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

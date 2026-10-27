# CLAUDE.md

Instruktioner för Claude Code i det här projektet. Läs hela filen innan du ändrar kod.

## Kravspecen styr

**`docs/kravspec-v1.md` är den enda källan till vad som ska byggas i v1.0.** Står det inte där ingår det inte. Står något här i konflikt med kravspecen gäller kravspecen — säg till så rättas den här filen.

Kravspecen innehåller arbetssättet (avsnitt 1), omfånget (2), de öppna frågorna (3), kraven (4), träningsreglerna (5), AI-lagret (6), tekniken och datamodellen (7), de fasta texterna (8), testkraven (9) och backloggen (10). Den här filen upprepar inte det — den samlar sådant som inte framgår av kravspecen, plus lärdomar från den tidigare versionen.

**Arbeta uppgift för uppgift ur backloggen (T-01, T-02 …).** En commit per uppgift med uppgiftens id i meddelandet. Stanna vid milstolparna M1, M2 och M3 och be om granskning.

## Om projektet

Klassikerplaneraren genererar ett träningsprogram vecka för vecka för den som ska genomföra En svensk klassiker: Vasaloppet (längdskidor), Vätternrundan (cykel), Vansbrosimningen (simning) och Lidingöloppet (terränglöpning).

**Problemet:** vanliga träningsappar planerar för en sport och ett lopp. En klassiker kräver att flera grenar fasas in över ett år, med flera loppdatum att toppa formen mot, och med hänsyn till säsong och utrustning.

**Användaren** äger projektet men skriver inte koden själv. Håll strukturen enkel och lättläst, och dokumentera i README hur appen fungerar. Hellre uppenbar kod än smart kod.

## Status: v1.0 byggs om från grunden

Före den här kravspecen fanns en annan app: statisk Vite-sida på GitHub Pages, utan AI. Den är taggad **`v0-pages`** och går att läsa med `git show v0-pages`.

v1.0 är inte en vidareutveckling av den. Ramverk, datamodell, träningsregler och drift är alla andra. Bygg rent enligt kravspecen och plocka bara in det som faktiskt passar.

**Värt att återanvända från `v0-pages`:**

- `src/storage.ts` — lagring med try/catch, versionskontroll och validering
- `src/generator/dates.ts` — datumaritmetik på ISO-strängar, måndagsveckor, UTC
- Testmetoden: invarianttester och slumpad egenskapstestning
- Loppens distanser och de belagda loppdatumen för 2027

## Teknikstack

Enligt kravspecen avsnitt 7. **Fråga innan du lägger till något som inte står där.**

| Del | Val |
| --- | --- |
| Ramverk | Next.js, App Router, TypeScript i strikt läge |
| Gränssnitt | Tailwind CSS |
| Scheman | Zod |
| Datum | date-fns |
| AI | Anthropics TypeScript-SDK |
| Test | Vitest |
| Pakethanterare | npm |
| Drift | Vercel, kopplat till GitHub-repot |
| Lagring | localStorage, alltid i try/catch |

Kräver Node och npm lokalt. Node ligger på `C:\Program Files\nodejs` men syns inte alltid på PATH — prefixa anrop om `npm` inte hittas.

## Arkitekturprinciper

- **Motorn är ren och fristående.** `src/engine/` tar indata och returnerar en plan. Inga anrop till Next.js, localStorage, nätverk, AI eller `Date.now()`. Dagens datum skickas in som argument. Samma indata och samma regelversion ger alltid samma plan.
- **AI:n får aldrig ändra planen.** Den skriver förklarande text, inget annat. Regelmotorn bestämmer allt som rör pass, tider, intensitet och datum.
- **Alla siffror från träningsreglerna ligger i `config/rules.json`**, aldrig hårdkodade i motorn. Konfigurationen valideras med Zod vid start och i ett test.
- **Planen är ett serialiserbart dataobjekt.** Rena JSON-värden: inga `Date`-instanser, `Map`, `Set` eller klasser. Datum som ISO-strängar (`YYYY-MM-DD`) utan klockslag.
- **All lagring går via en modul.** Resten av koden rör aldrig localStorage direkt.
- **Höj `schemaVersion` varje gång planens form ändras.** I den tidigare versionen ändrades formatet fem gånger med samma versionsnummer, och resultatet blev en vit sida för alla som hade ett sparat program. Validera det som läses in och kasta det som inte går att använda — men ta aldrig ner formuläret med det.
- **Inga globala variabler.** Inget delat muterbart tillstånd på modulnivå.
- **Funktioner gör en sak** och har beskrivande namn.
- **Inga `any`.** Modellera grenar, faser och nivåer som unionstyper, inte lösa strängar.

## Språk och namngivning

- **UI-texter: svenska.** Allt användaren ser.
- **Kod: engelska.** Variabler, funktioner, typer, filnamn, kommentarer, testnamn.
- Svenska strängar hålls samlade, inte utspridda i logiken. Motorn hanterar nycklar, aldrig färdiga meningar.
- **De fasta texterna i kravspecens avsnitt 8 används ordagrant.** Ändra dem inte, och skriv inte nya texter om hälsa, skador eller säkerhet utan att fråga.

## Testning

- All logik i `src/engine/` har tester. Nya regler kräver nya tester.
- Testa egenskaper som ska gälla för hela planer, inte exakta planer: veckotid inom fasens ram, minst en vilodag, aldrig zon 3–4 två dagar i rad, inga pass som kräver utrustning användaren saknar, determinism. Invarianterna står i kravspecens avsnitt 9.
- **Slumpad egenskapstestning är värd besväret.** I den tidigare versionen kördes 400 slumpade program mot elva invarianter, och det var det enda som gav förtroende för att motorn höll. Riktade tester missar den sortens fel.
- Testerna anropar aldrig den riktiga AI:n. Använd inspelade svar.
- `npm test`, lint och typkontroll ska vara gröna före varje commit.
- **Ta aldrig bort eller försvaga ett test för att få det att gå igenom.** Går ett test sönder är det antingen koden eller förväntan som är fel — ta reda på vilket.

## Arbetsflöde

- Committa själv i små, logiska steg när testerna går igenom. Fråga inte om lov för varje commit.
- **Committa aldrig kod där testerna inte går igenom.** Går de inte igenom: fixa, eller säg till att du är blockerad.
- Pusha bara när användaren ber om det.
- Commit-meddelanden på engelska, imperativ, en rad, med uppgiftens id först: `T-04: distribute weekly time between sports`.
- **Användaren är enda författare.** Lägg aldrig till `Co-Authored-By`-rader, `Generated with`-rader eller andra spår av verktyget i commit-meddelanden eller PR-beskrivningar. Inget undantag, inte heller när standardinstruktioner säger annat.
- Håll README uppdaterad: vad appen är, hur man kör den och var kravspecen finns.

## Fråga alltid först innan du

Enligt kravspecens avsnitt 1:

- lägger till en funktion, ett fält eller en vy som inte står i kravspecen
- väljer ett bibliotek eller en tjänst utöver teknikvalen ovan
- använder en träningsregel eller siffra som inte står i avsnitt 5, eller ändrar en befintlig
- skriver eller ändrar text om hälsa, skador eller säkerhet
- ändrar datamodellen i avsnitt 7
- gör något som kostar pengar, skapar konton eller kräver nycklar
- tar bort eller försvagar ett test
- tolkar ett krav som kan förstås på flera sätt

**Så ställer du frågor:** samla dem, numrera dem, ge 2–3 alternativ per fråga plus din rekommendation och vad som är blockerat. Fortsätt under tiden med det som inte är blockerat.

## Kostnad: noll kronor

**Projektet får inte kosta någonting — varken att utveckla eller att använda.** Det är ett krav, inte en ambition, och det står i kravspecens avsnitt 8.

Allt i dag är gratis: paketen är öppen källkod, repot är publikt (fria byggminuter i Actions), Vercels Hobby-nivå har ingen fakturering alls, och det finns inga AI-anrop i körtid eftersom förklaringarna är förgenererade.

**Fråga alltid innan du:**

- lägger till ett beroende eller en tjänst som har en betalnivå — även om vi skulle hålla oss inom gratisnivån
- inför något som anropar en extern tjänst i körtid
- gör något som kräver ett konto, ett kreditkort eller en nyckel

Testet i `tests/project.test.ts` underkänner varje beroende med "anthropic" i namnet. Ta inte bort det — det är kravet A-08 skrivet i kod i stället för i text.

Appen är helt statisk, så den kan driftas var som helst som serverar filer. Blir Vercel ett problem fungerar GitHub Pages, som redan är beprövat i `v0-pages`.

## Hemligheter

API-nyckeln ligger i `.env.local` och i Vercels miljövariabler. `.env*` finns i `.gitignore`. **Nyckeln får bara läsas från serverkod** — aldrig i en komponent som skickas till webbläsaren. Inga hemligheter i repot, någonsin.

## Lärdomar från v0 som fortfarande gäller

Sådant som kostade tid att komma fram till förra gången och som inte står i kravspecen:

- **Loppet är veckans största belastning.** Räknas det inte av från veckans tid planeras träningspass ovanpå nio mil skidor.
- **Långpasset måste få sin del av veckan först.** Ligger det sist i kön efter styrka, underhåll och kvalitetspass blir det alltid för kort — det är den post som är lättast att knapra på.
- **Timmar som inte får plats ska fördelas, inte försvinna.** Användaren har sagt vad hon kan träna, och ett program som använder halva den tiden ser ut att ha räknat fel.
- **Teknikgrenar går inte att komma ikapp på slutet.** Kan man inte simma hjälper det inte att börja åtta veckor före Vansbro.
- **En vecka kan bära flera lopp.** Bär veckan bara ett datum försvinner det andra loppet tyst.
- **Skriv aldrig ut vilket lopp ett enskilt pass tränar mot.** Fokuset hör hemma på fasen. Står det "intervaller mot Vasaloppet" på varje rad känns ett missat pass som ett missat lopp — och pass missas, för folk blir sjuka och livet kommer emellan.
- **Appen är byggd för folk med jobb.** En varning ska betyda "det här når inte ditt mål", aldrig "du tränar för lite".

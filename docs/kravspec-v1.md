# Klassikerplaneraren – kravspec v1.0 (beta 19 november)

Oct 27, 2026 · @Isabelle

## 1. Instruktioner till Claude Code

Den här fliken är den enda källan till vad som ska byggas i v1.0. Bygg exakt det som står här, i backlogens ordning, och fråga Isabelle hellre än att gissa.

**Arbetssätt**

1. Läs hela fliken innan du börjar. Fliken "Fullständig kravspec – framtida versioner" ingår inte i v1.0; bygg ingenting därifrån.
2. Kontrollera att de öppna frågorna i avsnitt 3 är besvarade. Saknas ett svar som påverkar en uppgift, fråga innan du börjar den uppgiften.
3. Arbeta uppgift för uppgift i backlogens ordning (T-01, T-02 …). Börja inte nästa uppgift förrän den förra uppfyller sina kriterier.
4. Efter varje uppgift: kör alla tester, gör en commit med uppgiftens id i meddelandet (t.ex. "T-04: veckotid och sportfördelning") och skriv en kort sammanfattning – vad som gjordes, hur det testades och eventuella frågor.
5. Stanna vid varje milstolpe (M1, M2, M3) och be Isabelle granska innan du fortsätter.
6. Håll CLAUDE.md uppdaterad med beslut som fattas under arbetet.

**Fråga alltid först innan du**

- lägger till en funktion, ett fält eller en vy som inte står här
- väljer ett bibliotek eller en tjänst utöver teknikvalen i avsnitt 7
- använder en träningsregel eller siffra som inte står i avsnitt 5, eller ändrar en befintlig
- skriver eller ändrar text om hälsa, skador eller säkerhet (texterna i avsnitt 8 används ordagrant)
- ändrar datamodellen i avsnitt 7
- gör något som kostar pengar, skapar konton eller kräver nycklar
- tar bort eller försvagar ett test för att få det att gå igenom
- tolkar ett krav som kan förstås på flera sätt

**Så ställer du frågor.** Samla frågorna och numrera dem. Ge för varje fråga 2–3 alternativ, din rekommendation och vad som är blockerat tills svaret kommer. Fortsätt under tiden med uppgifter som inte är blockerade.

**Konventioner.** Kod, namn och kommentarer på engelska; all text i gränssnittet på svenska. TypeScript i strikt läge. Inga hemligheter i repot — v1.0 behöver inga nycklar alls, eftersom appen inte anropar någon tjänst i körtid.

**För Isabelle.** Exportera den här fliken som Markdown till `docs/kravspec-v1.md` i repot och skriv i CLAUDE.md att Claude Code ska följa den.

## 2. Mål och omfång för v1.0

v1.0 är en enkel webbapp där en klassikeraspirant fyller i ett kort formulär och får ett träningsprogram vecka för vecka fram till sina lopp. Den ska kunna visas upp den 19 november 2026 och vara en ren grund att bygga vidare på.

**Mål**

| Mål | Så vet vi att det är uppfyllt |
| --- | --- |
| Klar för demon 19 nov | Appen är live på Vercel och fungerar i mobilen |
| Programmen är rimliga | Alla regler i avsnitt 5 följs och verifieras av tester; referensprofilerna P1–P5 ger planer som Isabelle godkänner |
| Snabbt att komma igång | Från startsida till färdigt program på under 2 minuter |
| AI gör nytta | AI skriver förklaringarna till faserna under utvecklingen; Isabelle granskar dem och de följer med i appen |
| Grund för senare versioner | Regelmotorn är en fristående modul med tester; lopp, regler och pass ligger i konfigurationsfiler |

**Ingår i v1.0**

- Startsida med förklaring, betatext och ansvarsfriskrivning
- Formulär i tre steg: lopp och datum, nivå per sport, tid och utrustning
- Regelmotor som skapar programmet enligt avsnitt 5
- Förklaringar per fas, förgenererade med AI och granskade
- Översikt över alla veckor och en veckovy med pass per dag
- Varningar och säkerhetstexter
- Den senaste planen sparas i webbläsaren

**Ingår inte i v1.0** (fråga innan något av detta läggs till)

- Konton, inloggning och databas
- Fritext, hälsofrågor och skadefrågor
- Loggning av genomförda pass, kalenderexport och delbar länk
- Koppling till Strava, Garmin eller andra appar
- Analysverktyg, kakor, betalning och engelsk version
- Halvdistanser och varianter som Öppet Spår eller Halvvättern, om inte fråga 2 säger annat

**Prioritet inom v1.0.** Krav märkta **Måste** krävs till demon. Krav märkta **Bra att ha** byggs bara om tiden räcker och stryks först.

## 3. Öppna frågor att besvara innan start

Isabelle besvarar frågorna här i dokumentet. Claude Code får inte anta ett svar; saknas ett svar som behövs, fråga.

- [x] **1. Loppdatum 2027.** Besvarad 2026-10-27: använd de belagda datumen — Vasaloppet **2027-03-07**, Vätternrundan **2027-06-18**, Vansbrosimningen **2027-07-10**, Lidingöloppet **2027-09-25**. Kontrollerade mot arrangörernas sidor i oktober 2026; `config/races.json` ska bära källa och kontrolldatum.
- [x] **2. Distanser.** Besvarad 2026-10-27: **bara de fyra fulla distanserna** i v1.0, enligt lopptabellen i avsnitt 5. Användaren väljer vilka av de fyra hon gör. Öppet Spår, Halvvättern och övriga varianter ligger utanför v1.0 — motorn byggs så att fler lopp bara blir rader i `config/races.json`.
- [x] **3. AI-modell och nyckel.** Besvarad 2026-10-27: **inga AI-anrop i körtid.** Förklaringarna förgenereras under utvecklingen med hjälp av AI, granskas av Isabelle och sparas i appen. Ingen API-nyckel, ingen kostnad, inget missbruksskydd och inga data som lämnar webbläsaren. Ett riktigt AI-anrop kan läggas till i en senare version. Se noten nedan om vad det innebär för avsnitt 6, 7 och T-12.
- [x] **4. Konton.** Besvarad 2026-10-27: GitHub-repot finns och är publikt. **Vercel-konto saknas ännu** och skapas senare — senast till M2, eftersom den milstolpen kräver att appen går att testa i mobilen. T-01 byggs och testas lokalt tills dess.
- [ ] **5. Granskning av träningsreglerna.** Vem granskar reglerna i avsnitt 5 före demon? Förslag: en tränare eller kunnig bekant; om ingen hinner visas betatexten tydligt. Blockerar M1-granskningen.
- [ ] **6. Demon.** Hur lång är demon och vad ska den visa? Påverkar demomanuset i avsnitt 11.

### Not till fråga 3: vad beslutet ändrar

Beslutet att förgenerera förklaringarna gör appen **helt statisk** — den behöver ingen server. Följande i kravspecen påverkas och ska bekräftas innan T-12 byggs:

| Krav | Följd |
| --- | --- |
| A-01 route handler, A-02 indata, A-04 omförsök, A-05 tidsgräns, A-07 anropsbegränsning | Utgår — det finns inget körtidsanrop att skydda |
| A-03 Zod-validering av AI-svaret | Blir i stället validering av textbiblioteket i `config/` |
| A-06 prompt i `prompts/` och promptversion i planen | Behålls — prompten används vid bygget och versionen sparas |
| A-08 AI-märkning | Behålls ordagrant. Texterna är skrivna med hjälp av AI och granskade av en människa |
| K-05 "AI-förklaringarna hämtas efteråt" | Utgår. Texterna finns direkt, så tvåsekunderskravet uppfylls alltid |
| K-08 förklaring per fas, högst 300 tecken | Oförändrat |
| Avsnitt 7, Anthropics SDK | Behövs inte i körtid |
| Avsnitt 8, nyckeln bara på servern | Utgår — ingen nyckel finns |
| T-12 | Byts från route handler och reservlogik till att skriva och granska textbiblioteket |

Målet i avsnitt 2 — "AI skriver förklaringen till varje fas; finns inget AI-svar visas en reservtext" — uppfylls på ett annat sätt än beskrivet: AI:n skriver texterna, men vid bygget. Det finns inget reservläge, eftersom det inte finns något som kan misslyckas.

## 4. Användarflöde och funktionella krav

Appen har ett enda flöde: startsida, formulär i tre steg och sedan planen. Den som kommer tillbaka ser sin senast sparade plan direkt.

1. **Startsida** – vad appen gör, betatext, ansvarsfriskrivning och knappen "Skapa mitt program"
2. **Steg 1: Lopp** – välj lopp och datum
3. **Steg 2: Nivå** – nivå per vald sport
4. **Steg 3: Tid och utrustning** – timmar per vecka och utrustning
5. **Planen** – översikt över alla veckor; tryck på en vecka för att se passen

**Krav**

| ID | Krav | Prio | Acceptanskriterier |
| --- | --- | --- | --- |
| K-01 | Startsida med kort förklaring, betatext, ansvarsfriskrivning, åldersgräns (18 år) och knappen "Skapa mitt program" | Måste | Givet att jag öppnar appen utan sparad plan, så ser jag förklaringen, texterna från avsnitt 8 och knappen som startar formuläret |
| K-02 | Steg 1: välj minst ett av de fyra loppen och ange datum för varje valt lopp; startdatum är idag men kan ändras | Måste | Inget lopp valt eller ett loppdatum före startdatumet ger ett felmeddelande vid fältet, och jag kommer inte vidare |
| K-03 | Steg 2: nivå per sport som ingår i valda lopp – Ny, Van eller Erfaren – med beskrivningarna i avsnitt 5 | Måste | Varje sport har exakt en vald nivå innan jag kommer vidare; förvalt är "Van" |
| K-04 | Steg 3: timmar per vecka (3–15, heltal) och utrustning: snö eller rullskidor, stakmaskin, simhall, landsvägscykel eller trainer (ja/nej för varje) | Måste | Alla fält har standardvärden (6 timmar, nej på utrustning); värden utanför 3–15 kan inte väljas |
| K-05 | Generering: regelmotorn skapar planen direkt, med förklaringarna på plats från början | Måste | Planen med sina förklaringar visas inom 2 s efter att jag skickat formuläret, utan att något laddas i efterhand |
| K-06 | Översikt: alla veckor från start till sista lopp med veckonummer, datumintervall, fas, total tid och markering av loppveckor | Måste | Antalet veckor stämmer med perioden; varje loppvecka är markerad med loppets namn |
| K-07 | Veckovy: sju dagar med pass; varje pass visar sport, typ, minuter, intensitet i vardagsspråk och zon samt en kort instruktion; vilodagar visas som vila | Måste | Varje dag i veckan visas; intensitet visas som t.ex. "Lugnt – du ska kunna prata hela meningar (zon 2)" |
| K-08 | Förklaring per fas: varje sammanhängande fas har en kort förklaring, och planen har en kort sammanfattning överst | Måste | Varje fas i översikten har en förklaring; texten är högst 300 tecken |
| K-09 | Varningar enligt avsnitt 5 visas överst i planen; planen skapas ändå | Måste | Givet Vasaloppet om 6 veckor, när planen skapas, så visas varningen om kort förberedelsetid och en plan |
| K-10 | Den senaste planen sparas i webbläsaren och visas vid återbesök, med knappen "Gör en ny plan" | Måste | Efter omladdning visas samma plan; fungerar inte lagringen visas planen ändå utan fel |
| K-11 | Säkerhetstexter från avsnitt 8: ansvarsfriskrivning, röda flaggor, smärtregel och sjukdomsregel i planen; säkerhetstext på varje pass i öppet vatten | Måste | Varje pass i öppet vatten har säkerhetstexten; övriga texter syns i planen |
| K-12 | Fungerar i mobil från 360 px bredd | Måste | Ingen vågrät scroll och alla knappar går att trycka på vid 360 px |
| K-13 | Ändra svar: tillbaka till formuläret med tidigare svar ifyllda | Bra att ha | Givet en sparad plan, när jag trycker "Ändra svar", så är formuläret ifyllt med mina svar |
| K-14 | Utskrift: planen går att skriva ut snyggt via webbläsarens utskrift | Bra att ha | Utskriften visar översikt och alla veckor utan knappar och menyer |

## 5. Träningsregler för regelmotorn

Reglerna nedan är förslag som granskas enligt fråga 5. Claude Code implementerar exakt dessa, lägger alla siffror i `config/rules.json` och frågar om ett fall inte täcks. Varje regel har ett id som testerna hänvisar till.

**Lopp** (`config/races.json`)

| Lopp | Sport | Distans | Nedtrappning | Återhämtning efter | Specifik fas |
| --- | --- | --- | --- | --- | --- |
| Vasaloppet | Längdskidor | 90 km | 2 veckor | 1 vecka | 8 veckor |
| Vätternrundan | Cykel | 315 km | 2 veckor | 1 vecka | 8 veckor |
| Vansbrosimningen | Simning | 3 km | 1 vecka | Ingen | 6 veckor |
| Lidingöloppet | Löpning | 30 km | 1 vecka | 1 vecka | 8 veckor |

Datum enligt fråga 1.

**Nivåer** (visas i steg 2)

| Nivå | Beskrivning för användaren |
| --- | --- |
| Ny | Jag har knappt provat sporten eller kan inte tekniken, t.ex. simmar inte crawl |
| Van | Jag tränar sporten ibland och klarar en lugn timme |
| Erfaren | Jag tränar sporten regelbundet och har gjort lopp förut |

**Struktur och faser**

- **R-01** Planen går från måndagen i startdatumets vecka till söndagen i veckan med sista loppet. Veckor börjar på måndag.
- **R-02** Varje vecka får en fas utifrån närmaste kommande lopp: Återhämtning (veckorna direkt efter ett lopp), Nedtrappning (sista veckorna före loppet), Specifik (veckorna före nedtrappningen) och Bas (övrig tid). Ordningen gäller i den prioriteten.
- **R-03** Blocklogik: ligger två lopp mindre än 4 veckor isär, får det första loppet ingen återhämtningsvecka, nedtrappningen inför det andra blir 1 vecka och veckorna däremellan är specifik fas för det andra loppet.
- **R-04** Loppdagen innehåller bara loppet.

**Veckotid** (T = valda timmar per vecka)

- **R-05** Bas 75 % av T; Specifik 100 %; Nedtrappning 60 % första och 40 % andra veckan (50 % om den bara är en vecka); Återhämtning 50 %.
- **R-06** Var fjärde vecka i bas- och specifik fas är en avlastningsvecka med 70 % av fasens tid.
- **R-07** De två första veckorna i planen har högst 60 % av T.

**Fördelning mellan sporter**

- **R-08** Specifik fas: 55 % till loppets sport, resten fördelat jämnt mellan övriga sporter i planen.
- **R-09** Bas: jämn fördelning mellan sporterna i planen, med +10 procentenheter för sporter där nivån är Ny.
- **R-10** Styrka räknas in i veckotiden: 2 pass à 20 minuter i bas, 1 i specifik fas, inga i nedtrappning och återhämtning. Övningar för bål, höft, vader och axlar från en fast lista i `config/sessions.json`.

**Pass**

- **R-11** Antal träningsdagar: T ≤ 5 ger 4 dagar, T 6–9 ger 5 dagar, T ≥ 10 ger 6 dagar. Minst en helt vilodag i veckan.
- **R-12** Passlängd 20–300 minuter.
- **R-13** Ett långpass per vecka i loppets sport under specifik fas, på lördag eller söndag. Det växer jämnt genom fasen upp till: skidor 240 min, cykel 300 min, löpning 150 min, simning 75 min.
- **R-14** Löptak: total löptid får öka högst 10 % från en vecka till nästa (veckor efter avlastning undantagna). Nivå Ny i löpning har aldrig löppass två dagar i rad.

**Intensitet**

| Zon | Text i appen |
| --- | --- |
| 1 | Mycket lugnt |
| 2 | Lugnt – du ska kunna prata hela meningar |
| 3 | Måttligt – du kan prata korta meningar |
| 4 | Hårt – bara några ord i taget |

- **R-15** Bas: alla pass i zon 1–2 utom ett pass i zon 3 per vecka. Specifik: ett pass i zon 3 och ett intervallpass i zon 4 per vecka; nivå Ny i sporten får bara zon 3. Nedtrappning: korta inslag i zon 3. Återhämtning: bara zon 1–2.
- **R-16** Aldrig pass i zon 3–4 två dagar i rad.

**Ersättningar, teknik och säsong**

- **R-17** Skidor utan snö eller rullskidor: stakmaskin om användaren har en, annars stavgång i backe med samma tid och zon.
- **R-18** Simning utan simhall: före juni ersätts simpass med torrövningar för simteknik, och en varning visas om att simträning behövs.
- **R-19** Pass i öppet vatten planeras bara juni–augusti och har alltid säkerhetstexten från avsnitt 8.
- **R-20** Cykel utan landsvägscykel eller trainer: passet blir "cykel, t.ex. spinning på gym" och en varning visas.
- **R-21** Nivå Ny i skidor eller simning: ett teknikpass per vecka i den sporten under bas och specifik fas, och en rekommendation om kurs i översikten.

**Varningar**

- **R-22** Mindre än 8 veckor från start till första lopp: "Du har kort tid att förbereda dig. Planen är försiktig – sikta på att genomföra, inte på tid."
- **R-23** T under 4 timmar när Vasaloppet eller Vätternrundan ingår, eller under 3 timmar annars: "Den tid du har valt är i minsta laget för dina lopp."
- **R-24** Vasaloppet med nivå Ny i skidor och varken snö, rullskidor eller stakmaskin: "Teknik är avgörande i Vasaloppet. Försök att åka på snö eller gå en skidkurs före loppet."

**Sjukdom och missade pass.** Hanteras i v1.0 bara som fast text (avsnitt 8), inte som logik i motorn.

## 6. Förklaringar

Förklaringarna skrivs med hjälp av AI **under utvecklingen**, granskas av Isabelle och sparas i appen. Appen gör inga anrop till någon AI-tjänst när användaren skapar sin plan. Regelmotorn bestämmer hela planen; förklaringarna beskriver den, aldrig tvärtom.

Det här är ett medvetet val framför ett körtidsanrop (fråga 3). Det ger noll kostnad, ingen API-nyckel, inget missbruksskydd att bygga, inga data som lämnar webbläsaren — och framför allt: varje mening är läst av en människa innan en användare ser den. Ett riktigt körtidsanrop kan läggas till i en senare version.

**Texterna innehåller**

- En sammanfattning av planen överst, högst 500 tecken
- En förklaring per fas, högst 300 tecken: varför fasen finns och vad den bygger upp
- Allt på svenska i klarspråk, peppande men ärligt

**Texterna innehåller inte**

- Siffror, datum eller fakta som rör den enskilda planen — texten väljs utifrån fas och lopp, inte utifrån användarens svar
- Medicinska råd eller löften om att planen förebygger skador
- Påståenden om tider, resultat eller vad användaren kommer att klara

**Krav**

| ID | Krav | Prio |
| --- | --- | --- |
| A-01 | Texterna ligger i `config/explanations.json` och valideras med Zod vid start och i ett test | Måste |
| A-02 | Biblioteket täcker varje kombination av fas och lopp som motorn kan producera — 4 faser × 4 lopp = 16 texter. Saknas en kombination är det ett testfel, inte ett tomt fält | Måste |
| A-03 | Nivåvariation läggs till bara där nivån ändrar budskapet, och då som egna poster. Börja utan den | Bra att ha |
| A-04 | Sammanfattningen väljs utifrån vilka lopp planen innehåller; högst 500 tecken | Måste |
| A-05 | Längdgränserna kontrolleras i test. En för lång text är ogiltig och kortas inte automatiskt | Måste |
| A-06 | Prompten som användes för att skriva texterna ligger i `prompts/phase-explanations.v1.md`, och versionen sparas i planen som `promptVersion` | Måste |
| A-07 | Texterna märks i gränssnittet med "Förklaringarna är skrivna med hjälp av AI." | Måste |
| A-08 | Appen anropar ingen AI-tjänst i körtid. Anthropics SDK finns inte bland beroendena | Måste |

**Om `source` i datamodellen.** Fältet `explanations.source` behålls oförändrat och sätts alltid till `'ai'` i v1.0 — texterna *är* skrivna med AI, bara vid ett annat tillfälle. Fältet finns kvar för en framtida version med körtidsanrop och reservläge.

## 7. Teknik, arkitektur och datamodell

En Next.js-app utan databas, där regelmotorn är en ren TypeScript-modul utan beroenden till webbramverket. Det gör motorn testbar och lätt att flytta när databas och konton kommer i senare versioner.

**Teknikval** (fråga innan något annat läggs till)

| Del | Val |
| --- | --- |
| Ramverk | Next.js med App Router och TypeScript i strikt läge |
| Gränssnitt | Tailwind CSS |
| Scheman och validering | Zod |
| Datum | date-fns |
| Test | Vitest |
| Pakethanterare | npm |
| Drift | Vercel, kopplat till GitHub-repot |
| Lagring | Webbläsarens localStorage, alltid inom try/catch |

**Mappstruktur**

```text
config/            races.json, rules.json, sessions.json, explanations.json
prompts/           phase-explanations.v1.md – prompten som texterna skrevs med
src/engine/        generatePlan(input): Plan – ren funktion, ingen Next.js, ingen AI
src/app/           sidor
src/components/    gränssnittskomponenter
tests/             enhets-, invariant- och datumtester
docs/              kravspec-v1.md (den här fliken som Markdown)
scripts/           print-profiles.ts – skriver ut P1–P5 som text för granskning
CLAUDE.md
```

**Principer**

- Motorn är deterministisk: samma indata och samma regelversion ger alltid samma plan. Inga slumptal och ingen läsning av klockan inne i motorn; dagens datum skickas in som indata.
- Datum hanteras som lokala datum i formatet `YYYY-MM-DD` utan klockslag, med veckor som börjar på måndag.
- Alla siffror från avsnitt 5 läses från `config/rules.json`, aldrig hårdkodade i motorn.
- Konfigurationsfilerna valideras med Zod när appen startar och i ett test.

**Datamodell** (ändras inte utan att fråga)

```ts
type Sport = 'ski' | 'bike' | 'swim' | 'run' | 'strength';
type RaceId = 'vasaloppet' | 'vatternrundan' | 'vansbrosimningen' | 'lidingoloppet';
type Level = 'new' | 'experienced' | 'advanced'; // Ny, Van, Erfaren
type Phase = 'base' | 'specific' | 'taper' | 'recovery';
type SessionType = 'easy' | 'long' | 'tempo' | 'intervals' | 'technique' | 'strength' | 'rest' | 'race';

interface PlanInput {
  schemaVersion: 1;
  today: string;              // YYYY-MM-DD
  startDate: string;          // YYYY-MM-DD
  races: { id: RaceId; date: string }[];
  levels: Partial<Record<'ski' | 'bike' | 'swim' | 'run', Level>>;
  hoursPerWeek: number;       // 3–15
  equipment: { snowOrRollerSkis: boolean; skiErg: boolean; pool: boolean; bike: boolean };
}

interface Session {
  id: string;                 // stabilt id, t.ex. 'w05-d3-1'
  date: string;
  sport: Sport | null;        // null för vila
  type: SessionType;
  minutes: number;
  zone: 1 | 2 | 3 | 4 | null;
  title: string;
  instruction: string;
  safetyNote?: string;
}

interface Week {
  index: number;              // 1, 2, 3 …
  startDate: string;          // måndag
  phase: Phase;
  phaseId: string;            // samma för sammanhängande veckor i samma fas och lopp
  focusRaceId: RaceId | null;
  isDeload: boolean;
  totalMinutes: number;
  sessions: Session[];
}

interface Plan {
  schemaVersion: 1;
  rulesVersion: string;
  promptVersion: string | null;
  input: PlanInput;
  weeks: Week[];
  warnings: string[];
  explanations: { summary: string; phases: Record<string, string>; source: 'ai' | 'fallback' };
}
```

## 8. Säkerhet, dataskydd och icke-funktionella krav

v1.0 samlar inga personuppgifter: ingen databas, inga konton, inga hälsofrågor, inga kakor och ingen analys. **Ingenting lämnar webbläsaren** — appen gör inga anrop till någon tjänst i körtid.

**Fasta texter** (används ordagrant; ändras inte utan att fråga)

| Text | Var | Innehåll |
| --- | --- | --- |
| Ansvarsfriskrivning | Startsida och planens fot | Klassikerplaneraren är en beta och ger allmänna träningsförslag, inte medicinska råd. Har du en sjukdom eller skada, är gravid eller osäker på om du tål hård träning – prata med vården innan du börjar. |
| Åldersgräns | Startsida | För dig som är 18 år eller äldre. |
| Röda flaggor | Planens topp | Avbryt passet och sök vård om du får bröstsmärta, ovanlig andfåddhet, yrsel eller oregelbunden puls. |
| Smärtregel | Planen | Träningsvärk som går över på ett par dagar är normalt. Gör det ont mer och mer, haltar du eller sitter smärtan kvar nästa dag – vila den sporten och byt till något skonsammare. |
| Sjukdom | Planen | Har du feber – vila. Börja sedan lugnt och ta inte igen missade pass. |
| Öppet vatten | Varje pass i öppet vatten | Simma aldrig ensam i öppet vatten. Använd en synlig boj och gå i gradvis – kallt vatten kan ge köldchock. |
| AI-märkning | Vid förklaringarna | Förklaringarna är skrivna med hjälp av AI. |
| Oberoende | Planens fot | Klassikerplaneraren är inte knuten till Vasaloppet, Vätternrundan, Vansbrosimningen, Lidingöloppet eller En svensk klassiker. |

**Skrivregler för alla texter**

- Inga medicinska påståenden: skriv aldrig att appen förebygger skador, behandlar eller rehabiliterar
- Använd loppnamnen bara för att beskriva loppen; inga loggor
- Klarspråk utan oförklarade fackord

**Icke-funktionella krav**

| Område | Krav |
| --- | --- |
| Mobil | Fungerar från 360 px bredd; testas i Safari på iOS och Chrome på Android |
| Prestanda | Planen med förklaringar visas inom 2 s |
| Tillgänglighet | Semantisk HTML, går att använda med tangentbord, god kontrast, sporter visas med både färg och text |
| Säkerhet | Inga API-nycklar och inga hemligheter i repot; inga anrop till tredje part i körtid |
| Kvalitet | TypeScript strikt, lint utan fel, alla tester gröna innan commit |
| Kostnad | Inga AI-anrop i körtid, alltså noll rörlig kostnad; gratisnivåer hos Vercel |
| Språk | Svenska i hela gränssnittet |

## 9. Test och definition of done

Regelmotorn testas mot regler som alltid ska gälla, inte mot exakta planer. Testerna anropar aldrig den riktiga AI:n.

**Referensprofiler** (`tests/profiles.ts`; startdatum 2026-11-02 om inget annat anges)

| Profil | Lopp | Timmar | Nivåer | Utrustning |
| --- | --- | --- | --- | --- |
| P1 Förstagångsklassikern | Alla fyra | 6 | Ny i skidor och simning, Van i övrigt | Simhall och cykel |
| P2 Tidsjägaren | Alla fyra | 10 | Erfaren i allt | Allt |
| P3 Den begränsade | Alla fyra | 3 | Van i allt | Bara cykel |
| P4 Kort tid | Bara Vasaloppet, 6 veckor efter start | 6 | Ny i skidor | Ingen |
| P5 Lopp tätt | Vätternrundan och Vansbrosimningen, 2 veckor isär | 8 | Van i båda | Cykel och simhall |

**Invarianter** (gäller för P1–P5 och ska testas för varje vecka)

- Veckans totala tid överskrider aldrig fasens tid enligt R-05–R-07
- Minst en vilodag per vecka (R-11)
- Aldrig pass i zon 3–4 två dagar i rad (R-16)
- Löptiden ökar högst 10 % mellan veckor, utom efter avlastning (R-14)
- Inga pass före startdatum eller efter sista loppet, och loppdagen innehåller bara loppet (R-01, R-04)
- Inget pass kräver utrustning som användaren saknar (R-17–R-20)
- Varje pass i öppet vatten har säkerhetstexten (R-19)
- Samma indata ger samma plan (determinism)

**Särskilda testfall**

- P4 ger varningen i R-22, P3 varningen i R-23 och P4 varningen i R-24
- P5 följer blocklogiken i R-03
- Datum: ISO-vecka 53 och årsskiftet 2026–2027, sommartid 28 mars 2027, skottår behövs inte i v1.0
- Förklaringar: varje kombination av fas och lopp har en text, ingen text överskrider sin längdgräns, och ingen plan saknar förklaring
- Konfiguration: alla filer i `config/` validerar mot sina scheman

**Definition of done per uppgift**

- Uppgiftens kriterier i backlogen är uppfyllda
- Tester finns för ny logik, och alla tester, lint och typkontroll är gröna
- Commit med uppgiftens id och en kort sammanfattning till Isabelle

**Definition of done för v1.0**

- [ ] Alla Måste-krav är klara och testade
- [ ] Appen är live på Vercel och fungerar i Safari på iOS och Chrome på Android
- [ ] Isabelle har granskat P1–P5 som text (via `scripts/print-profiles.ts`) och godkänt planerna
- [ ] Varje kombination av fas och lopp har en granskad förklaring
- [ ] README beskriver idé, hur man kör projektet och var kravspecen finns

## 10. Backlog i ordning

Uppgifterna görs i den här ordningen. Motorn byggs och granskas först, eftersom allt annat vilar på den. Totalt cirka 25 timmar, varav Bra att ha-uppgifterna (T-15, T-16) stryks först om tiden inte räcker.

| ID | Uppgift | Klart när | Krav | Tid | Milstolpe |
| --- | --- | --- | --- | --- | --- |
| T-01 | Projektuppsättning: Next.js, TypeScript strikt, Tailwind, Vitest, lint, mappstruktur, CLAUDE.md och en tom sida på Vercel | Tom sida är live; `npm test` och lint körs i repot | – | 1,5 h |  |
| T-02 | Datamodell och konfiguration: typer, Zod-scheman och filerna i `config/` | Typer kompilerar; konfigurationen validerar i ett test | Avsnitt 5, 7 | 1,5 h |  |
| T-03 | Veckor och faser, inklusive blocklogik | Tester för R-01–R-04 gröna; P4 och P5 ger rätt faser | R-01–R-04 | 2 h |  |
| T-04 | Veckotid och fördelning mellan sporter | Tester för R-05–R-10 gröna | R-05–R-10 | 2 h |  |
| T-05 | Pass per vecka: dagar, långpass, intensitet och vila | Tester för R-11–R-16 gröna | R-11–R-16 | 3 h |  |
| T-06 | Ersättningar, teknik och säsong | Tester för R-17–R-21 gröna | R-17–R-21 | 1,5 h |  |
| T-07 | Varningar och säkerhetstexter i planen | Tester för R-22–R-24 och öppet vatten gröna | R-22–R-24, K-11 | 1 h |  |
| T-08 | Invarianttester, datumtester och `scripts/print-profiles.ts` | Alla invarianter gröna för P1–P5; skriptet skriver ut planerna som läsbar text | Avsnitt 9 | 1,5 h | **M1 Motorn klar** – Isabelle granskar P1–P5 |
| T-09 | Formulär i tre steg | Acceptanskriterierna för K-02–K-04 uppfyllda | K-02–K-04 | 2 h |  |
| T-10 | Planvy: översikt och veckovy | Acceptanskriterierna för K-05–K-09 uppfyllda | K-05–K-09 | 2,5 h |  |
| T-11 | Spara i webbläsaren | Acceptanskriteriet för K-10 uppfyllt | K-10 | 0,5 h | **M2 Appen live utan AI** – Isabelle testar i mobilen |
| T-12 | Förklaringar: skriv de 16 texterna med AI, Isabelle granskar, lägg dem i `config/explanations.json` med schema och tester | Acceptanskriterierna för K-08 och A-01–A-08 uppfyllda; alla 16 texter granskade | A-01–A-08 | 2 h + Isabelles granskningstid |  |
| T-13 | Startsida och fasta texter | Acceptanskriterierna för K-01 och K-11 uppfyllda; texterna ordagrant enligt avsnitt 8 | K-01, K-11 | 1 h |  |
| T-14 | Genomgång i mobil och av tillgänglighet | K-12 uppfyllt; kraven för tillgänglighet i avsnitt 8 kontrollerade | K-12 | 1 h |  |
| T-15 | Ändra svar (Bra att ha) | Acceptanskriteriet för K-13 uppfyllt | K-13 | 0,5 h |  |
| T-16 | Utskrift (Bra att ha) | Acceptanskriteriet för K-14 uppfyllt | K-14 | 0,5 h |  |
| T-17 | README och förberedelse för demon | Definition of done för v1.0 uppfylld | Avsnitt 9 | 1 h | **M3 Klar för demo** |

Tiderna avser Isabelles tid med Claude Code och har en osäkerhet på ungefär ±30 %.

## 11. Tidsplan och demo

Demon är den 19 november 2026. Kapaciteten fram dit är cirka 20–27 timmar och backlogen cirka 25 timmar, så det finns ingen buffert: Bra att ha-uppgifterna stryks först, och om M1 inte är klar den 8 november är det en signal att stryka mer.

&#91;embedded content: tidsplan · 5 arbetsblock och 3 milstolpar fram till demon\]

Regelmotorn är klar och granskad efter första arbetsveckan; därefter byggs gränssnittet och sist AI-lagret, så att en fungerande app finns redan vid M2.

**Om tiden inte räcker** (i den här ordningen)

1. Stryk T-16 Utskrift och T-15 Ändra svar
2. Förenkla översikten (K-06) till en lista utan fasförklaringar i varje rad
3. Minska textbiblioteket: skriv en förklaring per fas i stället för en per fas och lopp, så att granskningen blir fyra texter i stället för sexton

**Demomanus** (justeras efter fråga 6)

1. Visa startsidan i mobilen och berätta problemet: fyra lopp, fyra sporter, ett år
2. Fyll i profil P1 live – under en minut
3. Visa översikten med faser och lopp, och öppna en vecka
4. Visa en fasförklaring och en säkerhetstext, och berätta att förklaringarna är skrivna med AI och granskade i förväg
5. Visa kort i koden att regelmotorn är fristående och testad
6. Avsluta med vägen framåt (avsnitt 12)

**Reserv för demon.** Ta skärmdumpar av P1 i förväg. Appen gör inga nätverksanrop när planen skapas, så den fungerar även utan uppkoppling.

## 12. Utanför v1.0: framtida versioner

Allt som inte står i den här fliken väntar till efter kursen eller tills det finns tid. Det fullständiga underlaget – med granskningar från tränare, fysioterapeut, dataarkitekt, UX, AI, juridik och test – finns i fliken Fullständig kravspec – framtida versioner. Claude Code bygger ingenting därifrån utan att Isabelle uttryckligen ber om det.

Troliga nästa steg efter betan, i föreslagen ordning:

1. Kalenderexport och delbar länk, så att planen går att följa i vardagen
2. Strukturerad hälsoscreening i webbläsaren, smärtknappen och fler säkerhetsregler
3. Databas med pseudonymiserad lagring, radering och integritetspolicy
4. AI-förklaringar i körtid, skrivna för den enskilda planen, med reservtexter när anropet misslyckas
5. Fritext tolkad av AI, med samtycke
6. Zonkalibrering, full belastningsmodell, styrkedel och delklassiker
7. Konton, loggning av pass och adaptiv plan

Grunden i v1.0 är byggd för det här: motorn är fristående, reglerna ligger i konfiguration och planen har `schemaVersion`, `rulesVersion` och stabila id:n på passen.

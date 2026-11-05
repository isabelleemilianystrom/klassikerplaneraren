# Hemuppgift 2 — implementation och kodgranskning

**Projekt:** Klassikerplaneraren — en app som genererar ett träningsprogram vecka för vecka
för En svensk klassiker (Vasaloppet 90 km skidor, Vätternrundan 315 km cykel,
Vansbrosimningen 3 km simning, Lidingöloppet 30 km terränglöpning).

**Period:** 29 oktober – 5 november 2026 · **27 commits**

**Läget efter:** 481 tester, lint, typkontroll och bygge gröna. 49 träningsregler, 4 164 rader
i regelmotorn.

---

## Del A — implementation med plan

### Vad agenten identifierade

Jag bad om en analys utan lösningar. Den levererades som
[`docs/kodanalys-2026-11-03.md`](kodanalys-2026-11-03.md) och grupperade fynden i tre
kategorier. De tyngsta:

**Läsbarhet och struktur**

- `src/engine/sessions.ts` var **1 774 rader** och bar 26 av dåvarande 44 regler. Sex regler
  (R-08, R-10, R-14, R-25, R-29, R-31) bodde i både den och `budget.ts`.
- Parameterlistorna hade blivit funktionernas gränssnitt mot hela planen: `longSession` tog
  **tio** parametrar, `foldAwayTooSmallSports` åtta, `capRunVolume` åtta. Varje ny regel la
  till en.
- `allowedOn` höll fyra orelaterade regler i rad (R-14, R-16, R-42, R-43) med olika form.
- Språkkonventionen i CLAUDE.md säger engelska för kod och kommentarer. Funktionsnamnen är
  engelska, men **96 lokala variabler och i praktiken alla kommentarer är svenska**.

**Duplicerad logik**

- **Öppningspasset har ingen markör.** "Är det här ett öppningspass?" härleddes om på fyra
  ställen med tre olika regler, och två av dem sa emot varandra: `sessions.ts:246` kräver ett
  pass dagen före ett lopp i samma gren, medan `budget.ts:218` alltid lägger på 25 minuter.
- **R-31:s nybörjartak upprätthölls i fyra lager**, som var och ett räknade om "taket minus det
  som redan är använt". Ett av dem kände inte till långpassets minuter — det var den konkreta
  buggen bakom ett simpass på 84 minuter mot ett tak på 80.
- **R-29 "inga minuter försvinner" i fem lager**, ingen med kännedom om de andra.
- Zod validerar konfigurationen, men `PlanInput` och `FormState` — det som faktiskt sparas i
  webbläsaren och alltså kan vara trasigt — validerades av handskrivna typvakter.

**Teknisk skuld**

- **Den slumpade egenskapstestningen som kravspecen krävde sedan 27 oktober fanns inte.**
  Avsnitt 9 och T-08 kräver "minst 200 slumpade men giltiga indata mot samtliga invarianter",
  med skälet utskrivet: *"Fem profiler räcker inte."* Alla 429 tester kördes mot sex fasta
  profiler.
- **Tyst reservutgång i dagplaceringen:** `bestDateFor` föll tillbaka på vilken dag som helst
  när inget villkor gick att uppfylla, utan att signalera.
- **`R-16` var död kod** — borttagen ur `allowedOn` var alla 429 tester gröna, eftersom R-43
  täcker den helt. Samma mönster för R-22 och R-24, som hade text och konfiguration men ingen
  kod.
- **`schemaVersion` som literal på elva ställen** utan något som band dem samman — exakt det
  v0-fel projektet vaktar mot.
- **Backloggen var inte en tillförlitlig bild av vad som fanns:** T-07 var markerad klar med
  acceptanskriteriet "tester för R-22–R-24 gröna", men R-22 och R-24 var aldrig byggda.

### Planen, och hur den ändrades

Jag bad om en implementationsplan med explicit *"Implementera ingenting. Jag vill se planen
först."* Planen kom i fyra delar — påverkade filer, ändringsbeskrivning, sekventiell ordning,
riskfaktorer — och jag ändrade omfånget innan jag godkände den:

| Agenten föreslog | Mitt beslut |
| --- | --- |
| Alla femton fynd i etapper | **Bara de tre dyraste.** Resten är en egen omgång |
| Oklart när arbetet skulle göras | **Städning före demon, motorarbete efter.** Jag har en fungerande app och fjorton dagar |
| Lät R-23:s varning ligga kvar | **Stryk den.** Golvet på sex timmar ersätter den, och en varning om att golvet är "i minsta laget" motsäger golvet |

Ordningen i planen var inte förhandlingsbar och det var rätt: **slumptestningen måste komma
först**, eftersom den är det enda nät som kan fånga vad de två andra ändringarna råkar förstöra.

### Vad agenten ville göra som jag stoppade

**1. Bygga R-22 och R-24 "nu, före demon".** Jag godkände det. Agenten började, mätte vad det
faktiskt skulle ge, och kom tillbaka med att båda är **dubbletter** av varningar som redan
finns: R-22 går av under 8 veckor och R-35 under 10, så R-35 går alltid av först med en längre
text; R-24 säger nästan ordagrant samma sak som R-21:s kursråd. Den visade utskriften för P4,
där båda paren stod efter varandra. **Bara R-26 saknades på riktigt** och byggdes. Det var rätt
att inte bygga dubbletterna — men jag noterar att det var agenten själv som upptäckte det efter
att jag sagt ja.

**2. Hosting och Vercel-konto.** Skjutet till efter demon. Demon körs lokalt med `npm run dev`.

**3. Målet "fylla i formuläret på under en minut".** Struket — det pressar mot färre frågor, och
jag vill hellre ha rätt frågor.

**4. "Stavgång i backe — i stället för längdskidor".** Bor man i Skåne *är* stavgång i backe hur
man tränar för Vasaloppet. Formuleringen ändrades och principen skrevs in i R-17.

**5. Jag pausade arbetet mitt i** en refaktorering. Inget var halvgjort — agenten hade tagit en
baslinje och inget mer, och rapporterade läget tillräckligt tydligt att jag kunde säga
"fortsätt" dagen efter.

**6. Där jag överröstade agentens rekommendation, och fick fel.** Agenten rekommenderade en egen
fråga om snötillgång. Jag valde i stället att härleda snö ur månaden. Den implementerade mitt
val, mätte följden och rapporterade att **profil P1 nu fick 43 timmar längdskidor utan
alternativ** — alltså precis det Skåne-fall jag själv hade beskrivit sex dagar tidigare. Jag
ändrade mig och bad om frågan tillbaka. Att den implementerade mitt beslut men mätte och
rapporterade konsekvensen var rätt hantering.

### Vad agenten missade

Det här är den intressantaste delen, och listan är lång.

**Fel den själv införde och hittade först när jag frågade:**

- **Långpasset trappades inte upp.** Agentens egen ändring den 29 oktober la ett golv på
  veckans snitt under tillväxtkurvan, vilket gjorde kurvan platt i fyra veckor och sedan
  hoppade **63 %** (75 → 122 minuter). Hittades först den 4 november när jag frågade om
  upptrappning.
- **Kvalitetspasset flyttade till en annan gren.** Agentens lösning på en annan lucka gjorde att
  intervallpasset hamnade på cykel i en vecka som var loppspecifik mot Lidingöloppet. Jag fick
  säga att det ska ligga i fokusgrenen.
- **`initialState` behöll de gamla utrustningsflaggorna** efter att datamodellen bytte form.
  Tre nycklar var döda och tre nya saknades. Hittades först i säkerhetsgranskningen dagen efter.
- **Profilutskriften visade budgeten, inte passen.** 84 % av cellerna i P1 stämde inte med
  veckorna längre ner i samma fil, och 35 celler visade tid för en gren utan pass. Det är
  granskningsytan jag läser planerna ur.
- **R-16 blev död kod** när agenten skrev R-43, utan att det noterades.

**Att slumptestningen aldrig byggdes** är det tyngsta. Den stod i kravspecen från 27 oktober med
skälet utskrivet. När den väl byggdes den 4 november hittade den **sex brutna invarianter på
200 planer** medan 462 tester var gröna. Det bästa fyndet:

> Alla sex referensprofiler startar på en **måndag**. Startar man en fredag börjar vecka 1 ändå
> på måndagen före — så planen visade träning på dagar som redan passerat. **172 av 200
> slumpade planer**, i snitt 2,9 pass i det förflutna.

**Att fixen tog tre försök** hör också hit. Första försöket med en avkortad första vecka gav
fyra nya invariantbrott och **krascher i 18 av 200 planer**. Andra försöket — börja på nästa
måndag — tappade ett lopp som låg mellan startdatumet och måndagen. Tredje höll. Agenten
rapporterade varje misslyckande i stället för att bara visa resultatet, och de två förkastade
vägarna står nu i kravspecen så att ingen prövar dem igen.

**Ett test hade varit stillastående i en vecka.** `"ger en plan för varje timtal mellan 3 och
15"` stod kvar efter att R-41 höjde golvet till sex. Det passerade bara för att ingenting
upprätthöll golvet — det syntes först när skyddsräcket kom på plats.

### Är projektet körbart?

Ja.

```
npm run check      481 tester, lint och typkontroll gröna
npm run build      ✓ Compiled successfully
npm run dev        kör lokalt på localhost:3000
npm run profiles   skriver alla sex referensplanerna som läsbar text
npm run invariants 34 invarianter mot 200 slumpade indata
```

Verifieringen efter varje steg gick via tre lager:

1. **`npm test`** efter varje ändring — och aldrig en commit med röda tester.
2. **`npm run profiles` + md5-jämförelse** mot en baslinje. För de två refaktoreringarna var
   kravet **bitidentisk utdata**, och det kontrollerades efter varje av de sex stegen när
   `sessions.ts` delades upp.
3. **Muteringsprov.** Varje ny regel prövades genom att medvetet gå sönder den och se att tester
   faller. Tre gånger överlevde en mutering, och varje gång avslöjade det att testet inte prövade
   det det sa — en gång var det ett vakt som var omöjligt att nå, vilket dokumenterades i stället.

---

## Del B — tre granskningar

Varje perspektiv kördes som en egen prompt, med uppföljande mätningar inom samma område.

### Prompt 1 — arkitektur mot CLAUDE.md

Fem av nio principer håller rent:

| Princip | Läge |
| --- | --- |
| **1. Motorn är ren** | ✅ Inga `Date.now()`, `localStorage`, `fetch` eller Next-anrop i `src/engine/`. Determinism testad på tre nivåer |
| **2. AI:n ändrar aldrig planen** | ✅ Inget AI-beroende; **två** tester underkänner varje paket med "anthropic" i namnet. Texterna läses bara av vyn |
| **4. Planen är serialiserbar** | ✅ Rena JSON-värden. `Map`/`Set` finns bara som interna arbetsstrukturer |
| **5. All lagring via en modul** | ✅ `localStorage` på exakt ett ställe |
| **7. Inga globala variabler** | ✅ Noll `let` på modulnivå, ingen cachning, inget delat tillstånd |

Tre brister:

- **Princip 8 (funktioner gör en sak)** — svagast. 1 774 rader i `sessions.ts`, fem funktioner
  över 90 rader, nio med sex eller fler parametrar.
- **Princip 3 (siffror i config)** — tre läckor, alla träningstal: `zone >= 3` som definition av
  "hårt pass" hårdkodat på **tre** ställen, `zone: 4`/`zone: 3` för intervall och tröskel, och
  `weekdayOf(datum) >= 6` som definition av helgen — samtidigt som `allowedWeekdays: [6,7]` står
  i konfigurationen.
- **Princip 9 (inga `any`)** — bokstavligen uppfylld, noll `any`. Men `substitutedAs?: string`
  är en lös sträng där värdena är en sluten mängd, och ~51 `as`-casts är samma nödutgång.

**Åtgärdat och committat:** princip 8:s två värsta fall.

- [`271333e`](.) `sessions.ts` delad i sex moduler efter ansvar: **1 774 → 333 rader**, med
  bitidentisk utdata verifierad efter varje steg.
- [`7bad2b9`](.) `longSession`: **10 → 2 parametrar**, 117 → 47 rader. Två konkreta fynd inuti:
  `grenensTid` hade ett namn som ljög (den var hela veckans tid), och den visade sig vara **död
  kod** — termen kunde aldrig bli minimum. Att utdatan är identisk bevisar det.

### Prompt 2 — säkerhet

Tre av fem kategorier är tomma, och det är en följd av arkitekturen snarare än tur: appen är
statisk utan server, databas, konton eller nätanrop.

| Kategori | Fynd |
| --- | --- |
| Hårdkodade hemligheter | **Inga.** Noll `process.env`, inga env-filer någonsin committade, inga nyckelmönster i historiken |
| Injektion (SQL, kommando, path traversal) | **Inga.** Inget `child_process`, ingen databas, inget `dangerouslySetInnerHTML`/`eval`. `out/${namn}.txt` byggs ur hårdkodade profilnamn |
| Känsliga data i loggar | **Inga i appen.** Noll `console.*` i `src/`. Inget lämnar webbläsaren |
| **Saknad inputvalidering** | **Åtta fynd**, ett allvarligt |
| **Osäkra standardvärden** | **Ett fynd** |

Det allvarligaste, **S-1**: datumfälten saknade `min` och `max`, och valideringen kontrollerade
bara ISO-form. En felskrivning — **`2927` i stället för `2027`** — gav motorn **46 978 veckor**
att bygga och **låste webbläsarfliken**. Hängningen är synkron, så inget `catch` hinner emellan.

Övriga: timmar valideras bara som `Number.isFinite` (en handskriven `hoursPerWeek: 1000000`
hängde också), lopp-id bara som sträng, nivåvärden inte alls, inget tak på antalet lopp,
`isFormState` lösare än `isPlanInput` på samma data, och `initialState` som listade de gamla
utrustningsflaggorna.

**Åtgärdat och committat:** samtliga åtta.

- [`01acec4`](.) **S-1 och S-2** — tak på planens längd (`weekTime.maxPlanWeeks: 104`, mot den
  längsta riktiga planens 47 veckor) upprätthållet i tre lager: formuläret visar det sista
  tillåtna datumet, lagringen kastar, motorn vägrar bygga. Alla tre vägrar på **noll
  millisekunder** i stället för att hänga.
- [`aae4062`](.) **S-3 till S-6, S-8 och S-9** — lagringen validerar nu *innehåll* och inte bara
  typ: okänt lopp-id, dubbletter, ogiltiga nivåer, ogiltiga datum och timmar utanför intervallet
  kastas vid inläsning. Standardvärdena härleds ur frågorna i formuläret, och fyra tester
  hindrar dem från att glida isär igen — det var drift som orsakade S-9.

**Inte åtgärdat:** säkerhetsheaders i `next.config.ts` (ingen CSP). De har driftkonsekvenser och
väntar på värdvalet efter demon. Exponeringen är liten: inga hemligheter, inget
tredjepartsinnehåll, inga externa källor.

### Prompt 3 — kodkvalitet

De fem allvarligaste, rangordnade:

1. **`longSession`** — tio parametrar, fem jobb, och två lögner: `grenensTid` som inte var
   grenens tid, och ett `void tillgängligt;` som inte behövdes.
2. **`page.tsx` kastade bort varje fel** — tomt `catch` plus `if (byggd === null) return;`.
   Knappen "Skapa programmet" gjorde **ingenting**, utan meddelande och utan loggning. Det
   gjorde också S-1 och S-3 odiagnosticerbara.
3. **`seasonSharesWithNewBonus`** — oläsbar utan sina kommentarer. Kodbasens högsta
   kommentartäthet (1,71 mot snittet 0,57), tre parallella arrayer hållna i takt med `i`, och
   namn som `utgång` (som är *startvärdet*) och `möjligt` (som är en nämnare).
4. **`foldAwayTooSmallSports`** — sex jobb, och den garanti funktionen finns för upprätthålls på
   fyra ställen med fyra olika uttryck.
5. **`enduranceSessions`** — 121 rader, fem jobb, kodbasens längsta funktion.

Värt att säga: **felhantering mot yttre gränser är genomgående gjord.** `storage.ts` har
try/catch kring varje `localStorage`-anrop och kring `JSON.parse`, och provar att faktiskt
skriva innan den litar på webbläsaren. Att `config.ts` kastar vid trasig konfiguration är ett
dokumenterat val. Den enda luckan var ett `writeFileSync` i ett utvecklingsskript.

**Åtgärdat och committat:** punkt 1 och 2.

- [`7bad2b9`](.) punkt 1 (samma commit som arkitekturfixen).
- [`03b5613`](.) punkt 2 — användaren får ett meddelande med `role="alert"`, och felet loggas med
  `console.error`. **Bara felet, aldrig indatan** — den är användarens svar om sin egen träning
  och hör inte i en konsol. Ett test kontrollerar tonen och underkänner formuleringar som
  "ogiltig" eller "du gjorde".

---

## Kvar på bordet

| | |
| --- | --- |
| **Fyra invariantbrott** | F-2 till F-6 (F-1 löst) står i kravspecens avsnitt 9 med omfattning och orsak. F-3 och F-6 är samma sak: den tysta reservutgången i `bestDateFor` |
| **Öppen fråga 10** | Fullt fokus före Lidingöloppet krockar med löptaket i R-14 — ett beslut om vilken skaderegel som väger tyngst |
| **Tre träningstal i kod** | `zone >= 3`, intervallzonerna, helgdefinitionen |
| **Säkerhetsheaders** | Väntar på värdvalet |
| **Språkkonventionen** | 96 svenska variabler och svenska kommentarer mot CLAUDE.md:s engelska |

---

## Vad jag tar med mig om arbetssättet

**Planeringsläget var värt mer än implementationen.** Den plan jag fick var inte den jag
godkände — jag strök två tredjedelar av omfånget och styrde om tidpunkten. Hade agenten kört
fritt hade den gjort allt, i fel ordning, fjorton dagar före en demo.

**Agenten är bäst på att mäta och sämst på att minnas sina egna beslut.** Varje gång jag bad om
en mätning — hur många veckor, hur många profiler, hur stor ökning — kom ett tal jag kunde lita
på. Men fyra av de fem allvarligaste felen var sådana den själv hade infört några dagar
tidigare och inte kom ihåg.

**Det som faktiskt fångade felen var inte granskningarna utan slumptestningen.** Tre
granskningar hittade struktur och risker. 200 slumpade planer hittade sex brutna invarianter som
462 tester hade missat — däribland att varje profil råkade börja på en måndag.

**Att kräva bitidentisk utdata gjorde refaktoreringarna ofarliga.** Två omfattande ändringar i
motorn, noll beteendeförändring, bevisat med md5-summor efter varje steg. Det var också så den
döda koden i `longSession` bevisades vara död.

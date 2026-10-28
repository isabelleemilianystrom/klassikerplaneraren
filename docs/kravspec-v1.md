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

**En klassiker kan börja när som helst på året** (tillagd 2026-10-28). Det enda kravet är att alla fyra loppen genomförs inom tolv månader (R-26). Appen antar därför aldrig att loppen kommer i en bestämd ordning: den som börjar på våren tar Vätternrundan, Vansbrosimningen och Lidingöloppet samma år och Vasaloppet våren därpå, och då är Vasaloppet planens sista lopp i stället för dess första. Planen styrs av loppens datum, aldrig av vilken ordning de råkar stå i.

**Mål**

| Mål | Så vet vi att det är uppfyllt |
| --- | --- |
| Klar för demon 19 nov | Appen går att köra lokalt och fungerar i mobilen *(ändrad 2026-10-28)* |
| Programmen är rimliga | Alla regler i avsnitt 5 följs och verifieras av tester; referensprofilerna P1–P6 ger planer som Isabelle godkänner |
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

- [x] **1. Loppdatum 2027.** Besvarad 2026-10-27: använd de belagda datumen — Vasaloppet **2027-03-07**, Vätternrundan **2027-06-18**, Vansbrosimningen **2027-07-10**, Lidingöloppet **2027-09-25**. Kontrollerade mot arrangörernas sidor i oktober 2026; `config/races.json` ska bära källa och kontrolldatum. *(Utökad 2026-10-28: datumen ligger nu i en lista per lopp, se avsnitt 7.)*
- [x] **2. Distanser.** Besvarad 2026-10-27: **bara de fyra fulla distanserna** i v1.0, enligt lopptabellen i avsnitt 5. Användaren väljer vilka av de fyra hon gör. Öppet Spår, Halvvättern och övriga varianter ligger utanför v1.0 — motorn byggs så att fler lopp bara blir rader i `config/races.json`.
- [x] **3. AI-modell och nyckel.** Besvarad 2026-10-27: **inga AI-anrop i körtid.** Förklaringarna förgenereras under utvecklingen med hjälp av AI, granskas av Isabelle och sparas i appen. Ingen API-nyckel, ingen kostnad, inget missbruksskydd och inga data som lämnar webbläsaren. Ett riktigt AI-anrop kan läggas till i en senare version. Se noten nedan om vad det innebär för avsnitt 6, 7 och T-12.
- [x] **4. Konton.** Besvarad 2026-10-27: GitHub-repot finns och är publikt. **Vercel-konto saknas ännu.** *(Uppdaterat 2026-10-28: drift väntar till efter demon.)* Demon körs lokalt med `npm run dev`, så inget konto behövs före den 19 november. Appen är helt statisk — inga serveranrop, ingen databas, inga AI-anrop i körtid — så den kan läggas på Vercel eller GitHub Pages när som helst efteråt utan att något i koden ändras.
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
| K-04 | Steg 3: timmar per vecka (3–15, heltal), vilken dag långpasset ska ligga på, vilken dag som är vilodag, och utrustning: snö eller rullskidor, stakmaskin, simhall, landsvägscykel eller trainer (ja/nej för varje) | Måste | Alla fält har standardvärden (6 timmar, söndag långpass, måndag vila, nej på utrustning); värden utanför 3–15 kan inte väljas; samma dag för långpass och vila ger ett felmeddelande vid fältet och jag kommer inte vidare |
| K-05 | Generering: regelmotorn skapar planen direkt, med förklaringarna på plats från början | Måste | Planen med sina förklaringar visas inom 2 s efter att jag skickat formuläret, utan att något laddas i efterhand |
| K-06 | Översikt: alla veckor från start till sista lopp med veckonummer, datumintervall, fas, total tid och markering av loppveckor | Måste | Antalet veckor stämmer med perioden; varje loppvecka är markerad med loppets namn |
| K-07 | Veckovy: sju dagar med pass; varje pass visar sport, typ, minuter, intensitet i vardagsspråk och zon samt en kort instruktion; vilodagar visas som vila | Måste | Varje dag i veckan visas; intensitet visas som t.ex. "Lugnt – du ska kunna prata hela meningar (zon 2)" |
| K-08 | Förklaring per fas: varje sammanhängande fas har en kort förklaring, och planen har en kort sammanfattning överst | Måste | Varje fas i översikten har en förklaring; texten är högst 300 tecken |
| K-09 | Varningar enligt avsnitt 5 visas överst i planen; planen skapas ändå | Måste | Givet Vasaloppet om 6 veckor, när planen skapas, så visas varningen om kort förberedelsetid och en plan |
| K-10 | Den senaste planen sparas i webbläsaren och visas vid återbesök, med knappen "Gör en ny plan". Formuläret står aldrig tomt bredvid en sparad plan *(förtydligad 2026-10-27)* | Måste | Efter omladdning visas samma plan; fungerar inte lagringen visas planen ändå utan fel; en ändring i formuläret kan aldrig radera planen oavsiktligt |
| K-11 | Säkerhetstexter från avsnitt 8: ansvarsfriskrivning, röda flaggor, smärtregel och sjukdomsregel i planen; säkerhetstext på varje pass i öppet vatten | Måste | Varje pass i öppet vatten har säkerhetstexten; övriga texter syns i planen |
| K-12 | Fungerar i mobil från 360 px bredd | Måste | Ingen vågrät scroll och alla knappar går att trycka på vid 360 px |
| K-13 | Ändra svar: tillbaka till formuläret med tidigare svar ifyllda | **Måste** *(höjd från Bra att ha 2026-10-27)* | Givet en sparad plan, när jag trycker "Ändra svar", så är formuläret ifyllt med mina svar |
| K-14 | Utskrift: planen går att skriva ut snyggt via webbläsarens utskrift | Bra att ha | Utskriften visar översikt och alla veckor utan knappar och menyer |
| K-15 | Sparad plan valideras vid inläsning. Går den inte att använda kastas den, lagringen rensas och användaren får veta varför. Formuläret ritas alltid, även om planen är trasig | Måste *(tillagd 2026-10-27)* | Givet en sparad plan från en äldre version, när jag öppnar appen, så ser jag formuläret och ett meddelande om att den gamla planen inte kunde läsas — aldrig en tom sida |
| K-16 | Innevarande vecka är markerad i översikten, och vyn visar den när jag kommer tillbaka | Måste *(tillagd 2026-10-27)* | Givet en sparad plan där några veckor passerat, när jag öppnar appen, så är veckan jag är i markerad och syns utan att jag letar |
| K-17 | Är alla veckor passerade visas ett avslut i stället för en tom lista | Bra att ha *(tillagd 2026-10-27)* | Givet att sista loppet varit, när jag öppnar planen, så står det att programmet är genomfört och hur jag planerar om |

## 5. Träningsregler för regelmotorn

Reglerna nedan är förslag som granskas enligt fråga 5. Claude Code implementerar exakt dessa, lägger alla siffror i `config/rules.json` och frågar om ett fall inte täcks. Varje regel har ett id som testerna hänvisar till.

**Lopp** (`config/races.json`)

| Lopp | Sport | Distans | Uppskattad tid | Nedtrappning | Återhämtning efter | Specifik fas | Volymriktmärke |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Vasaloppet | Längdskidor | 90 km | 7 h | 2 veckor | 2 veckor | 8 veckor | – |
| Vätternrundan | Cykel | 315 km | 11 h | 2 veckor | 2 veckor | 8 veckor | 1000 km |
| Vansbrosimningen | Simning | 3 km | 1,25 h | 1 vecka | 1 vecka | 6 veckor | – |
| Lidingöloppet | Löpning | 30 km | 3,5 h | 1 vecka | 1 vecka | 8 veckor | – |

**Uppskattad tid** (tillagd 2026-10-27) är hur länge en motionär är ute i loppet. Siffran är grov men storleksordningen avgör: loppet är veckans största belastning och måste räknas som träning. Se R-25.

**Återhämtning efter** (ändrad 2026-10-27): Vansbrosimningen stod tidigare som "Ingen", vilket motsade R-02. Lopp som tar fem timmar eller mer kräver två veckor, kortare lopp en.

**Datum** (ändrad 2026-10-28). Varje lopp bär en **lista** med datum i `dates`, i kronologisk ordning och utan dubbletter, inte ett enda datum. Skälet är att en klassiker kan börja när som helst på året: den som startar i maj 2027 har redan missat Vasaloppet i mars och behöver mars 2028.

Formuläret förifyller det första datumet i listan som ligger på eller efter startdatumet (`nextRaceDate` i `src/engine/config.ts`). Finns inget sådant datum lämnas fältet **tomt** med en hänvisning till arrangörens sida, så att användaren kan skriva in det själv. Ett datum som redan har varit får aldrig förifyllas, eftersom K-02 underkänner loppdatum före startdatumet — användaren ska inte mötas av ett felmeddelande på ett värde hon inte har skrivit.

Listan innehåller bara datum som är kontrollerade mot arrangörens sida. I oktober 2026 har inget av de fyra arrangörerna publicerat sina 2028-datum, så listorna bär bara 2027. Att lägga till ett år är en ändring i `config/races.json` och kräver ingen kodändring.

**Nivåer** (visas i steg 2)

| Nivå | Beskrivning för användaren |
| --- | --- |
| Ny | Jag har knappt provat sporten eller kan inte tekniken, t.ex. simmar inte crawl |
| Van | Jag tränar sporten ibland och klarar en lugn timme |
| Erfaren | Jag tränar sporten regelbundet och har gjort lopp förut |

**Struktur och faser**

- **R-01** Planen går från måndagen i startdatumets vecka till söndagen i veckan med sista loppet. Veckor börjar på måndag.
- **R-02** Varje vecka får en fas utifrån närmaste kommande lopp: Återhämtning (veckorna direkt efter ett lopp), Nedtrappning (sista veckorna före loppet), Specifik (veckorna före nedtrappningen) och Bas (övrig tid). Ordningen gäller i den prioriteten.
- **R-03** *(ändrad 2026-10-28)* Ligger två lopp mindre än fyra veckor isär får det andra
  loppet en veckas nedtrappning i stället för sin vanliga, så att nedtrappningen inte kräver
  veckor som redan är återhämtning.

  **Återhämtningen efter det första loppet behålls.** Den kortas bara så mycket som krävs för
  att inte sträcka sig in i nästa loppvecka. Tidigare ströks den helt, vilket innebar att den
  som gör hela klassikern inte fick någon vila efter 315 kilometer på cykel — och det gällde
  normalfallet, eftersom Vätternrundan och Vansbrosimningen ligger tre veckor isär med de
  riktiga datumen.

  Följden är att **Vansbrosimningen inte får någon egen specifik fas** när den följer nära på
  Vätternrundan. Det är ett medvetet val: loppet är tre kilometer och en motionär simmar det
  på en till en och en halv timme, alltså görbart med tekniken i ryggen. Simningen byggs upp
  under årets bas- och specifikveckor, och hålls uppe med teknikpass under återhämtningen
  (R-33). Kroppen behöver vilan efter Vätternrundan mer än den behöver ytterligare simvolym.
- **R-27** (tillagd 2026-10-27) Flera lopp samma vecka: alla lopp som infaller samma vecka hör till den veckan. Veckan är nedtrappning för det första av dem, men varje lopp markeras, räknas som belastning enligt R-25 och får sin säkerhetstext. Inget lopp får försvinna ur planen för att ett annat ligger samma vecka.
- **R-04** Loppdagen innehåller bara loppet. Dagen före ett lopp innehåller högst ett kort öppningspass på 20–30 minuter i loppets sport, i zon 1–2, eller vila. *(utökad 2026-10-27)*

**Veckotid** (T = valda timmar per vecka)

- **R-05** Bas 75 % av T; Specifik 100 %; Nedtrappning 60 % första och 40 % andra veckan (50 % om den bara är en vecka); Återhämtning 50 %.
- **R-06** Var fjärde vecka i bas- och specifik fas är en avlastningsvecka med 70 % av fasens tid.
- **R-07** De två första veckorna i planen har högst 60 % av T.
- **R-25** (tillagd 2026-10-27) Loppet räknas som belastning. Loppveckans budget är fasens tid minus loppets uppskattade tid enligt lopptabellen, aldrig mindre än noll. Vasaloppet tar sju timmar, och de ska inte planeras ovanpå en vecka på 60 % av T.
- **R-29** (tillagd 2026-10-27) Minuter som inte får plats fördelas, de försvinner inte. Tar träningsdagarna slut innan veckans tid gjort det förlängs befintliga pass upp till sina tak i stället för att tiden stryks. Går tiden ändå inte att placera ska veckans faktiska tid visas för användaren, inte den planerade.

**Fördelning mellan sporter**

- **R-08** Specifik fas: 55 % till loppets sport, resten fördelat jämnt mellan övriga sporter i planen. *(utökad 2026-10-27)* Innehåller planen bara en sport går 100 % dit. Innehåller den två sporter går 65 % till loppets sport och 35 % till den andra. Andelen får aldrig lämnas ofördelad — profil P4 har bara ett lopp, och 45 % hade annars ingenstans att ta vägen.
- **R-09** Bas: jämn fördelning mellan sporterna i planen, med +10 procentenheter för sporter där nivån är Ny. *(preciserad 2026-10-28)* De tio procentenheterna **tas från de sporter där nivån är Van eller Erfaren** — att kunna cykla hjälper inte den som inte kan simma, så tiden flyttas dit tekniken saknas. Ingen sport får pressas under **halva den jämna andelen**; är nästan alla sporter nya finns det inte tio procentenheter att hämta, och då krymper bonusen till det som går att ta. Golvet är det som gör att andelarna alltid summerar till 100 procent utan att någon sport blir utan tid. Siffrorna ligger i `config/rules.json` som `newLevelBonus` och `minShareOfEvenSplit`.
- **R-31** (tillagd 2026-10-28) **Nybörjartak per sport.** Är nivån Ny i en sport får veckan högst så många minuter och så många pass som `newLevelLimits.bySport` säger. För **simning: 80 minuter och ett pass i veckan** — en nybörjarkurs i simning är en timme i veckan, och ett program som planerar tre simpass för den som knappt kan simma är ett program som inte går att följa, hur rätt det än ser ut i en tabell. Sporter som inte står i konfigurationen har inget tak.

  Loppets tid i sporten och dess öppningspass räknas av från taket. Den som är ny i simning har alltså loppet som veckans simning: inget tröskelpass läggs ovanpå 3 km i Vansbroån.

  Minuterna som taket skär bort går till de sporter som har plats kvar (R-29). Har ingen sport plats blir de kvar som `unplacedMinutes`, och veckans faktiska tid blir då lägre än den valda — det ska visas för användaren, inte gömmas. Det händer bara i planer där varje sport har slagit i sitt tak, till exempel en plan med bara Vansbrosimningen för en nybörjare.
- **R-32** (tillagd 2026-10-28) **Säsongen styr fördelningen mellan grenarna.** Man behöver inte fokusera på alla grenar samtidigt. Vintern är svår att cykla på och är skidornas årstid; sommaren är cykelns. Det är också i de två grenarna de långa passen går att lägga utan att slita ut kroppen, och det är de två längsta loppen — Vasaloppet 90 km och Vätternrundan 315 km — så tid på skidor eller cykel är avgörande. Löpningen hålls nere året om eftersom den sliter betydligt mer.

  Vikterna ligger i `seasonWeights` i `config/rules.json`:

  | Säsong | Månader | Skidor | Cykel | Simning | Löpning |
  | --- | --- | --- | --- | --- | --- |
  | Vinter | nov–mar | 50 % | 15 % | 15 % | 20 % |
  | Mellansäsong | apr, okt | 25 % | 35 % | 20 % | 20 % |
  | Sommar | maj–sep | 10 % | 50 % | 20 % | 20 % |

  Vikterna gäller där tiden delas mellan flera grenar: basfasen och återhämtningen (R-09), och den del av specifik fas som går till de övriga grenarna (R-08). Loppets egen sport får sina 55 eller 65 procent oavsett säsong — ett cykelblock i maj är ett cykelblock.

  Månaden tas från veckans måndag. Innehåller planen inte alla fyra grenarna normeras vikterna till 100 procent över de som finns. Alla tolv månader måste höra till exakt en säsong och vikterna i varje säsong summera till 1; båda kontrolleras av schemat vid start.

  Nybörjarbonusen i R-09 räknas ovanpå säsongens vikt, inte ovanpå en jämn andel. Tiden tas från varje van gren i proportion till hur mycket utrymme den har **över** golvet — annars kan en gren med låg säsongsvikt tryckas under det.

  **Simningens vikt sänks till 10 procent för den som inte är nybörjare**
  *(tillagt 2026-10-28)*, via `experiencedWeightOverride`. Vansbrosimningen är tre kilometer och
  drygt en timme, alltså fem procent av klassikerns samlade lopptid — men fick 15 procent av
  träningstiden. Den som redan kan simma har tiden bättre använd på skidor eller cykel, där de två
  långa loppen avgörs. Nybörjaren behåller sina 20 procent: frekvens och teknik är det som bygger
  simning, inte volym, och R-31:s tak på 80 minuter gäller ändå. Sänks en grens vikt normeras
  andelarna om, så veckan blir inte kortare.

- **R-36** (tillagd 2026-10-28) **Träningen fokuserar på nästa kommande lopp.** När ett lopp är
  avklarat ska dess gren inte längre tränas som huvudgren — tiden går till nästa lopps gren. Är
  Vasaloppet genomfört ligger fokus helt på cykeln inför Vätternrundan.

  **Undantaget är grenens egen säsong.** Är det fortfarande vinter där man bor kan skidor användas
  som långpass för konditionsträning, och grenen behåller då `afterRace.keepShareInOwnSeason` —
  **10 procent**. Utanför sin säsong får den ingenting. Grenens egen säsong är de månader där den
  har sin högsta säsongsvikt i R-32: vinter för skidor, sommar för cykel.

  Den frigjorda tiden går till **veckans fokusgren**, inte ut över alla grenar. Annars hamnade den
  hos löpningen, som har jämn vikt året om — och ett halvår före Lidingöloppet gör den ingen nytta
  där. Fokusgrenen rörs aldrig av regeln, oavsett vad som varit.

  Före regeln gav en plan 33 timmar skidåkning efter Vasaloppet, varav en del i maj och juni.
  Veckorna direkt efter loppet gav 216 minuter skidor mot 65 minuter cykel, trots att Vasaloppet
  var avklarat och Vätternrundan var nästa lopp.

- **R-37** (tillagd 2026-10-28) **Passet är det primära, grenen är ett val.** Träningsupplägget är
  långpass, intervaller och styrka — inte fyra separata sporter. Grenen som står på ett pass är den
  som passar nästa lopp bäst, men flera grenar ger samma konditionsträning, och den som hellre vill
  eller måste byta ska kunna göra det utan att tappa poängen med passet.

  Varje pass av typen `easy`, `long`, `tempo` eller `intervals` bär därför en lista `alternatives`
  med de grenar det också kan göras i. Grenarna som är utbytbara är **längdskidor, cykel och
  löpning**; simning står inte med, eftersom den inte ger samma konditionsträning och dessutom
  kräver simhall.

  Ett alternativ måste vara möjligt att faktiskt genomföra:

  - **i säsong** — längdskidor erbjuds bara november till mars. Att föreslå skidor i juli gör
    planen otrovärdig.
  - **med utrustning användaren har** — minst en av grenens flaggor räcker. Skidor går med snö
    eller rullskidor, men också med en stakmaskin.

  **Loppet, vilan, styrkan och teknikpassen har inga alternativ.** Ett teknikpass i simning kan
  inte bytas mot cykel — då är det inte längre samma pass.

  Exempel ur en färdig plan:

  | Pass | Gren | Kan också göras som |
  | --- | --- | --- |
  | Långpass i mars, mot Vätternrundan | Cykel | Längdskidor *(om det finns snö)*, Löpning |
  | Långpass i april, mot Vätternrundan | Cykel | Löpning |
  | Långpass i augusti, mot Lidingöloppet | Löpning | Cykel *(sliter mindre på kroppen)* |

  Reglerna ligger i `sessionAlternatives` i `config/rules.json`. **Gränssnittet ska leda med
  passtypen**, inte med grenen: raden är ett långpass, och grenen är hur man väljer att göra det.

- **R-33** (tillagd 2026-10-28) **Teknikpass under återhämtningen.** Pass i en teknikgren blir
  teknikpass i stället för vanliga pass under återhämtningsveckorna. Grenarna står i
  `recovery.techniqueSports` i `config/rules.json` och är simning och längdskidor.

  Kroppen ska få vila efter ett långt lopp, men tekniken tappas fort — särskilt i simning, där
  det inte hjälper att ha cyklat. Ett teknikpass håller den uppe utan att belasta: kort, lugnt
  och med fokus på rörelsen i stället för på tiden. Det är därför veckan efter Vätternrundan
  innehåller ett simteknikpass fast den i övrigt är vila.

- **R-34** (tillagd 2026-10-28) **Volymriktmärke per lopp.** Ett lopp kan ha ett riktmärke för
  hur många kilometer man bör ha samlat i loppets gren före loppet — **summan av alla pass**,
  inte ett enskilt långpass. Talet ligger i `volumeMilestoneKm` i `config/races.json`.

  **Vätternrundan: 1000 km.** Det är det riktmärke som brukar nämnas. De övriga tre loppen har
  inget tal: de lämnas tomma hellre än gissade, och ger då ingen kontroll. Att lägga till ett
  tal senare är en rad i konfigurationen.

  Tid räknas om till kilometer med grenens träningsfart i `trainingSpeedKmh`, som för cykel är
  **25 km/h**. Farten är lägre än Vätternrundans loppfart på 28,6 km/h eftersom loppet körs i
  klunga medan ett träningspass oftast görs ensam. Farten används bara för den här omräkningen,
  aldrig för att planera ett pass, och bara cykeln har ett tal.

  Loppet självt räknas inte — riktmärket handlar om förberedelsen. Öppningspasset dagen före
  räknas med, eftersom det är tid i sadeln.

  **Motorn ändrar aldrig planen för att nå ett riktmärke.** Den totala volymen följer av hur
  många timmar användaren kan träna och hur många veckor hon har, och båda har hon valt själv.
  Når planen inte riktmärket visas varningen nedan.

- **R-10** Styrka räknas in i veckotiden: 2 pass à 20 minuter i bas, 1 i specifik fas, inga i nedtrappning och återhämtning. Övningar för bål, höft, vader och axlar från en fast lista i `config/sessions.json`. *(utökad 2026-10-28)* Styrkan viktas mot veckans fokuslopp där grenen kräver det: inför **Vasaloppet** mot överkropp och bål, eftersom stakningen kommer därifrån. Texten och övningslistan ligger i `strengthVariants.byRace` och `strengthExercises.byRace` i `config/sessions.json`; saknas loppet används den allmänna. Arrangörens eget råd är att styrkan ska vara allmän, funktionell och skadeförebyggande, med extra överkropp särskilt före skidor.

**Pass**

- **R-11** Antal träningsdagar: T ≤ 5 ger 4 dagar, T 6–9 ger 5 dagar, T ≥ 10 ger 6 dagar. Minst en helt vilodag i veckan. *(utökad 2026-10-28)* **Användaren väljer vilken dag som är vilodag.** Den dagen lämnas helt fri varje vecka — det enda som får ligga där är ett lopp eller dess öppningspass, eftersom R-04 väger tyngre. Formuläret föreslår måndag, dagen efter helgens långpass.
- **R-12** Passlängd 20–300 minuter. *(utökad 2026-10-28)* Räcker veckans tid inte till ett pass i varje gren behåller fokusgrenen sin andel, och **de övriga grenarna roterar mellan veckorna** — urvalet styrs av veckonumret, aldrig av hur mycket tid grenen har. Annars stryks samma gren varje vecka: simningen har minst tid och tränades aldrig alls i profil P3, trots att Vansbrosimningen är ett av dess lopp. Varje gren som väljs fylls upp till minst ett helt pass innan resten fördelas efter grenarnas andelar.
- **R-13** Ett långpass per vecka i loppets sport under **bas- och specifik fas** *(basfasen tillagd 2026-10-28)*. *(ändrad 2026-10-28)* Passet läggs på **den dag användaren valt** — vilken dag som helst i veckan, inte bara helgen. Appen är byggd för folk med jobb, och alla har inte helgen fri; ett långpass på en söndag man arbetar är ett pass man inte kan göra. Formuläret föreslår söndag. Är den valda dagen upptagen av ett lopp eller ett öppningspass flyttas långpasset till den sista fria av `longSession.allowedWeekdays`, och i sista hand till någon annan fri dag — hellre ett långpass på fel dag än inget långpass. Grenens tak är: skidor 240 min, cykel 300 min, löpning 150 min, simning 75 min. Det börjar på `startShareOfCap` av sitt tak i fasens första vecka och når taket i den sista; blir det kortare än `longSession.minMinutes` blir det inget långpass.

  **Kurvan går genom båda faserna** *(ändrad 2026-10-28)*. Basen växer från en fjärdedel till hälften av grenens tak, och den specifika fasen tar vid där basen slutade: från hälften till taket. Talen ligger i `longSession.growthByPhase` i `config/rules.json`. Grundperioden är där uthålligheten byggs, och ett kvartal utan ett enda längre pass är svårt att försvara. För Vasaloppet blir kurvan 68 → 120 minuter genom basen och 135 → 240 genom den specifika fasen.

  Nedtrappning och återhämtning har inget långpass. Räcker grenens tid inte till `longSession.minMinutes` blir det inget långpass den veckan — hellre inget än ett som bara heter så.

  **De sista veckorna får långpasset låna tid från de andra grenarna** *(tillagd 2026-10-28)*, upp till taket på 70 procent i R-28. Antalet veckor står i `longSession.borrowInFinalWeeks`. Utan lånet binds långpasset av grenens andel i R-08 och hinner aldrig bli långt nog: Vasaloppets längsta pass stannade på 45 procent av loppets tid och Vätternrundans på 28 procent. Ett långpass på tre timmar inför 315 kilometer på cykel är inte en förberedelse. Lånet tas från de övriga grenarna i proportion till deras tid, så veckans totala tid är oförändrad (R-29). Det följer också arrangörens eget råd: träna mer specifikt perioden närmast varje tävling.
- **R-28** (tillagd 2026-10-27) Långpasset får ta högst 70 % av veckans tid, utöver taken i R-13. Vid T = 6 timmar skulle ett cykelpass på 300 minuter annars vara 83 % av veckan.
- **R-30** (tillagd 2026-10-27) Varje pass har en titel och en instruktion från `config/sessions.json`. **En instruktion per passtyp, 8 totalt**; sportspecifika varianter läggs till bara där sporten ändrar innehållet. Saknas en kombination som motorn kan producera är det ett testfel, inte ett tomt fält. *(utökad 2026-10-28)* Grenspecifika varianter finns nu också där **loppet** ändrar vad passet innehåller, inte bara där grenen gör det: löpningens långpass och lugna pass nämner kuperad terräng och mjukt underlag eftersom Lidingöloppet är terränglöpning, och cykelns långpass nämner klungkörning — som ett **tips**, eftersom alla inte har någon att cykla med, och med ett uttalat tillägg att passet duger lika bra ensamt.
- **R-14** Löptak: total löptid får öka högst 10 % från en vecka till nästa (veckor efter avlastning undantagna). Nivå Ny i löpning har aldrig löppass två dagar i rad.

  **Löptaket är nu byggt** *(tidigare bara dess andra hälft; 2026-10-28)*. Jämförelsen görs mot senaste **normala** veckan — bas eller specifik fas, utan avlastning och utan lopp — inte mot veckan precis innan. Skälet till undantaget i regeln är att avlastningsveckan är medvetet lätt, men undantaget får inte betyda att taket släpps helt: då kunde löptiden femdubblas veckan efter en avlastning. Att hoppa över de lätta veckorna i jämförelsen ger regelns avsikt utan hålet.

  Taket blev akut när R-36 infördes: när de andra loppen är avklarade går deras tid till det sista loppets gren, och är det Lidingöloppet växte löpningen från nittio minuter till åtta timmar på en vecka. Löpning sliter betydligt mer på kroppen än skidor och cykel, och det är precis vad den här regeln finns för.

  De minuter taket skär bort går till de andra grenarna, men aldrig över ett nybörjartak (R-31) och aldrig till en gren vars lopp är avklarat och som är utanför sin säsong (R-36). Finns det ingen gren som kan ta emot behåller löpningen minuterna — taket är en riktlinje mot en skaderisk, inte ett skäl att göra veckan kortare än användaren valt.

**Intensitet**

| Zon | Text i appen |
| --- | --- |
| 1 | Mycket lugnt |
| 2 | Lugnt – du ska kunna prata hela meningar |
| 3 | Måttligt – du kan prata korta meningar |
| 4 | Hårt – bara några ord i taget |

- **R-15** Bas: alla pass i zon 1–2 utom ett pass i zon 3 per vecka. Specifik: ett pass i zon 3 och ett intervallpass i zon 4 per vecka; nivå Ny i sporten får bara zon 3. Nedtrappning: korta inslag i zon 3 — **högst 20 minuter**, `maxHardMinutes` i `config/rules.json` *(preciserad 2026-10-28)*. Utan en siffra blev det ett helt tröskelpass på upp till två timmar veckan före loppet, vilket motsäger både regelns ord och arrangörens råd att träna mindre och lugnare den sista veckan. De minuter som kapas bort flyttas till lugna pass, så veckans tid är oförändrad (R-29). Återhämtning: bara zon 1–2.
- **R-16** Aldrig pass i zon 3–4 två dagar i rad.

**Ersättningar, teknik och säsong**

- **R-17** Skidor utan snö eller rullskidor: stakmaskin om användaren har en, annars stavgång i backe med samma tid och zon. *(preciserad 2026-10-28)* Passet **behåller grenen**: det tränar fortfarande mot Vasaloppet, och det ska synas i planen. Stavgång i backe är skidträning, inte en nödlösning — bor man där det inte finns snö är det så man tränar för Vasaloppet, och det är bra träning. Gränssnittet ska därför visa "Stavgång i backe — Längdskidor", aldrig "i stället för längdskidor".
- **R-18** Simning utan simhall: före juni ersätts simpass med torrövningar för simteknik, och en varning visas om att simträning behövs. *(preciserad 2026-10-28)* Undantaget är `season.openWaterMonths`, juni till augusti: då simmar man i öppet vatten och behöver ingen simhall, och det är dessutom vad Vansbrosimningen faktiskt är. Utanför de månaderna — inte bara före juni — blir simpassen torrövningar för den som saknar simhall. I oktober finns varken bassäng eller öppet vatten.
- **R-19** Pass i öppet vatten planeras bara juni–augusti och har alltid säkerhetstexten från avsnitt 8. *(preciserad 2026-10-28)* Simpass juni till augusti planeras som öppet vatten och bär säkerhetstexten i fältet `safetyNote`. Texten sätts aldrig på ett ersatt pass: torrövningar på land behöver ingen varning om köldchock.
- **R-20** Cykel utan landsvägscykel eller trainer: passet blir "cykel, t.ex. spinning på gym" och en varning visas.
- **R-21** Nivå Ny i skidor eller simning: ett teknikpass per vecka i den sporten under bas och specifik fas, och en rekommendation om kurs i översikten. *(preciserad 2026-10-28)* Teknikpasset tas **före** veckans hårda pass — är man nybörjare avgör tekniken mer än intensiteten. Kursrekommendationen ges bara för grenar vars lopp faktiskt ingår i planen; ett simråd till den som inte ska simma Vansbrosimningen är bara brus. Texterna ligger i `technique.courseAdvice` i `config/rules.json`.

**Varningar**

- **R-22** Mindre än 8 veckor från start till första lopp: "Du har kort tid att förbereda dig. Planen är försiktig – sikta på att genomföra, inte på tid."
- **R-23** T under 4 timmar när Vasaloppet eller Vätternrundan ingår, eller under 3 timmar annars: "Den tid du har valt är i minsta laget för dina lopp."
- **R-24** Vasaloppet med nivå Ny i skidor och varken snö, rullskidor eller stakmaskin: "Teknik är avgörande i Vasaloppet. Försök att åka på snö eller gå en skidkurs före loppet."

- **R-26** (tillagd 2026-10-27) Spänner loppen över mer än tolv månader: "Dina lopp ligger mer än tolv månader isär. För att räknas som En svensk klassiker ska alla fyra genomföras inom tolv månader." Planen skapas ändå. Kontrollen är det som gör planen till en klassikerplan och inte bara ett träningsprogram.
- **R-34** (tillagd 2026-10-28) Planen når inte ett lopps volymriktmärke: "Med dina timmar hinner du ungefär {km} km på {sport} före {race}. Många siktar på {milestone} km innan loppet. Planen är lagd för att du ska klara distansen, men vill du komma närmare riktmärket behöver du fler timmar eller fler veckor." Tonen är medveten: varningen betyder "det här når inte riktmärket", aldrig "du tränar för lite".
- **R-35** (tillagd 2026-10-28) **Mindre än tio veckor till första loppet.** Varningen lyder:
  "Det är {weeks} till {race}. Ett helt program börjar med en grundperiod på flera månader, och
  den hinner du inte – du hoppar in mitt i programmet, i den loppspecifika delen. Planen är lagd
  för att du ska klara distansen, inte för att du ska slå en tid." Saknar planen grundperiod helt
  läggs meningen "Den här planen innehåller ingen grundperiod alls." till.

  Gränsen på tio veckor är inte godtycklig: det är **hela uppbyggnaden för Vasaloppet och
  Vätternrundan** — två veckors nedtrappning plus åtta veckors specifik fas. Startar man senare än
  så finns det ingen grundperiod kvar att göra, och planen börjar inne i den specifika fasen.
  Användaren ska veta det, inte upptäcka det när programmet känns ovanligt tungt från vecka ett.

  Bara **det första loppet** kontrolleras. De senare loppen har hela planen framför sig och bygger
  upp sig i tur och ordning; att varna för dem vore att varna för något som inte är ett problem.

  Gränsen och texterna ligger i `warnings.midProgramme` i `config/rules.json`. Varningen överlappar
  med R-22, som går vid åtta veckor: den som startar sex veckor före loppet får båda. De säger olika
  saker — R-35 vad som strukturellt händer med programmet, R-22 vad man bör sikta på — men om de
  känns övertaliga i gränssnittet är R-22 den som bör slås samman hit.

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
| A-02 | Biblioteket täcker varje fas motorn kan producera — **en text per fas, 4 totalt** *(krympt från 16 den 2026-10-27)*. Saknas en fas är det ett testfel, inte ett tomt fält | Måste |
| A-03 | Variation per lopp eller nivå läggs till bara där den ändrar budskapet, och då som egna poster. Börja utan den | Bra att ha |
| A-04 | En sammanfattning, högst 500 tecken, skriven så att den fungerar oavsett vilka lopp planen innehåller | Måste |
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
| Drift | Lokalt till demon; Vercel eller GitHub Pages efteråt *(ändrad 2026-10-28)* |
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

*Ändringar:* `Session.raceId` tillagt 2026-10-28. Veckan har `focusRaceId`, men bara ett. Går två lopp samma vecka enligt R-27 är det andra ett pass av typen `race`, och utan id:t skulle koden behöva leta efter loppets namn i passets titel.

```ts
type Sport = 'ski' | 'bike' | 'swim' | 'run' | 'strength';
type RaceId = 'vasaloppet' | 'vatternrundan' | 'vansbrosimningen' | 'lidingoloppet';
type Level = 'new' | 'experienced' | 'advanced'; // Ny, Van, Erfaren
type Phase = 'base' | 'specific' | 'taper' | 'recovery';
type SessionType = 'easy' | 'long' | 'tempo' | 'intervals' | 'technique' | 'strength' | 'rest' | 'race';

type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;   // ISO: 1 = måndag, 7 = söndag

interface PlanInput {
  schemaVersion: 2;           // höjd 2026-10-28: preferredDays tillkom
  today: string;              // YYYY-MM-DD
  startDate: string;          // YYYY-MM-DD
  races: { id: RaceId; date: string }[];
  levels: Partial<Record<'ski' | 'bike' | 'swim' | 'run', Level>>;
  hoursPerWeek: number;       // 3–15
  preferredDays: { longSession: Weekday; rest: Weekday };   // måste vara olika
  equipment: { snowOrRollerSkis: boolean; skiErg: boolean; pool: boolean; bike: boolean };
}

interface SessionAlternative {
  sport: Sport;
  title: string;
  note: string;               // t.ex. 'om det finns snö'; tom när inget villkor gäller
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
  safetyNote?: string;        // R-19, satt på pass i öppet vatten
  raceId?: RaceId;            // satt på pass av typen 'race'
  alternatives: SessionAlternative[];   // R-37, grenar passet också kan göras i
  substitutedAs?: string;     // R-17, R-18, R-20: nyckel i sessions.json när passet görs på annat sätt
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
  schemaVersion: 3;
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
| Öppet vatten | Varje pass i öppet vatten | Simma aldrig ensam i öppet vatten. Använd en synlig boj och gå i gradvis – kallt vatten kan ge köldchock. Att simma i öppet vatten med våtdräkt är något annat än att simma i bassäng: dräkten bär dig högre i vattnet och ändrar både andning och armtag. Prova den i öppet vatten före loppet, inte på loppdagen. *(utökad 2026-10-28)* |
| AI-märkning | Vid förklaringarna | Förklaringarna är skrivna med hjälp av AI. |
| Oberoende | Planens fot | Klassikerplaneraren är inte knuten till Vasaloppet, Vätternrundan, Vansbrosimningen, Lidingöloppet eller En svensk klassiker. |

### Kostnad: noll kronor *(tillagt 2026-10-27)*

**v1.0 ska inte kosta någonting — varken att utveckla eller att använda.** Det är ett krav på samma nivå som att appen ska fungera, inte en ambition. Allt som skulle införa en kostnad, nu eller senare, kräver Isabelles uttryckliga godkännande.

Så här ser det ut i dag:

| Del | Kostnad | Varför det håller |
| --- | --- | --- |
| Alla paket i `package.json` | 0 kr | Öppen källkod under MIT |
| GitHub, publikt repo | 0 kr | Publika repon har fria byggminuter i Actions |
| Vercel Hobby | 0 kr | Permanent gratis, inget kreditkort, **ingen fakturering alls** — överskrids en gräns pausas funktionen tills månaden vänder, ingen betalning kan utlösas |
| AI | 0 kr | Inga anrop i körtid. Texterna skrivs under utvecklingen i Claude Code, som redan är betald |
| Databas, backend, domän | 0 kr | Finns inte. Appen är helt statisk och sparar i webbläsaren |

**Fyra ställen där en kostnad skulle kunna smyga sig in, och vad som hindrar det:**

1. **Ett AI-anrop i körtid.** Hindras av A-08 och av ett test som underkänner varje beroende med "anthropic" i namnet. Kravet står alltså i kod, inte bara i text.
2. **En betaltjänst som nytt beroende** — analys, felrapportering, databas, kartor, typsnittstjänst. Hindras av regeln i avsnitt 1 om att fråga innan bibliotek eller tjänster läggs till.
3. **Vercels villkor för Hobby gäller personligt och icke-kommersiellt bruk.** Skulle appen någon gång ta betalt, visa reklam eller användas i en verksamhet krävs Pro. Så länge den är en kursbeta är den inom villkoren.
4. **Ett privat repo** skulle göra byggminuterna i Actions begränsade. Repot ska förbli publikt.

**Reserv.** Appen är helt statisk sedan beslutet om förgenererade förklaringar, så den kan driftas var som helst som serverar filer. GitHub Pages fungerar, är gratis utan kommersiell begränsning, och är redan beprövat i v0. Om Vercel någon gång skulle bli ett problem är bytet litet.

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
| Kostnad | **Noll kronor.** Se avsnittet nedan — kravet är absolut, inte en ambition |
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
| P6 Vårstart | Alla fyra, start 2027-05-03, Vasaloppet sist (mars 2028); långpass onsdag, vila söndag | 8 | Ny i skidor, Van i övrigt | Simhall och cykel |

**Invarianter** (gäller för P1–P6 och ska testas för varje vecka)

- Veckans totala tid överskrider aldrig fasens tid enligt R-05–R-07
- Minst en vilodag per vecka (R-11)
- Aldrig pass i zon 3–4 två dagar i rad (R-16)
- Återhämtningen efter ett lopp finns kvar och kortas bara så att den inte går in i nästa loppvecka (R-03) *(tillagd 2026-10-28)*
- Pass i simning och längdskidor är teknikpass under återhämtningsveckorna (R-33) *(tillagd 2026-10-28)*
- Inget pass i zon 3 överskrider 20 minuter i en nedtrappningsvecka, och veckans totala tid är ändå oförändrad (R-15) *(tillagd 2026-10-28)*
- Den valda vilodagen är helt fri varje vecka, med lopp och öppningspass som enda undantag (R-11) *(tillagd 2026-10-28)*
- En sport där nivån är Ny håller sitt veckotak i både minuter och antal pass, loppet och öppningspasset inräknade (R-31) *(tillagd 2026-10-28)*
- Summan av minuterna per sport plus de oplacerade minuterna är alltid exakt veckans konditionstid (R-29, R-31) *(tillagd 2026-10-28)*
- Skidorna får mer tid än cykeln i en basvecka november–mars, och cykeln mer än skidorna maj–september (R-32) *(tillagd 2026-10-28)*
- Varje gren i planen får tid varje vecka utom i loppveckan, också den säsongen tonar ner (R-32) *(tillagd 2026-10-28)*
- Långpasset ligger på den valda dagen när den är fri (R-13) *(tillagd 2026-10-28)*
- Reglerna om dagar i rad i R-14 och R-16 håller också över veckogränsen, söndag till måndag *(tillagd 2026-10-28)*
- Löptiden ökar högst 10 % mellan veckor, utom efter avlastning (R-14)
- Inga pass före startdatum eller efter sista loppet, och loppdagen innehåller bara loppet (R-01, R-04)
- Inget pass kräver utrustning som användaren saknar: det ersätts i stället, med tid och zon kvar (R-17–R-20)
- Varje simpass juni till augusti har säkerhetstexten, och inget pass utanför dem har den (R-19)
- En gren användaren är ny i har ett teknikpass i veckan under bas och specifik fas (R-21) *(tillagd 2026-10-28)*
- Ett alternativ erbjuds bara när grenen är i säsong och användaren har utrustningen, och aldrig för lopp, vila, styrka eller teknik (R-37) *(tillagd 2026-10-28)*
- Samma indata ger samma plan (determinism)
- Varje pass är 20–300 minuter och har titel, instruktion och zon där zon gäller (R-12, R-30) *(tillagd 2026-10-27)*
- Varje pass av typen `race` har ett `raceId` som finns i `config/races.json` *(tillagd 2026-10-28)*
- Loppveckans budget är minskad med loppets uppskattade tid (R-25) *(tillagd 2026-10-27)*
- Andelarna mellan sporterna summerar alltid till 100 %, även när planen har en eller två sporter (R-08) *(tillagd 2026-10-27)*
- Planen överlever en rundtur genom lagringen: sparad och inläst plan är identisk med originalet *(tillagd 2026-10-27)*
- Varje fas i planen har en förklaring, och varje passtyp en instruktion (A-02, R-30) *(tillagd 2026-10-27)*

**Särskilda testfall**

- P4 ger varningen i R-22, P3 varningen i R-23 och P4 varningen i R-24
- P5 följer blocklogiken i R-03
- Datum: ISO-vecka 53 och årsskiftet 2026–2027, sommartid 28 mars 2027, och skottåret 2028 — en vårstart lägger Vasaloppet i mars 2028, så februari 2028 ligger inne i planen (ändrad 2026-10-28)
- Förklaringar: varje kombination av fas och lopp har en text, ingen text överskrider sin längdgräns, och ingen plan saknar förklaring
- Konfiguration: alla filer i `config/` validerar mot sina scheman
- **Slumpad egenskapstestning** *(tillagd 2026-10-27)*: minst 200 slumpade men giltiga indata körs mot samtliga invarianter. Fem profiler räcker inte — i v0 var det slumptestningen som avslöjade att en gren aldrig tränades, vilket P1–P5 hade missat
- Plan med ett enda lopp: hela veckotiden går till den sporten, ingen andel blir ofördelad (R-08)
- Två lopp samma vecka: båda markeras, båda räknas som belastning, inget lopp försvinner (R-27)
- Lopp som spänner över mer än tolv månader ger varningen i R-26 men ändå en plan
- Start i var och en av årets tolv månader ger en hel plan där alla fyra loppen finns med, oavsett vilken ordning loppen kommer i (tillagt 2026-10-28)
- Alla sju veckodagar som långpassdag och som vilodag: planen håller samtliga regler i varje kombination (tillagt 2026-10-28)
- Plan med bara Vansbrosimningen och nivå Ny: veckan stannar på 80 minuter och resten redovisas som oplacerad tid (R-31) (tillagt 2026-10-28)
- Vårstart i maj med Vätternrundan i juni: planen når inte 1000 km och varningen i R-34 visas (tillagt 2026-10-28)
- Start 9, 10 och 11 veckor före loppet: varning, ingen varning, ingen varning (R-35) (tillagt 2026-10-28)
- Veckan efter Vasaloppet: cykeln är huvudgren och skidorna har högst 10 procent (R-36) (tillagt 2026-10-28)
- Cykellångpass i mars erbjuder längdskidor som alternativ; samma pass i april gör det inte (R-37) (tillagt 2026-10-28)
- Profil utan utrustning: skidpassen blir stavgång, simpassen torrövningar, och inget pass stryks (R-17, R-18) (tillagt 2026-10-28)
- Samma profil med stakmaskin: skidpassen blir stakmaskin i stället för stavgång (R-17) (tillagt 2026-10-28)
- Simpass i juli utan simhall: ingen ersättning, eftersom öppet vatten inte kräver bassäng (R-19) (tillagt 2026-10-28)
- Lidingöloppets block när de tre andra loppen är avklarade: löpningen växer högst 10 procent i veckan (R-14) (tillagt 2026-10-28)
- Sparad plan i ett gammalt eller trasigt format: kastas, rensas och ger ett meddelande — aldrig en tom sida (K-15)

**Definition of done per uppgift**

- Uppgiftens kriterier i backlogen är uppfyllda
- Tester finns för ny logik, och alla tester, lint och typkontroll är gröna
- Commit med uppgiftens id och en kort sammanfattning till Isabelle

**Definition of done för v1.0**

- [ ] Alla Måste-krav är klara och testade
- [ ] Appen går att köra lokalt med `npm run dev` och fungerar i mobil *(ändrad 2026-10-28:
      demon körs lokalt, drift skjuts till efter demon)*
- [ ] Isabelle har granskat P1–P5 som text (via `scripts/print-profiles.ts`) och godkänt planerna
- [ ] Varje kombination av fas och lopp har en granskad förklaring
- [ ] Varje passtyp har en granskad instruktion
- [ ] README beskriver idé, hur man kör projektet och var kravspecen finns

## 10. Backlog i ordning

Uppgifterna görs i den här ordningen. Motorn byggs och granskas först, eftersom allt annat vilar på den.

**Tiderna höjdes 2026-10-27** när reglerna R-25 till R-30 och kraven K-15 till K-17 lades till. Totalt cirka **30 timmar** mot tidigare 25, efter att textbiblioteken krympts den 2026-10-27. Se avsnitt 11 om vad det betyder för tidsplanen.

| ID | Uppgift | Klart när | Krav | Tid | Milstolpe |
| --- | --- | --- | --- | --- | --- |
| T-01 | Projektuppsättning: Next.js, TypeScript strikt, Tailwind, Vitest, lint, mappstruktur, CLAUDE.md och en tom sida på Vercel | Appen går att köra lokalt; `npm test` och lint körs i repot *(ändrad 2026-10-28)* | – | 1,5 h |  |
| T-02 | Datamodell och konfiguration: typer, Zod-scheman och filerna i `config/`, inklusive instruktionsbiblioteket i `sessions.json` | Typer kompilerar; konfigurationen validerar i ett test; varje passtyp har en instruktion | Avsnitt 5, 7, R-30 | 2,5 h |  |
| T-03 | Veckor och faser, inklusive blocklogik och flera lopp samma vecka | Tester för R-01–R-04 och R-27 gröna; P4 och P5 ger rätt faser | R-01–R-04, R-27 | 2,5 h |  |
| T-04 | Veckotid, loppbelastning och fördelning mellan sporter | Tester för R-05–R-10, R-25 och R-29 gröna; en plan med ett enda lopp fördelar hela tiden | R-05–R-10, R-25, R-29 | 3 h |  |
| T-05 | Pass per vecka: dagar, långpass, intensitet och vila | Tester för R-11–R-16 och R-28 gröna; varje pass har titel och instruktion | R-11–R-16, R-28, R-30 | 3,5 h |  |
| T-06 | Ersättningar, teknik och säsong | Tester för R-17–R-21 gröna | R-17–R-21 | 1,5 h |  |
| T-07 | Varningar och säkerhetstexter i planen | Tester för R-22–R-24, R-26 och öppet vatten gröna | R-22–R-24, R-26, K-11 | 1,5 h |  |
| T-08 | Invarianttester, slumpad egenskapstestning, datumtester och `scripts/print-profiles.ts` | Alla invarianter gröna för P1–P5 och för 200 slumpade indata; skriptet skriver ut planerna som läsbar text | Avsnitt 9 | 2 h | **M1 Motorn klar** – Isabelle granskar P1–P5 |
| T-09 | Formulär i tre steg | Acceptanskriterierna för K-02–K-04 uppfyllda | K-02–K-04 | 2 h |  |
| T-10 | Planvy: översikt, veckovy och markering av innevarande vecka | Acceptanskriterierna för K-05–K-09 och K-16 uppfyllda | K-05–K-09, K-16 | 3 h |  |
| T-11 | Spara i webbläsaren, med validering av det som läses in | Acceptanskriterierna för K-10 och K-15 uppfyllda | K-10, K-15 | 1,5 h | **M2 Appen körbar utan AI** – Isabelle testar i mobilen |
| T-12 | Förklaringar: skriv de 4 fastexterna och sammanfattningen med AI, Isabelle granskar, lägg dem i `config/explanations.json` med schema och tester | Acceptanskriterierna för K-08 och A-01–A-08 uppfyllda; alla texter granskade | A-01–A-08 | 1,5 h |  |
| T-13 | Startsida och fasta texter | Acceptanskriterierna för K-01 och K-11 uppfyllda; texterna ordagrant enligt avsnitt 8 | K-01, K-11 | 1 h |  |
| T-14 | Genomgång i mobil och av tillgänglighet | K-12 uppfyllt; kraven för tillgänglighet i avsnitt 8 kontrollerade | K-12 | 1 h |  |
| T-15 | Ändra svar — **nu Måste**, eftersom ett tomt formulär bredvid en sparad plan kan radera den | Acceptanskriteriet för K-13 uppfyllt | K-13 | 0,5 h |  |
| T-16 | Utskrift (Bra att ha) | Acceptanskriteriet för K-14 uppfyllt | K-14 | 0,5 h |  |
| T-18 | Avslut när planen är genomförd (Bra att ha) | Acceptanskriteriet för K-17 uppfyllt | K-17 | 0,25 h |  |
| T-17 | README och förberedelse för demon | Definition of done för v1.0 uppfylld | Avsnitt 9 | 1 h | **M3 Klar för demo** |

Tiderna avser Isabelles tid med Claude Code och har en osäkerhet på ungefär ±30 %.

## 11. Tidsplan och demo

Demon är den 19 november 2026. Kapaciteten fram dit är cirka 20–27 timmar.

**Backlogen är fortfarande större än kapaciteten.** Efter tilläggen 2026-10-27 är den cirka **30 timmar** mot en kapacitet på 20–27.

**Beslut 2026-10-27: textbiblioteken krymptes** — fyra fasförklaringar i stället för sexton, åtta passinstruktioner i stället för trettiotvå. Det sparar framför allt Isabelles granskningstid, som är den verkliga flaskhalsen, men bara ungefär en halvtimme av byggtiden. Gapet mot kapaciteten kvarstår, och något av följande kan behövas:

1. **Stryk ett lopp ur v1.0.** Tre lopp i stället för fyra minskar både regelarbetet och antalet texter, och demon fungerar lika bra.
3. **Flytta K-16 och K-17 efter demon.** Navigering i en lång plan är viktigt i vardagen men syns knappt i en demo på några minuter.
4. **Utöka tiden.** Fem timmar till över tre veckor är ungefär tjugo minuter om dagen.

Tilläggen är inte valfria i samma mening som övriga krav: utan R-25 planerar appen träning ovanpå ett sju timmar långt lopp, och utan K-15 kan en sparad plan ge en tom sida. De fyra kritiska tilläggen — R-08 utökad, R-25, K-15 och K-13 som Måste — bör behållas oavsett vad som stryks.

&#91;embedded content: tidsplan · 5 arbetsblock och 3 milstolpar fram till demon\]

Regelmotorn är klar och granskad efter första arbetsveckan; därefter byggs gränssnittet och sist AI-lagret, så att en fungerande app finns redan vid M2.

**Om tiden inte räcker** (i den här ordningen)

1. Stryk T-16 Utskrift och T-18 Avslut. **T-15 Ändra svar kan inte längre strykas** — den är Måste sedan 2026-10-27, eftersom ett tomt formulär bredvid en sparad plan kan radera den
2. Förenkla översikten (K-06) till en lista utan fasförklaringar i varje rad
3. Minska textbiblioteket: skriv en förklaring per fas i stället för en per fas och lopp, så att granskningen blir fyra texter i stället för sexton

**Demomanus** (justeras efter fråga 6)

**Demon körs lokalt** *(beslut 2026-10-28)* med `npm run dev` på Isabelles egen dator. Appen är statisk och behöver ingen server, så drift skjuts till efter demon. Kravet på noll kronor påverkas inte — det blir i stället noll konton också.

1. Visa startsidan och berätta problemet: fyra lopp, fyra sporter, ett år
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

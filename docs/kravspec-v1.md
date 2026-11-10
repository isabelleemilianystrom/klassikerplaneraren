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
| Lätt att komma igång | Formuläret känns överblickbart: tre steg, inga frågor som kräver att man slår upp något, och förvalda svar överallt *(ändrad 2026-10-29: tidsmålet "under 2 minuter" ströks — det pressade mot färre frågor, och frågorna är det som gör planen personlig)* |
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
- [x] **5. Granskning av träningsreglerna.** Vem granskar reglerna i avsnitt 5 före demon? Förslag: en tränare eller kunnig bekant; om ingen hinner visas betatexten tydligt. Blockerar M1-granskningen. **Besvarad 2026-10-29: granskad.** Fyra granskningar gjordes — en allmän klassikercoach och en specialist per gren. Profilerna P1–P5 lästes som text. Utfallet: periodiseringen, teknikprioriteringen för nybörjare, terrängträningen och volymvarningen för Vätternrundan bekräftades. Tre luckor hittades och är åtgärdade: utförslöpning inför Lidingöloppet, blicklyft i öppet vatten, och lopptaktiken i R-30. Kvar att besluta: volymriktmärken för de tre övriga loppen, som ingen av granskarna gav tal för.
- [ ] **7. R-22 och R-24 — två varningar som redan sägs av andra.** *(Hittad 2026-10-29 när
  varningarna skulle byggas.)* Båda har text och konfiguration men ingen kod, och båda går av
  exakt när en annan, redan byggd varning också går av:

  | Krav | Täcks av | Varför |
  | --- | --- | --- |
  | **R-22** under 8 veckor till första loppet | **R-35** under 10 veckor | 8 är mindre än 10, så R-35 går alltid av först. R-35:s text är längre och säger mer: att grundperioden saknas och vad planen i stället är lagd för |
  | **R-24** Vasaloppet, ny på skidor, ingen utrustning | **R-21:s kursråd** för skidor | R-21 går av redan på "ny på skidor" och säger nästan ordagrant samma sak, plus nivån och skälet |

  Byggdes de som de står visas två nästan identiska stycken. För P4 blev det i prov: *"Du har
  kort tid att förbereda dig…"* direkt följt av *"Det är 5 veckor till Vasaloppet…"*, och
  *"Teknik är avgörande i Vasaloppet…"* direkt följt av *"Du är ny på längdskidor. Teknik avgör
  mer än kondition i Vasaloppet…"*.

  **Förslag: stryk båda, som R-23 ströks.** Alternativet är att rikta om dem — R-22 mot något
  R-35 inte säger, och R-24 mot det användaren faktiskt saknar: ett skidläger för att få någon
  tid på snö. Det senare kräver en ny text, som Isabelle i så fall får godkänna.

  **R-26 var den enda av de fyra varningarna som saknades på riktigt** och är nu byggd.

- [x] **8. Simhallsfrågan i formuläret.** *(Hittad 2026-11-04 när R-18 togs bort.)* `pool` var
  den enda utrustning simningen behövde, och med R-18 borta styr den ingenting i planen.
  Frågan "har du tillgång till simhall?" står kvar i steg 3 men påverkar inte vad användaren
  får. **Förslag: ta bort frågan** — ett formulär som frågar om något som inte spelar någon
  roll gör resten av frågorna mindre trovärdiga. Alternativet är att låta den stå, eftersom
  den säger något om vad appen bryr sig om. Blockerar inget. **Besvarad 2026-11-04: frågan
  togs bort**, tillsammans med cykelfrågan. Skidor och cykel är förutsatta och simhallen styr
  ingenting — kvar är bara komplementen rullskidor, stakmaskin och trainer (R-17, R-20).

- [x] **9. Snön följer månaden — men inte alla har ett spår.** *(Hittad 2026-11-04 när
  utrustningsfrågorna gjordes om.)* Snö är nu en fråga om månaden: november–mars planeras
  skidpassen som skidpass för alla. Följden är att **profil P1 får 43 timmar längdskidor den
  perioden utan något alternativ**, fast hon inte har rullskidor eller stakmaskin. P3 och P4
  har noll ersatta skidpass. Bor man i Skåne är det fel — och det var ditt eget exempel den
  29 oktober.

  **Förslag: en fråga tillbaka** — "Kommer du åt ett skidspår på vintern?" — och snö kräver då
  **både** vintermånad **och** ja på frågan. Resten av kedjan är oförändrad: rullskidor,
  stakmaskin, stavgång i backe. Alternativet är att låta det stå: den som inte kommer åt snö
  får själv byta passet, precis som den som saknar simhall.

  **Besvarad 2026-11-04: frågan lades tillbaka.** Snö kräver nu både vintermånad och ett ja på
  "Kommer du åt snö där du bor, eller reser du dit?". Cykelns inomhusvariant styrs fortfarande
  av månaden ensam — en trainer i januari handlar om mörker och väglag, inte om snö.

  Följden: P4 får stavgång i backe för alla femton skidpassen i november–december, och
  **taket på 90 minuter i stakmaskin (R-44) går av igen** — en profil med stakmaskin men utan
  spår får fjorton pass över taket, det längsta 240 minuter.

- [ ] **10. Fullt fokus före Lidingöloppet.** *(Hittad 2026-11-04 när R-45 utökades till alla
  lopp.)* Principen gäller alla fyra loppen, men för Lidingöloppet krockar den med löptaket i
  R-14. Med `fullFocusWeeks: 2` fick löpningen bara **32 procent** av veckan — taket höll
  tillbaka den och resten gick till de grenar som skulle vara pausade. Pausen blev en paus på
  pappret.

  **Förslag: låt det stå som det är.** R-14 finns för att löpning sliter mer, och ett test i
  sviten säger uttryckligen att det lades in för att stoppa en vecka där löpningen växte från
  nittio minuter till åtta timmar. De två sista veckorna före ett trettio kilometer långt
  terränglopp är inte rätt tillfälle att tredubbla löpvolymen.

  Alternativet är att låta pausen gälla och de överblivna minuterna **försvinna** — veckan blir
  då kortare än användaren valt, vilket bryter mot R-29. Eller att höja löptaket inför
  Lidingöloppet, vilket är en skaderegel och ditt beslut.

- [x] **6. Demon.** Besvarad 2026-10-29: **högst fem minuter.** Det styr demomanuset i avsnitt 11 och vad som måste finnas. Fem minuter räcker till startsidan, formuläret ifyllt live, översikten och en öppnad vecka. Fasförklaringarna (T-12) hinner knappt visas och är därmed inte kritiska för demon.

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
| K-02 | Steg 1: välj minst ett av de fyra loppen och ange datum och mål — ta sig i mål eller sikta på en tid — för varje valt lopp *(mål tillagt 2026-10-29)*; startdatum är idag men kan ändras | Måste | Inget lopp valt eller ett loppdatum före startdatumet ger ett felmeddelande vid fältet, och jag kommer inte vidare |
| K-03 | Steg 2: nivå per sport som ingår i valda lopp – Ny, Van eller Erfaren – med beskrivningarna i avsnitt 5 | Måste | Varje sport har exakt en vald nivå innan jag kommer vidare; förvalt är "Van" |
| K-04 | Steg 3: timmar per vecka (6–15, heltal), vilken dag långpasset ska ligga på, vilken dag som är vilodag, och tillgång och utrustning: skidspår på vintern, rullskidor, stakmaskin, trainer eller spinning (ja/nej för varje) *(ändrad 2026-11-04: simhall och cykel utgick eftersom de är förutsatta; snöfrågan är kvar och krävs tillsammans med vintermånaden — se R-17)* | Måste | Alla fält har standardvärden (6 timmar, söndag långpass, måndag vila, nej på utrustning); värden utanför 6–15 kan inte väljas; samma dag för långpass och vila ger ett felmeddelande vid fältet och jag kommer inte vidare |
| K-05 | Generering: regelmotorn skapar planen direkt, med förklaringarna på plats från början | Måste | Planen med sina förklaringar visas inom 2 s efter att jag skickat formuläret, utan att något laddas i efterhand |
| K-06 | Översikt: alla veckor från start till sista lopp med veckonummer, datumintervall, fas, total tid och markering av loppveckor | Måste | Antalet veckor stämmer med perioden; varje loppvecka är markerad med loppets namn |
| K-07 | Veckovy: sju dagar med pass; varje pass visar sport, typ, minuter, intensitet i vardagsspråk och zon samt en kort instruktion; vilodagar visas som vila | Måste | Varje dag i veckan visas; intensitet visas som t.ex. "Lugnt – du ska kunna prata hela meningar (zon 2)" |
| K-08 | Förklaring per fas: varje sammanhängande fas har en kort förklaring, och planen har en kort sammanfattning överst | Måste | Varje fas i översikten har en förklaring; texten är högst 300 tecken |
| K-09 | Varningar enligt avsnitt 5 visas överst i planen; planen skapas ändå | Måste | Givet Vasaloppet om 6 veckor, när planen skapas, så visas varningen om kort förberedelsetid och en plan |
| K-10 | Den senaste planen sparas i webbläsaren och visas vid återbesök, med knappen "Gör en ny plan". Formuläret står aldrig tomt bredvid en sparad plan *(förtydligad 2026-10-27)* | Måste | Efter omladdning visas samma plan; fungerar inte lagringen visas planen ändå utan fel; en ändring i formuläret kan aldrig radera planen oavsiktligt |
| K-11 | Säkerhetstexter från avsnitt 8: ansvarsfriskrivning, röda flaggor, smärtregel och sjukdomsregel i planen; säkerhetstext på varje pass i öppet vatten | Måste | Varje pass i öppet vatten har säkerhetstexten; övriga texter syns i planen |
| K-12 | Fungerar i mobil från 360 px bredd | Måste | Ingen vågrät scroll och alla tryckytor minst 44 × 44 px vid 360 px *(preciserad 2026-10-29: gränsen 44 px är den vanliga minimigränsen för en tryckyta på pekskärm)* |
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

  **Den första veckan kan vara avkortad** *(tillagd 2026-11-04)*. Börjar man en fredag ligger veckans tre första dagar före startdatumet, och de är inte träningsdagar — de har redan passerat. Veckan får då bara den del av tiden som träningsdagarna räcker till, och tre saker gäller bara den veckan:

  1. **Inga pass före startdatumet.** Det var fynd F-1: 172 av 200 slumpade planer hade pass på dagar som passerat, eftersom alla sex referensprofiler råkade börja på en måndag. Nu 0 av 200.
  2. **Inget långpass om den valda dagen har passerat.** Reservdagen är veckans sista, och ligger nästa veckas långpass på en måndag hamnar två långpass intill varandra (R-43). Upptrappningen börjar i vecka 2.
  3. **Inget hårt pass.** Placeringen ser bara bakåt, inte framåt, så ett hårt pass på stubbveckans sista dagar hamnade intill nästa veckas långpass. Kvalitetsarbetet börjar också i vecka 2.

  En start på en **söndag** ger noll träningsdagar: den enda dagen som återstår är den vilodag veckan alltid ska ha (R-11). Veckan blir då helt tom, och planen börjar på riktigt i vecka 2.

  Alternativet — att låta planen börja på nästa måndag i stället — prövades och förkastades: ett lopp som ligger mellan startdatumet och nästa måndag försvann då ur planen.

  **Planen har ett tak: `weekTime.maxPlanWeeks`, i dag 104 veckor** *(tillagt 2026-11-05)*.
  Taket är inte en träningsregel utan ett skyddsräcke. Ett felskrivet årtal — **2927 i stället
  för 2027** — gav 46 978 veckor och låste webbläsaren. Hängningen är synkron, så inget
  `catch` hinner emellan; den enda platsen att stoppa den är före bygget. Den längsta riktiga
  planen i profilerna är 47 veckor, så 104 är mer än dubbelt upp, och en klassiker ska dessutom
  genomföras inom tolv månader (R-26).

  Taket upprätthålls i tre lager:

  1. **Formuläret** underkänner ett loppdatum förbi taket och visar det sista tillåtna datumet,
     inte en regel att tolka: *"Det datumet ligger för långt fram. Välj senast 2028-10-26 –
     kontrollera årtalet."* Fältet får också `min` och `max`, så webbläsaren hjälper till.
  2. **Lagringen** kastar en sparad plan vars timmar ligger utanför R-41:s intervall. Då visas
     "det sparade programmet kunde inte öppnas" i stället för ett byggfel.
  3. **Motorn** vägrar bygga: `buildWeeks` kastar över taket, och `buildWeekPlans` kastar på
     timmar som inte är ett heltal inom intervallet. En handskriven `hoursPerWeek: 1000000`
     gav sextio miljoner minuter att dela ut per vecka och låste också webbläsaren.

  **Lagringen validerar lika strängt som formuläret** *(skärpt 2026-11-05)*. Den är appens enda
  otrodda indata — allt annat kommer från repot eller från formuläret — och kontrollerade förut
  bara att fälten hade rätt *typ*. Nu kastas en sparad plan som bär ett okänt lopp-id, samma
  lopp två gånger, en nivå som inte är en nivå, en gren som inte finns, timmar utanför
  intervallet, eller ett datum som inte är ett datum. Tomt loppdatum är fortfarande giltigt i
  formulärtillståndet: ett lopp som inte är valt har inget datum än.

  Skälet att kasta i stället för att låta motorn kasta: "det sparade programmet kunde inte
  öppnas" är rätt besked för en trasig sparad post, och det visas på startsidan i stället för
  som ett byggfel i formuläret.

  Alla tre vägrar på **noll millisekunder** i stället för att hänga. Motorns kast når användaren
  som ett meddelande i formuläret (K-15).
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

- **R-38** (tillagd 2026-10-29) **Målet med loppet styr hur mycket grenen får.** Användaren
  anger per lopp om hon vill **ta sig i mål** eller **sikta på en tid**. Förvalt är att ta sig i
  mål — det är vad de flesta vill med sin första klassiker.

  Den som bara vill komma runt Vansbroån behöver **vattenvana och teknik, inte simvolym**. Den
  som vill slå en tid behöver bådadera. Målet `finish` multiplicerar därför grenens säsongsvikt
  med `raceGoal.finishWeightFactor` — **0,6** — och den frigjorda tiden går till de lopp
  användaren faktiskt siktar på.

  **Teknikpassen rörs aldrig.** Det är de som gör loppet görbart, och de är billigast i tid.
  **Nybörjaren rörs inte heller:** för den som knappt kan simma är frekvensen själva
  förberedelsen, och nybörjartaket i R-31 håller volymen nere ändå.

  Är alla lopp satta till samma mål ändras ingenting — andelarna normeras tillbaka. Det är
  **skillnaden mellan loppen** som får genomslag.

  I profil P5, där Vätternrundan är på tid och Vansbrosimningen bara ska klaras, flyttar regeln
  **tretton timmar** från simningen till cykeln över planens trettiofem veckor.

- **R-39** (tillagd 2026-10-29) **En gren behöver inte tränas från dag ett.** Står grenen i
  `deferredSports.sports` kan den vänta tills dess egen uppbyggnad börjar. **I dag står bara
  simning där.**

  Skälet: simning är en färdighet man har eller inte har, och Vansbrosimningen tar drygt en
  timme. En erfaren simmare behöver inte simma i november för ett lopp i juli. Löpning och
  cykel står inte med — trettio respektive trehundrafemton kilometer kräver uppbyggnad i
  månader.

  Fem villkor måste gälla samtidigt:

  1. Grenen står i listan.
  2. Grenen är **inte veckans fokus** — basperioden mot ett lopp är just den uppbyggnad
     grenen behöver.
  3. Användaren är **inte nybörjare** i grenen. Teknik går inte att ta igen på slutet.
  4. Loppet saknar **volymriktmärke** (R-34). Den volymen byggs i månader.
  5. Grenens egen **uppbyggnad har inte börjat** — veckan ligger mer än `taperWeeks +
     specificWeeks` före loppveckan.

  Villkor 2 och 4 kan nuvarande konfiguration inte utlösa, eftersom bara simning står i listan.
  De är skyddsräcken för den dag listan växer, och `tests/config.test.ts` kontrollerar att
  listan aldrig innehåller en gren med volymriktmärke eller ett lopp längre än två timmar.

  Tiden går till de grenar som faktiskt tränas — den försvinner inte. Löptaket i R-14 får
  heller inte skicka minuter till en gren som väntar; till skillnad från en avklarad gren
  (R-36) finns här inget säsongsundantag.

  För profil P2, som är erfaren i allt, går simningen från **fjorton timmar och tjugoåtta pass**
  före Vasaloppet till **noll**. Profil P1, som är ny i simning, är oförändrad.

- **R-40** (tillagd 2026-10-29) **Golv och tak per gren: ett simpass är 60 till 90 minuter.**
  Står grenen i `session.minMinutesBySport` och `session.maxMinutesBySport` är de talen
  grenens kortaste och längsta pass, i stället för `session.minMinutes` och
  `session.maxMinutes`. **I dag står bara simning där, med 60 och 90 minuter.** Golvet gäller
  också långpasset och ett hårt pass. Det gäller **inte** öppningspasset dagen före loppet
  (R-25) — det är kort med flit och ligger på loppets plats.

  Skälet till golvet: ett pass kostar mer än sin träningstid. Att ta sig till simhallen, betala
  inträde och byta om är lika mycket besvär för tjugo minuter i vattnet som för en timme, och
  ett program som planerar tjugominuterspass i simhallen är ett program man slutar följa.
  Löpning och cykel har inte den kostnaden — där går man ut genom dörren.

  Skälet till taket: nittio minuter är ett långt pass i en simhall, och mer än så blir det inte
  av. Den tiden gör mer nytta i en annan gren.

  Fyra följder:

  1. **Räcker veckans tid inte till ett helt pass simmar man inte den veckan**, och minuterna
     går till en annan gren (R-29). Hellre en vecka utan simning än en resa till simhallen för
     tjugo minuter.
  2. **Utom när grenen måste tränas.** Är man ny i grenen (R-31) eller är grenens lopp inne i
     sin uppbyggnad (R-39) tas timmen från de andra grenarna i stället: den grenen väljs före
     både rotationen och fokusgrenens återstod, och långpasset lämnar plats för den. Simning
     går inte att komma ikapp de sista veckorna, och en gren som aldrig tränas är precis det
     som gick fel i v0.
  3. **Krockar golvet med taket på hårda minuter i nedtrappningen (R-15)** blir det inget
     kvalitetspass den veckan *(ändrad 2026-11-04)*. Tidigare lades inslaget i en annan gren,
     men kvalitetspasset hör till fokusgrenen (R-42) — ett tröskelpass på cykel i
     nedtrappningen mot Vansbrosimningen tränar inte mot Vansbrosimningen. Nedtrappningen
     handlar ändå om att vila in sig.
  4. **Golvet och taket går inte alltid att hålla samtidigt.** 106 minuter simning blir
     antingen ett pass på 106 minuter eller två på 53, och båda bryter en regel. Då gäller
     taket, och de minuter som blir över går till en annan gren (R-29). Går de inte dit heller
     redovisas de som **oplacerad tid** i veckans budget — veckans faktiska tid är då lägre än
     den valda, och det ska stå, inte tystas ner. I de sex profilerna händer det i tre veckor
     av 226, med fem till femton minuter.

- **R-41** (tillagd 2026-10-29) **Minst sex timmar i veckan.** Under sex timmar byggs inget
  program. Talet står i `weeklyHours.min` i `config/rules.json`, och formuläret läser samma
  tal — gränsen i gränssnittet och gränsen i motorn kan aldrig säga olika. Fem timmar går inte
  att välja; sex är standardvärdet och det lägsta som går.

  Skälet: en klassiker är fyra grenar som var och en behöver ett långpass, och fyra långpass
  ryms inte i mindre tid. Under golvet blir programmet en lista över pass som inte leder fram
  till loppen, och ett sådant program är sämre än inget — det ser ut att ha räknat, men det har
  inte råd med det det föreslår.

  Att golvet ligger rätt syns på volymriktmärket: sex timmar i veckan räcker till tusen
  kilometer på cykel före Vätternrundan när hela året finns kvar (R-34). Hade det inte gjort
  det vore golvet satt för lågt.

- **R-42** (tillagd 2026-10-29) **Veckans tre fasta dagar, och ett pass per dag.** Varje vecka i
  bas- och specifik fas har **en styrkedag, en långpassdag och en kvalitetsdag**, och **en dag
  bär ett pass**.

  1. **Styrkedagen** är en hel timme styrka och ingenting annat. Talen står i `strength` i
     `config/rules.json`: `minutesPerSession: 60`, `ownDay: true`, ett pass i veckan.
  2. **Långpassdagen** ligger på den dag användaren valt (R-13) och bär veckans längsta pass.
     Inget annat pass i veckan får vara längre än långpasset — i någon gren.
  3. **Kvalitetsdagen** bär veckans hårda pass, och det ligger **alltid i veckans fokusgren**
     *(skärpt 2026-11-04)*. I specifik fas är det **intervallpasset i zon 5**; i grundperioden
     tröskelpasset i zon 4, eftersom zon 5 inte hör hemma där än. Passet får en egen plats i
     fokusgrenen — utöver teknikpasset om grenen har ett — och ligger först i kön när dagarna
     delas ut.

     **Finns ingen plats i fokusgrenen får veckan inget kvalitetspass.** Det flyttar inte till
     en annan gren. Veckan handlar om ett lopp, och ett intervallpass på cykel i en vecka som
     är loppspecifik mot Lidingöloppet tränar inte mot Lidingöloppet. Två fall gör det
     omöjligt: fokusgrenens tid räcker inte till både teknikpass och kvalitetspass, eller
     grenens golv är högre än fasens tak på hårda minuter (R-15 mot R-40 i nedtrappningen mot
     Vansbrosimningen).
  4. **En dag bär ett pass.** Antalet pass är därför aldrig fler än veckan har träningsdagar
     (R-11), och grenarna får platser efter hur mycket tid de har. Minuter som inte får plats
     flyttar till en annan gren (R-29) eller redovisas som oplacerad tid.

  Skälet: appen är byggd för folk som arbetar. Två pass samma dag förutsätter att man kan träna
  två gånger, och före den här regeln kunde en tisdag bära två löppass på 53 minuter **plus**
  ett styrkepass på 20. Det är inget program man följer; det är en lista.

  Följden för långpasset: med en plats per dag är veckans tid delad på platserna vad ett vanligt
  pass blir, så långpasset får ett golv där. Är grenens egen andel mindre än det lånar
  långpasset upp till snittet från de andra grenarna — annars kapar långpassets längd varje
  annat pass i veckan, och timmar försvinner. Det är samma lån som de sista veckorna i fasen
  (R-13), bara mindre.

  **Känd gräns, priset för att passet stannar i fokusgrenen** *(mätt 2026-11-04)*:

  | Profil | Veckor som vill ha ett kvalitetspass | Har det | I fokusgrenen |
  | --- | --- | --- | --- |
  | P2 (10 h) | 38 | **37** | 37 |
  | P5 (8 h) | 32 | 28 | 28 |
  | P6 (8 h) | 36 | 22 | 22 |
  | P3 (6 h) | 38 | 17 | 17 |
  | P1 (6 h, ny i två grenar) | 38 | **9** | 9 |

  Inget pass ligger utanför fokusgrenen. Men i en vecka där fokusgrenens tid går till
  långpasset och teknikpasset finns inget kvar till kvalitetspasset, och då blir veckan utan.
  Teknik går före intensitet — den går inte att komma ikapp på slutet (R-21), och ett
  intervallpass går att ta igen nästa vecka.

  **Vad som skulle höja siffrorna:** låta kvalitetspasset låna tid från de andra grenarna,
  precis som långpasset gör de sista veckorna i fasen (R-13). Ett försök 2026-11-04 krympte
  långpasset utan att kvalitetspasset blev av, och sextio minuter blev oplacerade i stället —
  det kräver att grenens minsta tid efter långpasset reserveras i R-08, inte bara att
  långpasset kortas. Ligger kvar som möjlig förbättring, inte som ett fel.

- **R-43** (tillagd 2026-10-29) **Två lugna dagar efter ett hårt pass.** Efter en belastad dag
  följer **två dagar som varken bär ett hårt pass eller långpasset**. Talet står i
  `intensity.minEasyDaysAfterHard`. Långpasset räknas som belastning, så en vecka bär **högst
  två** belastade dagar: kvalitetsdagen och långpassdagen. Regeln gäller över veckogränsen.

  Skälet, ur tränargranskningen 2026-10-29: hårda pass på onsdag, fredag och söndag bryter inte
  mot R-16 — de ligger inte två dagar i rad — men tre tunga dagar i en vecka utan helvila
  emellan tömmer depåerna ändå. Det räcker inte att belastningen är utspridd i kalendern.

  Följden för planeringen: det hårt bundna passet väljer dag **först**. Ett hårt pass har med
  den här regeln bara någon enstaka möjlig dag, medan ett lugnt pass passar nästan var som
  helst. Får de lugna passen välja först tar de dagen det hårda behövde, och då finns ingen
  tillåten dag kvar.

- **R-44** (tillagd 2026-10-29) **Tak per ersättning.** En ersättning kan ha ett eget tak per
  pass, i `substitutions.bySport` med `maxMinutes` och `overflowKey`. **I dag har bara
  stakmaskinen ett: 90 minuter, resten som stavgång i backe.**

  Passet **behåller sin tid** — skidträningen behövs — men instruktionen säger hur den delas,
  och nämner att tiden på trainern inomhus fungerar lika bra. Det blir inget andra pass av det:
  en dag bär ett pass (R-42), och det här är ett pass som görs på två sätt.

  Skälet, ur tränargranskningen: två och en halv timme i stakmaskin är samma rörelse hela vägen.
  Det sliter på armbågar och axlar jämfört med att åka skidor, och är dessutom tungt att hålla
  ut. Stavgång i backe är fullgod skidträning (R-17), så delningen kostar ingenting.

- **R-45** (tillagd 2026-11-04) **Fullt fokus de sista veckorna före ett lopp.** Ett lopp kan ha
  ett tal för hur många veckor före loppveckan som hela konditionstiden går till loppets gren.
  De övriga grenarna **pausas** de veckorna. Talet står per lopp i `races.json` som
  `fullFocusWeeks`, och talet är **`taperWeeks` + 1**: nedtrappningen plus den sista
  loppspecifika veckan. *(Utökad 2026-11-04 från bara Vasaloppet till alla lopp.)*

  | Lopp | Veckor | Varför |
  | --- | --- | --- |
  | Vasaloppet | **3** | taperWeeks 2 + 1 |
  | Vätternrundan | **3** | taperWeeks 2 + 1 |
  | Vansbrosimningen | **2** | taperWeeks 1 + 1 |
  | Lidingöloppet | *inget* | se nedan |

  Skälet: tre veckor före Vasaloppet gör ingen nytta i bassängen. Det som avgör på nittio
  kilometer är skidtid, och de timmarna gör mer nytta där. Simningen och cyklingen tappar
  ingenting på tre veckors paus — men skidorna vinner tre veckor till.

  **Lidingöloppet saknar talet med flit.** Löptaket i R-14 begränsar hur mycket löptiden får
  öka från en vecka till nästa, eftersom löpning sliter mer än skidor och cykel. En vecka med
  bara löpning går därför inte att genomföra: med talet satt till 2 fick löpningen **trettiotvå
  procent** av veckan i stället för hundra, för taket höll tillbaka den och resten gick till de
  grenar som skulle vara pausade. Pausen blev alltså en paus bara på pappret. R-14 lades in för
  att stoppa en vecka där löpningen växte från nittio minuter till **åtta timmar**, och den
  regeln väger tyngre. *(Öppen fråga 10.)*

  **Vansbrosimningen har talet men får inga fokusveckor** i 2027-kalendern: loppet ligger tre
  veckor efter Vätternrundan, så dess veckor tillhör Vätternrundans block (R-03). Talet står
  där för kalendrar där loppen ligger längre isär.

  Regeln gäller bara veckor som har loppet som **fokuslopp**. Ligger två lopp tätt (R-03) ska
  det ena loppets slutspurt inte stänga av det andras uppbyggnad. Loppveckan själv är
  oförändrad: där gäller R-04, bara loppet och öppningspasset.

  **Regeln är knuten till loppet, inte till en position i planen.** En svensk klassiker går att
  börja när som helst på året, så vilket lopp som är först och vilket som är sist varierar
  (R-02). Fokusveckorna ligger omedelbart före Vasaloppets loppvecka vare sig det är planens
  första lopp, dess sista eller något i mitten — kontrollerat för alla tre ordningarna. Börjar
  planen närmare loppet än tre veckor blir det färre fokusveckor, inte en trasig plan.

  **Regeln väger tyngre än R-21, R-31, R-32, R-36 och R-39.** En gren som annars skulle tränas varje
  vecka — en nybörjargren med teknikpass, eller en gren vars egen uppbyggnad börjat — pausas
  ändå. Tre veckor är kort nog att tekniken sitter kvar.

  **En andra följd, hittad 2026-11-04:** en vecka där en gren är pausad får inte bli referens
  för R-14. Blev den det trodde löptaket att löptiden var noll, och då stängdes taket av helt —
  löpningen växte till åtta timmar veckan därpå. Pausade veckor hoppas nu över på samma sätt som
  avlastning, nedtrappning och loppveckor.

  **En följd som kostade tid att hitta:** när en gren äger hela veckan ska dess tid delas på
  veckans dagar, inte på två pass. Nedtrappningsveckan före Vasaloppet blev först **ett
  skidpass på fem timmar och fyra vilodagar**, eftersom uppdelningen föredrog två pass — en
  regel som var rimlig när en gren hade en liten andel. Nu används de platser grenen fått, och
  veckan blev fem skidpass à 68 minuter plus ett kort tempopass. Den oplacerade tiden i de sex
  profilerna sjönk samtidigt från 91 till 81 minuter.

- **R-46** (tillagd 2026-11-04) **Långpasset trappas upp varje vecka.** Inom en fas växer
  långpasset vecka för vecka och **krymper aldrig**. Lånet från de andra grenarna (R-13) följer
  tillväxtkurvan genom hela fasen, inte bara de sista veckorna.

  Skälet: en upptrappning minskar skaderisken, och det är hoppen som är farliga. Förut slogs
  lånet på som en knapp fyra veckor före loppet. Dessförinnan var långpasset bundet av grenens
  egen andel i R-08, och mot Lidingöloppet gav det den här formen:

  | | Före | Efter |
  | --- | --- | --- |
  | Långpass i löpning, vecka för vecka | 75, 75, 75, —, 75, **122**, 131, 132, 150 | 75, 84, 94, 103, 113, 122, 131, 132, 150 |
  | Största veckoökning | **+63 %** | +12 % |

  Fyra veckor stillastående följt av sextiotre procents ökning är precis vad en upptrappning
  finns för att undvika — och löpning är den gren som sliter mest.

  **Mätt utfall per gren** *(2026-11-04, de sex profilerna)*: största veckoökning av långpasset
  är **+12 % i löpning**, +51 % i cykel och +93 % i skidor. Att cykel och skidor hoppar mer är
  avsiktligt: där går långpassen att lägga utan att slita ut kroppen (R-32), och hoppen ligger i
  korta specifika faser där kurvan måste klättra från halva taket till hela på tre veckor. I
  löpningen, där det betyder något, är upptrappningen jämn.

  Två tak gäller fortfarande och kan binda före kurvan: grenens eget i R-13 och sjuttio procent
  av veckans konditionstid i R-28. Den som har sex timmar i veckan når därför högst 210 minuter,
  inte cykelns tak på 300 — ett långpass på fem timmar ryms inte i en sextimmarsvecka.

  `longSession.borrowInFinalWeeks` utgick samtidigt: lånet gäller hela fasen, så talet hade
  ingen läsare kvar.

- **R-47** (tillagd 2026-11-04) **Nästa lopps uppbyggnad börjar direkt efter det förra.** När
  ett lopp är avklarat och dess återhämtningsveckor är slut växlar fokus till **nästa lopp i
  datumordning** — inte till ett bestämt lopp. Efter Vansbrosimningen är det Lidingöloppet, om
  Vansbro inte är planens sista lopp.

  Det följer av R-02: en svensk klassiker går att börja när som helst på året, så vilket lopp
  som kommer efter vilket varierar. Kontrollerat 2026-11-04 för både höststart (P1: Vansbro
  vecka 36, återhämtning vecka 37, Lidingöuppbyggnad från vecka 38) och vårstart (P6: Vansbro
  vecka 10, återhämtning vecka 11, Lidingöuppbyggnad från vecka 12).

  **Och man får cykla i stället för att springa.** Varje långpass i löpning erbjuder cykel som
  alternativ med noteringen *"sliter mindre på kroppen"* (R-37). Passet är det primära och
  grenen ett val — det gäller särskilt löpningen, som sliter mest.

- **R-48** (tillagd 2026-11-04) **Uppmuntran på långpasset när riktmärket inte nås.** Når planen
  inte ett lopps volymriktmärke (R-34) får **långpassen i den grenen före loppet** ett tillägg i
  sin instruktion: har dagen mer tid än planen räknat med är det det här passet som ska
  förlängas. Texten står i `warnings.volumeMilestone.sessionEncouragement`.

  Skälet: varningen i R-34 står i planens topp, men beslutet tas på **passet**. Den som har
  begränsat med tid når inte tusen kilometer på cykel före Vätternrundan, och då är det värt att
  säga var de extra minuterna gör mest nytta — i långpasset, inte i ett extra pass.

  **Tonen är ett erbjudande, inte ett krav.** Användaren har valt sina timmar själv och planen
  räcker för att klara distansen. Lärdomen från v0 gäller: en varning ska betyda "det här når
  inte ditt mål", aldrig "du tränar för lite". Texten säger därför uttryckligen att planen räcker,
  och ett test underkänner formuleringar som "du måste", "du borde" och "för lite".

  **Motorn ändrar aldrig planen för att nå ett riktmärke.** R-48 lägger till text, ingenting
  annat — passlängder, tider och zoner är oförändrade. Tillägget läggs på efter att veckorna är
  byggda, eftersom det kräver hela planen för att räknas ut.

  Uppmuntran står bara på **långpass**, bara i den gren som missar sitt riktmärke, och bara på
  pass **före** loppet. Efter loppet är riktmärket inte längre något att närma sig.

  Mätt 2026-11-04: ingen av de sex profilerna med full förberedelsetid får uppmuntran längre —
  upptrappningen i R-46 tog P1 från 900 till över tusen kilometer. Den som startar i januari med
  sex timmar i veckan hamnar på 992 km och får uppmuntran på elva pass; vårstarten P6, som bara
  har sex och en halv vecka till Vätternrundan, får den på fem.

- **R-33** (tillagd 2026-10-28) **Teknikpass under återhämtningen.** Pass i en teknikgren blir
  teknikpass i stället för vanliga pass under återhämtningsveckorna. Grenarna står i
  `recovery.techniqueSports` i `config/rules.json` och är simning och längdskidor.

  Kroppen ska få vila efter ett långt lopp, men tekniken tappas fort — särskilt i simning, där
  det inte hjälper att ha cyklat. Ett teknikpass håller den uppe utan att belasta: kort, lugnt
  och med fokus på rörelsen i stället för på tiden. Det är därför veckan efter Vätternrundan
  innehåller ett simteknikpass fast den i övrigt är vila.

- **R-34** (tillagd 2026-10-28) **Volymriktmärke per lopp.** Ett lopp kan ha ett riktmärke för
  **Varför bara Vätternrundan har ett tal** *(besvarat vid tränargranskningen 2026-10-29)*.
  För de övriga tre loppen finns inget motsvarande riktmärke, och det är inte en lucka utan
  ett svar:

  - **Vasaloppet:** desto mer tid på skidor desto bättre — det finns inget tak och inget
    tydligt golv. Går det inte att komma åt snö är rullskidor eller stakmaskin vägen, och ett
    skidläger för att få *någon* tid på snö är viktigare än ett kilometertal.
  - **Vansbrosimningen:** det avgörande är att känna sig van i vattnet, inte att ha simmat ett
    visst antal kilometer. Se R-38.
  - **Lidingöloppet:** inget tal angivet.
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

- **R-10** Styrka räknas in i veckotiden: **1 pass à 60 minuter** i bas och specifik fas, inga i nedtrappning och återhämtning. *(ändrad 2026-10-29 efter tränargranskning: var 2 pass à 20 minuter i bas och 1 i specifik. Ett styrkepass på tjugo minuter ovanpå två löppass är inget styrkepass — se R-42.)* Övningar för bål, höft, vader och axlar från en fast lista i `config/sessions.json`. *(utökad 2026-10-28)* Styrkan viktas mot veckans fokuslopp där grenen kräver det: inför **Vasaloppet** mot överkropp och bål, eftersom stakningen kommer därifrån. Texten och övningslistan ligger i `strengthVariants.byRace` och `strengthExercises.byRace` i `config/sessions.json`; saknas loppet används den allmänna. Arrangörens eget råd är att styrkan ska vara allmän, funktionell och skadeförebyggande, med extra överkropp särskilt före skidor.

**Pass**

- **R-11** Antal träningsdagar: T ≤ 5 ger 4 dagar, T 6–9 ger 5 dagar, T ≥ 10 ger 6 dagar. Minst en helt vilodag i veckan. *(utökad 2026-10-28)* **Användaren väljer vilken dag som är vilodag.** Den dagen lämnas helt fri varje vecka — det enda som får ligga där är ett lopp eller dess öppningspass, eftersom R-04 väger tyngre. Formuläret föreslår måndag, dagen efter helgens långpass.
- **R-12** Passlängd 20–300 minuter. *(utökad 2026-10-28)* Räcker veckans tid inte till ett pass i varje gren behåller fokusgrenen sin andel, och **de övriga grenarna roterar mellan veckorna** — urvalet styrs av veckonumret, aldrig av hur mycket tid grenen har. Annars stryks samma gren varje vecka: simningen har minst tid och tränades aldrig alls i profil P3, trots att Vansbrosimningen är ett av dess lopp. Varje gren som väljs fylls upp till minst ett helt pass innan resten fördelas efter grenarnas andelar.
- **R-13** Ett långpass per vecka i loppets sport under **bas- och specifik fas** *(basfasen tillagd 2026-10-28)*. *(ändrad 2026-10-28)* Passet läggs på **den dag användaren valt** — vilken dag som helst i veckan, inte bara helgen. Appen är byggd för folk med jobb, och alla har inte helgen fri; ett långpass på en söndag man arbetar är ett pass man inte kan göra. Formuläret föreslår söndag. Är den valda dagen upptagen av ett lopp eller ett öppningspass flyttas långpasset till den sista fria av `longSession.allowedWeekdays`, och i sista hand till någon annan fri dag — hellre ett långpass på fel dag än inget långpass. Grenens tak är: skidor 240 min, cykel 300 min, löpning 150 min, simning 75 min. Det börjar på `startShareOfCap` av sitt tak i fasens första vecka och når taket i den sista; blir det kortare än `longSession.minMinutes` blir det inget långpass.

  **Kurvan går genom båda faserna** *(ändrad 2026-10-28)*. Basen växer från en fjärdedel till hälften av grenens tak, och den specifika fasen tar vid där basen slutade: från hälften till taket. Talen ligger i `longSession.growthByPhase` i `config/rules.json`. Grundperioden är där uthålligheten byggs, och ett kvartal utan ett enda längre pass är svårt att försvara. För Vasaloppet blir kurvan 68 → 120 minuter genom basen och 135 → 240 genom den specifika fasen.

  Nedtrappning och återhämtning har inget långpass. Räcker grenens tid inte till `longSession.minMinutes` blir det inget långpass den veckan — hellre inget än ett som bara heter så.

  **Långpasset får låna tid från de andra grenarna** *(tillagd 2026-10-28, utökad till hela fasen 2026-11-04 — se R-46)*, upp till taket på 70 procent i R-28. Utan lånet binds långpasset av grenens andel i R-08 och hinner aldrig bli långt nog: Vasaloppets längsta pass stannade på 45 procent av loppets tid och Vätternrundans på 28 procent. Ett långpass på tre timmar inför 315 kilometer på cykel är inte en förberedelse. Lånet tas från de övriga grenarna i proportion till deras tid, så veckans totala tid är oförändrad (R-29). Det följer också arrangörens eget råd: träna mer specifikt perioden närmast varje tävling.
- **R-28** (tillagd 2026-10-27) Långpasset får ta högst 70 % av veckans tid, utöver taken i R-13. Vid T = 6 timmar skulle ett cykelpass på 300 minuter annars vara 83 % av veckan.
- **R-30** (tillagd 2026-10-27) Varje pass har en titel och en instruktion från `config/sessions.json`. **En instruktion per passtyp, 8 totalt**; sportspecifika varianter läggs till bara där sporten ändrar innehållet. Saknas en kombination som motorn kan producera är det ett testfel, inte ett tomt fält. *(utökad 2026-10-28)* Grenspecifika varianter finns nu också där **loppet** ändrar vad passet innehåller, inte bara där grenen gör det: löpningens långpass och lugna pass nämner kuperad terräng och mjukt underlag eftersom Lidingöloppet är terränglöpning, och cykelns långpass nämner klungkörning — som ett **tips**, eftersom alla inte har någon att cykla med, och med ett uttalat tillägg att passet duger lika bra ensamt.

  **Lopptaktik per lopp** *(tillagd 2026-10-29, efter tränargranskning)*. Loppdagens instruktion får ett tillägg ur `raceNotes.byRace` i `config/sessions.json`: motströmmen i Vanån de första kilometrarna, klungan i Vätternrundan, att Lidingöloppet avgörs på sista milen, och att äta tidigt i Vasaloppet. Det är råd man **förhåller sig till**, inte tränar på, och de står därför bara på loppdagen — aldrig på ett träningspass.
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

- **R-15** Bas: alla pass i zon 1–2 utom ett tröskelpass i zon 4 per vecka. Specifik: ett tröskelpass i zon 4 och ett intervallpass i zon 5 per vecka; nivå Ny i sporten får bara zon 4. Nedtrappning: korta inslag i zon 4 — **högst 20 minuter**, `maxHardMinutes` i `config/rules.json` *(preciserad 2026-10-28)*.

  **Skalan har fem zoner sedan 2026-11-10.** Fram till dess hade vi fyra, och då betydde vår
  "zon 3" tröskel medan zon 3 på användarens pulsklocka är en hel zon lättare. Den som följde
  siffran körde alltså sitt kvalitetspass för lugnt, varje vecka. Jämförelsen mot SPÅRAT:s
  längdguide avslöjade det: guiden använder fem zoner, och dess zon 4 motsvarade vår zon 3.
  Omräkningen var 1→1, 2→2, 3→4 och 4→5. **Zon 3 används inte av motorn** — polariserad träning
  ligger lugnt eller hårt, inte däremellan — men den finns i skalan för att numreringen ska
  stämma med klockan. Utan en siffra blev det ett helt tröskelpass på upp till två timmar veckan före loppet, vilket motsäger både regelns ord och arrangörens råd att träna mindre och lugnare den sista veckan. De minuter som kapas bort flyttas till lugna pass, så veckans tid är oförändrad (R-29). Återhämtning: bara zon 1–2.

  **Pratprovet fungerar inte i vattnet** *(tillagt 2026-10-29)*. Zontexterna i tabellen ovan beskriver ansträngning med hur mycket man kan prata, vilket går på skidor, cykel och i löpning — men inte när man simmar. Simningen har därför egna zontexter i `intensity.zoneTextBySport.swim`, som mäter på **andningen** i stället:

  | Zon | Text för simning |
  | --- | --- |
  | 1 | Mycket lugnt |
  | 2 | Lugnt – du andas var tredje tag och håller samma rytm hela passet |
  | 3 | Måttligt – du behöver andas varannat tag |
  | 4 | Hårt – du andas varje tag |

  Simningens lugna pass har också en egen instruktion, av samma skäl.
- **R-16** Aldrig pass i zon 4–5 två dagar i rad. *(utökad 2026-10-29: numera två lugna dagar, och långpasset räknas som belastning — se R-43. R-16 är kvar som den undre gränsen.)*

**Ersättningar, teknik och säsong**

- **R-17** *(omskriven 2026-11-04)* **Skidor utan snö.** Snö är det enda som begränsar
  träningen, och snö kräver **två saker**: en månad i `season.winterMonths` (november–mars)
  **och** att användaren kommer åt ett spår (`substitutions.snowNeeds`). Saknas något av dem
  görs passet som **rullskidor** om användaren har dem, annars **stakmaskin**, annars
  **stavgång i backe** — i den ordningen, med samma tid och samma zon.

  Båda villkoren behövs: november till mars räddar inte den som bor där det aldrig ligger snö,
  och ett spår hjälper inte i juli.

  Passet **behåller grenen**: det tränar fortfarande mot Vasaloppet, och det ska synas i
  planen. Stavgång i backe är skidträning, inte en nödlösning — bor man där det inte finns snö
  är det så man tränar för Vasaloppet, och det är bra träning. Gränssnittet ska därför visa
  "Stavgång i backe — Längdskidor", aldrig "i stället för längdskidor".

  Skidor och cykel är i övrigt **förutsatta**: ska man göra en svensk klassiker behöver man
  kunna träna på det man ska. Utrustningsfrågorna gäller bara komplement — se K-04.

  Profil **P4 kommer inte åt snö**, och får därför stavgång i backe för alla femton skidpassen
  i november–december. Det är Skåne-fallet, och det är vad frågan finns för.
- **R-18** ~~Simning utan simhall: simpass ersätts med torrövningar för simteknik utanför
  `season.openWaterMonths`.~~ **Borttagen 2026-11-04.** Simpass ersätts inte längre. Kan man
  inte simma behöver man lära sig det, och det görs i en simhall — gummiband och rörlighet för
  axlarna är inte simträning, och ett pass som heter "Simträning på land" i zon 5 är en
  motsägelse. Saknas simhall är det användarens sak att lösa. Simpassen planeras som simpass,
  och R-21:s kursråd står kvar för den som är ny i grenen.

  Följden: `equipment.pool` påverkar inte längre planen alls. Frågan står kvar i formuläret
  (K-04) men styr ingenting — se öppen fråga 8 i avsnitt 3.
- **R-19** Pass i öppet vatten planeras bara juni–augusti och har alltid säkerhetstexten från avsnitt 8. *(preciserad 2026-10-28)* Simpass juni till augusti planeras som öppet vatten och bär säkerhetstexten i fältet `safetyNote`. Texten sätts aldrig på ett ersatt pass — ett skidpass som blivit stavgång i backe behöver ingen varning om köldchock. *(2026-11-04: simpass ersätts inte längre, se R-18.)*
- **R-20** *(omskriven 2026-11-04)* **Cykel inomhus på vintern.** Cykelpass under
  `season.winterMonths` görs **inomhus** — trainer, spinning eller motionscykel — för den som
  har tillgång till det. Saknas den planeras passet som vanligt cykelpass.

  Det här är **ingen ersättning** utan en säsongsvariant: samma gren, samma tid, samma zon,
  annan plats. Alla som gör en klassiker har cykel, så det finns inget att ersätta. Därför
  behåller passet också sina alternativ (R-37), till skillnad från ett pass som bytt gren.

  Det tipset som hör till utomhuscykling står inte i inomhusvarianten — det finns ingen klunga
  att ligga i på en trainer.
- **R-21** Nivå Ny i skidor eller simning: ett teknikpass per vecka i den sporten under bas och specifik fas, och en rekommendation om kurs i översikten. *(preciserad 2026-10-28)* Teknikpasset tas **före** veckans hårda pass — är man nybörjare avgör tekniken mer än intensiteten. Kursrekommendationen ges bara för grenar vars lopp faktiskt ingår i planen; ett simråd till den som inte ska simma Vansbrosimningen är bara brus. Texterna ligger i `technique.courseAdvice` i `config/rules.json`.

  **Teknikpasset går före långpasset också** *(preciserad 2026-11-05, beslut om fynd F-8)*. Meningen
  ovan nämnde bara det hårda passet, och motorn gav därför grenens enda pass till långpasset.
  Hur det löses skiljer sig mellan grenarna, eftersom bara simningen har ett nybörjartak:

  - **Simning: det enda passet är teknikpasset.** R-31 ger nybörjaren ett simpass i veckan, och
    två går inte att få in — R-40:s golv på 60 minuter mot R-31:s tak på 80 gör det aritmetiskt
    omöjligt. Då ska passet vara teknik. Tekniken är det som gör 3 km i Vansbroån görbart, och
    ett nybörjarprogram som ger 28 veckor långpass och aldrig ett teknikpass tränar fel sak.
    Grenen har alltså **inget långpass** medan nivån är Ny.
  - **Skidor: båda passen, och långpasset krymper.** Skidor har inget nybörjartak, så tiden finns.
    Teknikpasset tar `session.minMinutes` och långpasset resten, men aldrig under sitt eget golv
    `longSession.minMinutes` — 76 minuter blir alltså 45 + 31, inte ett enda pass. **Långpasset
    får inte utgå.** Tekniken avgör i Vasaloppet, men loppet tar tio timmar, och den som inte
    byggt uthållighet klarar det inte hur fin stakning hon än har. Räcker inte tiden till båda
    golven (65 minuter) behåller långpasset veckan.

- **R-49** (tillagd 2026-11-05) **Generalrep före loppet.** Grenens sista pass före
  nedtrappningen mot ett lopp bär en påminnelse om att köra passet i den utrustning man tänkt
  tävla i. **Ett pass per lopp**, aldrig fler.

  **Varför just det passet.** Upptäcker man att skorna skaver, att gelen inte går ner eller att
  våtdräkten stryper över halsen ska det finnas tid kvar att göra något åt det. Ligger
  generalrepet inne i nedtrappningen återstår bara att hoppas. Står det på varje långpass slutar
  man läsa det — samma lärdom som ligger bakom att fokusloppet står på veckan och aldrig på ett
  enskilt pass.

  **Aldrig på ett ersatt pass.** Utrustningen går inte att prova i en ersättning: "kör passet i
  din Vasaloppsutrustning" på en stavgångsrunda i backe är ett råd som inte går att följa. Har
  grenen bara ersatta pass — ingen snö alls — blir det **inget** generalrep i den grenen, och
  det är avsiktligt. P4 har noll av den anledningen.

  **Saknar grenen långpass** tas grenens sista pass i stället. Den som är ny på simning har bara
  ett teknikpass (R-21), och det är just hon som behöver prova våtdräkten före Vansbro.

  Texterna ligger i `sessions.json` som `rehearsalNotes`, en per gren. De säger med flit
  ingenting om mat och dryck — det står redan i långpassets instruktion.

  Idén är hämtad ur SPÅRAT:s längdguide, som kör ett genrep två veckor före Vasaloppet. Här är
  den generaliserad till alla fyra loppen, eftersom en klassiker har fyra uppsättningar
  utrustning att prova.

**Varningar**

- **R-22** Mindre än 8 veckor från start till första lopp: "Du har kort tid att förbereda dig. Planen är försiktig – sikta på att genomföra, inte på tid."
- **R-23** ~~T under 4 timmar när Vasaloppet eller Vätternrundan ingår, eller under 3 timmar
  annars.~~ **Borttagen 2026-10-29**, ersatt av golvet i R-41. Varningen kunde inte längre gå av,
  och en varning om att golvet är "i minsta laget" skulle motsäga golvet: sex timmar räcker till
  tusen kilometer på cykel före Vätternrundan. Numret står kvar för att hänvisningar i resten av
  dokumentet ska fortsätta stämma.
- **R-24** Vasaloppet med nivå Ny i skidor och varken snö, rullskidor eller stakmaskin: "Teknik är avgörande i Vasaloppet. Försök att åka på snö eller gå en skidkurs före loppet."

- **R-26** (tillagd 2026-10-27) Spänner loppen över mer än tolv månader: "Dina lopp ligger mer än tolv månader isär. För att räknas som En svensk klassiker ska alla fyra genomföras inom tolv månader." Planen skapas ändå. Kontrollen är det som gör planen till en klassikerplan och inte bara ett träningsprogram.
- **R-34** (tillagd 2026-10-28) Planen når inte ett lopps volymriktmärke: "Med dina timmar hinner du ungefär {km} km på {sport} före {race}. Många siktar på {milestone} km innan loppet. Planen är lagd för att du ska klara distansen, men vill du komma närmare riktmärket behöver du fler timmar eller fler veckor." Tonen är medveten: varningen betyder "det här når inte riktmärket", aldrig "du tränar för lite". *(2026-11-04: samma besked finns nu också på långpasset, se R-48.)*
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
| Lagring | Webbläsarens localStorage, alltid inom try/catch; egen `storageVersion` *(förtydligad 2026-10-28)* |

**Mappstruktur**

```text
config/            races.json, rules.json, sessions.json, explanations.json
prompts/           phase-explanations.v1.md – prompten som texterna skrevs med
src/engine/        regelmotorn – rena funktioner, ingen Next.js, ingen AI
                   weeks, budget, sessions, warnings, volume, dates, config, types
src/ui/            formulär, planvy, texter och lagring  (ändrad 2026-10-29:
                   hette src/components/, men texter och lagring hör hit med)
src/app/           sidan som binder ihop dem
tests/             enhets-, invariant- och datumtester
docs/              kravspec-v1.md (den här fliken som Markdown)
scripts/           print-profiles.ts – skriver ut P1–P6 som text för granskning
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
  schemaVersion: 5;           // höjd 2026-10-29: mål per lopp tillkom (R-38)
  today: string;              // YYYY-MM-DD
  startDate: string;          // YYYY-MM-DD
  races: { id: RaceId; date: string; goal: 'finish' | 'time' }[];   // R-38
  levels: Partial<Record<'ski' | 'bike' | 'swim' | 'run', Level>>;
  hoursPerWeek: number;       // 6–15 (R-41)
  // equipment: snötillgång plus komplementen (R-17, R-20). Skidor och cykel är
  // förutsatta. Ändrad 2026-11-04; schemaVersion 3 → 5 i två steg samma dag.
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
  schemaVersion: 5;
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
| Tillgänglighet | Semantisk HTML, går att använda med tangentbord, god kontrast, sporter visas med både färg och text. **Kontrollerat 2026-10-29:** rubriknivåer utan hopp, varje fält har etikett, varje fältgrupp har legend, allt interaktivt nås med tangentbord, `lang="sv"`, och all text klarar WCAG AA (lägsta uppmätta 4,73:1) |
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
| P3 Den begränsade | Alla fyra | 6 | Van i allt | Bara cykel |
| P4 Kort tid | Bara Vasaloppet, 6 veckor efter start | 6 | Ny i skidor | Ingen |
| P5 Lopp tätt | Vätternrundan och Vansbrosimningen, 2 veckor isär | 8 | Van i båda | Cykel och simhall |
| P6 Vårstart | Alla fyra, start 2027-05-03, Vasaloppet sist (mars 2028); långpass onsdag, vila söndag | 8 | Ny i skidor, Van i övrigt | Simhall och cykel |

**Invarianter** (gäller för P1–P6 och ska testas för varje vecka)

- Veckans totala tid överskrider aldrig fasens tid enligt R-05–R-07
- Minst en vilodag per vecka (R-11)
- Aldrig pass i zon 4–5 två dagar i rad (R-16)
- Motorn planerar aldrig zon 3 — skalan har den för klockans skull, träningen är polariserad (R-15) *(tillagd 2026-11-10)*
- Återhämtningen efter ett lopp finns kvar och kortas bara så att den inte går in i nästa loppvecka (R-03) *(tillagd 2026-10-28)*
- En gren man bara vill ta sig i mål i får mindre tid än en man siktar på en tid i, men aldrig noll (R-38) *(tillagd 2026-10-29)*
- Inget simpass beskriver ansträngningen med hur mycket man kan prata (R-15) *(tillagd 2026-10-29)*
- En gren som väntar får noll minuter, också via löptaket, och veckans fokusgren väntar aldrig (R-39) *(tillagd 2026-10-29)*
- Inget pass är kortare än sin grens golv, utom öppningspasset dagen före loppet (R-40) *(tillagd 2026-10-29)*
- Inget pass är längre än sin grens tak (R-40) *(tillagd 2026-10-29)*
- Ingen dag bär mer än ett pass, och styrkepasset ligger ensamt på sin dag (R-42) *(tillagd 2026-10-29)*
- Långpasset är veckans längsta pass, i alla grenar (R-42) *(tillagd 2026-10-29)*
- Antalet pass är aldrig fler än veckans träningsdagar (R-11, R-42) *(tillagd 2026-10-29)*
- Veckan bär högst två belastade dagar, och aldrig två inom två dagar — inte heller över veckogränsen (R-43) *(tillagd 2026-10-29)*
- Passen plus den oplacerade tiden är exakt veckans budget, och oplacerad tid är alltid mindre än ett pass (R-29, R-40) *(tillagd 2026-10-29)*
- En gren som måste tränas får sitt pass varje vecka där veckan har tid alls (R-31, R-39, R-40) *(tillagd 2026-10-29)*
- Pass i simning och längdskidor är teknikpass under återhämtningsveckorna (R-33) *(tillagd 2026-10-28)*
- Inget pass i zon 4 överskrider 20 minuter i en nedtrappningsvecka, och veckans totala tid är ändå oförändrad (R-15) *(tillagd 2026-10-28)*
- Den valda vilodagen är helt fri varje vecka, med lopp och öppningspass som enda undantag (R-11) *(tillagd 2026-10-28)*
- En sport där nivån är Ny håller sitt veckotak i både minuter och antal pass, loppet och öppningspasset inräknade (R-31) *(tillagd 2026-10-28)*
- Summan av minuterna per sport plus de oplacerade minuterna är alltid exakt veckans konditionstid (R-29, R-31) *(tillagd 2026-10-28)*
- Skidorna får mer tid än cykeln i en basvecka november–mars, och cykeln mer än skidorna maj–september (R-32) *(tillagd 2026-10-28)*
- Varje gren i planen får tid varje vecka utom i loppveckan, också den säsongen tonar ner (R-32) *(tillagd 2026-10-28)*
- Långpasset ligger på den valda dagen när den är fri (R-13) *(tillagd 2026-10-28)*
- Reglerna om dagar i rad i R-14 och R-16 håller också över veckogränsen, söndag till måndag *(tillagd 2026-10-28)*
- Löptiden ökar högst 10 % mellan veckor, utom efter avlastning (R-14)
- Inga pass före startdatum eller efter sista loppet, och loppdagen innehåller bara loppet (R-01, R-04)
- Planen är aldrig längre än `weekTime.maxPlanWeeks`, och varken formulär, lagring eller motor släpper igenom indata som skulle bli det (R-01) *(tillagd 2026-11-05)*
- Ett skidpass står som skidpass bara när det finns snö — vintermånad och ett spår. Annars görs det som rullskidor, stakmaskin eller stavgång i backe, med tid och zon kvar (R-17) *(ändrad 2026-11-04)*
- Ett pass som bytt gren har inga alternativ; ett som bara bytt plats behåller dem (R-20, R-37) *(tillagd 2026-11-04)*
- Varje pass i zon 4–5 ligger i veckans fokusgren (R-42) *(tillagd 2026-11-04)*
- De sista veckorna före ett lopp med `fullFocusWeeks` får loppets gren hela konditionstiden, och de övriga noll (R-45) *(tillagd 2026-11-04)*
- Fokusveckorna ligger omedelbart före loppveckan oavsett var i planen loppet hamnar, och loppveckan själv är aldrig en av dem (R-02, R-45) *(tillagd 2026-11-04)*
- En pausad vecka blir aldrig referens för löptaket i R-14 *(tillagd 2026-11-04)*
- Löptaket i R-14 väger tyngre än pausen i R-45: en pausad gren får ta emot det taket skär bort *(tillagd 2026-11-04)*
- Långpasset krymper aldrig inom en fas, och i löpning växer det högst femton procent i veckan (R-46) *(tillagd 2026-11-04)*
- Varje långpass i löpning erbjuder cykel som alternativ (R-37, R-47) *(tillagd 2026-11-04)*
- Uppmuntran i R-48 står bara på långpass, bara i grenen som missar riktmärket och bara före loppet *(tillagd 2026-11-04)*
- R-48 ändrar bara text: inga passlängder, tider eller zoner rörs *(tillagd 2026-11-04)*
- Varje gren har exakt ett lopp — tre ställen i motorn letar upp "grenens lopp" och tar det första *(tillagd 2026-11-04)*
- Fokus växlar till nästa lopp i datumordning när det förras återhämtning är slut (R-02, R-47) *(tillagd 2026-11-04)*
- En gren som äger hela veckan delar sin tid på veckans dagar, inte på två pass (R-12, R-45) *(tillagd 2026-11-04)*
- Varje simpass juni till augusti har säkerhetstexten, och inget pass utanför dem har den (R-19)
- Generalrepet står på högst ett pass per lopp, i loppets gren, före nedtrappningen, och aldrig på ett ersatt pass (R-49) *(tillagd 2026-11-05)*
- En gren användaren är ny i har ett teknikpass i veckan under bas och specifik fas (R-21) *(tillagd 2026-10-28)*. Är man ny i simning är det grenens **enda** pass, och grenen har inget långpass; är man ny på skidor finns båda, och långpasset ligger på eller över sitt golv *(preciserad 2026-11-05)*
- Ett alternativ erbjuds bara när grenen är i säsong och användaren har utrustningen, och aldrig för lopp, vila, styrka eller teknik (R-37) *(tillagd 2026-10-28)*
- Sparad data valideras fält för fält och **till innehåll**, inte bara på versionsnumret och typen, och kastas när något inte stämmer (K-15) *(skärpt 2026-11-05)*
- Utrustningsfrågorna i formuläret och flaggorna i datamodellen är exakt samma mängd (K-04) *(tillagd 2026-11-05)*
- Appen fungerar när localStorage saknas, inte går att skriva till eller inte går att läsa (K-10) *(tillagd 2026-10-28)*
- Startsidan ritas alltid, också när den sparade planen är trasig — aldrig en tom sida (K-15) *(tillagd 2026-10-28)*
- Texterna i avsnitt 8 används ordagrant: ett test läser kravspecen och jämför, så att de två inte kan glida isär (K-01, K-11) *(tillagd 2026-10-29)*
- "Ändra svar" fyller formuläret med exakt de svar som sparades, och lämnar det aldrig tomt bredvid en sparad plan (K-13) *(tillagd 2026-10-29)*
- Samma indata ger samma plan (determinism)
- Varje pass är 20–300 minuter och har titel, instruktion och zon där zon gäller (R-12, R-30) *(tillagd 2026-10-27)*
- Varje pass av typen `race` har ett `raceId` som finns i `config/races.json` *(tillagd 2026-10-28)*
- Loppveckans budget är minskad med loppets uppskattade tid (R-25) *(tillagd 2026-10-27)*
- Andelarna mellan sporterna summerar alltid till 100 %, även när planen har en eller två sporter (R-08) *(tillagd 2026-10-27)*
- Planen överlever en rundtur genom lagringen: sparad och inläst plan är identisk med originalet *(tillagd 2026-10-27)*
- Varje fas i planen har en förklaring, och varje passtyp en instruktion (A-02, R-30) *(tillagd 2026-10-27)*

**Särskilda testfall**

- Loppen mer än tolv månader isär ger varningen i R-26, och planen skapas ändå. Skottdagen räknas rätt (R-26) *(byggd 2026-10-29)*
- R-22 och R-24 är inte byggda: se öppen fråga 7 i avsnitt 3 *(R-23 borttagen 2026-10-29)*
- P5 följer blocklogiken i R-03
- Datum: ISO-vecka 53 och årsskiftet 2026–2027, sommartid 28 mars 2027, och skottåret 2028 — en vårstart lägger Vasaloppet i mars 2028, så februari 2028 ligger inne i planen (ändrad 2026-10-28)
- Förklaringar: varje kombination av fas och lopp har en text, ingen text överskrider sin längdgräns, och ingen plan saknar förklaring
- Konfiguration: alla filer i `config/` validerar mot sina scheman
- **Slumpad egenskapstestning** *(tillagd 2026-10-27, **byggd 2026-11-04**)*: minst 200 slumpade men giltiga indata körs mot samtliga invarianter. Fem profiler räcker inte — i v0 var det slumptestningen som avslöjade att en gren aldrig tränades, vilket P1–P5 hade missat.

  Byggd som `npm run invariants`: generatorn i `tests/generators.ts`, de 34 motorinvarianterna i `tests/invariants.ts`, körningen i `scripts/check-invariants.ts`. Slumpen är seedad, så varje brott går att köra om med sitt seed. **Ännu ett skript och inte ett test** — den går röd, och CLAUDE.md förbjuder att committa röda tester. Fynden står nedan; när de är åtgärdade flyttas kontrollerna till `tests/properties.test.ts`.
- Plan med ett enda lopp: hela veckotiden går till den sporten, ingen andel blir ofördelad (R-08)
- Två lopp samma vecka: båda markeras, båda räknas som belastning, inget lopp försvinner (R-27)
- Lopp som spänner över mer än tolv månader ger varningen i R-26 men ändå en plan
- Start i var och en av årets tolv månader ger en hel plan där alla fyra loppen finns med, oavsett vilken ordning loppen kommer i (tillagt 2026-10-28)
- Alla sju veckodagar som långpassdag och som vilodag: planen håller samtliga regler i varje kombination (tillagt 2026-10-28)
- Plan med bara Vansbrosimningen och nivå Ny: veckan stannar på 80 minuter och resten redovisas som oplacerad tid (R-31) (tillagt 2026-10-28)
- Vårstart i maj med Vätternrundan i juni: planen når inte 1000 km och varningen i R-34 visas (tillagt 2026-10-28)
- Start 9, 10 och 11 veckor före loppet: varning, ingen varning, ingen varning (R-35) (tillagt 2026-10-28)
- Veckan efter Vasaloppet: cykeln är huvudgren och skidorna har högst 10 procent (R-36) (tillagt 2026-10-28)
- Samma mål på alla lopp ändrar ingenting; det är skillnaden mellan loppen som räknas (R-38) (tillagt 2026-10-29)
- Erfaren simmare: noll simning före Vasaloppet. Nybörjare: oförändrat (R-39) (tillagt 2026-10-29)
- Sex timmar i veckan: simningen blir hela pass de veckor den finns, inte tjugominuterspass varje vecka (R-40) (tillagt 2026-10-29)
- Fem timmar i veckan går inte att välja, och sex gör det (R-41) (tillagt 2026-10-29)
- Loppdatum 2927 i stället för 2027: formuläret säger till, och motorn vägrar bygga i stället för att hänga (R-01) (tillagt 2026-11-05)
- Sparad plan med `hoursPerWeek` utanför intervallet kastas vid inläsning (R-41, K-15) (tillagt 2026-11-05)
- Sparad plan med okänt lopp-id, dubblett, ogiltig nivå eller ogiltigt datum kastas vid inläsning (K-15) (tillagt 2026-11-05)
- Varje utrustningsfråga har ett standardvärde och når hela vägen till planen (K-04) (tillagt 2026-11-05)
- Vecka i specifik fas: en styrkedag à 60 min, en långpassdag och en kvalitetsdag med intervaller i zon 5 (R-42) (tillagt 2026-10-29)
- Kvalitetspasset ligger i fokusgrenen i varje vecka som har ett, och veckan är utan hellre än att passet flyttar (R-42) (tillagt 2026-11-04)
- De tre veckorna före Vasaloppet: allt är skidor, och simning och cykel är noll — också för nybörjaren (R-45) (tillagt 2026-11-04)
- Fyra veckor före Vasaloppet: ingenting pausat (R-45) (tillagt 2026-11-04)
- Veckorna före Vätternrundan: ingenting pausat, eftersom loppet saknar talet (R-45) (tillagt 2026-11-04)
- Vasaloppet först, sist och i mitten: tre fokusveckor i alla tre fallen, alltid direkt före loppveckan (R-02, R-45) (tillagt 2026-11-04)
- Start två veckor före Vasaloppet: en fokusvecka, inte tre (R-45) (tillagt 2026-11-04)
- Fokusveckor finns inför både Vasaloppet och Vätternrundan, inte bara ett av dem (R-45) (tillagt 2026-11-04)
- Fokusgrenen får hela veckan när den inte är löpning; Lidingöloppet saknar därför talet (R-14, R-45) (tillagt 2026-11-04)
- Långpasset i löpning mot Lidingöloppet: stiger varje vecka, aldrig fyra platta veckor följt av ett hopp (R-46) (tillagt 2026-11-04)
- Upptrappningen når grenens tak före loppet, utom för den som har för kort tid (R-46) (tillagt 2026-11-04)
- Efter Vansbrosimningens återhämtning är nästa veckas fokus Lidingöloppet, både vid höststart och vårstart (R-47) (tillagt 2026-11-04)
- Start i januari med sex timmar: 992 km mot riktmärkets 1000, och elva långpass på cykel bär uppmuntran (R-48) (tillagt 2026-11-04)
- Profil som når riktmärket: ingen uppmuntran någonstans (R-48) (tillagt 2026-11-04)
- Nedtrappningsvecka mot Vansbrosimningen: inget kvalitetspass alls, eftersom simningens golv är högre än taket på hårda minuter (R-15, R-40, R-42) (tillagt 2026-11-04)
- Nybörjare i två grenar på sex timmar: teknik går före kvalitetsdagen i de tunnaste basveckorna (R-21, R-42) (tillagt 2026-10-29)
- Stakmaskin utan snö: ett långpass över 90 min delas i instruktionen, ett under 90 min gör det inte (R-44) (tillagt 2026-10-29)
- Golvet på sex timmar räcker till volymriktmärket på 1000 km när hela året finns kvar (R-34, R-41) (tillagt 2026-10-29)
- Vecka där simningen får mer tid än ett pass rymmer: passet stannar på taket och resten flyttar eller redovisas som oplacerad tid (R-29, R-40) (tillagt 2026-10-29)
- Nedtrappningsvecka mot Vansbrosimningen: inget simpass på tjugo minuter, och veckans korta inslag i högre fart finns kvar (R-15, R-40) (tillagt 2026-10-29)
- Hela flödet vid 360 px: startsida, tre formulärsteg, planvy och öppnad vecka — ingen vågrät scroll, ingen tryckyta under 44 px (K-12) (tillagt 2026-10-29)
- Cykellångpass i mars erbjuder längdskidor som alternativ; samma pass i april gör det inte (R-37) (tillagt 2026-10-28)
- Profil utan spår och utan komplement: skidpassen blir stavgång i backe, också i januari (R-17) *(ändrat 2026-11-04)*
- Profil med spår: skidpassen i november–mars är orörda, och först utanför dem ersätts de (R-17) (tillagt 2026-11-04)
- Profil med rullskidor och stakmaskin: rullskidorna väljs först (R-17) (tillagt 2026-11-04)
- Cykelpass i januari med trainer: inomhus. Samma pass i juni: ute. Utan trainer: ute året om (R-20) (tillagt 2026-11-04)
- Samma profil med stakmaskin: skidpassen blir stakmaskin i stället för stavgång (R-17) (tillagt 2026-10-28)
- Simpass utan simhall ersätts aldrig, någon månad (R-18 borttagen 2026-11-04)
- Inget pass bär en zon som motsäger sin instruktion: ingen ersättning finns kvar som gör ett hårt pass till rörlighetsträning (R-15, R-18) (tillagt 2026-11-04)
- Lidingöloppets block när de tre andra loppen är avklarade: löpningen växer högst 10 procent i veckan (R-14) (tillagt 2026-10-28)
- Sparad plan i ett gammalt eller trasigt format: kastas, rensas och ger ett meddelande — aldrig en tom sida (K-15)
- Sparad plan med rätt versionsnummer men fel form: kastas också — det var v0:s fel (K-15) (tillagt 2026-10-28)
- "Gör en ny plan" frågar innan den raderar: ett program på fyrtiosju veckor ska inte gå att radera med ett felklick (K-10) (tillagt 2026-10-28)
- En ändrad bokstav i en fast text, eller en förvanskad unicode-escape, gör testet rött — det var v0:s fel (K-01, K-11) (tillagt 2026-10-29)
- Lopptaktiken står bara på loppdagen, aldrig på ett träningspass (R-30) (tillagt 2026-10-29)

**Definition of done per uppgift**

- Uppgiftens kriterier i backlogen är uppfyllda
- Tester finns för ny logik, och alla tester, lint och typkontroll är gröna
- Commit med uppgiftens id och en kort sammanfattning till Isabelle

**Definition of done för v1.0**

- [x] Alla Måste-krav är klara och testade *(2026-10-29)*
- [ ] Appen går att köra lokalt med `npm run dev` och fungerar i mobil *(ändrad 2026-10-28:
      demon körs lokalt, drift skjuts till efter demon)*
      **Återstår: prova på en riktig telefon.** Layouten är verifierad vid 360 px i en
      iframe, utan vågrät scroll och med alla tryckytor minst 44 px, men det ersätter inte
      en riktig skärm. Se *Visa appen i mobilen* i README.
- [x] Isabelle har granskat P1–P5 som text (via `scripts/print-profiles.ts`) och godkänt planerna *(2026-10-29)*
- [x] Varje fas har en granskad förklaring *(2026-10-29; en text per fas enligt A-02, krympt från en per fas och lopp)*
- [x] Varje passtyp har en granskad instruktion *(2026-10-29)*
- [x] README beskriver idé, hur man kör projektet och var kravspecen finns *(2026-10-29)*

### Fynd ur den slumpade egenskapstestningen *(2026-11-04)*

Första körningen *(2026-11-04)*: 34 invarianter mot 200 slumpade indata plus de sex profilerna. **Sex invarianter brutna.** Sviten på 462 tester var grön samtidigt — det är hela skälet att slumptestningen stod i kravspecen.

**Andra körningen *(2026-11-05)*: 46 invarianter.** Genomgången visade att tolv av avsnittets invarianter aldrig kommit med i harnessen, och inte de minsta — veckans tid mot fasens tak, att andelarna summerar till veckans tid, och att en avklarad gren slutar tränas hör till det mest grundläggande motorn gör. De tolv lades till, och två av dem hittade brott: **F-7 och F-8**.

**Metoden kostade tre felformuleringar innan den gav fynd.** Varje ny invariant prövades först mot de sex profilerna, eftersom de är genomgångna för hand. Tre var röda där, och alla tre var mina egna fel: R-32 tog inte hänsyn till att ett avklarat skidlopp flyttar tiden med flit (R-36), och inte till att nybörjarbonusen (R-09) tar tio procentenheter från den vana grenen — är man van på skidor och ny på cykel går cykeln om i en vintervecka, som den ska. R-21 trodde jag också var felformulerad av samma skäl, men den var det inte: att grenen bara har ett pass är just problemet, och vilket pass det ska vara blev beslutet nedan.

**Men R-36 var röd mot profilerna och är ändå ett fynd.** Det var premissen i `scripts/check-invariants.ts` som föll: skriptet påstod att röd mot profilerna betyder felformulerad invariant. Oftast gör det det, och nu säger skriptet "oftast" i stället.

F-1 är åtgärdad. Resten är inte. Etapp 1 skulle hitta, inte fixa.

| # | Invariant | Omfattning | Vad det är |
| --- | --- | --- | --- |
| ~~**F-1**~~ | ~~Inga pass före startdatum (R-01)~~ | **Åtgärdad 2026-11-04** | 0 av 200 planer. Den första veckan är nu avkortad — se R-01 |
| **F-2** | Oplacerad tid är mindre än ett pass (R-29) | **139 av 200 planer**, upp till 106 min/vecka | Med många timmar och få grenar kapas varje pass av långpassets längd, och resten får inte plats. Den avkortade första veckan står för en procent av minuterna |
| **F-3** | Ingen ny löpare får löppass två dagar i rad (R-14) | 35 planer | Reservutgången i `bestDateFor` tar vilken dag som helst när ingen är tillåten |
| **F-4** | Löpningens långpass växer högst 15 %/vecka (R-46) | 56 planer, upp till +29 % | Korta faser tvingar kurvan att klättra snabbare än taket |
| **F-5** | Fokusveckan ger loppets gren veckan (R-45) | 29 planer, ner till 13 % | R-31:s nybörjartak (80 min simning) krockar med R-45 — samma klass som R-14-krocken inför Lidingöloppet |
| **F-6** | Högst två belastade dagar, aldrig två inom två (R-43) | 1 plan, 4 brott | Samma reservutgång som F-3 |
| **F-7** | En avklarad gren tränas bara i sin egen säsong (R-36) | 130 planer, 826 brott → **77 planer, 412 brott** | Nybörjartakets överskott delas ut till grenen med mest utrymme, och det är den gren R-36 just nollat. **Halvt åtgärdad 2026-11-05** — resten blockerad bakom F-3, se nedan |
| **F-9** | Veckan har ett kvalitetspass (R-15, R-42) | 31 % → **28 %** av bas- och specifikveckorna | Långpasset tar fokusgrenens hela tid. **Delvis åtgärdad 2026-11-05** — resten kräver ett beslut, se nedan |
| **F-8** | En gren man är ny i får ett teknikpass i veckan (R-21) | 24 % → **6 %** av veckorna med en nybörjargren. **Åtgärdad 2026-11-05** | Grenen har bara ett pass och långpasset tar det. I simningen är det R-31:s tak mot R-40:s golv; i skidorna att långpasset tar hela grenens tid. **Avgjord 2026-11-05** — se R-21 |

**F-1 förklarade varför profiler inte räcker.** Alla sex startar på en måndag — 2026-11-02 och 2027-05-03 — så de prövar aldrig en start mitt i veckan. Av 200 slumpade startdatum låg 21 på en måndag.

**F-1 åtgärdades 2026-11-04**, och vägen dit är värd att minnas: det första försöket med en avkortad vecka gav fyra nya brott och **krascher i 18 av 200 planer** — `bestDateFor` returnerade `undefined` när veckan inte hade någon laglig dag kvar. Det andra försöket, att börja planen på nästa måndag, tappade ett lopp som låg mellan startdatumet och måndagen. Det tredje höll: delvecka med tiden skalad efter träningsdagar, inget långpass och inget hårt pass i stubbveckan, och ett platstak som inte kan tvinga fram pass utan dagar.

Längs vägen rättades tre buggar som inte hade med F-1 att göra: platsräkningens golv på en plats, fokusgrenens platsbehov som kunde överskrida veckans platser, och den tysta reservutgången i `bestDateFor` som nu returnerar null i stället för att krascha.

**F-2 steg från 128 till 139 planer** som följd: den avkortade första veckan har svårt att få sina minuter till hela pass. Den står för en procent av den oplacerade tiden, resten är F-2:s egen orsak.

**F-3 och F-6 är samma sak**, och den stod redan i kodanalysen 2026-11-03: `bestDateFor` faller tillbaka på vilken dag som helst när inget villkor går att uppfylla, utan att signalera. Det är etapp 2 i planen.

**F-5 är en regelkrock, inte en bugg.** Den behöver samma sorts beslut som Lidingöloppet fick: vilken regel som ger vika. Hör till Isabelle.

**F-8 är åtgärdad 2026-11-05 och F-9 delvis.** Två ändringar:

1. **Simningen har inget långpass medan nivån är Ny** (`long-session.ts`). Nybörjartaket ger ett
   simpass i veckan, och det ska vara teknikpasset.
2. **Fokusgrenen har ett golv i veckobudgeten** (`withFocusSportFloor` i `budget.ts`):
   långpassets golv plus ett passgolv till kvalitetspasset, plus ett till när grenen också ska ha
   teknikpass. Minuterna tas från de övriga grenarna, så veckans tid är oförändrad (R-29) — men
   **aldrig under R-09:s golv på halva den jämna andelen**. Den regeln väger tyngre; en vecka där
   fokus tar all tid från de andra är R-45:s sak.

Utfall: teknikpasset saknas nu i **6 procent** av veckorna i stället för 24. Kvalitetspasset
saknas i **28 procent** i stället för 31. Oplacerad tid (F-2) sjönk från 1 340 till 1 103 brott
och R-14 från 637 till 563.

**Priset: fem nya brott mot R-32 i en plan av 200.** Fokusgrenens golv kan ge cykeln mer tid än
skidorna i en vintervecka när Vätternrundan är nästa lopp. Golvet går före säsongsvikten, och det
är en avsiktlig avvägning — men den är mätt och står här.

**Varför F-9 inte blev klar.** Det naturliga nästa steget vore att låta långpasset krympa så det
lämnar plats — det var också det du valde den 2026-11-05 ("minuterna går till kvalitetspasset").
Det provades och **bröt mot tre regler du redan beslutat**:

| Regel | Vad som gick sönder |
| --- | --- |
| **R-13** | Långpasset får överstiga grenens andel när grenen är smal — ett tak tar bort lånet, och då blir cykelns långpass för kort inför 315 km |
| **R-46** | Långpasset krymper aldrig inom en fas — taket varierar med veckans budget och fick passet att gå 105 → 92 minuter |
| **R-13** | Långpasset ska nå grenens tak före loppet — med ett tak gör det inte det |

Fyra riktade tester gick röda. Att krympa långpasset är alltså fel lever: beslutet förutsatte att
det gick, och reglerna säger att det inte gör det. **Det som återstår av F-9 kräver att du avgör
vilken av R-13 och R-46 som får ge vika, eller om 28 procent är acceptabelt.** Hör till Isabelle.

**F-9 hittades 2026-11-05 vid en granskning mot SPÅRAT:s längdguide**, inte av harnessen. Guiden
säger att en träningsvecka har ett kvalitetspass, och att det är det *sista* man stryker när tiden
inte räcker. Vår motor stryker det först. Av 6 556 bas- och specifikveckor saknar **2 044** både
intervaller och tröskelpass.

Delvis är det med flit: R-21 säger att teknikpasset går före veckans hårda pass, och för en
nybörjare med sex timmar saknar 63 procent av veckorna kvalitetspass. Men en femtedel av veckorna
**utan någon nybörjargren alls** saknar det också, och det förklarar ingen regel.

**Orsaken är inte den jag först läste ur koden.** `hardSessionPlan` returnerar tomt när veckan
saknar fokuslopp (`src/engine/endurance.ts:536`), och det såg ut som den troliga förklaringen.
Mätningen av 777 sådana veckor gav **noll** av det slaget. Det som faktiskt händer:

| | andel |
| --- | --- |
| Fokusgrenen har exakt ett pass, och det är långpasset | **92 %** |
| Långpasset är längre än fokusgrenens hela veckobudget | **91 %** |
| Långpasset är minst två passgolv långt, så ett kvalitetspass hade rymts om det delat med sig | **95 %** |
| Fokusgrenens andel av veckan, i snitt | **26 %** |

Kedjan är: långpasset dimensioneras ur hela veckan (R-13) och lånar från andra grenar när grenens
egen tid inte räcker; både långpasset och kvalitetspasset ska ligga i fokusgrenen; långpasset
placeras först och tar allt. Kvar blir en vecka där fokusgrenen har ett enda pass och resten av
tiden ligger som lugna pass i andra grenar — i en vecka vars hela syfte är fokusgrenen.

**Det är samma rotorsak som F-8.** Där trängde långpasset undan teknikpasset i en nybörjargren;
här tränger det undan kvalitetspasset i fokusgrenen. Beslutet du tog för F-8:s skidor — båda passen
ryms, långpasset krymper mot sitt golv men utgår aldrig — har samma form som det som behövs här.
Det talar för att lösa dem tillsammans.

**F-7 är halvt åtgärdad 2026-11-05.** Säsongsdelen är gjord: en avklarad gren utanför sin säsong
får nu taket noll i `applyNewLevelLimits`, vilket både trimmar bort tid den fått och hindrar den
från att ta emot någon annans. P1:s skidor i juli gick från 35 minuter till noll, och brotten från
826 till 412 i 77 planer i stället för 130.

**Två lärdomar ur fixen.** Den första: spärren i `capRunVolume` har *tre* delar, och jag tog först
bara R-36-delen. Då rann de trimmade minuterna i stället in i en gren som väntar och gav **51 nya
brott mot R-39 i 21 planer** — ett fynd jag själv införde och som harnessen fångade direkt.
Delarna hör ihop: ett tak noll hindrar både att grenen får tid och att den tar emot någon annans.

Den andra: **resten av F-7 är blockerad bakom F-3.** I sin egen säsong ska grenen bara behålla
`keepShareInOwnSeason` — tio procent — och det är den gränsen som gäller, inte nybörjartaket.
Utan den klättrar simningen efter Vansbro upp till sitt tak på 80 minuter, 44 procent av veckan.
Taket är en rad kod. Men det frigör så mycket tid i veckorna efter ett lopp att den hamnar på
löpningen, och då bryts R-14 i *placeringen*: **sex riktade tester gick röda**, bland dem två som
säger att en ny löpare aldrig får löppass två dagar i rad. Orsaken är `bestDateFor`:s tysta
reservutgång på `src/engine/placement.ts:222` — `tillåtna.length > 0 ? tillåtna : dates` — som
struntar i samtliga dagregler samtidigt när ingen dag går att använda. Det är F-3, och den måste
göras först.

**Kostnaden för den halva som är gjord**, ärligt redovisad: R-14:s brott steg från 535 till 637,
och de drabbade planerna från 35 till 37 — seed 33 och 120 är nya, ingen plan blev ren. Samma
orsak: minuterna jag tar från skidorna i juli hamnar på löpningen och placeras två dagar i rad.
Oplacerad tid (F-2) steg från 1313 till 1340 brott, vilket är väntat: en gren som kapas till noll
måste lämna sina minuter någonstans.

**Den ursprungliga diagnosen, för protokollet.** `applyFinishedRaces` i `src/engine/budget.ts:708` gör rätt: den nollar den avklarade grenen och ger tiden till veckans fokusgren. Men `applyNewLevelLimits` på rad 267 körs efteråt, och den delar ut nybörjartakets överskott "en i taget till den sport som har mest utrymme kvar" — utan att veta något om R-36. Grenen med mest utrymme *är* den R-36 just nollat.

Det syns tydligast i en loppvecka: i P1:s vecka 36 går Vansbrosimningen, simningens nybörjartak på 80 minuter äts upp av loppet och öppningspasset, och de frigjorda minuterna går till skidor, cykel och löpning med 35 minuter var. Skidor i juli, ett halvår efter Vasaloppet. R-36 säger "utanför sin säsong får den ingenting".

Spärren finns redan formulerad en gång, för R-14:s löptak: "aldrig till en gren vars lopp är avklarat och som är utanför sin säsong (R-36)". Nybörjartaket behöver samma mening. Det är inte ett regelbeslut — det är två ställen som ska bete sig likadant och inte gör det.

**F-8 mättes fel först, och den felmätningen är värd att minnas.** Den första beskrivningen sa
"avlastningsveckorna" och utgick från P1:s vecka 4. En riktig mätning gav **522 veckor i 45 av 200
planer**, varav bara 106 är avlastningsveckor — och **436 av 522 är simning, inte skidor**. Felet
var att generalisera från den profil jag råkade titta på. Det är samma fel som F-1 handlade om.

**I simningen var det ingen regelkrock.** R-31 ger nybörjaren ett simpass i veckan med avsikt, och
R-40:s golv på 60 minuter mot taket på 80 gör ett andra pass aritmetiskt omöjligt. Båda reglerna
går att uppfylla samtidigt — om det enda passet *är* teknikpasset. Motorn lade det på långpasset.
Seed 17 visar vad det kostade: en nybörjare på simning med 13 timmar i veckan fick **28 veckor i
rad** med ett 75-minuters simlångpass och fyra lugna löppass, och aldrig ett teknikpass, inför
3 km i Vansbroån.

**I skidorna fanns tiden till båda.** 76 minuter rymmer långpassets golv på 45 plus ett teknikpass
på 31. Det var platsfördelningen som gav långpasset allt.

**Avgjord 2026-11-05.** Simningens enda pass blir teknik; skidorna får båda och långpasset krymper
mot sitt golv men utgår aldrig — loppet tar tio timmar, och teknik utan uthållighet bär inte dit.
Preciseringen står i R-21.

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

**Demomanus** — högst fem minuter *(fastställt 2026-10-29)*

**Demon körs lokalt** *(beslut 2026-10-28)* med `npm run dev` på Isabelles egen dator. Appen är statisk och behöver ingen server, så drift skjuts till efter demon. Kravet på noll kronor påverkas inte — det blir i stället noll konton också.

Fem minuter räcker inte till allt. Manuset nedan är skrivet för att **planen** ska
vara det man minns, inte koden.

| Tid | Vad | Poängen |
| --- | --- | --- |
| 0:00–0:45 | Startsidan, och problemet: fyra lopp, fyra grenar, ett år | Vanliga appar planerar en sport och ett lopp |
| 0:45–1:45 | Fyll i formuläret live som P1 | Tre steg, förvalda svar, inget att slå upp |
| 1:45–3:00 | Översikten: faserna, loppveckorna, "Nu"-markeringen | Programmet har en riktning, inte bara pass |
| 3:00–4:15 | Öppna en vecka: ett pass med zon, instruktion och alternativ | "Kan också göras som" — planen går att leva med |
| 4:15–5:00 | Varningarna och fasförklaringen | Appen säger ifrån när den inte räcker, och texterna är granskade |

**Det som inte hinns med** och som får bli frågor i stället: att motorn är fristående och
testad, säsongsviktningen, ersättningarna, och vägen framåt i avsnitt 12.

**Fyll i P1 så här** — öva på det så att det flyter:

- Alla fyra loppen, datumen är redan ifyllda
- Mål: ta mig i mål på alla fyra
- Ny på längdskidor och simning, van på cykel och löpning
- Sex timmar i veckan, långpass söndag, ledig måndag
- Simhall och cykel, inga skidor — då syns stavgången i backe, som är en poäng i sig

**Reserv för demon.** Skapa planen i förväg så att den redan ligger sparad i webbläsaren — då syns den direkt om formuläret krånglar. Ta också skärmdumpar. Appen gör inga nätverksanrop alls, så den fungerar utan uppkoppling.

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

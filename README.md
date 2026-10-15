# Klassikerplaneraren

En webbsida som genererar ett personligt träningsprogram för **En Svensk Klassiker**: fyra
grenar — längdskidor, cykel, simning och terränglöpning — som ska genomföras inom tolv månader.

Vanliga träningsappar planerar för en sport och ett lopp. En klassiker kräver att fyra grenar
fasas in över ett år, med fyra loppdatum att toppa formen mot, och med hänsyn till säsong — det
finns till exempel inte snö året runt eller överallt.

> Programmet är ett automatiskt förslag och ersätter inte medicinsk rådgivning.

## Status

MVP:n är färdig. Appen fungerar från formulär till färdigt program och kalenderfil:

- `src/generator/dates.ts` — datumaritmetik på ISO-strängar ✔
- `src/generator/timeline.ts` — vilka veckor programmet omfattar ✔
- `src/generator/phases.ts` — vilken roll varje vecka har ✔
- `src/generator/blocks.ts` — hur programmet delas i block ✔
- `src/generator/schedule.ts` — vilken veckodag varje pass hamnar på ✔
- `src/generator/sessions.ts` — vilka pass veckan innehåller ✔
- `src/generator/season.ts` — skidpass utanför snöperioden ✔
- `src/ics.ts` — exporten till kalenderfil ✔

Hela programmet täcks av egenskapstester: veckotimmarna håller sig inom budgeten, varje lopp får
nedtrappning och återhämtning, inga skidpass ligger på snö utanför snöperioden, och samma indata
ger alltid samma program.

## Kom igång

Kräver Node 20 eller senare.

```bash
npm install     # installera beroenden
npm run dev     # utvecklingsserver på http://localhost:5173
npm run check   # typkontroll + alla tester (kör detta före commit)
```

Övriga kommandon:

| Kommando | Gör |
| --- | --- |
| `npm test` | Vitest i watch-läge under utveckling |
| `npm run test:run` | kör testerna en gång |
| `npm run typecheck` | TypeScript utan att bygga |
| `npm run build` | produktionsbygge till `dist/` |
| `npm run preview` | visa produktionsbygget lokalt |

## De fyra varianterna

Vilken klassiker du gör avgör distanserna programmet tränar mot, och är därför det första du
väljer i formuläret.

| Variant | Skidor | Cykel | Simning | Löpning |
| --- | --- | --- | --- | --- |
| En Svensk Klassiker | 90 km | 315 km | 3 km | 30 km |
| En Svensk Klassiker – Halva | 45 km | 150 km | 1,5 km | 15 km |
| En Svensk Klassiker – Korta | 30 km | 100 km | 1 km | 10 km |
| En Svensk Klassiker – Tjej | 30 km | 100 km | 1 km | 10 km |

Varje gren har flera godkända lopp — skidor i den korta varianten kan vara Tjejvasan,
Nattvasan 30, Vasaloppet 30, Öppet Spår måndag 30, Kristinaloppet eller Engelbrektsloppet 30 —
men distansen är densamma inom varianten. Appen planerar därför mot distansen, inte mot ett
loppnamn.

I den hela klassikern godkänns Engelbrektsloppet 60 km istället för Vasaloppets 90 km. Åker du
det kryssar du i rutan under skidloppet, så tränar programmet mot 60 km. I de kortare varianterna
har Engelbrektsloppet samma distans som de andra skidloppen, och då visas ingen ruta.

Korta och Tjej har identiska distanser och ger samma program. Båda finns med för att du ska känna
igen din egen utmaning. Distanserna ligger i `src/variants.ts`, med källa och kontrolldatum.

Alla fyra loppen måste ligga inom en tolvmånadersperiod för att räknas som en klassiker. Du får
börja med vilken gren du vill.

## Så fungerar appen

1. Användaren väljer vilken klassiker hon gör, fyller i fyra loppdatum, sin nivå och sitt mål per
   gren, hur många timmar och dagar i veckan hon kan träna, vilken dag långpasset ska ligga på,
   vilka dagar som inte fungerar, när hon har tillgång till snö och vad hon har för utrustning.
2. `generateProgram()` tar den indatan och returnerar ett **program**: en lista veckor, där varje
   vecka har en fas, ett lopp den är periodiserad mot och ett antal pass.
3. Programmet sparas i webbläsaren och ritas upp vecka för vecka.
4. Programmet kan laddas ner som `.ics` och läsas in i en kalender. Varje pass blir en
   heldagshändelse med upplägg och intensitet i beskrivningen, och loppen läggs in som egna
   händelser. Filen byggs i webbläsaren och skickas aldrig någonstans.

Det finns ingen server och ingen databas. Allt körs i användarens webbläsare, och programmet
lämnar aldrig datorn.

## Loppdatum

Formuläret har en knapp som fyller i kommande loppdatum åt dig. Datumen ligger i
`src/race-schedule.ts` och hämtas **inte** live från arrangörernas sidor — appen har ingen
backend, och webbläsaren tillåts inte läsa andra webbplatser direkt. Listan uppdateras alltså för
hand, och `SCHEDULE_CHECKED` säger när den senast stämdes av.

Bara datum som gått att belägga finns med. Saknas ett lopp lämnas fältet tomt och appen säger
till — ett gissat datum vore sämre än inget, eftersom du skulle tro att det var kontrollerat.

Kontrollerat 2026-10-13:

| Lopp | Datum | Gäller |
| --- | --- | --- |
| Vasaloppet 90 km | 2027-03-07 | Hela |
| Vätternrundan 315 km | 2027-06-18 | Hela |
| Vansbrosimningen 3 km | 2027-07-10 | Hela |
| TCS Lidingöloppet 30 km | 2027-09-25 | Hela |
| Tjejvasan 30 km | 2027-02-27 | Korta, Tjej |
| Vansbro Halvsim 1,5 km | 2027-07-04 | Halva |
| Vansbro Kortsim 1 km | 2027-07-04 | Korta, Tjej |

Vätternrundan startar fredag kväll och avslutas under lördagen; vi föreslår startdagen, eftersom
det är då du ska vara i form. Stäm alltid av mot arrangören innan du anmäler dig.

## Så är koden uppdelad

```
src/
  generator/     ren genereringslogik — indata in, program ut
  storage.ts     allt som rör sparat program (localStorage i dag)
  ics.ts         program -> .ics
  ui/            rendering, formulär och all svensk text
  variants.ts    de fyra varianterna och deras distanser
  race-schedule.ts  kommande loppdatum som förslag
  recommendations.ts  riktmärken för veckotimmar och långpass
  types.ts       delade typer
  main.ts        startpunkt: kopplar ihop UI, generator och lagring
```

Tre regler håller det här begripligt:

- **Generatorn är ren.** Den läser inget, skriver inget och frågar aldrig vad klockan är —
  dagens datum skickas in som argument. Därför ger samma indata alltid samma program, och
  logiken kan testas utan webbläsare.
- **All lagring går via `storage.ts`.** Ingen annan fil nämner `localStorage`. Vill vi senare
  spara i ett användarkonto byts bara den filen.
- **Programmet är vanlig JSON.** Inga `Date`-objekt, inga klasser. Datum är strängar som
  `2026-06-19`. Därför kan det sparas, skickas och läsas tillbaka oförändrat.

## Så är genereringslogiken uppbyggd

Genereringen går från loppdatum till färdigt program i fyra steg:

1. **Tidslinjen läggs ut.** Perioden från dagens datum till det sista loppet delas i veckor, en
   per måndag. Första veckan är den du är i nu — du börjar träna i dag, inte nästa måndag — och
   sista veckan är den loppet ligger i, så att loppveckan själv ingår. Allt räknas i UTC, annars
   hoppar dygnen fel vid sommartidsskiftena.
2. **Varje vecka får en fas.** Avståndet till nästa lopp avgör: `uppbyggnad` längst bort,
   `bygge` inom åtta veckor, `toppning` de tre sista veckorna, `nedtrappning` den vecka loppet
   går och `återhämtning` veckan efter. Var fjärde vecka läggs dessutom en lugnare vecka in mitt
   i en uppbyggnad — kroppen blir starkare när den vilar, inte när den tränar.

   Ligger två lopp så tätt att veckan efter det ena är det andras loppvecka vinner nedtrappningen,
   för du ska prestera i helgen. Veckan flaggas då som `followsRace` så att passplaneringen kan
   göra den extra lätt. Med bara två veckor mellan loppen hinner formen inte toppas alls, och det
   är avsiktligt.
3. **Veckan fylls med pass.** Nästa lopps gren får långpasset och kvalitetspasset — det är den
   som ska toppas. Grenar där du är nybörjare hålls igång med ett pass i veckan hela året, för
   teknikgrenar går inte att komma ikapp på slutet: kan du inte simma i dag hjälper det inte att
   börja åtta veckor före Vansbro. Grenar du redan behärskar vilar tills de blir nästa lopp.
   Summan av veckans pass överstiger aldrig dina timmar.
4. **Säsongen anpassar grenarna.** Skidpass utanför din snöperiod byts mot det du har tillgång
   till: rullskidor för långpass, stakmaskin för intervaller, annars stavgång och överkroppsstyrka.
   Grenen försvinner aldrig ur programmet — bara formen ändras.

Varje steg är en egen funktion som tar ett värde och returnerar ett nytt. Inget steg ändrar
något som ett tidigare steg har byggt.

## Så läses programmet

Programmet är indelat i **block**. Ett block siktar mot ett lopp — eller mot två när de ligger
närmare varandra än fem veckor, som Vätternrundan och Vansbrosimningen. Fokuset står på blocket:

```
Block 1 — fokus Skidloppet          21 veckor · 2026-10-12 till 2027-03-01
Block 2 — fokus Cykelloppet och Simloppet   18 veckor
Block 3 — fokus Löparloppet         12 veckor
```

Det enskilda passet säger däremot ingenting om vilket lopp det tränar mot. Det står bara om det är
**kondition** eller **styrka**, vilken dag det ligger, hur långt det är och vad det går ut på:

```
Vecka 1 — Uppbyggnad                 Start 2026-10-12 · 6 h
  KONDITION  tisdag · Längdskidor (stakmaskin) · 1,5 h · Uthållighet   Nyckelpass
  KONDITION  torsdag · Simning · 1,5 h · Teknik                        Stödpass
  KONDITION  lördag · Längdskidor (stakmaskin) · 3 h · Långpass        Nyckelpass
```

Det är medvetet. Står det "intervaller mot Vasaloppet" på varje rad känns ett missat pass som ett
missat lopp — och du kommer att missa pass, för man blir sjuk och livet kommer emellan.

**Nyckelpass och stödpass** säger vad du ska prioritera när veckan inte räcker till: behåll
långpasset och kvalitetspasset, stryk resten. En vilodag är bättre än ett illa genomfört pass.

## Hur mycket tid behövs?

Formuläret visar ett riktmärke som följer både din variant och ditt mål:

| | Ta mig runt | God marginal | Tidsmål |
| --- | --- | --- | --- |
| En Svensk Klassiker | 6–8 h/vecka | 7,5–10 h | 9–11,5 h |
| Halva | 4,5–6 h | 5,5–7,5 h | 7–9 h |
| Korta och Tjej | 3,5–4,5 h | 4,5–6 h | 5,5–7 h |

Siffrorna utgår från vanliga motionärer med jobb och familj. **Att ta sig runt en hel klassiker på
sex timmar i veckan är fullt rimligt** — det är tidsmålen som kostar timmar.

Riktmärket är inte ett krav. Programmet anpassar sig efter de timmar du faktiskt har, och appen
varnar bara när upplägget inte når det mål *du* har satt — aldrig för att du tränar mindre än
någon annan skulle göra.

## Träningsmodellen

Programmet bygger på vedertagen uthållighetsmetodik:

- **Trappan: uppbyggnad → bygge → toppning.** Tränar du likadant varje vecka stannar utvecklingen av.
- **Polariserad intensitet:** ungefär 70–80 % lugnt och 20–30 % hårt. Lätt plus hårt slår medelmåttigt hela tiden.
- **Tre till fyra nyckelpass i veckan:** ett kvalitetspass, ett långpass, ett till två lugna pass, plus styrka. Måste något strykas är det ett lugnt pass.
- **Volymen ökar högst cirka 10 % per vecka**, och var fjärde vecka dras den ner. Långpasset byggs upp för sig: det växer mot loppet, för det är den enskilt viktigaste förberedelsen inför ett långt lopp.
- **Loppet räknas som träning.** Vasaloppet tar omkring sju timmar, och de dras av från loppveckans budget. Loppveckan innehåller därför nästan ingen planerad träning, och efter ett långt lopp följer två återhämtningsveckor.
- **Inga pass på loppdagen**, och dagen före bara ett kort öppningspass.
- **Nedtrappning sänker volymen men behåller intensiteten** — utvilad utan att tappa skärpa.
- **Teknik före fart på skidor och i vattnet.** Är du inte rutinerad får du teknikpass i båda — Vasaloppet avgörs i stakningen och Vansbro i crawltekniken, inte i syreupptaget.
- **Varje pass har zon och upplägg**, inte bara "intervaller 1 h". Du ska veta vad du ska göra när du står där.
- **Simningen flyttar ut i öppet vatten** under din säsong före simloppet, med våtdräkt och siktträning. Går det inte att få in några sådana pass säger appen till.
- **Ett pass kan bytas mot en annan gren i samma intensitet.** Det är precis det som gör säsongsanpassningen möjlig: skidpasset blir stakmaskin eller rullskidor utanför snöperioden.

## Kalenderexporten

`programToIcs` tar programmet och en uppsättning etiketter och returnerar en `.ics`-fil som text.
Tre val är värda att känna till:

- **Heldagshändelser, inte klockslag.** Programmet vet vilken dag passet ligger, inte när på dagen
  du tränar. Att hitta på "18:00" vore att låtsas veta något vi inte vet. Längden står i rubriken.
- **Stabila UID.** Händelsens id bygger på datum och ordning, så en ny export uppdaterar
  kalendern i stället för att lägga in allt en gång till.
- **Ingen klocka inblandad.** Tidsstämpeln hämtas från programmets `createdAt`, vilket gör
  exporten deterministisk: samma program ger alltid exakt samma fil, byte för byte.

Modulen äger inga svenska texter — de skickas in från `src/ui/ics-labels.ts`. Det håller
exporten testbar utan UI och gör den översättbar utan att formatkoden ändras.

## Att följa planen

Programmet är långt — ett helt år, ofta femtio veckor. Tre saker gör det följbart:

- **Genvägar till blocken** högst upp, så att året går att överblicka.
- **Veckan du är i nu är markerad** och sidan skrollar dit när du kommer tillbaka.
- **Veckor som varit fälls ihop.** Det som gäller nu ligger överst.

Programmet sparas i webbläsaren, och formuläret fylls med samma svar nästa gång du kommer
tillbaka. Vill du börja om finns en knapp för det under formuläret.

## Deploy

Push till `main` bygger sidan och publicerar den på GitHub Pages via GitHub Actions
(`.github/workflows/deploy.yml`). Deployen körs bara om typkontroll och tester går igenom.

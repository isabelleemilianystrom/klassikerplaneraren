# Klassikerplaneraren

En webbsida som genererar ett personligt träningsprogram för **En Svensk Klassiker**: fyra
grenar — längdskidor, cykel, simning och terränglöpning — som ska genomföras inom tolv månader.

Vanliga träningsappar planerar för en sport och ett lopp. En klassiker kräver att fyra grenar
fasas in över ett år, med fyra loppdatum att toppa formen mot, och med hänsyn till säsong — det
finns till exempel inte snö året runt eller överallt.

> Programmet är ett automatiskt förslag och ersätter inte medicinsk rådgivning.

## Status

Genereringen är klar och appen fungerar från formulär till färdigt program:

- `src/generator/dates.ts` — datumaritmetik på ISO-strängar ✔
- `src/generator/timeline.ts` — vilka veckor programmet omfattar ✔
- `src/generator/phases.ts` — vilken roll varje vecka har ✔
- `src/generator/sessions.ts` — vilka pass veckan innehåller ✔
- `src/generator/season.ts` — skidpass utanför snöperioden ✔
- `src/ics.ts` — exporten till kalenderfil, kvar

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

1. Användaren väljer vilken klassiker hon gör, fyller i fyra loppdatum, sin nuvarande nivå per
   gren, hur många timmar i veckan hon kan träna och när hon har tillgång till snö.
2. `generateProgram()` tar den indatan och returnerar ett **program**: en lista veckor, där varje
   vecka har en fas, ett lopp den är periodiserad mot och ett antal pass.
3. Programmet sparas i webbläsaren och ritas upp vecka för vecka.
4. Programmet kan exporteras som `.ics` och läsas in i en kalender.

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

## Träningsmodellen

Programmet bygger på vedertagen uthållighetsmetodik:

- **Trappan: uppbyggnad → bygge → toppning.** Tränar du likadant varje vecka stannar utvecklingen av.
- **Polariserad intensitet:** ungefär 70–80 % lugnt och 20–30 % hårt. Lätt plus hårt slår medelmåttigt hela tiden.
- **Tre till fyra nyckelpass i veckan:** ett kvalitetspass, ett långpass, ett till två lugna pass, plus styrka. Måste något strykas är det ett lugnt pass.
- **Volymen ökar högst cirka 10 % per vecka**, och var fjärde vecka dras den ner.
- **Nedtrappning sänker volymen men behåller intensiteten** — utvilad utan att tappa skärpa.
- **Ett pass kan bytas mot en annan gren i samma intensitet.** Det är precis det som gör säsongsanpassningen möjlig: skidpasset blir stakmaskin eller rullskidor utanför snöperioden.

## Deploy

Push till `main` bygger sidan och publicerar den på GitHub Pages via GitHub Actions
(`.github/workflows/deploy.yml`). Deployen körs bara om typkontroll och tester går igenom.

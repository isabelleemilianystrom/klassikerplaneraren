# Klassikerplaneraren

En webbsida som genererar ett personligt träningsprogram för **En Svensk Klassiker**: fyra
grenar — längdskidor, cykel, simning och terränglöpning — som ska genomföras inom tolv månader.

Vanliga träningsappar planerar för en sport och ett lopp. En klassiker kräver att fyra grenar
fasas in över ett år, med fyra loppdatum att toppa formen mot, och med hänsyn till säsong — det
finns till exempel inte snö året runt eller överallt.

> Programmet är ett automatiskt förslag och ersätter inte medicinsk rådgivning.

## Status

Grundstommen står: projektet bygger, testerna går igenom och sidan går att köra. Två delar är
medvetet tomma och väntar på implementation:

- `src/generator/` — själva programgenereringen
- `src/ics.ts` — exporten till kalenderfil

Kravspecen för generatorn ligger som `it.todo`-rader i `src/generator/index.test.ts`.

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

## Så är koden uppdelad

```
src/
  generator/     ren genereringslogik — indata in, program ut
  storage.ts     allt som rör sparat program (localStorage i dag)
  ics.ts         program -> .ics
  ui/            rendering, formulär och all svensk text
  variants.ts    de fyra varianterna och deras distanser
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
   per måndag.
2. **Varje vecka får en fas.** Fasen avgörs av avståndet till nästa lopp:
   `uppbyggnad` längst bort, sedan `toppning`, `nedtrappning` den sista veckan före loppet och
   `återhämtning` veckan efter. Nedtrappning och återhämtning är obligatoriska — de stryks inte
   även om nästa lopp ligger nära.
3. **Veckan fylls med pass.** Fasen och användarens nivå bestämmer fördelningen mellan grenarna
   och vad passen har för syfte. Summan av veckans pass får aldrig överstiga de angivna timmarna.
4. **Säsongen anpassar grenarna.** Skidpass utanför användarens snöperiod byts till stakmaskin
   eller rullskidor. Grenen försvinner aldrig ur programmet — bara formen ändras.

Varje steg är en egen funktion som tar ett värde och returnerar ett nytt. Inget steg ändrar
något som ett tidigare steg har byggt.

## Deploy

Push till `main` bygger sidan och publicerar den på GitHub Pages via GitHub Actions
(`.github/workflows/deploy.yml`). Deployen körs bara om typkontroll och tester går igenom.

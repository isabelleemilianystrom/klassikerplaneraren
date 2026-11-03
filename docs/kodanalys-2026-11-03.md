# Kodanalys 2026-11-03

Genomgång av kodbasen med fokus på kodkvalitet och framtida underhåll. **Det här är en
analys, inte en plan.** Inga lösningar eller refaktoreringar föreslås — dokumentet beskriver
vad som finns och vad det kostar, så att besluten kan tas separat.

**Tillstånd vid genomgången:** 429 tester gröna, lint och typkontroll gröna. 44 träningsregler
(R-01–R-44), 11 818 rader i `src`, `tests`, `config` och `docs`.

**Metod:** läsning av motorn, gränssnittet, konfigurationen och testerna, plus mätningar och
mutationsprov. Det som är empiriskt kontrollerat är utmärkt med *(kontrollerat)* nedan.

---

## 1. Läsbarhet och struktur

### `sessions.ts` bär för mycket

**1641 rader och 26 av 44 regler.** Filen gör fem olika saker: sätter samman veckan,
dimensionerar långpasset, delar konditionstiden i pass, fördelar passen på dagar, och sätter
titlar, ersättningar och säkerhetstexter.

`budget.ts` bär 15 regler, och sex av dem bor i båda filerna: **R-08, R-10, R-14, R-25, R-29
och R-31.** Ändringen av R-42 den 29 oktober rörde åtta funktioner i `sessions.ts`, varav de
flesta inte handlade om det som ändrades.

### Parameterlistorna har blivit funktionernas gränssnitt mot hela planen

| Funktion | Parametrar |
| --- | --- |
| `longSession` (`sessions.ts:392`) | **10** |
| `foldAwayTooSmallSports` (`sessions.ts:874`) | 8 |
| `placeOnDays` | 7 |
| `buildWeekPlan`, `enduranceSessions`, `trainingDates`, `bestDateFor`, `allowedOn` | 6 |
| `capRunVolume` (`budget.ts:154`) | 7 |

Varje ny regel lägger till en parameter som måste trädas igenom hela kedjan — R-42 la till
fyra (`races`, `slots`, `maxBySport`, `platser`). Signaturen säger inte längre vad funktionen
behöver, bara att den behöver nästan allt.

### `allowedOn` håller fyra orelaterade regler i rad

`sessions.ts:1260` innehåller R-16, R-42 (två gånger), R-43 och R-14 som fem oberoende
`if`-block med olika form — vissa läser `before`, vissa `perDag`, vissa båda. För att läsa
funktionen måste man hålla alla fyra reglerna i huvudet samtidigt, och inget säger vilken som
väger tyngst när de krockar.

### `foldAwayTooSmallSports` upprätthåller sin invariant på fyra ställen

Funktionen ska garantera att summan av de utdelade minuterna är exakt `totalt`. Det säkras i
urvalet (`Math.min(..., kvar, tak)`), i den proportionella påfyllningen, i avrundningsresten
och i golvpåslaget — fyra separata ställen i samma funktion, med fyra olika uttryck. Det var
här 19 minuter per vecka försvann tidigare, och R-42 la till ett femte villkor i samma
funktion.

### Ordningen i `buildWeekPlan` är bärande men bara underförstådd

Stegen är numrerade 1–5 i kommentarer, och steg 3 (långpasset) beror på steg 2 (dagräkningen)
enbart genom den lokala variabeln `platser`. Byter man ordning ändras planen, men varken
koden eller typerna säger det.

### Språket i koden följer inte CLAUDE.md

Konventionen säger engelska för "variabler, funktioner, typer, filnamn, **kommentarer**,
testnamn". Funktions- och typnamnen är engelska, men **83 lokala variabler och i praktiken
alla kommentarer är svenska** *(kontrollerat)*. Resultatet är rader som:

```ts
const kvarPlatser = Math.max(1, platser - (long === null ? 0 : 1));
```

inne i `function enduranceSessions`. Dessutom gör `type Vy = 'start' | 'formulär' | 'plan'` i
`page.tsx` ett svenskt ord med å-ä-ö till en tillståndsnyckel. Koden och konventionen har
glidit isär.

### `budget.ts` räknar i parallella arrayer

`shares[i]`, `utgång[i]`, `tilldelat[i]` och `övrigaAndelar[j++]` ligger alla i takt med en
`sports`-array, och den samordningen är osynlig för typsystemet. Det kostar ett tjugotal
`as number`-casts (51 `as`-casts totalt i `src`, `as const` oräknade) och gör att en array ur
fas inte är ett typfel utan ett tyst räknefel.

---

## 2. Duplicerad logik

### Öppningspasset har ingen markör

Passet är `type: 'easy'` med fast dag, så frågan "är det här ett öppningspass?" härleds om på
fyra ställen — med tre olika regler:

| Plats | Hur det avgörs |
| --- | --- |
| `sessions.ts:246` | ett pass dagen före ett lopp i samma gren |
| `sessions.ts:openerFor` | skapas med fast dag, **men blir `null`** om dagen före ligger utanför veckan eller är ett annat lopp |
| `budget.ts:218` | lägger **alltid** på 25 minuter när grenen har ett lopp i veckan |
| `tests/` | `ärÖppningspass`, plus `raceMinutes > 0 ? openerMinutes : 0` på ett annat ställe |

De två första säger emot varandra: ligger loppet på veckans första dag finns inget
öppningspass, men budgeten räknar av dess 25 minuter ändå. *(Kontrollerat: inget av de
riktiga loppdatumen faller på en måndag, så det slår inte till i dag. Men datumet kommer från
formuläret, så det är nåbart.)*

### Samma garanti upprätthålls i flera lager

**R-31 (nybörjartaket) i fyra lager**, där varje lager själv räknar ut "taket minus det som
redan är använt": `budget.ts:188`, `budget.ts:258`, `sessions.ts:551`, `sessions.ts:588`,
`sessions.ts:707`. Felet där simningen fick 84 minuter mot ett tak på 80 var precis det: ett
lager kände inte till långpassets minuter.

**R-29 (inga minuter försvinner) i fem lager:** `budget.unplacedMinutes`, `distribute`s
avrundning, `foldAway`s proportionella påfyllning, `distributeLeftover` och
`withUnplacedMinutes`. Ingen av dem känner till de andra, så en ändring i en av dem syns som
försvunna minuter långt bort.

### Mindre upprepningar

- **Gruppera pass per dag** finns tre gånger i tre former: `Map` i motorn
  (`sessions.ts:1124`), array av objekt i gränssnittet (`PlanView.tsx:282`), `Map` i testerna
  (`sessions.test.ts:1501`).
- **`raceById(x).sport as TrainedSport`** står på tio ställen — samma avsmalning upprepad,
  eftersom `sport` i `races.json` är typad som sträng.
- **`if (plan.budget.raceMinutes > 0) continue;`** står på ett tiotal ställen i testerna som
  vakt mot loppveckor.

### Två valideringsidiom för samma jobb

Zod validerar konfigurationen (`config.ts`, 463 rader). `PlanInput` och `FormState` — alltså
det som faktiskt sparas i webbläsaren och därmed är det som kan vara trasigt — valideras av
handskrivna typvakter (`storage.ts:165` och `:198`). Den handskrivna vakten har dessutom
`schemaVersion !== 3` som literal.

---

## 3. Teknisk skuld

### Den slumpade egenskapstestningen som kravspecen kräver finns inte

Avsnitt 9 och T-08 kräver *"minst 200 slumpade men giltiga indata körs mot samtliga
invarianter"*, med skälet utskrivet: *"Fem profiler räcker inte — i v0 var det
slumptestningen som avslöjade att en gren aldrig tränades."*

Alla 429 tester körs mot sex fasta profiler; 83 ställen i `sessions.test.ts` refererar dem
*(kontrollerat)*. Det är den dyraste posten i listan. Den 29 oktober kostade den tre gånger:

- P3 utan ett enda simpass i 43 veckor
- P1 utan kvalitetsdag i 19 av 38 veckor
- 100 av 420 minuter som försvann i en av P6:s veckor

Alla tre hittades av engångsskript skrivna för hand, inget av dem av testsviten.

### Placeringen faller tillbaka tyst när reglerna inte går att uppfylla

`bestDateFor` (`sessions.ts:1251`):

```ts
const urval = tillåtna.length > 0 ? tillåtna : dates;
```

Finns ingen laglig dag används vilken dag som helst, och regeln bryts utan att något
signalerar det. Det hände två gånger den 29 oktober — löppass två dagar i rad för en ny
löpare (R-14), och två belastade dagar två dagar isär (R-43) — och båda syntes bara för att
ett test råkade täcka just den profilen. Villkoren är formulerade som filter, men ingenting
garanterar att det finns en lösning.

### R-16 är död kod

*(Kontrollerat: hela blocket togs bort ur `allowedOn` och alla **429 av 429** tester var
gröna. `CarriedOver.hardDates` hade då ingen läsare kvar.)* R-43 täcker R-16 helt, eftersom
varje hårt pass också är en belastad dag.

Det är samma mönster som **R-22** och **R-24** (som har text och konfiguration men ingen kod)
och **R-23** (som ströks den 29 oktober): fyra regler som levt kvar i kravspec och
konfiguration efter att en senare regel tagit över. Kravspecens R-16 säger numera "kvar som
den undre gränsen", vilket koden inte håller med om.

### `schemaVersion` är en literal på elva ställen

`types.ts` (två), `form-state.ts`, `storage.ts`, och sju i testerna. Det är exakt det
v0-felet projektet uttryckligen vaktar mot: en höjning som missar ett ställe. Ingenting
binder dem samman.

### Konfigurationsschemat speglar varje nyckel för hand

`config.ts` är 463 rader och speglar varje nyckel, inklusive de 43 `_`-prefixade
dokumentationsnycklarna. Ett nytt tal kräver tre ändringar: JSON-värdet, `_rule`-texten och en
Zod-rad. R-40, R-41, R-42 och R-44 krävde fyra sådana trippler, och en av dem misslyckades
första gången just för att schemat inte matchade.

### Backloggen är inte en tillförlitlig bild av vad som finns

T-07 har acceptanskriteriet "Tester för R-22–R-24, R-26 och öppet vatten gröna" och är
markerad klar, men R-22 och R-24 var aldrig byggda och R-26 byggdes den 29 oktober. Man kan
alltså inte läsa backloggen för att veta vad som är gjort.

### Reglerna är 44 poster i en platt lista med korsreferenser

R-40 pekar på R-42 som pekar på R-13 och R-43; R-31 nämns i fem andra regler. Ändringen den
29 oktober rörde R-10, R-13, R-15 och R-16 och la till tre nya. Antalet par som kan krocka
växer kvadratiskt, och det finns ingen ordning som säger vilken regel som vinner — det avgörs
av i vilken ordning koden råkar köra.

### Motorn kastar och gränssnittet sväljer

`byggPlan` (`page.tsx:69`) fångar allt och returnerar `null`; `skapaPlan` gör
`if (byggd === null) return;` (`page.tsx:98`). Kastar motorn blir "Skapa programmet" en knapp
som inte gör någonting — ingen text, ingen loggning, inget spår. Det är gjort för att skydda
mot vit sida (K-15), men det döljer också varje riktigt fel.

### CI kör Node 20, verktygskedjan kräver nyare

`engines` säger `>=20`, ingen `.nvmrc` finns, lokalt är det Node 24, och `npm run profiles`
kör en `.ts`-fil direkt genom Node — vilket kräver minst 22.6. CI går igenom bara för att den
aldrig kör det skriptet.

### Testsviten är större än motorn den testar

`tests/sessions.test.ts` är 1726 rader och 108 tester — repots största fil. Att den är
profilstyrd gör den känslig för annat än det den testar: när P3 flyttades från 3 till 6 timmar
gick fyra tester om volymvarningar sönder, och de handlade inte om P3.

---

## Sammanfattat

De tre dyraste posterna:

1. **Den saknade slumpade egenskapstestningen** (kravspecens avsnitt 9 och T-08)
2. **Den tysta reservutgången i dagplaceringen** (`sessions.ts:1251`)
3. **Att samma garanti upprätthålls i fyra–fem lager som inte känner till varandra** (R-29,
   R-31)

De tre förklarar tillsammans varför i stort sett varje regeländring den 29 oktober gav två
till fyra följdfel på ställen som inte verkade ha med saken att göra.

# Frågor och svar inför demon

Underlag för demon den 19 november 2026. Svaren är korta med flit — de ska gå att
säga, inte läsas upp. Under varje kort svar står det du kan ta om någon frågar vidare.

**Läs först:** avsnittet *Det du måste veta innan du står där* längst ner. Det finns
en siffra som kan sätta dig i knipa om du inte känner till den.

---

## Om appen

**Vad gör den?**
Den gör ett träningsprogram vecka för vecka fram till loppen i En svensk klassiker.
Du svarar på tre frågor — vilka lopp, hur van du är i varje gren, hur mycket tid du
har — och får ett program som fasar in fyra grenar över ett år.

**Varför behövs en egen app? Det finns ju Strava och TrainingPeaks.**
De planerar för *en* sport och *ett* lopp. En klassiker är fyra grenar och fyra
loppdatum utspridda över ett år, där formen ska toppas fyra gånger och grenarna
måste samsas om samma vecka. Det är ett annat problem.

*Om de frågar vidare:* säsongen styr också — skidor går inte att träna i juli, och
simning går inte att komma ikapp på åtta veckor. Appen viktar grenarna efter
månad och efter hur nära nästa lopp är.

**Vem är den för?**
Den som ska göra en klassiker och har ett jobb. Sex till femton timmar i veckan.
En bärande princip i hela projektet: en varning ska betyda "det här når inte ditt
mål", aldrig "du tränar för lite".

**Vad kostar den?**
Noll kronor att bygga och noll att använda. Inga konton, ingen server, inga
API-nycklar. Det är ett krav i kravspecen, inte en ambition.

---

## Om AI:n — de frågor du säkert får

**Var är AI:n i appen?**
I de förklarande texterna, och bara där. Fasförklaringarna och sammanfattningen är
skrivna med AI **under utvecklingen**, granskade av mig, och sparade i appen som
data. Appen gör inga AI-anrop när någon använder den.

**Varför inte AI i körtid?**
Tre skäl. Det kostar pengar per användare. Det kräver en nyckel som måste skyddas.
Och framför allt: varje mening som en användare ser är då läst av en människa först.
Beslutet togs den 27 oktober och står i kravspecen som öppen fråga 3.

**Så AI:n skriver inte träningsprogrammet?**
Nej, och det är med flit. En regelmotor bestämmer allt som rör pass, tider,
intensitet och datum. AI:n får aldrig ändra planen — den skriver förklarande text.
Samma indata ger alltid samma plan.

**Hur vet du att AI-texterna stämmer?**
De är fyra fasförklaringar och åtta passinstruktioner, alla lästa och godkända av
mig innan de lades in. Texterna om hälsa och säkerhet är dessutom skrivna för hand
och får inte ändras utan beslut.

**Har du använt AI för att bygga appen?**
Ja — Claude Code har skrivit koden, jag har ägt kravspecen, besluten och
granskningen. Det är kursens poäng, och det är värt att säga rakt ut.

*Om de frågar vidare:* arbetssättet står i kravspecens avsnitt 1. Varje regel och
varje krav har ett id, och AI:n får inte lägga till en funktion eller en
träningssiffra som inte står där utan att fråga först.

---

## Om tekniken

**Vad är den byggd i?**
Next.js med App Router, TypeScript i strikt läge, Tailwind för utseendet, Zod för
att validera konfigurationen och Vitest för testerna. Helt statisk sida — ingen
server, ingen databas.

**Var sparas mina svar?**
I webbläsarens localStorage, på din egen dator. Ingenting skickas någonstans. Appen
gör inte ett enda nätverksanrop när den körs — typsnittet ligger med i bygget just
därför.

**Hur är den uppbyggd?**
Motorn bygger planen i fyra steg, en modul per steg:

1. `weeks.ts` — vilka veckor planen omfattar och vilken fas varje vecka har
2. `budget.ts` — hur många minuter varje vecka har, fördelade på grenar
3. `sessions.ts` — minuterna blir pass med dag, längd, zon och instruktion
4. `warnings.ts` och `volume.ts` — vad appen bör säga om planens begränsningar

**Vad betyder "motorn är ren"?**
Den läser ingenting, skriver ingenting och frågar aldrig vad klockan är — dagens
datum skickas in som argument. Den känner inte till Next.js, webbläsaren eller AI.
Det gör att samma svar alltid ger samma program, och att den går att testa utan att
rendera något.

**Var kommer träningssiffrorna ifrån?**
Ur `config/rules.json`, aldrig ur koden. Femtioen regler, R-01 till R-51, var och en
beskriven i kravspecens avsnitt 5. Vill man ändra hur mycket tid skidor får på
vintern är det en siffra i en fil, inte en ändring i motorn.

**Hur stor är den?**
Motorn är sjutton filer och knappt femtusen rader. Gränssnittet är sex filer.

---

## Om kvalitet och test

**Hur vet du att programmen blir rimliga?**
Två saker. 516 vanliga tester, och en harness som prövar **49 invarianter** mot
**200 slumpade indata** plus sex referensprofiler.

**Vad är en invariant?**
Ett påstående som ska gälla för *varje* plan, inte en förväntan om en viss plan.
Till exempel: veckans tid ligger inom fasens ram, det finns alltid minst en vilodag,
och två hårda dagar kommer aldrig tätt inpå varandra. Riktade tester missar den
sortens fel.

**Har det hittat riktiga buggar?**
Ja, och det är hela poängen. Det bästa exemplet: alla sex referensprofiler råkade
börja på en måndag, så ingen upptäckte att planen la pass på dagar som redan
passerat. Med slumpade startdatum visade det sig gälla **172 av 200 planer**.

*Fler exempel om de vill ha:* grenfärgerna var valda på känsla och föll i
kontrastvalidering — löpningens gröna gick inte att skilja från simningens turkosa
ens med full färgsyn. Och stakmaskinsrutan i formuläret kunde inte påverka något
alls: 0 av 74 skidpass nämnde den.

---

## Om säkerhet och ansvar

**Är det här medicinska råd?**
Nej. Det står ordagrant på startsidan: appen ger allmänna träningsförslag, inte
medicinska råd, och den som har en sjukdom eller skada, är gravid eller osäker ska
prata med vården först. Åldersgräns 18 år.

**Vad händer om någon skadar sig?**
Appen säger ifrån på tre sätt: röda flaggor att avbryta passet för, en smärtregel om
när man ska vila, och en regel om feber. De texterna står överst i varje program och
är skrivna för hand, inte av AI.

**Varför står varningarna före programmet?**
För att de ska läsas. De ligger överst, med en röd markering för säkerhetstexterna
och gul för varningar om att planen inte når ett riktmärke. Kursråd — "du är ny på
simning, gå en simkurs" — står för sig själva i neutral ton, eftersom ett råd inte
är en varning.

---

## Om drift

**Var ligger den?**
På GitHub Pages: isabelleemilianystrom.github.io/klassikerplaneraren. Den byggs om
automatiskt vid varje push, och workflowen kör alla tester först — ett bygge som
inte klarar dem når aldrig adressen.

**Varför kör du demon lokalt då?**
För att inte vara beroende av nätet. Appen gör inga nätverksanrop, så den fungerar
lika bra utan uppkoppling.

---

## Begränsningar — det är styrka att kunna dem

**Vad gör den inte?**
Den loggar ingen träning, anpassar sig inte efter hur det gick, och har ingen
kalenderexport. Allt det är backloggat till efter kursen.

**Vad vet du är fel just nu?**
Sex fynd är öppna och dokumenterade. De viktigaste:

- **Löpning för tätt efter ett terränglopp.** Efter Lidingöloppets tre mil kan det
  bli löppass redan dag två. Tre lösningar är prövade och var och en bryter mot en
  annan regel — det som återstår är ett beslut om en återhämtningsvecka får vara
  kortare än de timmar användaren valt.
- **Ingen nedtrappning före simloppet.**
- **Rampen utgår från hur mycket tid du sagt att du har, inte från vad du gör i dag**,
  så vecka tre kan bli sextiosju procent tyngre än vecka två.

*Varför det är bra att säga:* att veta exakt vad som är fel och varför det inte är
fixat är mer förtroendeingivande än att påstå att allt fungerar.

---

## Svåra frågor

**"Väntar appen i tre sekunder på låtsas?"**
Ja. Motorn räknar ut planen på en millisekund. Väntan finns för att det ska synas
att svaren användes — trycker man på knappen och programmet står där omedelbart ser
det ut som en färdig mall. Den var fem sekunder och kortades till tre, och den visas
aldrig före ett felmeddelande.

**"Du säger AI, men appen innehåller ju ingen AI."**
Stämmer, i körtid. AI:n användes för att skriva texterna och för att bygga appen.
Det är två olika saker och jag tycker att båda är värda att skilja på.

**"Kan man lita på träningsråden?"**
Reglerna bygger på SPÅRAT:s guider och är granskade mot dem. Men appen lovar inte
att du slår en tid — den är lagd för att du ska klara distansen, och den säger
ifrån när dina timmar inte räcker till ett riktmärke.

**"Vad händer för en nybörjare som fyller i femton timmar?"**
Nivån styr taket. En nybörjare i simning får inte mer än ett visst antal minuter i
veckan oavsett hur mycket tid som finns, och tiden går till en gren hon faktiskt kan
tillgodogöra sig.

**"Fungerar den för färgblinda?"**
Grenfärgerna är validerade mot både färgblindhet och normalseende. Och färgen är
aldrig ensam bärare av betydelse — grenens namn står alltid utskrivet bredvid.

---

## Det du måste veta innan du står där

**Testsviten är grön. Invariantharnessen är det inte.**

- `npm test` → **516 av 516 gröna**
- `npm run invariants` → **8 av 49 invarianter brutna** mot 200 slumpade indata

De åtta är de dokumenterade öppna fynden, inte okänd skada:

| Regel | Invariant |
| --- | --- |
| R-29, R-40 | oplacerad tid är alltid mindre än ett pass |
| R-14 | ingen ny löpare får löppass två dagar i rad |
| R-36 | en avklarad gren tränas bara i sin egen säsong |
| R-01, R-04 | inga pass före startdatum eller efter sista loppet |
| R-45 | fokusveckorna ger loppets gren veckan |
| R-46 | löpningens långpass växer högst femton procent i veckan |
| R-32 | skidor får mer tid än cykel i en basvecka på vintern |
| R-43 | högst två belastade dagar, aldrig två inom två dagar |

**Så här säger du det om någon kör harnessen eller frågar:** "Enhetstesterna är
gröna. Invariantharnessen hittar åtta brott mot slumpad indata, och det är med
flit kvar — det är den som hittar fynden, och de åtta är dokumenterade med orsak
och förslag. Att stänga av en invariant för att få grönt vore att slänga bort
verktyget."

---

## Siffror att ha i huvudet

| | |
| --- | --- |
| Träningsregler | 51 (R-01 till R-51) |
| Krav | K-01 till K-19 |
| Tester | 516 |
| Invarianter | 49, mot 200 slumpade indata |
| Referensprofiler | 6 (P1–P6) |
| Motorn | 17 filer, ca 4 900 rader |
| Exempelprogram | 45 veckor, 223 timmar, 6 h/vecka |
| Next.js | 16.4.6 |

---

## Om något krånglar under demon

- **Ha ett program sparat i förväg.** Finns det en sparad plan visas den direkt när
  appen öppnas, så du kommer förbi formuläret även om det strular.
- **Ta skärmdumpar** på startsidan, en veckovy och varningarna.
- **Appen fungerar utan nät.** Ingen uppkoppling behövs.
- **Startar inte `npm run dev`?** Kör `npm.cmd run dev` — PowerShells standardpolicy
  blockerar `npm.ps1`. Det är inte ett fel i projektet.

**Fyll i P1 så här** — öva tills det flyter:

- Alla fyra loppen, datumen är redan ifyllda
- Mål: ta mig i mål på alla fyra
- Ny på längdskidor och simning, van på cykel och löpning
- Sex timmar i veckan, långpass söndag, ledig måndag
- Utrustning: **lämna snö omarkerat** — då syns stavgång i backe, som är en poäng i sig

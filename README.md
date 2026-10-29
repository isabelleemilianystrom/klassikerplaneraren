# Klassikerplaneraren

En webbapp som skapar ett personligt träningsprogram vecka för vecka för den som ska
genomföra **En svensk klassiker**: Vasaloppet (längdskidor), Vätternrundan (cykel),
Vansbrosimningen (simning) och Lidingöloppet (terränglöpning).

Vanliga träningsappar planerar för en sport och ett lopp. En klassiker kräver att flera grenar
fasas in över ett år, med flera loppdatum att toppa formen mot, och med hänsyn till säsong och
utrustning.

> Klassikerplaneraren är en beta och ger allmänna träningsförslag, inte medicinska råd.

## Status

**v1.0 är byggd** mot kravspecen i [`docs/kravspec-v1.md`](docs/kravspec-v1.md), som är den
enda källan till vad som ska byggas. Alla Måste-krav är klara och testade.

Appen går från startsida genom ett formulär i tre steg till ett program vecka för vecka, och
sparar planen i webbläsaren så att den kommer tillbaka vid nästa besök.

Drift väntar till efter demon den 19 november — appen är helt statisk och körs lokalt så
länge. Se *Visa appen i mobilen* nedan.

En tidigare version — statisk Vite-app på GitHub Pages, utan AI — finns kvar i taggen
`v0-pages` och går att läsa med `git show v0-pages`.

## Kom igång

Kräver Node 20 eller senare.

```bash
npm install     # installera beroenden
npm run dev     # utvecklingsserver på http://localhost:3000
npm run check   # typkontroll + lint + tester (kör detta före commit)
```

## Visa appen i mobilen

Appen är helt statisk och behöver ingen server. Till demon körs den lokalt.

För att öppna den i telefonen behöver utvecklingsservern lyssna på nätverket,
inte bara på den här datorn:

```bash
npm run dev -- --hostname 0.0.0.0
```

Öppna sedan `http://<datorns IP>:3000` i telefonen — datorn och telefonen måste
vara på samma wifi. IP-adressen skrivs ut när servern startar, som `Network:`.

Brandväggen i Windows frågar första gången om Node får ta emot anslutningar.
Svara ja för privata nätverk.

## Granska planerna

Appen visar en plan i taget. För att läsa alla sex referensprofiler som text —
hela året, varje pass — kör:

```bash
npm run profiles
```

Det skriver en fil per referensprofil till `out/` — en översikt vecka för vecka
med tid och fördelning mellan sporterna, och därefter varje enskilt pass med
dag, längd, zon och instruktion. `out/oversikt.txt` sammanfattar alla sex.

Profilerna står i kravspecens avsnitt 9: från P1 som är ny i skidor och simning
med sex timmar i veckan, till P4 som har sex veckor på sig till Vasaloppet. Det
är så planerna granskades inför demon, både av Isabelle och av en tränare.

| Kommando | Gör |
| --- | --- |
| `npm run dev` | utvecklingsserver |
| `npm run build` | produktionsbygge |
| `npm test` | Vitest i watch-läge |
| `npm run test:run` | kör testerna en gång |
| `npm run typecheck` | TypeScript utan att bygga |
| `npm run lint` | ESLint |
| `npm run profiles` | skriver referensprofilernas planer till `out/` |

## Så är koden uppdelad

```
config/            lopp, regler, pass och förklaringar som data
prompts/           prompten som förklaringarna skrevs med
src/engine/        regelmotorn – rena funktioner, ingen Next.js, ingen AI
src/ui/            formulär, planvy, texter och lagring
src/app/           sidan som binder ihop dem
tests/             enhets-, invariant- och datumtester
docs/              kravspecen
prompts/           prompten som förklaringarna skrevs med
scripts/           verktyg för granskning
```

Motorn bygger planen i fyra steg, ett per modul:

1. `weeks.ts` — vilka veckor planen omfattar och vilken fas varje vecka har
2. `budget.ts` — hur många minuter varje vecka innehåller, fördelade på grenar
3. `sessions.ts` — minuterna blir pass med dag, längd, zon och instruktion
4. `warnings.ts` och `volume.ts` — vad appen bör säga om planens begränsningar

Två principer bär upp det:

- **Motorn är ren och fristående.** Den läser inget, skriver inget och frågar aldrig vad klockan
  är — dagens datum skickas in. Samma indata och samma regelversion ger alltid samma plan.
- **Siffrorna ligger i konfiguration, inte i koden.** Träningsreglerna i `config/rules.json` går
  att ändra utan att röra motorn.

## Inga AI-anrop i körtid

Förklaringarna till faserna skrivs med hjälp av AI **under utvecklingen**, granskas och sparas i
appen. Appen anropar ingen AI-tjänst när användaren skapar sin plan. Det ger noll kostnad, ingen
API-nyckel att skydda, och framför allt: varje mening är läst av en människa innan en användare
ser den. **Ingenting lämnar webbläsaren.**

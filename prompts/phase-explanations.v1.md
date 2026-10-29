# Prompt: fasförklaringar och sammanfattning

**Version:** `v1` — den sparas i varje plan som `promptVersion`.

Den här prompten användes för att skriva texterna i `config/explanations.json`.
Den finns här så att texterna går att skriva om på samma grund, och så att det
går att se vad som bad om dem.

**Texterna skrevs under utvecklingen, inte i körtid.** Appen gör inga anrop till
någon AI-tjänst. Varje mening är läst och godkänd av Isabelle innan den gick in.

---

## Uppgiften

Skriv fem korta texter till en svensk träningsapp för En svensk klassiker:
Vasaloppet (90 km längdskidor), Vätternrundan (315 km cykel),
Vansbrosimningen (3 km simning) och Lidingöloppet (30 km terränglöpning).

Appen bygger ett träningsprogram vecka för vecka fram till användarens lopp.
Programmet är indelat i fyra faser. Texterna förklarar **varför** varje fas
finns — inte vad användaren ska göra, det står på passen.

### 1. Sammanfattning — högst 500 tecken

Står överst i planen. Ska fungera oavsett vilka av de fyra loppen planen
innehåller, och oavsett om användaren har tre eller femton timmar i veckan.

### 2–5. En text per fas — högst 300 tecken vardera

| Fas | Vad den gör i programmet |
| --- | --- |
| `base` | Grundperiod. Många lugna pass i zon 1–2, ett långpass i veckan som växer till halva sitt tak, och ett hårdare pass. Bygger uthållighet. |
| `specific` | Loppspecifik. Grenen loppet gäller får mest tid, långpasset växer mot sitt tak, två hårdare pass i veckan. |
| `taper` | Nedtrappning. Veckans tid sjunker till 60 och sedan 40 procent. Korta inslag i zon 3, högst 20 minuter. Kroppen vilar in sig. |
| `recovery` | Återhämtning efter ett lopp. Halv tid, bara zon 1–2, teknikpass i simning och skidor. |

---

## Krav på texterna

**Språk och ton**

- Svenska, klarspråk, du-tilltal.
- Peppande men ärligt. Appen är byggd för folk som arbetar och har familj, inte
  för elitsatsande. En text ska aldrig få en missad vecka att kännas som ett
  misslyckande.
- Korta meningar. Hellre två korta än en lång.

**Innehållet ska**

- förklara vad fasen bygger och varför den behövs
- säga något om hur det *känns* när det är rätt, där det hjälper
  (grundperioden känns ofta för lätt — det är meningen)

**Innehållet får inte**

- innehålla siffror, datum eller tider som rör den enskilda planen — texten
  väljs utifrån fas, inte utifrån användarens svar
- innehålla medicinska råd eller påståenden om att planen förebygger skador
- lova resultat, tider eller vad användaren kommer att klara
- nämna ett enskilt lopp vid namn i fastexterna; fokuset hör till fasen
- använda engelska låneord där det finns ett svenskt ord (säg "tröskelpass",
  inte "tempo run")

**Varför inga siffror:** texten är densamma för alla, men planen är det inte.
En text som säger "nu tränar du sex timmar i veckan" blir fel för den som valt
tre.

**Varför inget loppnamn:** lärdomen från en tidigare version är att "intervaller
mot Vasaloppet" på varje rad gör ett missat pass till ett missat lopp. Planen
visar fokusloppet på veckan; texten behöver inte upprepa det.

---

## Format

Svara med JSON som passar `config/explanations.json`:

```json
{
  "summary": "…",
  "phases": {
    "base": "…",
    "specific": "…",
    "taper": "…",
    "recovery": "…"
  }
}
```

Räkna tecknen. En text som överskrider sin gräns är ogiltig och kortas inte
automatiskt — den skrivs om.

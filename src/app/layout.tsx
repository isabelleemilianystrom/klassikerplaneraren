import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Instrument_Sans } from 'next/font/google';
import './globals.css';

/**
 * Appens typsnitt (designöversynen 2026-11-17).
 *
 * Förut användes systemstacken, vilket gav appen ett ansikte på Windows, ett
 * annat på Mac och ett tredje på Android. Ett typsnitt med riktiga tabellsiffror
 * löser både det och sifferuppställningen i veckolistan.
 *
 * **`next/font` och inte en länk till Google Fonts.** Filerna laddas ner när
 * appen byggs och serveras från appen själv, så det görs inga nätverksanrop i
 * körtid. Det är ett krav: appen ska fungera utan uppkoppling, och demons
 * reservplan bygger på det. Bygget behöver däremot nå nätet en gång — därefter
 * ligger filerna i `.next/cache`.
 */
const instrumentSans = Instrument_Sans({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-app',
});

export const metadata: Metadata = {
  title: 'Klassikerplaneraren',
  description:
    'Skapa ett personligt träningsprogram för En svensk klassiker: Vasaloppet, Vätternrundan, Vansbrosimningen och Lidingöloppet.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sv" className={instrumentSans.variable}>
      {/*
        `suppressHydrationWarning` på <body>, och bara här.

        Webbläsartillägg skriver in egna attribut i <body> innan React hinner
        hydrera — Grammarly lägger till `data-gr-ext-installed` och
        `data-new-gr-c-s-check-loaded`. React jämför serverns HTML med det som
        står i dokumentet, ser attribut som inte fanns, och fäller upp en
        felruta. Felet är alltså ett tillägg i användarens webbläsare, inte
        något appen gör, och det går inte att rätta från vår sida.

        Flaggan gäller **bara det här elementets egna attribut och text**, inte
        någonting under det. Ett riktigt hydreringsfel i en komponent syns
        därför precis som förut — det här tystar inte appens egna fel.
      */}
      <body suppressHydrationWarning className="bg-ground text-ink antialiased">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Klassikerplaneraren',
  description:
    'Skapa ett personligt träningsprogram för En svensk klassiker: Vasaloppet, Vätternrundan, Vansbrosimningen och Lidingöloppet.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="sv">
      <body className="bg-white text-neutral-900 antialiased">{children}</body>
    </html>
  );
}

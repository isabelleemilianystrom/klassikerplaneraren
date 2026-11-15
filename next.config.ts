import type { NextConfig } from 'next';

/**
 * Appen är helt statisk: regelmotorn kör i webbläsaren och det finns inga
 * anrop till någon tjänst i körtid. Se kravspecens avsnitt 6 och 7.
 *
 * **`PAGES=1` slår på bygget för GitHub Pages.** Utan den variabeln beter sig
 * `npm run dev` och `npm run build` precis som förut — lokalt ligger appen på
 * `/`, och demon körs lokalt. Bara workflowen sätter variabeln.
 *
 * Två saker krävs för en projektsajt på GitHub Pages:
 *
 * - `output: 'export'` ger en statisk mapp i stället för ett serverbygge.
 * - `basePath` behövs eftersom sajten ligger på `/klassikerplaneraren/` och
 *   inte på domänroten. Utan den pekar varje länk till CSS och JS fel och
 *   sidan laddar utan stil.
 *
 * `images.unoptimized` krävs av `output: 'export'`: bildoptimeringen behöver
 * en server, och någon sådan finns inte.
 */
const tillPages = process.env.PAGES === '1';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  ...(tillPages
    ? {
        output: 'export' as const,
        basePath: '/klassikerplaneraren',
        images: { unoptimized: true },
        // Utan den här hamnar `/klassikerplaneraren/nagot` på en 404 i stället
        // för att serveras som `nagot/index.html`.
        trailingSlash: true,
      }
    : {}),
};

export default nextConfig;

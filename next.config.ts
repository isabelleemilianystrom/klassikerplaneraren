import type { NextConfig } from 'next';

/**
 * Appen är helt statisk: regelmotorn kör i webbläsaren och det finns inga
 * anrop till någon tjänst i körtid. Se kravspecens avsnitt 6 och 7.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;

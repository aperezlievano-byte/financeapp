import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Playwright navega a http://127.0.0.1:<puerto> (playwright.config.ts), no
  // a localhost -- el bloqueo de origen cruzado de Next.js en dev por
  // defecto no incluye 127.0.0.1, asi que sin esto el navegador de e2e
  // recibe los chunks de JS bloqueados y ningun componente cliente hidrata
  // nunca (los onClick simplemente no hacen nada, sin ningun error visible).
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;

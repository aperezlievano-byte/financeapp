import { defineConfig, env } from "prisma/config";

// Prisma 7 ya no acepta `url`/`directUrl` dentro de `datasource` en
// schema.prisma -- la conexion de la CLI (migrate, generate) vive aca.
// No carga .env por su cuenta: este archivo lo invoca siempre
// scripts/with-env.sh o scripts/with-test-env.sh, que ya lo cargaron.
export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: env("DIRECT_DATABASE_URL"),
  },
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
});

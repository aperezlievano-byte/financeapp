import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../generated/prisma";
import { env } from "../../lib/env";

// El unico archivo que abre una conexion (regla de CLAUDE.md). El patron de
// singleton en globalThis evita agotar el pool en dev, donde el hot-reload de
// Next reimporta este modulo en cada cambio de archivo. Prisma 7 exige un
// driver adapter explicito -- "new PrismaClient()" vacio ya no conecta.

declare global {
  var __prisma: PrismaClient | undefined;
}

const adapter = new PrismaPg(env.DATABASE_URL);

export const prisma: PrismaClient =
  globalThis.__prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}

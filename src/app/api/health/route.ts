import { prisma } from "../../../server/db/client";

export async function GET(): Promise<Response> {
  try {
    await prisma.$queryRaw`SELECT 1`;

    const pending = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*)::bigint AS count
      FROM _prisma_migrations
      WHERE finished_at IS NULL
    `;
    const migrations = pending[0].count > 0n ? "pending" : "applied";

    return Response.json({
      ok: true,
      data: { db: "reachable", migrations },
    });
  } catch (error) {
    console.error(error);
    return Response.json(
      {
        ok: false,
        error: {
          code: "internal",
          message: "No se pudo verificar el estado de la base.",
        },
      },
      { status: 500 },
    );
  }
}

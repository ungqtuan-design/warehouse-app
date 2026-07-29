import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;

    return Response.json({
      ok: true,
      database: "reachable",
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown database error";

    return Response.json(
      {
        ok: false,
        database: "unreachable",
        error: message,
        checkedAt: new Date().toISOString(),
      },
      { status: 500 },
    );
  }
}
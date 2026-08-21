import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json(
      { ok: true, database: "ok" },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Health check database failure", error);
    return Response.json(
      { ok: false, database: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}

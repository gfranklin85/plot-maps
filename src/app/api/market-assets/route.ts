import { NextResponse } from "next/server";
import postgres from "postgres";

export const dynamic = "force-dynamic";

// Pricing-tool market data. Reads from the Lemoore market dataset via a direct
// Postgres connection (MARKET_DATABASE_URL, falls back to DATABASE_URL).
// Ported from lemoore-homes; see src/app/price/page.tsx.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get("city") || "Lemoore";

    const connString = process.env.MARKET_DATABASE_URL || process.env.DATABASE_URL;
    if (!connString) {
      return NextResponse.json(
        { error: "Market data source not configured" },
        { status: 503 }
      );
    }

    const sql = postgres(connString, { ssl: "require" });
    const data = await sql`SELECT * FROM market_assets WHERE city = ${city} ORDER BY status, address`;
    await sql.end();

    return NextResponse.json(
      { data },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

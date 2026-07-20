import { NextRequest, NextResponse } from "next/server";
import postgres from "postgres";
import { Resend } from "resend";

// Lead capture for the pricing tool. Writes to the Lemoore `leads` table via a
// direct Postgres connection (MARKET_DATABASE_URL, falls back to DATABASE_URL)
// so the whole pricing tool shares one backend. Ported from lemoore-homes.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const lead = {
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      type: body.type || null,
      timeline: body.timeline || null,
      property_address: body.property_address || null,
      property_condition: body.property_condition || null,
      price_range: body.price_range || null,
      pre_approved: body.pre_approved ?? null,
      va_eligible: body.va_eligible ?? null,
      motivation: body.message || body.motivation || null,
      source: body.source || "website",
      utm_source: body.utm_source || null,
      utm_medium: body.utm_medium || null,
      utm_campaign: body.utm_campaign || null,
      status: "new",
    };

    const connString = process.env.MARKET_DATABASE_URL || process.env.DATABASE_URL;
    if (!connString) {
      return NextResponse.json(
        { error: "Lead store not configured" },
        { status: 503 }
      );
    }

    const sql = postgres(connString, { ssl: "require" });
    let inserted;
    try {
      const cols = Object.keys(lead);
      const rows = await sql`INSERT INTO leads ${sql(lead, ...cols)} RETURNING id`;
      inserted = rows[0];
    } catch (dbErr) {
      console.error("Lead insert error:", dbErr);
      await sql.end();
      return NextResponse.json({ error: "Failed to save lead" }, { status: 500 });
    }
    await sql.end();

    // Send email notification (don't fail the request if email fails)
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY);
        await resend.emails.send({
          from: "Lemoore Homes <leads@lemoore.homes>",
          to: "gregfranklin523@gmail.com",
          subject: `New Lead: ${lead.name} — ${lead.property_address || "No address"}`,
          html: `
            <h2>New Sell Lead Submitted</h2>
            <p><strong>Name:</strong> ${lead.name}</p>
            <p><strong>Phone:</strong> ${lead.phone || "N/A"}</p>
            <p><strong>Email:</strong> ${lead.email || "N/A"}</p>
            <p><strong>Address:</strong> ${lead.property_address || "N/A"}</p>
            <p><strong>Type:</strong> ${lead.type}</p>
            <p><strong>Details:</strong> ${lead.motivation || "N/A"}</p>
            <p><strong>Timeline:</strong> ${lead.timeline || "N/A"}</p>
            <p><strong>Source:</strong> ${lead.source}</p>
          `,
        });
      } catch (emailErr) {
        console.error("Failed to send notification email:", emailErr);
      }
    }

    return NextResponse.json({ success: true, id: inserted?.id }, { status: 201 });
  } catch (error) {
    console.error("API error:", error);
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

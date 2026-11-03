import { getAdminClient } from "@/lib/supabase/admin";

type DonationBody = {
  sessionId?: unknown;
  externalId?: unknown;
  donorName?: unknown;
  coins?: unknown;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Coin-to-effect rules. Each tier gives extra vote time and bot capital.
 * Values are provisional; the economy spec is still open.
 */
function donationEffect(coins: number): { timeSeconds: number; capitalAdded: number } {
  if (coins >= 5000) return { timeSeconds: 60, capitalAdded: 100 };
  if (coins >= 1000) return { timeSeconds: 60, capitalAdded: 25 };
  if (coins >= 500) return { timeSeconds: 30, capitalAdded: 10 };
  if (coins >= 300) return { timeSeconds: 15, capitalAdded: 5 };
  if (coins >= 100) return { timeSeconds: 5, capitalAdded: 2 };
  return { timeSeconds: 0, capitalAdded: 0 };
}

/**
 * Called by the TikTok gift listener running on the server, not by viewers.
 * Requires the shared secret DONATION_WEBHOOK_SECRET in the x-webhook-secret header.
 * externalId makes retries idempotent.
 */
export async function POST(request: Request) {
  const secret = process.env.DONATION_WEBHOOK_SECRET;
  if (!secret || request.headers.get("x-webhook-secret") !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: DonationBody;
  try {
    body = (await request.json()) as DonationBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { sessionId, externalId, donorName, coins } = body;
  if (typeof sessionId !== "string" || !UUID.test(sessionId)) {
    return Response.json({ error: "sessionId must be a UUID" }, { status: 400 });
  }
  if (typeof externalId !== "string" || externalId.length < 1 || externalId.length > 128) {
    return Response.json({ error: "externalId must be 1-128 characters" }, { status: 400 });
  }
  if (typeof donorName !== "string" || donorName.length < 1 || donorName.length > 64) {
    return Response.json({ error: "donorName must be 1-64 characters" }, { status: 400 });
  }
  if (typeof coins !== "number" || !Number.isInteger(coins) || coins <= 0) {
    return Response.json({ error: "coins must be a positive integer" }, { status: 400 });
  }

  const supabase = getAdminClient();
  const effect = donationEffect(coins);

  const { data: session, error: sessionError } = await supabase
    .from("game_sessions")
    .select("id, balance, status")
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    return Response.json({ error: "Failed to load session" }, { status: 500 });
  }
  if (!session || session.status !== "active") {
    return Response.json({ error: "Session is not active" }, { status: 409 });
  }

  const { error: insertError } = await supabase.from("donations").insert({
    session_id: sessionId,
    external_id: externalId,
    donor_name: donorName,
    coins,
    time_seconds: effect.timeSeconds,
    capital_added: effect.capitalAdded,
  });

  if (insertError) {
    // Unique violation on external_id means this donation was already processed.
    if (insertError.code === "23505") {
      return Response.json({ ok: true, duplicate: true }, { status: 200 });
    }
    return Response.json({ error: "Failed to record donation" }, { status: 500 });
  }

  if (effect.capitalAdded > 0) {
    const { error: balanceError } = await supabase
      .from("game_sessions")
      .update({
        balance: Number(session.balance) + effect.capitalAdded,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sessionId);

    if (balanceError) {
      return Response.json({ error: "Donation saved but balance update failed" }, { status: 500 });
    }
  }

  return Response.json(
    { ok: true, timeSeconds: effect.timeSeconds, capitalAdded: effect.capitalAdded },
    { status: 201 },
  );
}

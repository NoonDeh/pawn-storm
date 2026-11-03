import { getAdminClient } from "@/lib/supabase/admin";

type VoteBody = {
  auctionId?: unknown;
  voterKey?: unknown;
  choice?: unknown;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Records one vote per voter per auction. A repeated vote replaces the earlier choice. */
export async function POST(request: Request) {
  let body: VoteBody;
  try {
    body = (await request.json()) as VoteBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { auctionId, voterKey, choice } = body;
  if (typeof auctionId !== "string" || !UUID.test(auctionId)) {
    return Response.json({ error: "auctionId must be a UUID" }, { status: 400 });
  }
  if (typeof voterKey !== "string" || voterKey.length < 1 || voterKey.length > 128) {
    return Response.json({ error: "voterKey must be 1-128 characters" }, { status: 400 });
  }
  if (choice !== "RAISE" && choice !== "SURRENDER") {
    return Response.json({ error: "choice must be RAISE or SURRENDER" }, { status: 400 });
  }

  const supabase = getAdminClient();

  const { data: auction, error: auctionError } = await supabase
    .from("auctions")
    .select("id, status, vote_ends_at")
    .eq("id", auctionId)
    .maybeSingle();

  if (auctionError) {
    return Response.json({ error: "Failed to load auction" }, { status: 500 });
  }
  if (!auction) {
    return Response.json({ error: "Auction not found" }, { status: 404 });
  }
  if (auction.status !== "voting" || new Date(auction.vote_ends_at).getTime() <= Date.now()) {
    return Response.json({ error: "Voting is closed for this auction" }, { status: 409 });
  }

  const { error: voteError } = await supabase.from("votes").upsert(
    { auction_id: auctionId, voter_key: voterKey, choice, weight: 1 },
    { onConflict: "auction_id,voter_key" },
  );

  if (voteError) {
    return Response.json({ error: "Failed to record vote" }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 201 });
}

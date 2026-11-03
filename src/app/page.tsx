import { Suspense } from "react";
import { connection } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { VoteButtons } from "./vote-buttons";

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-900">
          <p className="text-slate-500">Memuat lelang...</p>
        </main>
      }
    >
      <GameContent />
    </Suspense>
  );
}

const LABELS = {
  condition: {
    PRISTINE: "Sempurna",
    EXCELLENT: "Sangat Baik",
    GOOD: "Baik",
    WORN: "Aus",
    DAMAGED: "Rusak",
    BROKEN: "Rusak Parah",
  },
  authenticity: {
    AUTHENTIC: "Asli",
    QUESTIONABLE: "Diragukan",
    FAKE: "Palsu",
  },
  rarity: {
    COMMON: "Biasa",
    UNCOMMON: "Tidak Biasa",
    RARE: "Langka",
    LEGENDARY: "Legendaris",
    MYTHIC: "Mitos",
  },
} as const;

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

type Auction = {
  id: string;
  item_name: string;
  item_condition: keyof typeof LABELS.condition;
  item_authenticity: keyof typeof LABELS.authenticity;
  item_rarity: keyof typeof LABELS.rarity;
  estimate_min: number | string;
  estimate_max: number | string;
  starting_bid: number | string;
  current_bid: number | string;
  vote_ends_at: string;
};

async function GameContent() {
  // Read session and auction data per request, not at build time.
  await connection();
  const supabase = getAdminClient();

  const { data: session, error: sessionError } = await supabase
    .from("game_sessions")
    .select("id, balance, target_balance")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (sessionError) {
    return <Message title="Gagal memuat sesi" text="Coba muat ulang halaman." />;
  }
  if (!session) {
    return <Message title="Belum ada sesi aktif" text="Lelang akan dimulai setelah sesi dibuka." />;
  }

  const { data: auction, error: auctionError } = await supabase
    .from("auctions")
    .select(
      "id, item_name, item_condition, item_authenticity, item_rarity, estimate_min, estimate_max, starting_bid, current_bid, vote_ends_at",
    )
    .eq("session_id", session.id)
    .eq("status", "voting")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<Auction>();

  if (auctionError) {
    return <Message title="Gagal memuat lelang" text="Coba muat ulang halaman." />;
  }

  const balance = Number(session.balance);
  const target = Number(session.target_balance);
  const progress = Math.min(100, Math.max(0, (balance / target) * 100));

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 text-slate-900">
      <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
        <header className="rounded-2xl bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Saldo</p>
          <p className="text-3xl font-bold">{money.format(balance)}</p>
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-emerald-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-sm text-slate-500">Target {money.format(target)}</p>
        </header>

        {auction ? (
          <section className="flex flex-col gap-5 rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex h-48 items-center justify-center rounded-xl bg-slate-200 text-slate-400">
              Gambar barang
            </div>
            <div>
              <h1 className="text-2xl font-bold">{auction.item_name}</h1>
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                <Tag>Kondisi: {LABELS.condition[auction.item_condition]}</Tag>
                <Tag>Keaslian: {LABELS.authenticity[auction.item_authenticity]}</Tag>
                <Tag>Kelangkaan: {LABELS.rarity[auction.item_rarity]}</Tag>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-4">
              <Stat label="Estimasi" value={`${money.format(Number(auction.estimate_min))} – ${money.format(Number(auction.estimate_max))}`} />
              <Stat label="Harga awal" value={money.format(Number(auction.starting_bid))} />
              <Stat label="Tawaran saat ini" value={money.format(Number(auction.current_bid))} />
            </dl>
            <VoteButtons auctionId={auction.id} voteEndsAt={auction.vote_ends_at} />
          </section>
        ) : (
          <Message title="Menunggu lelang" text="Barang berikutnya sedang disiapkan." />
        )}
      </div>
    </main>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">{children}</span>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 text-slate-900">
      <div className="max-w-md rounded-2xl bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-2 text-slate-500">{text}</p>
      </div>
    </main>
  );
}

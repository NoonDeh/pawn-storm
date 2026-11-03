"use client";

import { useEffect, useState } from "react";

type Choice = "RAISE" | "SURRENDER";

type Props = {
  auctionId: string;
  voteEndsAt: string;
};

const VOTER_KEY_STORAGE = "pawn-storm-voter-key";

/** Returns a stable anonymous id for this browser, creating one on first use. */
function getVoterKey(): string {
  let key = window.localStorage.getItem(VOTER_KEY_STORAGE);
  if (!key) {
    key = crypto.randomUUID();
    window.localStorage.setItem(VOTER_KEY_STORAGE, key);
  }
  return key;
}

export function VoteButtons({ auctionId, voteEndsAt }: Props) {
  const [now, setNow] = useState<number | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Set the clock after mount so server and client render the same HTML first.
  useEffect(() => {
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const endsAt = new Date(voteEndsAt).getTime();
  const remaining = now === null ? null : Math.max(0, Math.ceil((endsAt - now) / 1000));
  const closed = remaining === 0;

  async function vote(next: Choice) {
    if (pending || closed) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ auctionId, voterKey: getVoterKey(), choice: next }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Suara gagal dikirim. Coba lagi.");
        return;
      }
      setChoice(next);
    } catch {
      setError("Koneksi bermasalah. Coba lagi.");
    } finally {
      setPending(false);
    }
  }

  const disabled = pending || closed;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>Voting ditutup dalam</span>
        <span className="font-semibold tabular-nums text-slate-900" aria-live="polite">
          {remaining === null ? "--" : closed ? "Ditutup" : `${remaining} dtk`}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => vote("RAISE")}
          disabled={disabled}
          aria-pressed={choice === "RAISE"}
          className={`rounded-xl px-4 py-4 text-lg font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
            choice === "RAISE" ? "bg-emerald-700 ring-4 ring-emerald-200" : "bg-emerald-500 hover:bg-emerald-600"
          }`}
        >
          TAWAR
        </button>
        <button
          type="button"
          onClick={() => vote("SURRENDER")}
          disabled={disabled}
          aria-pressed={choice === "SURRENDER"}
          className={`rounded-xl px-4 py-4 text-lg font-bold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
            choice === "SURRENDER" ? "bg-rose-700 ring-4 ring-rose-200" : "bg-rose-500 hover:bg-rose-600"
          }`}
        >
          MENYERAH
        </button>
      </div>

      {choice && !error && (
        <p className="text-center text-sm text-slate-500" role="status">
          Pilihan kamu: {choice === "RAISE" ? "TAWAR" : "MENYERAH"}. Kamu bisa mengubahnya sebelum voting ditutup.
        </p>
      )}
      {error && (
        <p className="text-center text-sm text-rose-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

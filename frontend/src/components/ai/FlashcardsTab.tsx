"use client";
import { useState } from "react";
import { aiApi, type AIScope } from "@/lib/aiApi";
import type { Flashcard } from "@/types/ai";
import { Btn, ErrorBox, Loading, errMsg } from "./shared";

export default function FlashcardsTab({ scope }: { scope: AIScope }) {
  const [count, setCount] = useState(10);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true); setError(null);
    try {
      const r = await aiApi.flashcards(scope, count);
      setCards(r.cards); setI(0); setFlipped(false);
    } catch (e) { setError(errMsg(e)); }
    finally { setBusy(false); }
  }

  const go = (d: number) => { setI((v) => Math.min(cards.length - 1, Math.max(0, v + d))); setFlipped(false); };
  const card = cards[i];

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <label className="text-sm text-neutral-700">
          Cards
          <input
            type="number" min={3} max={30} value={count}
            onChange={(e) => setCount(Math.max(1, Math.min(30, Number(e.target.value) || 1)))}
            className="mt-1 block w-20 rounded-md border border-line bg-surface px-2 py-1 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <Btn onClick={run} disabled={busy}>{cards.length ? "Regenerate" : "Generate flashcards"}</Btn>
      </div>
      {busy && <Loading label="Making flashcards..." />}
      {error && <ErrorBox message={error} onRetry={run} />}

      {card && !busy && (
        <>
          <button
            onClick={() => setFlipped((f) => !f)}
            className="flex min-h-[200px] w-full flex-col items-center justify-center rounded-xl border border-line bg-surface p-6 text-center shadow-sm transition hover:border-accent"
            aria-label="Flip card"
          >
            <span className="mb-2 text-xs text-neutral-500">{flipped ? "Answer" : "Question"} · {card.topic}</span>
            <span className="whitespace-pre-wrap text-base text-neutral-900">{flipped ? card.back : card.front}</span>
            <span className="mt-4 text-xs text-neutral-400">Click to flip</span>
          </button>
          <div className="flex items-center justify-between">
            <Btn variant="ghost" onClick={() => go(-1)} disabled={i === 0}>Previous</Btn>
            <span className="text-sm text-neutral-600">{i + 1} / {cards.length}</span>
            <Btn variant="ghost" onClick={() => go(1)} disabled={i === cards.length - 1}>Next</Btn>
          </div>
        </>
      )}
    </div>
  );
}

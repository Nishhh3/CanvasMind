"use client";
import { useEffect, useRef, useState } from "react";
import { aiApi, type AIScope } from "@/lib/aiApi";
import type { ChatMessage, Source } from "@/types/ai";
import MarkdownView from "./MarkdownView";
import { Btn, ErrorBox, Loading, NotGrounded, Sources, errMsg } from "./shared";

type Msg = ChatMessage & { grounded?: boolean; sources?: Source[] };

export default function ChatTab({
  scope, preset,
}: { scope: AIScope; preset?: { id: number; question: string } }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const lastPreset = useRef(0);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  async function send(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    const history: ChatMessage[] = msgs.slice(-8).map(({ role, content }) => ({ role, content }));
    setMsgs((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setError(null);
    setBusy(true);
    try {
      const r = await aiApi.ask(scope, q, history);
      setMsgs((m) => [...m, { role: "assistant", content: r.answer, grounded: r.grounded, sources: r.sources }]);
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  // Run a question coming from "Explain / Summarize selection"
  useEffect(() => {
    if (preset && preset.id !== lastPreset.current) {
      lastPreset.current = preset.id;
      send(preset.question);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto pr-1">
        {msgs.length === 0 && !busy && (
          <p className="text-sm text-ink-soft">
            Ask anything about your notes. Answers come only from what you wrote or imported.
          </p>
        )}
        {msgs.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={`max-w-[92%] rounded-lg px-3 py-2 ${
              m.role === "user" ? "bg-accent text-white text-sm" : "bg-surface-muted border border-line"
            }`}>
              {m.role === "user" ? m.content : (
                <>
                  {m.grounded === false && <div className="mb-1"><NotGrounded /></div>}
                  <MarkdownView>{m.content}</MarkdownView>
                  <Sources sources={m.sources ?? []} />
                </>
              )}
            </div>
          </div>
        ))}
        {busy && <Loading />}
        {error && <ErrorBox message={error} />}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="mt-3 flex gap-2 border-t border-line pt-3"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your notes..."
          className="flex-1 rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <Btn type="submit" disabled={busy || !input.trim()}>Ask</Btn>
      </form>
    </div>
  );
}

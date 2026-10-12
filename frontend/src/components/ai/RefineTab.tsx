"use client";
import { useEffect, useRef, useState } from "react";
import { aiApi, type AIScope } from "@/lib/aiApi";
import type { RefineMode } from "@/types/ai";
import { Btn, ErrorBox, Loading, errMsg } from "./shared";

const MODES: { v: RefineMode; label: string; hint: string }[] = [
  { v: "simplify", label: "Simplify", hint: "Plain, easy wording" },
  { v: "grammar", label: "Fix grammar", hint: "Spelling and grammar only" },
  { v: "structure", label: "Structure", hint: "Headings and bullet points" },
  { v: "improve", label: "Improve", hint: "Clearer and more complete" },
  { v: "exam_ready", label: "Exam-ready", hint: "Concise points to memorize" },
];

export default function RefineTab({
  scope, onAccept, autoRun,
}: {
  scope: AIScope;
  /** Called only when the user clicks Accept. Add/replace a text object on the page. */
  onAccept: (suggestion: string, original: string) => void;
  autoRun?: { id: number; mode: RefineMode };
}) {
  const [mode, setMode] = useState<RefineMode>("improve");
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ original: string; suggestion: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastAuto = useRef(0);

  async function run(m: RefineMode = mode) {
    setBusy(true); setError(null); setResult(null);
    try { setResult(await aiApi.refine(scope, m, text.trim() || undefined)); }
    catch (e) { setError(errMsg(e)); }
    finally { setBusy(false); }
  }

  useEffect(() => {
    if (autoRun && autoRun.id !== lastAuto.current) {
      lastAuto.current = autoRun.id;
      setMode(autoRun.mode);
      run(autoRun.mode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun]);

  const hasSelection = !!(scope.selection?.text || scope.selection?.image);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.v} title={m.hint} onClick={() => setMode(m.v)} aria-pressed={mode === m.v}
            className={`rounded-full border px-3 py-1 text-sm ${
              mode === m.v ? "border-accent bg-accent text-white shadow-sm" : "border-line hover:bg-surface-muted"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <textarea
        rows={3} value={text} onChange={(e) => setText(e.target.value)}
        placeholder={hasSelection
          ? "Leave empty to refine your selected area, or paste text here"
          : "Leave empty to refine this page's text, or paste text here"}
        className="w-full rounded-md border border-line bg-surface p-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
      />
      <Btn onClick={() => run()} disabled={busy}>Get suggestion</Btn>

      {busy && <Loading label="Refining..." />}
      {error && <ErrorBox message={error} onRetry={() => run()} />}

      {result && !busy && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-neutral-200 p-3">
              <p className="mb-1 text-xs font-medium text-neutral-500">Original</p>
              <p className="whitespace-pre-wrap text-sm">{result.original}</p>
            </div>
            <div className="rounded-lg border border-green-300 bg-green-50 p-3">
              <p className="mb-1 text-xs font-medium text-green-800">Suggestion</p>
              <p className="whitespace-pre-wrap text-sm">{result.suggestion}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Btn onClick={() => { onAccept(result.suggestion, result.original); setResult(null); }}>Accept</Btn>
            <Btn variant="danger" onClick={() => setResult(null)}>Reject</Btn>
          </div>
          <p className="text-xs text-neutral-500">Nothing changes on your page until you click Accept.</p>
        </div>
      )}
    </div>
  );
}

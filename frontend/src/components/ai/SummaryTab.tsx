"use client";
import { useState } from "react";
import { aiApi, type AIScope } from "@/lib/aiApi";
import MarkdownView from "./MarkdownView";
import { Btn, ErrorBox, Loading, errMsg } from "./shared";

export default function SummaryTab({ scope }: { scope: AIScope }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true); setError(null);
    try { setText((await aiApi.summary(scope)).summary); }
    catch (e) { setError(errMsg(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <Btn onClick={run} disabled={busy}>{text ? "Regenerate summary" : "Summarize"}</Btn>
      {busy && <Loading label="Summarizing..." />}
      {error && <ErrorBox message={error} onRetry={run} />}
      {text && !busy && <MarkdownView>{text}</MarkdownView>}
    </div>
  );
}

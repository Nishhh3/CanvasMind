"use client";
import { useState } from "react";
import { aiApi, type AIScope } from "@/lib/aiApi";
import MarkdownView from "./MarkdownView";
import { Btn, ErrorBox, Loading, errMsg } from "./shared";

export default function RevisionTab({ scope }: { scope: AIScope }) {
  const [sheet, setSheet] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function run() {
    setBusy(true); setError(null);
    try { setSheet((await aiApi.revisionSheet(scope)).sheet); }
    catch (e) { setError(errMsg(e)); }
    finally { setBusy(false); }
  }

  async function copy() {
    await navigator.clipboard.writeText(sheet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function download() {
    const url = URL.createObjectURL(new Blob([sheet], { type: "text/markdown" }));
    const a = document.createElement("a");
    a.href = url; a.download = "revision-sheet.md"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Btn onClick={run} disabled={busy}>{sheet ? "Regenerate" : "Create revision sheet"}</Btn>
        {sheet && <Btn variant="ghost" onClick={copy}>{copied ? "Copied" : "Copy"}</Btn>}
        {sheet && <Btn variant="ghost" onClick={download}>Download .md</Btn>}
      </div>
      {busy && <Loading label="Building your sheet..." />}
      {error && <ErrorBox message={error} onRetry={run} />}
      {sheet && !busy && <MarkdownView>{sheet}</MarkdownView>}
    </div>
  );
}

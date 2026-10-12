"use client";
import { useMemo, useState } from "react";
import type { RefineMode, ScopeKind, Selection } from "@/types/ai";
import type { AIScope } from "@/lib/aiApi";
import ScopeToggle from "./ScopeToggle";
import ChatTab from "./ChatTab";
import SummaryTab from "./SummaryTab";
import QuizTab from "./QuizTab";
import FlashcardsTab from "./FlashcardsTab";
import RefineTab from "./RefineTab";
import RevisionTab from "./RevisionTab";
import { Btn } from "./shared";

const TABS = ["Chat", "Summary", "Quiz", "Flashcards", "Refine", "Revision sheet"] as const;
type Tab = (typeof TABS)[number];

export type AIAssistantPanelProps = {
  projectId: number;
  /** Current page id (undefined while loading). */
  pageId?: number;
  /** From the rectangle-select tool: cropped JPEG data URL and/or text. */
  selection?: Selection | null;
  onClearSelection?: () => void;
  /** User clicked Accept in Refine: add or replace a text object on the canvas. */
  onApplyText: (suggestion: string, original: string) => void;
};

export default function AIAssistantPanel({
  projectId, pageId, selection, onClearSelection, onApplyText,
}: AIAssistantPanelProps) {
  const [tab, setTab] = useState<Tab>("Chat");
  const [scopeKind, setScopeKind] = useState<ScopeKind>("page");
  const [chatPreset, setChatPreset] = useState<{ id: number; question: string }>();
  const [refineAuto, setRefineAuto] = useState<{ id: number; mode: RefineMode }>();

  const hasSel = !!(selection?.text || selection?.image);

  // Selection is only sent for chat / explain / refine, not for quiz or summary of the whole project.
  const scope: AIScope = useMemo(
    () => ({ projectId, scope: scopeKind, pageId, selection: hasSel ? selection! : undefined }),
    [projectId, scopeKind, pageId, selection, hasSel],
  );
  // Quiz, flashcards, summary and revision sheet ignore the selection.
  const plainScope: AIScope = useMemo(() => ({ ...scope, selection: undefined }), [scope]);

  const pageMissing = scopeKind === "page" && pageId == null;

  function selectionAction(kind: "explain" | "summarize" | "improve") {
    if (kind === "improve") {
      setRefineAuto({ id: Date.now(), mode: "improve" });
      setTab("Refine");
      return;
    }
    setChatPreset({
      id: Date.now(),
      question: kind === "explain"
        ? "Explain the selected part of my notes in simple terms."
        : "Summarize the selected part of my notes in a few bullet points.",
    });
    setTab("Chat");
  }

  return (
    <aside className="flex h-full w-full flex-col border-l border-line bg-surface">
      <div className="space-y-3 border-b border-line p-3">
        <ScopeToggle value={scopeKind} onChange={setScopeKind} />

        {hasSel && (
          <div className="rounded-md border border-accent/30 bg-accent-soft p-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-accent">Selected area</span>
              {onClearSelection && (
                <button onClick={onClearSelection} className="text-xs text-accent underline">Clear</button>
              )}
            </div>
            {selection?.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={selection.image} alt="Selected area" className="mt-1 max-h-24 rounded border border-accent/30" />
            )}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Btn variant="ghost" className="!py-1 !text-xs" onClick={() => selectionAction("explain")}>Explain</Btn>
              <Btn variant="ghost" className="!py-1 !text-xs" onClick={() => selectionAction("summarize")}>Summarize</Btn>
              <Btn variant="ghost" className="!py-1 !text-xs" onClick={() => selectionAction("improve")}>Improve</Btn>
            </div>
          </div>
        )}

        <div className="min-w-0 overflow-x-auto overscroll-x-contain" role="tablist">
          <div className="flex w-max min-w-full gap-1 pb-1">
          {TABS.map((t) => (
            <button
              key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}
              className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1 text-sm ${
                tab === t ? "bg-accent text-white shadow-sm" : "text-ink-soft hover:bg-surface-muted"
              }`}
            >
              {t}
            </button>
          ))}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {pageMissing ? (
          <p className="text-sm text-ink-soft">Select a page, or switch to "Whole project".</p>
        ) : (
          // Tabs stay mounted (hidden) so chat history, quiz progress and cards survive tab switches.
          <>
            <div className={tab === "Chat" ? "h-full" : "hidden"}><ChatTab scope={scope} preset={chatPreset} /></div>
            <div className={tab === "Summary" ? "" : "hidden"}><SummaryTab scope={plainScope} /></div>
            <div className={tab === "Quiz" ? "" : "hidden"}><QuizTab scope={plainScope} /></div>
            <div className={tab === "Flashcards" ? "" : "hidden"}><FlashcardsTab scope={plainScope} /></div>
            <div className={tab === "Refine" ? "" : "hidden"}>
              <RefineTab scope={scope} onAccept={onApplyText} autoRun={refineAuto} />
            </div>
            <div className={tab === "Revision sheet" ? "" : "hidden"}><RevisionTab scope={plainScope} /></div>
          </>
        )}
      </div>
    </aside>
  );
}

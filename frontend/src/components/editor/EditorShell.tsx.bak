"use client";

import { AlertCircle, Sparkles, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { useEditorStore, type Tool } from "@/store/editor";
import { CanvasToolbar } from "./CanvasToolbar";
import { CanvasViewport } from "./CanvasViewport";
import { EditorHeader } from "./EditorHeader";
import { ImportDialog } from "./ImportDialog";
import { PageSidebar } from "./PageSidebar";

const TOOL_KEYS: Record<string, Tool> = { p: "pen", h: "highlighter", e: "eraser", t: "text", s: "select" };

/** Batch 3 replaces this component with the real AI assistant panel. It makes no API calls. */
function AIPanelPlaceholder() {
    const selection = useEditorStore((s) => s.selection);
    const setSelection = useEditorStore((s) => s.setSelection);
    return (
        <div className="flex h-full w-full flex-col">
            <div className="flex h-12 items-center gap-2 border-b border-line px-4">
                <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-ink">AI assistant</h2>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm text-ink-soft">
                <p>
                    Chat, summary, quiz, flashcards, refine and revision sheet arrive in Batch 3. Nothing on this panel contacts
                    the backend yet.
                </p>
                <div className="flex flex-wrap gap-1.5" aria-label="Planned tabs">
                    {["Chat", "Summary", "Quiz", "Flashcards", "Refine", "Revision sheet"].map((t) => (
                        <span key={t} className="rounded-full bg-surface-muted px-2.5 py-1 text-xs text-ink-faint">
                            {t}
                        </span>
                    ))}
                </div>
                <div className="rounded-ctl border border-line bg-surface-muted/50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Selected region</p>
                    {selection ? (
                        <div className="mt-2 flex items-center justify-between gap-2">
                            <span className="text-ink">
                                {Math.round(selection.w)} × {Math.round(selection.h)} at ({Math.round(selection.x)},{" "}
                                {Math.round(selection.y)})
                            </span>
                            <Button size="sm" variant="ghost" onClick={() => setSelection(null)}>
                                Clear
                            </Button>
                        </div>
                    ) : (
                        <p className="mt-2 text-xs text-ink-faint">Use the Select tool on the canvas to choose a region.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

function Sheet({
    side,
    label,
    onClose,
    children,
}: {
    side: "left" | "right";
    label: string;
    onClose: () => void;
    children: ReactNode;
}) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [onClose]);

    return (
        <div className="fixed inset-0 z-40">
            <div className="anim-fade absolute inset-0 bg-ink/30" onClick={onClose} aria-hidden="true" />
            <div
                role="dialog"
                aria-label={label}
                className={`absolute inset-y-0 w-80 max-w-[88vw] bg-surface shadow-pop ${side === "left" ? "anim-slide-in left-0" : "anim-slide-in-right right-0"
                    }`}
            >
                <button
                    type="button"
                    onClick={onClose}
                    aria-label={`Close ${label}`}
                    className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-ctl text-ink-faint hover:bg-surface-muted"
                >
                    <X className="h-4 w-4" />
                </button>
                {children}
            </div>
        </div>
    );
}

export function EditorShell({ projectId }: { projectId: number }) {
    const loadStatus = useEditorStore((s) => s.loadStatus);
    const loadError = useEditorStore((s) => s.loadError);

    const [importOpen, setImportOpen] = useState(false);
    const [pagesSheet, setPagesSheet] = useState(false);
    const [aiOpen, setAiOpen] = useState(true);
    const [aiSheet, setAiSheet] = useState(false);

    useEffect(() => {
        void useEditorStore.getState().load(projectId);
        return () => {
            useEditorStore.getState().dispose();
        };
    }, [projectId]);

    // Warn before closing the tab with unsaved work.
    useEffect(() => {
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            if (useEditorStore.getState().saveStatus === "saved") return;
            e.preventDefault();
            e.returnValue = "";
        };
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => window.removeEventListener("beforeunload", onBeforeUnload);
    }, []);

    // Keyboard shortcuts (ignored while typing or while a dialog is open).
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const target = e.target as HTMLElement | null;
            if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) return;
            if (document.querySelector('[role="dialog"]')) return;
            const s = useEditorStore.getState();
            const mod = e.ctrlKey || e.metaKey;
            const key = e.key.toLowerCase();

            if (mod && key === "z") {
                e.preventDefault();
                if (e.shiftKey) s.redo();
                else s.undo();
            } else if (mod && key === "y") {
                e.preventDefault();
                s.redo();
            } else if (mod && key === "s") {
                e.preventDefault();
                void s.saveNow();
            } else if ((e.key === "Delete" || e.key === "Backspace") && s.selectedTextId) {
                e.preventDefault();
                s.deleteSelectedText();
            } else if (!mod && !e.altKey && TOOL_KEYS[key]) {
                s.setTool(TOOL_KEYS[key]);
            }
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, []);

    const toggleAi = () => {
        if (window.matchMedia("(min-width: 1280px)").matches) setAiOpen((o) => !o);
        else setAiSheet((o) => !o);
    };

    if (loadStatus === "error") {
        return (
            <main className="flex min-h-dvh items-center justify-center p-6">
                <div className="max-w-md rounded-card border border-line bg-surface p-8 text-center shadow-soft">
                    <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft text-danger">
                        <AlertCircle className="h-6 w-6" aria-hidden="true" />
                    </div>
                    <h1 className="mt-4 text-base font-semibold text-ink">Could not open this project</h1>
                    <p className="mt-1 text-sm text-ink-soft">{loadError}</p>
                    <div className="mt-5 flex justify-center gap-2">
                        <Button variant="primary" onClick={() => void useEditorStore.getState().load(projectId)}>
                            Try again
                        </Button>
                        <Link
                            href="/"
                            className="inline-flex h-10 items-center rounded-ctl border border-line px-4 text-sm font-medium text-ink hover:bg-surface-muted"
                        >
                            Back to dashboard
                        </Link>
                    </div>
                </div>
            </main>
        );
    }

    if (loadStatus !== "ready") {
        return (
            <main className="flex min-h-dvh items-center justify-center" role="status">
                <div className="flex items-center gap-2 text-sm text-ink-soft">
                    <Spinner /> Opening project…
                </div>
            </main>
        );
    }

    return (
        <div className="flex h-dvh flex-col bg-app">
            <EditorHeader onOpenPages={() => setPagesSheet(true)} onToggleAi={toggleAi} onImport={() => setImportOpen(true)} />

            <div className="flex min-h-0 flex-1">
                <aside className="hidden w-60 shrink-0 border-r border-line bg-surface md:flex">
                    <PageSidebar />
                </aside>

                <main className="flex min-w-0 flex-1 flex-col">
                    <CanvasToolbar />
                    <CanvasViewport />
                </main>

                {aiOpen && (
                    <aside className="hidden w-80 shrink-0 border-l border-line bg-surface xl:flex">
                        <AIPanelPlaceholder />
                    </aside>
                )}
            </div>

            {pagesSheet && (
                <div className="md:hidden">
                    <Sheet side="left" label="Pages" onClose={() => setPagesSheet(false)}>
                        <PageSidebar onNavigate={() => setPagesSheet(false)} />
                    </Sheet>
                </div>
            )}
            {aiSheet && (
                <div className="xl:hidden">
                    <Sheet side="right" label="AI assistant" onClose={() => setAiSheet(false)}>
                        <AIPanelPlaceholder />
                    </Sheet>
                </div>
            )}

            <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} />
        </div>
    );
}
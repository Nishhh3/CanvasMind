"use client";

import { AlertCircle, ArrowLeft, Check, Download, FileUp, PanelLeft, Pencil, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Menu } from "@/components/ui/Menu";
import { Spinner } from "@/components/ui/Spinner";
import { exportPdf } from "@/lib/aiApi";
import { cn, errorMessage } from "@/lib/utils";
import { useEditorStore } from "@/store/editor";
import { toast } from "@/store/toast";

type EditorHeaderProps = {
    onOpenPages: () => void;
    onToggleAi: () => void;
    onImport: () => void;
    /** Optional override. If omitted, the header exports the whole project as a PDF itself. */
    onExportPdf?: () => void;
    exporting?: boolean;
};

function SaveIndicator() {
    const status = useEditorStore((s) => s.saveStatus);
    const error = useEditorStore((s) => s.saveError);
    const retry = useEditorStore((s) => s.retrySave);

    return (
        <div role="status" aria-live="polite" className="hidden items-center gap-2 text-xs sm:flex">
            {status === "saving" && (
                <span className="flex items-center gap-1.5 text-ink-soft">
                    <Spinner className="h-3.5 w-3.5" /> Saving...
                </span>
            )}
            {status === "saved" && (
                <span className="flex items-center gap-1.5 text-success">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" /> Saved
                </span>
            )}
            {status === "dirty" && (
                <span className="flex items-center gap-1.5 text-ink-faint">
                    <span className="h-2 w-2 rounded-full bg-warn" aria-hidden="true" /> Unsaved changes
                </span>
            )}
            {status === "error" && (
                <>
                    <span className="flex items-center gap-1.5 text-danger" title={error ?? undefined}>
                        <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" /> Save failed
                    </span>
                    <Button size="sm" variant="secondary" onClick={() => void retry()} className="h-7 px-2.5 text-xs">
                        Retry
                    </Button>
                </>
            )}
        </div>
    );
}

export function EditorHeader({ onOpenPages, onToggleAi, onImport, onExportPdf, exporting }: EditorHeaderProps) {
    const router = useRouter();
    const project = useEditorStore((s) => s.project);
    const renameProject = useEditorStore((s) => s.renameProject);
    const saveNow = useEditorStore((s) => s.saveNow);

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");
    const [exportingLocal, setExportingLocal] = useState(false);

    async function leave() {
        const ok = await saveNow();
        if (!ok && !window.confirm("Your latest changes could not be saved. Leave anyway and lose them?")) return;
        router.push("/");
    }

    async function commitTitle() {
        setEditing(false);
        const name = draft.trim();
        if (!name || !project || name === project.name) return;
        try {
            await renameProject(name);
        } catch (e) {
            toast.error(errorMessage(e, "Could not rename the project."));
        }
    }

    async function handleExport() {
        if (onExportPdf) {
            onExportPdf(); // parent supplied its own handler
            return;
        }
        if (!project) return;
        setExportingLocal(true);
        try {
            await saveNow(); // make sure the latest edits are saved before the PDF is built
            await exportPdf(project.id, project.name);
            toast.success("PDF downloaded.");
        } catch (e) {
            toast.error(errorMessage(e, "Could not export the PDF."));
        } finally {
            setExportingLocal(false);
        }
    }

    const isExporting = Boolean(exporting) || exportingLocal;
    const exportDisabled = isExporting || (!onExportPdf && !project);

    return (
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:px-4">
            <Button
                variant="ghost"
                size="sm"
                onClick={() => void leave()}
                aria-label="Back to Dashboard"
                title="Back to Dashboard"
                className="h-9 shrink-0 px-2 sm:px-3"
            >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">Dashboard</span>
            </Button>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={onOpenPages} aria-label="Show pages">
                <PanelLeft className="h-5 w-5" />
            </Button>

            <nav aria-label="Breadcrumb" className="flex min-w-0 flex-1 items-center gap-1 text-sm">
                {editing ? (
                    <input
                        autoFocus
                        value={draft}
                        maxLength={120}
                        aria-label="Project name"
                        onChange={(e) => setDraft(e.target.value)}
                        onFocus={(e) => e.currentTarget.select()}
                        onBlur={() => void commitTitle()}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") {
                                setDraft("");
                                setEditing(false);
                            }
                        }}
                        className="h-8 w-full max-w-48 rounded-md border border-accent bg-surface px-2 text-sm font-medium text-ink outline-none sm:w-64"
                    />
                ) : (
                    <button
                        type="button"
                        onClick={() => {
                            setDraft(project?.name ?? "");
                            setEditing(true);
                        }}
                        title="Rename project"
                        className="group flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-surface-muted"
                    >
                        <span className="truncate font-medium text-ink">{project?.name ?? "Project"}</span>
                        <Pencil className="h-3.5 w-3.5 shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" aria-hidden="true" />
                    </button>
                )}
            </nav>

            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
                <SaveIndicator />
                <Button variant="secondary" size="sm" onClick={onImport} className="hidden md:inline-flex">
                    <FileUp className="h-4 w-4" aria-hidden="true" /> Import
                </Button>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void handleExport()}
                    disabled={exportDisabled}
                    loading={isExporting}
                    title="Export PDF"
                    className="hidden md:inline-flex"
                >
                    <Download className="h-4 w-4" aria-hidden="true" /> Export PDF
                </Button>
                <ThemeToggle />
                <Button variant="ghost" size="icon" onClick={onToggleAi} aria-label="Toggle AI assistant" title="Toggle AI assistant">
                    <Sparkles className="h-4 w-4" />
                </Button>
                <Menu
                    className={cn("md:hidden")}
                    label="More actions"
                    items={[
                        { label: "Import files", icon: <FileUp className="h-4 w-4" />, onSelect: onImport },
                        {
                            label: "Export PDF",
                            icon: <Download className="h-4 w-4" />,
                            onSelect: () => void handleExport(),
                            disabled: exportDisabled,
                        },
                    ]}
                />
            </div>
        </header>
    );
}
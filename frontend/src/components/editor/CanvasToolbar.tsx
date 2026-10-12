"use client";

import { BoxSelect, Eraser, Highlighter, Pen, Redo2, Trash2, Type, Undo2, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { cn } from "@/lib/utils";
import { useEditorStore, type Tool } from "@/store/editor";
import { toast } from "@/store/toast";

const TOOLS: { id: Tool; label: string; key: string; icon: ReactNode }[] = [
    { id: "pen", label: "Pen", key: "P", icon: <Pen className="h-4 w-4" /> },
    { id: "highlighter", label: "Highlighter", key: "H", icon: <Highlighter className="h-4 w-4" /> },
    { id: "eraser", label: "Eraser", key: "E", icon: <Eraser className="h-4 w-4" /> },
    { id: "text", label: "Text", key: "T", icon: <Type className="h-4 w-4" /> },
    { id: "select", label: "Select region", key: "S", icon: <BoxSelect className="h-4 w-4" /> },
];

const COLORS = ["#1e2335", "#6c5dc0", "#c0405a", "#2f8a65", "#2563eb", "#d98a1a", "#f5c518"];

export function CanvasToolbar() {
    const tool = useEditorStore((s) => s.tool);
    const color = useEditorStore((s) => s.color);
    const size = useEditorStore((s) => s.size);
    const fontSize = useEditorStore((s) => s.fontSize);
    const setTool = useEditorStore((s) => s.setTool);
    const setColor = useEditorStore((s) => s.setColor);
    const setSize = useEditorStore((s) => s.setSize);
    const setFontSize = useEditorStore((s) => s.setFontSize);
    const undo = useEditorStore((s) => s.undo);
    const redo = useEditorStore((s) => s.redo);
    const clearPage = useEditorStore((s) => s.clearPage);
    const canUndo = useEditorStore((s) => s.past.length > 0);
    const canRedo = useEditorStore((s) => s.future.length > 0);
    const hasObjects = useEditorStore((s) => (s.content?.objects.length ?? 0) > 0);
    const hasPage = useEditorStore((s) => s.content !== null);
    const selection = useEditorStore((s) => s.selection);
    const setSelection = useEditorStore((s) => s.setSelection);

    const [confirmClear, setConfirmClear] = useState(false);

    const usesColor = tool !== "eraser" && tool !== "select";
    const usesSize = tool !== "select";
    const isText = tool === "text";
    const sliderValue = isText ? fontSize : size;

    return (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-3 py-2 sm:px-4">
            <div role="toolbar" aria-label="Drawing tools" className="flex items-center gap-1 rounded-ctl bg-surface-muted p-1">
                {TOOLS.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        disabled={!hasPage}
                        aria-pressed={tool === t.id}
                        aria-label={t.label}
                        title={`${t.label} (${t.key})`}
                        onClick={() => setTool(t.id)}
                        className={cn(
                            "inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors disabled:opacity-50",
                            tool === t.id ? "bg-surface text-accent shadow-sm" : "text-ink-soft hover:text-ink",
                        )}
                    >
                        {t.icon}
                    </button>
                ))}
            </div>

            {usesColor && (
                <div className="flex items-center gap-1.5" role="group" aria-label="Colour">
                    {COLORS.map((c) => (
                        <button
                            key={c}
                            type="button"
                            aria-label={`Colour ${c}`}
                            aria-pressed={color.toLowerCase() === c}
                            onClick={() => setColor(c)}
                            className={cn(
                                "h-6 w-6 rounded-full border border-black/10 transition-transform hover:scale-110",
                                color.toLowerCase() === c && "ring-2 ring-accent ring-offset-2",
                            )}
                            style={{ backgroundColor: c }}
                        />
                    ))}
                    <label className="relative ml-1 inline-flex h-6 w-6 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-line-strong bg-surface text-xs text-ink-soft focus-within:ring-2 focus-within:ring-accent">
                        <span aria-hidden="true">+</span>
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(e.target.value)}
                            aria-label="Custom colour"
                            className="absolute inset-0 cursor-pointer opacity-0"
                        />
                    </label>
                </div>
            )}

            {usesSize && (
                <label className="flex items-center gap-2 text-xs text-ink-soft">
                    <span className="whitespace-nowrap">{isText ? "Text size" : tool === "eraser" ? "Eraser size" : "Stroke size"}</span>
                    <input
                        type="range"
                        min={isText ? 14 : 1}
                        max={isText ? 96 : 40}
                        value={sliderValue}
                        onChange={(e) => (isText ? setFontSize(Number(e.target.value)) : setSize(Number(e.target.value)))}
                        className="w-28 accent-[#6c5dc0]"
                        aria-label={isText ? "Text size" : "Stroke size"}
                    />
                    <span className="w-6 text-right tabular-nums text-ink">{sliderValue}</span>
                </label>
            )}

            <div className="ml-auto flex items-center gap-1.5">
                {selection && (
                    <span className="flex items-center gap-1 rounded-full bg-accent-soft py-1 pl-3 pr-1 text-xs font-medium text-accent">
                        Selection {Math.round(selection.w)}×{Math.round(selection.h)}
                        <button
                            type="button"
                            onClick={() => setSelection(null)}
                            aria-label="Clear selection"
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full hover:bg-accent/15"
                        >
                            <X className="h-3 w-3" />
                        </button>
                    </span>
                )}
                <Button variant="ghost" size="icon" onClick={undo} disabled={!canUndo} aria-label="Undo" title="Undo (Ctrl+Z)">
                    <Undo2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={redo} disabled={!canRedo} aria-label="Redo" title="Redo (Ctrl+Y)">
                    <Redo2 className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmClear(true)} disabled={!hasObjects} title="Clear page">
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">Clear</span>
                </Button>
            </div>

            <ConfirmDialog
                open={confirmClear}
                title="Clear this page?"
                message="This removes all drawings and text boxes on the current page. An imported background image is kept. You can undo this."
                confirmLabel="Clear page"
                danger
                onConfirm={() => {
                    clearPage();
                    setConfirmClear(false);
                    toast.info("Page cleared. Press Ctrl+Z to undo.");
                }}
                onClose={() => setConfirmClear(false)}
            />
        </div>
    );
}
"use client";

import { AlertTriangle, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { CanvasLayers } from "@/components/canvas/CanvasLayers";
import { measureTextBlock, textBounds } from "@/components/canvas/canvas-utils";
import { useCanvasEngine } from "@/components/canvas/useCanvasEngine";
import { TEXT_FONT_FAMILY, TEXT_LINE_HEIGHT } from "@/components/canvas/canvas-utils";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { errorMessage } from "@/lib/utils";
import { useEditorStore, type EditingState } from "@/store/editor";
import { toast } from "@/store/toast";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/types/api";

const PADDING = 24;

export function CanvasViewport() {
    const bgRef = useRef<HTMLCanvasElement>(null);
    const drawRef = useRef<HTMLCanvasElement>(null);
    const wrapRef = useRef<HTMLDivElement>(null);
    const [box, setBox] = useState({ w: 0, h: 0 });
    const [pixelRatio, setPixelRatio] = useState(1);

    const content = useEditorStore((s) => s.content);
    const loadStatus = useEditorStore((s) => s.loadStatus);
    const pageLoading = useEditorStore((s) => s.pageLoading);
    const selection = useEditorStore((s) => s.selection);
    const selectedTextId = useEditorStore((s) => s.selectedTextId);
    const editing = useEditorStore((s) => s.editing);
    const addPage = useEditorStore((s) => s.addPage);

    // Observe the available area; ResizeObserver fires once on observe, so no manual first measurement.
    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const measure = () => {
            const r = el.getBoundingClientRect();
            setBox({ w: Math.floor(r.width), h: Math.floor(r.height) });
            setPixelRatio(Math.min(window.devicePixelRatio || 1, 3));
        };
        const observer = new ResizeObserver(measure);
        observer.observe(el);
        window.addEventListener("resize", measure); // browser zoom changes devicePixelRatio
        return () => {
            observer.disconnect();
            window.removeEventListener("resize", measure);
        };
    }, []);

    const cssWidth =
        box.w > 0 ? Math.max(280, Math.floor(Math.min(box.w - PADDING * 2, ((box.h - PADDING * 2) * CANVAS_WIDTH) / CANVAS_HEIGHT))) : 0;
    const cssHeight = Math.round((cssWidth * CANVAS_HEIGHT) / CANVAS_WIDTH);
    const k = cssWidth / CANVAS_WIDTH;

    const { handlers, cursor, backgroundError } = useCanvasEngine({ bgRef, drawRef, cssWidth, cssHeight, pixelRatio });

    const selectedText =
        content && selectedTextId && !editing
            ? content.objects.find((o) => o.type === "text" && o.id === selectedTextId)
            : undefined;
    const noPage = loadStatus === "ready" && !content && !pageLoading;

    async function handleAddPage() {
        try {
            await addPage();
        } catch (e) {
            toast.error(errorMessage(e, "Could not add a page."));
        }
    }

    return (
        <div ref={wrapRef} className="relative flex min-h-0 flex-1 overflow-auto p-6">
            {cssWidth > 0 && (
                <CanvasLayers
                    bgRef={bgRef}
                    drawRef={drawRef}
                    width={cssWidth}
                    height={cssHeight}
                    cursor={cursor}
                    handlers={handlers}
                >
                    {selection && (
                        <div
                            className="pointer-events-none absolute border-2 border-dashed border-accent bg-accent/10"
                            style={{ left: selection.x * k, top: selection.y * k, width: selection.w * k, height: selection.h * k }}
                        >
                            <span className="absolute -top-6 left-0 rounded-md bg-accent px-1.5 py-0.5 text-[11px] font-medium text-white">
                                {Math.round(selection.w)} × {Math.round(selection.h)}
                            </span>
                        </div>
                    )}

                    {selectedText && selectedText.type === "text" && (
                        <div
                            className="pointer-events-none absolute rounded-sm outline-dashed outline-1 outline-accent"
                            style={{
                                left: textBounds(selectedText).x * k - 4,
                                top: textBounds(selectedText).y * k - 4,
                                width: textBounds(selectedText).w * k + 8,
                                height: textBounds(selectedText).h * k + 8,
                            }}
                        />
                    )}

                    {editing && <TextEditor key={editing.id} editing={editing} k={k} />}

                    {backgroundError && (
                        <div
                            role="alert"
                            className="absolute left-3 top-3 flex items-center gap-2 rounded-ctl bg-warn-soft px-3 py-1.5 text-xs text-warn"
                        >
                            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                            The imported background image could not be loaded.
                        </div>
                    )}
                </CanvasLayers>
            )}

            {pageLoading && (
                <div className="anim-fade absolute inset-0 z-10 flex items-center justify-center bg-app/60" role="status">
                    <div className="flex items-center gap-2 rounded-ctl bg-surface px-4 py-2 text-sm text-ink-soft shadow-soft">
                        <Spinner /> Loading page…
                    </div>
                </div>
            )}

            {noPage && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-app/80 p-6">
                    <div className="rounded-card border border-line bg-surface p-8 text-center shadow-soft">
                        <h2 className="text-base font-semibold text-ink">This project has no pages</h2>
                        <p className="mt-1 text-sm text-ink-soft">Add a page to start writing and drawing.</p>
                        <Button variant="primary" className="mt-4" onClick={handleAddPage}>
                            <Plus className="h-4 w-4" aria-hidden="true" />
                            Add page
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

/** HTML overlay for typing. Positioned in logical coordinates scaled by k. */
function TextEditor({ editing, k }: { editing: EditingState; k: number }) {
    const [value, setValue] = useState(editing.text);
    const ref = useRef<HTMLTextAreaElement>(null);
    const doneRef = useRef(false);

    // Focus on the next frame: the browser's mousedown focus handling runs right after pointerdown
    // and would otherwise steal focus from a textarea mounted during that same event.
    useEffect(() => {
        const id = requestAnimationFrame(() => {
            const el = ref.current;
            if (!el) return;
            el.focus();
            el.setSelectionRange(el.value.length, el.value.length);
        });
        return () => cancelAnimationFrame(id);
    }, []);

    function finish(cancel: boolean) {
        if (doneRef.current) return;
        doneRef.current = true;
        useEditorStore.getState().finishEditing(value, cancel);
    }

    const m = measureTextBlock(value || " ", editing.fontSize);
    const width = Math.max(m.w + editing.fontSize, 140) * k;
    const height = m.h * k;

    return (
        <>
            <textarea
                ref={ref}
                value={value}
                wrap="off"
                spellCheck={false}
                aria-label="Edit text box"
                onChange={(e) => setValue(e.target.value)}
                onBlur={() => finish(false)}
                onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Escape") {
                        e.preventDefault();
                        finish(true);
                    } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault();
                        finish(false);
                    }
                }}
                className="absolute resize-none overflow-hidden border-0 bg-transparent p-0 outline-dashed outline-[1.5px] outline-offset-4 outline-accent"
                style={{
                    left: editing.x * k,
                    top: editing.y * k,
                    width,
                    height,
                    fontSize: editing.fontSize * k,
                    lineHeight: TEXT_LINE_HEIGHT,
                    fontFamily: TEXT_FONT_FAMILY,
                    color: editing.color,
                    whiteSpace: "pre",
                }}
            />
            <p
                className="pointer-events-none absolute whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[11px] text-white"
                style={{ left: editing.x * k, top: editing.y * k + height + 12 }}
            >
                Ctrl+Enter to finish · Esc to cancel
            </p>
        </>
    );
}
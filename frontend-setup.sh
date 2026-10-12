#!/usr/bin/env bash
# Frontend patch: mount the real AI panel in the editor.
#   - adds components/editor/AIPanel.tsx (adapter between the editor store and the AI panel)
#   - replaces AIPanelPlaceholder in EditorShell.tsx (backup: EditorShell.tsx.bak)
#   - makes lib/aiApi.ts reuse API_URL from lib/api.ts (only if api.ts exports it)
# Requires add_ai_frontend.sh first. Run from the project root:
#   bash add_ai_panel_wiring.sh
# Safe to re-run.
set -e

SHELL_FILE=frontend/src/components/editor/EditorShell.tsx
AIAPI=frontend/src/lib/aiApi.ts

if [ ! -f "$SHELL_FILE" ]; then
  echo "!! $SHELL_FILE not found. Run from the project root."; exit 1
fi
if [ ! -f frontend/src/components/ai/AIAssistantPanel.tsx ] || ! grep -q setAIBeforeRequest "$AIAPI" 2>/dev/null; then
  echo "!! Run the latest add_ai_frontend.sh first (it installs the AI panel components)."; exit 1
fi

# ---------------------------------------------------------------- adapter
cat > frontend/src/components/editor/AIPanel.tsx <<'TSX_EOF'
"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import AIAssistantPanel from "@/components/ai/AIAssistantPanel";
import {
    isStroke,
    isText,
    loadImage,
    renderContentToDataUrl,
    textBounds,
    textInRect,
} from "@/components/canvas/canvas-utils";
import { setAIBeforeRequest } from "@/lib/aiApi";
import { useEditorStore, type SelectionRect } from "@/store/editor";
import type { PageContent, TextObject } from "@/types/api";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/types/api";
import type { Selection } from "@/types/ai";

const ACCEPT_FONT_SIZE = 26;

/** Crops a region (logical 1200x800 coordinates) of the composite page to a JPEG data URL. */
async function cropSelection(content: PageContent, r: SelectionRect): Promise<string> {
    const full = await renderContentToDataUrl(content, { quality: 0.9 });
    const img = await loadImage(full);
    const w = Math.max(1, Math.round(r.w));
    const h = Math.max(1, Math.round(r.h));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not crop the selection.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, r.x, r.y, r.w, r.h, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.85);
}

/** Canvas text does not wrap, so wrap AI text to fit the page width. */
function wrapForCanvas(text: string, fontSize: number, x: number): string {
    const maxChars = Math.max(20, Math.floor((CANVAS_WIDTH - x - 40) / (fontSize * 0.5)));
    return text
        .split("\n")
        .map((paragraph) => {
            const lines: string[] = [];
            let current = "";
            for (const word of paragraph.split(/\s+/).filter(Boolean)) {
                if (current && (current + " " + word).length > maxChars) {
                    lines.push(current);
                    current = word;
                } else {
                    current = current ? current + " " + word : word;
                }
            }
            lines.push(current);
            return lines.join("\n");
        })
        .join("\n");
}

const newId = () => Math.random().toString(36).slice(2, 10);

/** Called only after the user clicks Accept in the Refine tab. */
function applySuggestion(suggestion: string, original: string) {
    const s = useEditorStore.getState();
    if (!s.content) return;
    const objects = s.content.objects;

    // If the original is exactly one existing text box, replace it in place.
    const target = objects.find((o) => isText(o) && o.text.trim() === original.trim());
    if (target && isText(target)) {
        const text = wrapForCanvas(suggestion, target.fontSize, target.x);
        s.commitObjects(
            objects.map((o) => (o.id === target.id && o.type === "text" ? { ...o, text } : o)),
            objects,
        );
        s.selectText(target.id);
        return;
    }

    // Otherwise add a new text box: at the selected region, or below the existing text.
    let x = 60;
    let y = 60;
    if (s.selection) {
        x = s.selection.x;
        y = s.selection.y;
    } else {
        const bottoms = objects.filter(isText).map((t) => {
            const b = textBounds(t);
            return b.y + b.h;
        });
        if (bottoms.length > 0) y = Math.min(Math.max(...bottoms) + 24, CANVAS_HEIGHT - 100);
    }
    x = Math.min(Math.max(x, 20), CANVAS_WIDTH - 200);

    const created: TextObject = {
        id: newId(),
        type: "text",
        x,
        y,
        text: wrapForCanvas(suggestion, ACCEPT_FONT_SIZE, x),
        fontSize: ACCEPT_FONT_SIZE,
        color: s.color,
    };
    s.commitObjects([...objects, created], objects);
    s.selectText(created.id);
}

export function AIPanel() {
    const projectId = useEditorStore((s) => s.projectId);
    const pageId = useEditorStore((s) => s.activePageId);
    const rect = useEditorStore((s) => s.selection);
    const setSelection = useEditorStore((s) => s.setSelection);
    const [selection, setSel] = useState<Selection | null>(null);

    // Save unsaved edits before each AI call so the backend reads the current page.
    useEffect(() => {
        setAIBeforeRequest(() => useEditorStore.getState().saveNow());
        return () => setAIBeforeRequest(null);
    }, []);

    // Turn the selected rectangle into text or a cropped JPEG (debounced).
    useEffect(() => {
        if (!rect || rect.w < 8 || rect.h < 8) {
            setSel(null);
            return;
        }
        let cancelled = false;
        const timer = setTimeout(() => {
            const content = useEditorStore.getState().content;
            if (!content) {
                setSel(null);
                return;
            }
            const hasInk = !!content.background || content.objects.some(isStroke);
            if (!hasInk) {
                const text = textInRect(content.objects, rect).trim();
                setSel(text ? { text } : null);
                return;
            }
            cropSelection(content, rect)
                .then((image) => {
                    if (!cancelled) setSel({ image });
                })
                .catch(() => {
                    if (!cancelled) setSel(null);
                });
        }, 300);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [rect]);

    if (projectId === null) return null;

    return (
        <div className="flex h-full w-full min-w-0 flex-col">
            <div className="flex h-12 shrink-0 items-center gap-2 border-b border-line px-4">
                <Sparkles className="h-4 w-4 text-accent" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-ink">AI assistant</h2>
            </div>
            <div className="min-h-0 flex-1">
                <AIAssistantPanel
                    projectId={projectId}
                    pageId={pageId ?? undefined}
                    selection={selection}
                    onClearSelection={() => setSelection(null)}
                    onApplyText={applySuggestion}
                />
            </div>
        </div>
    );
}
TSX_EOF
echo "wrote frontend/src/components/editor/AIPanel.tsx"

# ------------------------------------------- aiApi: reuse API_URL from api.ts
if grep -q '^const API_URL = process.env.NEXT_PUBLIC_API_URL' "$AIAPI"; then
  if grep -Eq 'export (const|let|var) API_URL|export \{[^}]*API_URL' frontend/src/lib/api.ts 2>/dev/null; then
    sed -i.tmp 's|^const API_URL = process.env.NEXT_PUBLIC_API_URL.*|import { API_URL } from "@/lib/api";|' "$AIAPI"
    rm -f "$AIAPI.tmp"
    echo "aiApi.ts now imports API_URL from lib/api.ts"
  else
    echo "!! lib/api.ts does not export API_URL (was it overwritten? restore it). aiApi.ts keeps using NEXT_PUBLIC_API_URL for now."
  fi
fi

# ------------------------------------------------------------ EditorShell
if grep -q 'from "./AIPanel"' "$SHELL_FILE"; then
  echo "EditorShell.tsx is already patched."
else
  if ! grep -q 'function AIPanelPlaceholder' "$SHELL_FILE"; then
    echo "!! AIPanelPlaceholder not found in $SHELL_FILE; not editing it. Mount <AIPanel /> by hand."; exit 1
  fi
  cp "$SHELL_FILE" "$SHELL_FILE.bak"
  sed -i.tmp \
    -e '/^\/\*\* Batch 3 replaces/,/^}/d' \
    -e 's|^import { PageSidebar } from "./PageSidebar";|&\nimport { AIPanel } from "./AIPanel";|' \
    -e 's|<AIPanelPlaceholder />|<AIPanel />|g' \
    -e 's|import { AlertCircle, Sparkles, X } from "lucide-react";|import { AlertCircle, X } from "lucide-react";|' \
    -e 's|hidden w-80 shrink-0 border-l|hidden w-[400px] shrink-0 border-l|' \
    "$SHELL_FILE"
  rm -f "$SHELL_FILE.tmp"
  if grep -q 'AIPanelPlaceholder' "$SHELL_FILE"; then
    echo "!! Some AIPanelPlaceholder references are left. Restoring backup."; mv "$SHELL_FILE.bak" "$SHELL_FILE"; exit 1
  fi
  echo "EditorShell.tsx patched (backup: $SHELL_FILE.bak)"
fi

echo ""
echo "Done. Restart 'npm run dev' if it is running, then open a project."
echo "  - Make sure frontend/src/lib/api.ts still exports api, API_URL and MOCK_MODE."
echo "  - Delete $SHELL_FILE.bak once everything works."
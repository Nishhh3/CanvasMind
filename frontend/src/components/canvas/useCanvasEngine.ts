"use client";

import {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState,
    type MouseEvent as ReactMouseEvent,
    type PointerEvent as ReactPointerEvent,
    type RefObject,
} from "react";
import { clamp, uid } from "@/lib/utils";
import { useEditorStore } from "@/store/editor";
import type { CanvasObject, StrokeObject } from "@/types/api";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/types/api";
import {
    drawStroke,
    drawStrokes,
    drawTexts,
    hitTestText,
    isStroke,
    loadImage,
    normalizeRect,
    paintBackground,
    resolveAssetUrl,
    toLogicalPoint,
} from "./canvas-utils";

const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export type CanvasHandlers = {
    onPointerDown: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
    onPointerUp: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
    onPointerCancel: (e: ReactPointerEvent<HTMLCanvasElement>) => void;
    onDoubleClick: (e: ReactMouseEvent<HTMLCanvasElement>) => void;
};

export type CanvasEngineOptions = {
    bgRef: RefObject<HTMLCanvasElement | null>;
    drawRef: RefObject<HTMLCanvasElement | null>;
    cssWidth: number;
    cssHeight: number;
    pixelRatio: number;
};

type Gesture =
    | { kind: "stroke"; pointerId: number }
    | {
        kind: "moveText";
        pointerId: number;
        id: string;
        dx: number;
        dy: number;
        before: CanvasObject[];
        moved: boolean;
        startX: number;
        startY: number;
    }
    | { kind: "select"; pointerId: number; startX: number; startY: number };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function useCanvasEngine({ bgRef, drawRef, cssWidth, cssHeight, pixelRatio }: CanvasEngineOptions) {
    const content = useEditorStore((s) => s.content);
    const editingId = useEditorStore((s) => s.editing?.id ?? null);
    const tool = useEditorStore((s) => s.tool);
    const objects = content?.objects;
    const background = content?.background ?? null;

    const [bgFailedSrc, setBgFailedSrc] = useState<string | null>(null);

    const cacheRef = useRef<HTMLCanvasElement | null>(null);
    const lastStrokesRef = useRef<StrokeObject[]>([]);
    const liveRef = useRef<StrokeObject | null>(null);
    const gestureRef = useRef<Gesture | null>(null);
    const scaleRef = useRef(1);
    const rafRef = useRef<number | null>(null);
    const bgTokenRef = useRef(0);

    // Composites: [committed strokes bitmap] + [live stroke] + [text boxes], all onto the drawing canvas.
    const redraw = useCallback(() => {
        const canvas = drawRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const cache = cacheRef.current;
        if (cache && cache.width === canvas.width && cache.height === canvas.height) {
            ctx.drawImage(cache, 0, 0);
        }
        ctx.setTransform(scaleRef.current, 0, 0, scaleRef.current, 0, 0);
        const live = liveRef.current;
        if (live) drawStroke(ctx, live);
        const state = useEditorStore.getState();
        drawTexts(ctx, state.content?.objects ?? [], state.editing?.id);
    }, [drawRef]);

    const scheduleRedraw = useCallback(() => {
        if (rafRef.current !== null) return;
        rafRef.current = requestAnimationFrame(() => {
            rafRef.current = null;
            redraw();
        });
    }, [redraw]);

    // Re-renders committed strokes (deterministically, in order) into the offscreen bitmap.
    const rebuildCache = useCallback(() => {
        const canvas = drawRef.current;
        if (!canvas) return;
        if (!cacheRef.current) cacheRef.current = document.createElement("canvas");
        const cache = cacheRef.current;
        if (cache.width !== canvas.width) cache.width = canvas.width;
        if (cache.height !== canvas.height) cache.height = canvas.height;
        const ctx = cache.getContext("2d");
        if (!ctx) return;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, cache.width, cache.height);
        ctx.setTransform(scaleRef.current, 0, 0, scaleRef.current, 0, 0);
        const all = useEditorStore.getState().content?.objects ?? [];
        drawStrokes(ctx, all);
        lastStrokesRef.current = all.filter(isStroke);
    }, [drawRef]);

    const paintBackgroundLayer = useCallback(() => {
        const canvas = bgRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;
        const token = ++bgTokenRef.current;
        const src = useEditorStore.getState().content?.background ?? null;

        const paint = (img: HTMLImageElement | null) => {
            const c = bgRef.current;
            const cx = c?.getContext("2d");
            if (!c || !cx) return;
            cx.setTransform(1, 0, 0, 1, 0, 0);
            cx.clearRect(0, 0, c.width, c.height);
            cx.setTransform(scaleRef.current, 0, 0, scaleRef.current, 0, 0);
            paintBackground(cx, img);
        };

        paint(null);
        if (!src) return;
        loadImage(resolveAssetUrl(src))
            .then((img) => {
                if (token !== bgTokenRef.current) return;
                paint(img);
                setBgFailedSrc(null);
            })
            .catch(() => {
                if (token === bgTokenRef.current) setBgFailedSrc(src);
            });
    }, [bgRef]);

    const applySize = useCallback(
        (w: number, h: number, ratio: number): boolean => {
            const bg = bgRef.current;
            const draw = drawRef.current;
            if (!bg || !draw || w <= 0 || h <= 0) return false;
            const bw = Math.max(1, Math.round(w * ratio));
            const bh = Math.max(1, Math.round((bw * CANVAS_HEIGHT) / CANVAS_WIDTH));
            for (const canvas of [bg, draw]) {
                canvas.width = bw;
                canvas.height = bh;
            }
            scaleRef.current = bw / CANVAS_WIDTH;
            return true;
        },
        [bgRef, drawRef],
    );

    // 1) Size / device pixel ratio changes: resize backing stores, then replay everything from the model.
    useIsoLayoutEffect(() => {
        if (!applySize(cssWidth, cssHeight, pixelRatio)) return;
        paintBackgroundLayer();
        rebuildCache();
        redraw();
    }, [applySize, paintBackgroundLayer, rebuildCache, redraw, cssWidth, cssHeight, pixelRatio]);

    // 2) Object changes (commit, undo, redo, page switch, text move): rebuild only if strokes changed.
    useIsoLayoutEffect(() => {
        const strokes = (objects ?? []).filter(isStroke);
        const last = lastStrokesRef.current;
        const same = strokes.length === last.length && strokes.every((s, i) => s === last[i]);
        if (!same) rebuildCache();
        liveRef.current = null;
        redraw();
    }, [objects, editingId, rebuildCache, redraw]);

    // 3) Background changes (page switch, import).
    useEffect(() => {
        paintBackgroundLayer();
    }, [background, paintBackgroundLayer]);

    useEffect(() => {
        return () => {
            if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    const onPointerDown = useCallback(
        (e: ReactPointerEvent<HTMLCanvasElement>) => {
            const s = useEditorStore.getState();
            if (!s.content || s.pageLoading) return;
            if (e.pointerType === "mouse" && e.button !== 0) return;
            if (gestureRef.current) return; // ignore extra touches while a gesture is active
            if (s.editing) {
                // Clicking the canvas while typing just commits the text (textarea blur does the work).
                (document.activeElement as HTMLElement | null)?.blur?.();
                return;
            }
            const canvas = e.currentTarget;
            const p = toLogicalPoint(canvas, e.clientX, e.clientY);
            const capture = () => {
                try {
                    canvas.setPointerCapture(e.pointerId);
                } catch {
                    // Not fatal: events continue while the pointer stays over the canvas.
                }
            };

            if (s.tool === "pen" || s.tool === "highlighter" || s.tool === "eraser") {
                capture();
                liveRef.current = {
                    id: uid("s"),
                    type: "stroke",
                    tool: s.tool,
                    color: s.color,
                    size: s.size,
                    points: [[round2(p.x), round2(p.y)]],
                };
                gestureRef.current = { kind: "stroke", pointerId: e.pointerId };
                scheduleRedraw();
                return;
            }

            if (s.tool === "text") {
                const hit = hitTestText(s.content.objects, p.x, p.y);
                if (hit) {
                    capture();
                    s.selectText(hit.id);
                    gestureRef.current = {
                        kind: "moveText",
                        pointerId: e.pointerId,
                        id: hit.id,
                        dx: p.x - hit.x,
                        dy: p.y - hit.y,
                        before: s.content.objects,
                        moved: false,
                        startX: p.x,
                        startY: p.y,
                    };
                } else {
                    s.selectText(null);
                    s.startEditing({
                        id: uid("t"),
                        isNew: true,
                        x: clamp(p.x, 0, CANVAS_WIDTH - 40),
                        y: clamp(p.y - s.fontSize / 2, 0, CANVAS_HEIGHT - s.fontSize * 1.3),
                        text: "",
                        fontSize: s.fontSize,
                        color: s.color,
                    });
                }
                return;
            }

            // Rectangular selection
            capture();
            s.setSelection(null);
            gestureRef.current = { kind: "select", pointerId: e.pointerId, startX: p.x, startY: p.y };
        },
        [scheduleRedraw],
    );

    const onPointerMove = useCallback(
        (e: ReactPointerEvent<HTMLCanvasElement>) => {
            const g = gestureRef.current;
            if (!g || g.pointerId !== e.pointerId) return;
            const canvas = e.currentTarget;

            if (g.kind === "stroke") {
                const live = liveRef.current;
                if (!live) return;
                const ne = e.nativeEvent;
                const coalesced = typeof ne.getCoalescedEvents === "function" ? ne.getCoalescedEvents() : [];
                const events = coalesced.length > 0 ? coalesced : [ne];
                for (const ev of events) {
                    const p = toLogicalPoint(canvas, ev.clientX, ev.clientY);
                    const last = live.points[live.points.length - 1];
                    if (Math.hypot(p.x - last[0], p.y - last[1]) >= 0.6) live.points.push([round2(p.x), round2(p.y)]);
                }
                scheduleRedraw();
                return;
            }

            const p = toLogicalPoint(canvas, e.clientX, e.clientY);
            const s = useEditorStore.getState();

            if (g.kind === "moveText") {
                if (!g.moved && Math.hypot(p.x - g.startX, p.y - g.startY) < 3) return;
                g.moved = true;
                const x = clamp(p.x - g.dx, 0, CANVAS_WIDTH - 20);
                const y = clamp(p.y - g.dy, 0, CANVAS_HEIGHT - 20);
                const current = s.content?.objects ?? [];
                s.setObjectsTransient(current.map((o) => (o.id === g.id && o.type === "text" ? { ...o, x, y } : o)));
                return;
            }

            s.setSelection(normalizeRect(g.startX, g.startY, p.x, p.y));
        },
        [scheduleRedraw],
    );

    const finishGesture = useCallback(
        (e: ReactPointerEvent<HTMLCanvasElement>, cancelled: boolean) => {
            const g = gestureRef.current;
            if (!g || g.pointerId !== e.pointerId) return;
            gestureRef.current = null;
            try {
                e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
                // Already released.
            }
            const s = useEditorStore.getState();

            if (g.kind === "stroke") {
                const live = liveRef.current;
                if (live && !cancelled && s.content) {
                    // The layout effect on `objects` clears liveRef after the committed bitmap is rebuilt (no flicker).
                    s.commitObjects([...s.content.objects, live], s.content.objects);
                } else {
                    liveRef.current = null;
                    redraw();
                }
                return;
            }

            if (g.kind === "moveText") {
                if (cancelled) {
                    s.setObjectsTransient(g.before);
                } else if (g.moved && s.content) {
                    s.commitObjects(s.content.objects, g.before);
                }
                return;
            }

            // Selection: discard accidental tiny rectangles.
            const sel = s.selection;
            if (cancelled || !sel || sel.w < 8 || sel.h < 8) s.setSelection(null);
        },
        [redraw],
    );

    const onPointerUp = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => finishGesture(e, false), [finishGesture]);
    const onPointerCancel = useCallback((e: ReactPointerEvent<HTMLCanvasElement>) => finishGesture(e, true), [finishGesture]);

    const onDoubleClick = useCallback((e: ReactMouseEvent<HTMLCanvasElement>) => {
        const s = useEditorStore.getState();
        if (s.tool !== "text" || !s.content || s.editing) return;
        const p = toLogicalPoint(e.currentTarget, e.clientX, e.clientY);
        const hit = hitTestText(s.content.objects, p.x, p.y);
        if (!hit) return;
        s.startEditing({
            id: hit.id,
            isNew: false,
            x: hit.x,
            y: hit.y,
            text: hit.text,
            fontSize: hit.fontSize,
            color: hit.color,
        });
    }, []);

    const handlers: CanvasHandlers = useMemo(
        () => ({ onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onDoubleClick }),
        [onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onDoubleClick],
    );

    return {
        handlers,
        cursor: tool === "text" ? "text" : "crosshair",
        backgroundError: background !== null && bgFailedSrc === background,
    };
}
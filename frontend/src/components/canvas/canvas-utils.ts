import { API_URL } from "@/lib/api";
import type { CanvasObject, PageContent, StrokeObject, StrokeTool, TextObject } from "@/types/api";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/types/api";

export const TEXT_FONT_FAMILY = 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
export const TEXT_LINE_HEIGHT = 1.3;
export const HIGHLIGHTER_ALPHA = 0.35;

/** Rendered width = stroke.size * multiplier. Used by every renderer so output is deterministic. */
const BRUSH_MULTIPLIER: Record<StrokeTool, number> = { pen: 1, highlighter: 3, eraser: 3 };

export type Rect = { x: number; y: number; w: number; h: number };
export type Point = { x: number; y: number };

export const isStroke = (o: CanvasObject): o is StrokeObject => o.type === "stroke";
export const isText = (o: CanvasObject): o is TextObject => o.type === "text";

export function strokeWidth(tool: StrokeTool, size: number): number {
    return size * BRUSH_MULTIPLIER[tool];
}

export function emptyContent(): PageContent {
    return { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, background: null, objects: [] };
}

function isValidObject(o: unknown): o is CanvasObject {
    if (!o || typeof o !== "object") return false;
    const v = o as Record<string, unknown>;
    if (typeof v.id !== "string") return false;
    if (v.type === "stroke") {
        return (
            Array.isArray(v.points) &&
            typeof v.size === "number" &&
            typeof v.color === "string" &&
            (v.tool === "pen" || v.tool === "highlighter" || v.tool === "eraser")
        );
    }
    if (v.type === "text") {
        return (
            typeof v.x === "number" &&
            typeof v.y === "number" &&
            typeof v.text === "string" &&
            typeof v.fontSize === "number" &&
            typeof v.color === "string"
        );
    }
    return false;
}

/** Defensive normalisation of whatever the server returned. Always yields a 1200x800 PageContent. */
export function normalizeContent(raw: unknown): PageContent {
    const c = (raw && typeof raw === "object" ? raw : {}) as Partial<PageContent>;
    return {
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        background: typeof c.background === "string" && c.background ? c.background : null,
        objects: Array.isArray(c.objects) ? c.objects.filter(isValidObject) : [],
    };
}

// ---------- Geometry ----------

export function toLogicalPoint(canvas: HTMLCanvasElement, clientX: number, clientY: number): Point {
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return { x: 0, y: 0 };
    return {
        x: ((clientX - rect.left) * CANVAS_WIDTH) / rect.width,
        y: ((clientY - rect.top) * CANVAS_HEIGHT) / rect.height,
    };
}

export function normalizeRect(ax: number, ay: number, bx: number, by: number): Rect {
    const x1 = Math.min(Math.max(Math.min(ax, bx), 0), CANVAS_WIDTH);
    const y1 = Math.min(Math.max(Math.min(ay, by), 0), CANVAS_HEIGHT);
    const x2 = Math.min(Math.max(Math.max(ax, bx), 0), CANVAS_WIDTH);
    const y2 = Math.min(Math.max(Math.max(ay, by), 0), CANVAS_HEIGHT);
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

// ---------- Text measuring ----------

let measureCtx: CanvasRenderingContext2D | null | undefined;

function getMeasureCtx(): CanvasRenderingContext2D | null {
    if (measureCtx !== undefined) return measureCtx;
    measureCtx = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d");
    return measureCtx;
}

export function measureTextBlock(text: string, fontSize: number): { w: number; h: number } {
    const lines = text.split("\n");
    const ctx = getMeasureCtx();
    let w = 0;
    if (ctx) {
        ctx.font = `${fontSize}px ${TEXT_FONT_FAMILY}`;
        for (const line of lines) w = Math.max(w, ctx.measureText(line).width);
    } else {
        for (const line of lines) w = Math.max(w, line.length * fontSize * 0.55);
    }
    return { w, h: lines.length * fontSize * TEXT_LINE_HEIGHT };
}

export function textBounds(t: TextObject): Rect {
    const m = measureTextBlock(t.text || " ", t.fontSize);
    return { x: t.x, y: t.y, w: Math.max(m.w, t.fontSize), h: m.h };
}

export function hitTestText(objects: readonly CanvasObject[], x: number, y: number, pad = 8): TextObject | null {
    for (let i = objects.length - 1; i >= 0; i--) {
        const o = objects[i];
        if (o.type !== "text") continue;
        const b = textBounds(o);
        if (x >= b.x - pad && x <= b.x + b.w + pad && y >= b.y - pad && y <= b.y + b.h + pad) return o;
    }
    return null;
}

/** Text of every text box that intersects the rectangle (useful for selection.text in Batch 3). */
export function textInRect(objects: readonly CanvasObject[], r: Rect): string {
    return objects
        .filter(isText)
        .filter((t) => {
            const b = textBounds(t);
            return b.x < r.x + r.w && b.x + b.w > r.x && b.y < r.y + r.h && b.y + b.h > r.y;
        })
        .map((t) => t.text)
        .join("\n");
}

// ---------- Drawing (all functions assume the logical 1200x800 transform is already set) ----------

export function drawStroke(ctx: CanvasRenderingContext2D, s: StrokeObject): void {
    const pts = s.points;
    if (pts.length === 0) return;
    const width = strokeWidth(s.tool, s.size);

    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = width;
    if (s.tool === "eraser") {
        ctx.globalCompositeOperation = "destination-out";
        ctx.strokeStyle = "#000000";
        ctx.fillStyle = "#000000";
    } else {
        ctx.globalCompositeOperation = "source-over";
        ctx.strokeStyle = s.color;
        ctx.fillStyle = s.color;
        if (s.tool === "highlighter") ctx.globalAlpha = HIGHLIGHTER_ALPHA;
    }

    if (pts.length === 1) {
        ctx.beginPath();
        ctx.arc(pts[0][0], pts[0][1], width / 2, 0, Math.PI * 2);
        ctx.fill();
    } else {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length - 1; i++) {
            const mx = (pts[i][0] + pts[i + 1][0]) / 2;
            const my = (pts[i][1] + pts[i + 1][1]) / 2;
            ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
        }
        const last = pts[pts.length - 1];
        ctx.lineTo(last[0], last[1]);
        ctx.stroke();
    }
    ctx.restore();
}

export function drawText(ctx: CanvasRenderingContext2D, t: TextObject): void {
    const lineHeight = t.fontSize * TEXT_LINE_HEIGHT;
    ctx.save();
    ctx.font = `${t.fontSize}px ${TEXT_FONT_FAMILY}`;
    ctx.fillStyle = t.color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    t.text.split("\n").forEach((line, i) => {
        ctx.fillText(line, t.x, t.y + (i + 0.5) * lineHeight);
    });
    ctx.restore();
}

export function drawStrokes(ctx: CanvasRenderingContext2D, objects: readonly CanvasObject[]): void {
    for (const o of objects) if (o.type === "stroke") drawStroke(ctx, o);
}

export function drawTexts(
    ctx: CanvasRenderingContext2D,
    objects: readonly CanvasObject[],
    editingId?: string | null,
): void {
    for (const o of objects) {
        if (o.type === "text" && o.id !== editingId) drawText(ctx, o);
    }
}

export function resolveAssetUrl(src: string): string {
    if (/^(?:data|blob|https?):/i.test(src)) return src;
    return src.startsWith("/") ? `${API_URL}${src}` : `${API_URL}/${src}`;
}

export function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error(`Could not load image: ${src}`));
        image.src = src;
    });
}

export function paintBackground(ctx: CanvasRenderingContext2D, image: HTMLImageElement | null): void {
    if (!image) return;
    ctx.drawImage(image, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

export type RenderOptions = { scale?: number; quality?: number };

export async function renderContentToDataUrl(content: PageContent, options: RenderOptions = {}): Promise<string> {
    const scale = options.scale ?? 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(CANVAS_WIDTH * scale));
    canvas.height = Math.max(1, Math.round(CANVAS_HEIGHT * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create a canvas rendering context.");
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    if (content.background) {
        const image = await loadImage(resolveAssetUrl(content.background));
        paintBackground(ctx, image);
    }
    drawStrokes(ctx, content.objects);
    drawTexts(ctx, content.objects);
    return canvas.toDataURL("image/jpeg", options.quality ?? 0.9);
}
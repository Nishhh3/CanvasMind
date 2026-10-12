import { create } from "zustand";
import { normalizeContent, renderContentToDataUrl } from "@/components/canvas/canvas-utils";
import { api } from "@/lib/api";
import { clamp, errorMessage } from "@/lib/utils";
import type { CanvasObject, Page, PageContent, PageSummary, ProjectDetail, TextObject } from "@/types/api";
import { toast } from "./toast";

export type Tool = "pen" | "highlighter" | "eraser" | "text" | "select";
export type SaveStatus = "saved" | "dirty" | "saving" | "error";
export type LoadStatus = "idle" | "loading" | "ready" | "error";
export type SelectionRect = { x: number; y: number; w: number; h: number };
export type EditingState = {
    id: string;
    isNew: boolean;
    x: number;
    y: number;
    text: string;
    fontSize: number;
    color: string;
};

type History = { past: CanvasObject[][]; future: CanvasObject[][] };

const MAX_HISTORY = 100;
const SAVE_DELAY_MS = 1500;

// ---------- Module-level save machinery ----------
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let thumbTimer: ReturnType<typeof setTimeout> | null = null;
let inflight: Promise<boolean> | null = null;
let revision = 0; // increments on every committed edit of the active page
let savedRevision = 0; // last revision confirmed saved by the server
let loadToken = 0;
let pageToken = 0;
let reorderToken = 0;
const historyByPage = new Map<number, History>();

const isDirty = () => revision !== savedRevision;
const sortPages = (pages: PageSummary[]) => [...pages].sort((a, b) => a.position - b.position);

function clearSaveTimer() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = null;
}

function clearAllTimers() {
    clearSaveTimer();
    if (thumbTimer) clearTimeout(thumbTimer);
    thumbTimer = null;
}

function scheduleSave() {
    clearSaveTimer();
    saveTimer = setTimeout(() => {
        saveTimer = null;
        void flush(false);
    }, SAVE_DELAY_MS);
}

function markDirty() {
    revision += 1;
    useEditorStore.setState((s) => ({ saveStatus: s.saveStatus === "saving" ? "saving" : "dirty" }));
    scheduleSave();
}

function scheduleThumb(delay = 700) {
    if (thumbTimer) clearTimeout(thumbTimer);
    thumbTimer = setTimeout(async () => {
        thumbTimer = null;
        const s = useEditorStore.getState();
        if (!s.content || s.activePageId === null) return;
        const id = s.activePageId;
        try {
            const url = await renderContentToDataUrl(s.content, { scale: 0.2, quality: 0.6 });
            if (useEditorStore.getState().activePageId !== id) return;
            useEditorStore.setState((st) => ({ thumbnails: { ...st.thumbnails, [id]: url } }));
        } catch {
            // Thumbnails are cosmetic; ignore failures.
        }
    }, delay);
}

/** One save request. Resolves true on success (or nothing to do), false on failure. */
async function doSavePass(): Promise<boolean> {
    const s = useEditorStore.getState();
    if (!s.content || s.activePageId === null) return true;
    const pageId = s.activePageId;
    const content = s.content;
    const rev = revision;

    useEditorStore.setState({ saveStatus: "saving", saveError: null });

    let image: string | undefined;
    try {
        image = await renderContentToDataUrl(content, { quality: 0.8 });
    } catch (e) {
        console.warn("Could not render the page image; saving content without it.", e);
        image = undefined;
    }

    try {
        const summary = await api.pages.save(pageId, image ? { content, image } : { content });
        if (useEditorStore.getState().activePageId !== pageId) return true; // user moved on; nothing to update
        savedRevision = rev;
        useEditorStore.setState((st) => ({
            pages: st.pages.map((p) => (p.id === summary.id ? { ...p, ...summary } : p)),
            saveStatus: revision === rev ? "saved" : "dirty",
            saveError: null,
        }));
        return true;
    } catch (e) {
        if (useEditorStore.getState().activePageId === pageId) {
            useEditorStore.setState({ saveStatus: "error", saveError: errorMessage(e, "Could not save this page.") });
        }
        return false;
    }
}

/**
 * force=true: save immediately and keep going until clean (used before page switches / leaving).
 * force=false: debounced path; edits made during a save are rescheduled with the full delay.
 * Resolves true when the active page has no unsaved changes.
 */
async function flush(force: boolean): Promise<boolean> {
    if (force) clearSaveTimer();
    while (inflight) {
        try {
            await inflight;
        } catch {
            // errors are reported through store state
        }
    }
    if (!isDirty()) return true;

    const pass: Promise<boolean> = doSavePass().finally(() => {
        if (inflight === pass) inflight = null;
    });
    inflight = pass;
    const ok = await pass;
    if (!ok) return false;
    if (isDirty()) {
        if (force) return flush(true);
        scheduleSave();
    }
    return true;
}

// ---------- Store ----------

type EditorState = {
    projectId: number | null;
    project: ProjectDetail | null;
    pages: PageSummary[];
    activePageId: number | null;
    loadStatus: LoadStatus;
    loadError: string | null;
    pageLoading: boolean;

    content: PageContent | null;
    past: CanvasObject[][];
    future: CanvasObject[][];

    tool: Tool;
    color: string;
    size: number;
    fontSize: number;
    selection: SelectionRect | null;
    selectedTextId: string | null;
    editing: EditingState | null;

    saveStatus: SaveStatus;
    saveError: string | null;
    thumbnails: Record<number, string>;

    load: (projectId: number) => Promise<void>;
    dispose: () => void;
    switchPage: (id: number) => Promise<void>;
    addPage: () => Promise<void>;
    renamePage: (id: number, title: string) => Promise<void>;
    deletePage: (id: number) => Promise<void>;
    reorderPages: (ids: number[]) => Promise<void>;
    renameProject: (name: string) => Promise<void>;
    importFiles: (files: File[]) => Promise<number>;

    saveNow: () => Promise<boolean>;
    retrySave: () => Promise<void>;

    setTool: (tool: Tool) => void;
    setColor: (color: string) => void;
    setSize: (size: number) => void;
    setFontSize: (size: number) => void;
    setSelection: (rect: SelectionRect | null) => void;
    selectText: (id: string | null) => void;
    startEditing: (editing: EditingState) => void;
    finishEditing: (value: string, cancel?: boolean) => void;

    commitObjects: (next: CanvasObject[], before?: CanvasObject[]) => void;
    setObjectsTransient: (next: CanvasObject[]) => void;
    undo: () => void;
    redo: () => void;
    clearPage: () => void;
    deleteSelectedText: () => void;
};

const documentInitial = {
    projectId: null as number | null,
    project: null as ProjectDetail | null,
    pages: [] as PageSummary[],
    activePageId: null as number | null,
    loadStatus: "idle" as LoadStatus,
    loadError: null as string | null,
    pageLoading: false,
    content: null as PageContent | null,
    past: [] as CanvasObject[][],
    future: [] as CanvasObject[][],
    selection: null as SelectionRect | null,
    selectedTextId: null as string | null,
    editing: null as EditingState | null,
    saveStatus: "saved" as SaveStatus,
    saveError: null as string | null,
    thumbnails: {} as Record<number, string>,
};

/** Fetches a page and makes it the active one. Does NOT flush; callers do that first. */
async function openPage(id: number): Promise<boolean> {
    const token = ++pageToken;
    useEditorStore.setState({ pageLoading: true });
    try {
        const page: Page = await api.pages.get(id);
        if (token !== pageToken) return false;
        const s = useEditorStore.getState();
        if (s.activePageId !== null && s.activePageId !== id) {
            historyByPage.set(s.activePageId, { past: s.past, future: s.future });
        }
        const history = historyByPage.get(id) ?? { past: [], future: [] };
        revision = 0;
        savedRevision = 0;
        useEditorStore.setState({
            activePageId: id,
            content: normalizeContent(page.content),
            past: history.past,
            future: history.future,
            selection: null,
            selectedTextId: null,
            editing: null,
            pageLoading: false,
            saveStatus: "saved",
            saveError: null,
        });
        scheduleThumb(150);
        return true;
    } catch (e) {
        if (token === pageToken) {
            useEditorStore.setState({ pageLoading: false });
            toast.error(errorMessage(e, "Could not open that page."));
        }
        return false;
    }
}

export const useEditorStore = create<EditorState>()((set, get) => ({
    ...documentInitial,
    tool: "pen",
    color: "#1e2335",
    size: 4,
    fontSize: 32,

    load: async (projectId) => {
        const token = ++loadToken;
        pageToken += 1;
        clearAllTimers();
        revision = 0;
        savedRevision = 0;
        historyByPage.clear();
        set({ ...documentInitial, projectId, loadStatus: "loading" });
        try {
            const project = await api.projects.get(projectId);
            if (token !== loadToken) return;
            const pages = sortPages(project.pages);
            const first = pages.length > 0 ? await api.pages.get(pages[0].id) : null;
            if (token !== loadToken) return;
            set({
                project,
                pages,
                activePageId: first ? first.id : null,
                content: first ? normalizeContent(first.content) : null,
                loadStatus: "ready",
                loadError: null,
            });
            if (first) scheduleThumb(200);
        } catch (e) {
            if (token !== loadToken) return;
            set({ loadStatus: "error", loadError: errorMessage(e, "Could not load this project.") });
        }
    },

    dispose: () => {
        const token = loadToken;
        void flush(true).finally(() => {
            // If a newer load started meanwhile (e.g. React Strict Mode remount), do not wipe it.
            if (token !== loadToken) return;
            clearAllTimers();
            revision = 0;
            savedRevision = 0;
            historyByPage.clear();
            set({ ...documentInitial });
        });
    },

    switchPage: async (id) => {
        const s = get();
        if (id === s.activePageId || s.pageLoading) return;
        if (s.editing && typeof document !== "undefined") {
            (document.activeElement as HTMLElement | null)?.blur?.();
        }
        const ok = await flush(true);
        if (!ok) {
            toast.error("Your latest changes could not be saved, so the page was not switched. Retry saving, then try again.");
            return;
        }
        await openPage(id);
    },

    addPage: async () => {
        const projectId = get().projectId;
        if (projectId === null) return;
        const summary = await api.pages.create(projectId);
        set((s) => ({ pages: [...s.pages, summary] }));
        await get().switchPage(summary.id);
    },

    renamePage: async (id, title) => {
        const summary = await api.pages.rename(id, title);
        set((s) => ({ pages: s.pages.map((p) => (p.id === id ? { ...p, ...summary } : p)) }));
    },

    deletePage: async (id) => {
        await api.pages.remove(id);
        const s = get();
        const index = s.pages.findIndex((p) => p.id === id);
        const remaining = s.pages.filter((p) => p.id !== id);
        const thumbnails = { ...s.thumbnails };
        delete thumbnails[id];
        historyByPage.delete(id);
        const wasActive = s.activePageId === id;
        set({ pages: remaining, thumbnails });
        if (!wasActive) return;

        clearAllTimers();
        revision = 0;
        savedRevision = 0;
        pageToken += 1;
        set({
            activePageId: null,
            content: null,
            past: [],
            future: [],
            selection: null,
            selectedTextId: null,
            editing: null,
            saveStatus: "saved",
            saveError: null,
            pageLoading: false,
        });
        if (remaining.length > 0) {
            await openPage(remaining[Math.min(index, remaining.length - 1)].id);
        }
    },

    reorderPages: async (ids) => {
        const s = get();
        if (s.projectId === null) return;
        const previous = s.pages;
        const byId = new Map(previous.map((p) => [p.id, p]));
        const optimistic = ids.map((id) => byId.get(id)).filter((p): p is PageSummary => p !== undefined);
        if (optimistic.length !== previous.length) return;
        set({ pages: optimistic });
        const token = ++reorderToken;
        try {
            const result = await api.pages.reorder(s.projectId, ids);
            if (token !== reorderToken) return;
            set({ pages: result });
        } catch (e) {
            if (token !== reorderToken) return;
            set({ pages: previous });
            toast.error(errorMessage(e, "Could not reorder pages."));
        }
    },

    renameProject: async (name) => {
        const projectId = get().projectId;
        if (projectId === null) return;
        const updated = await api.projects.rename(projectId, name);
        set((s) => ({
            project: s.project ? { ...s.project, name: updated.name, updated_at: updated.updated_at } : s.project,
        }));
    },

    importFiles: async (files) => {
        const projectId = get().projectId;
        if (projectId === null) throw new Error("No project is open.");
        const result = await api.projects.importFiles(projectId, files);
        try {
            const project = await api.projects.get(projectId);
            set({ project, pages: sortPages(project.pages) });
        } catch {
            set((s) => ({ pages: [...s.pages, ...result.pages.filter((p) => !s.pages.some((x) => x.id === p.id))] }));
        }
        const first = result.pages[0];
        if (first) await get().switchPage(first.id);
        return result.pages.length;
    },

    saveNow: () => flush(true),

    retrySave: async () => {
        const ok = await flush(true);
        if (!ok) toast.error(get().saveError ?? "Saving failed again. Your edits are still on screen.");
    },

    setTool: (tool) => set((s) => ({ tool, selectedTextId: tool === "text" ? s.selectedTextId : null })),
    setColor: (color) => set({ color }),
    setSize: (size) => set({ size: clamp(size, 1, 40) }),
    setFontSize: (fontSize) => set({ fontSize: clamp(fontSize, 12, 120) }),
    setSelection: (selection) => set({ selection }),
    selectText: (selectedTextId) => set({ selectedTextId }),
    startEditing: (editing) => set({ editing, selectedTextId: editing.id }),

    finishEditing: (value, cancel = false) => {
        const s = get();
        const editing = s.editing;
        if (!editing) return;
        const content = s.content;
        set({ editing: null });
        if (!content || cancel) {
            set({ selectedTextId: cancel && !editing.isNew ? editing.id : null });
            return;
        }
        const text = value.replace(/\s+$/, "");
        const objects = content.objects;

        if (editing.isNew) {
            if (!text.trim()) {
                set({ selectedTextId: null });
                return;
            }
            const created: TextObject = {
                id: editing.id,
                type: "text",
                x: editing.x,
                y: editing.y,
                text,
                fontSize: editing.fontSize,
                color: editing.color,
            };
            get().commitObjects([...objects, created], objects);
            set({ selectedTextId: created.id });
            return;
        }

        const existing = objects.find((o) => o.type === "text" && o.id === editing.id);
        if (!existing) return;
        if (!text.trim()) {
            get().commitObjects(objects.filter((o) => o.id !== editing.id), objects);
            set({ selectedTextId: null });
            return;
        }
        if (existing.type === "text" && existing.text !== text) {
            get().commitObjects(
                objects.map((o) => (o.id === editing.id && o.type === "text" ? { ...o, text } : o)),
                objects,
            );
        }
        set({ selectedTextId: editing.id });
    },

    commitObjects: (next, before) => {
        const s = get();
        if (!s.content) return;
        const prior = before ?? s.content.objects;
        set({
            content: { ...s.content, objects: next },
            past: [...s.past, prior].slice(-MAX_HISTORY),
            future: [],
        });
        markDirty();
        scheduleThumb();
    },

    setObjectsTransient: (next) => {
        const s = get();
        if (!s.content) return;
        set({ content: { ...s.content, objects: next } });
    },

    undo: () => {
        const s = get();
        if (!s.content || s.past.length === 0 || s.editing) return;
        const previous = s.past[s.past.length - 1];
        set({
            content: { ...s.content, objects: previous },
            past: s.past.slice(0, -1),
            future: [...s.future, s.content.objects],
            selectedTextId: null,
        });
        markDirty();
        scheduleThumb();
    },

    redo: () => {
        const s = get();
        if (!s.content || s.future.length === 0 || s.editing) return;
        const next = s.future[s.future.length - 1];
        set({
            content: { ...s.content, objects: next },
            future: s.future.slice(0, -1),
            past: [...s.past, s.content.objects],
            selectedTextId: null,
        });
        markDirty();
        scheduleThumb();
    },

    clearPage: () => {
        const s = get();
        if (!s.content || s.content.objects.length === 0) return;
        get().commitObjects([], s.content.objects);
        set({ selectedTextId: null, selection: null });
    },

    deleteSelectedText: () => {
        const s = get();
        if (!s.content || !s.selectedTextId) return;
        const id = s.selectedTextId;
        get().commitObjects(s.content.objects.filter((o) => o.id !== id), s.content.objects);
        set({ selectedTextId: null });
    },
}));
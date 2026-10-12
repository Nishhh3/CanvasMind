"use client";

import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Menu } from "@/components/ui/Menu";
import { cn, errorMessage } from "@/lib/utils";
import { useEditorStore } from "@/store/editor";
import { toast } from "@/store/toast";
import type { PageSummary } from "@/types/api";

export function PageSidebar({ onNavigate }: { onNavigate?: () => void }) {
    const pages = useEditorStore((s) => s.pages);
    const activePageId = useEditorStore((s) => s.activePageId);
    const thumbnails = useEditorStore((s) => s.thumbnails);
    const switchPage = useEditorStore((s) => s.switchPage);
    const addPage = useEditorStore((s) => s.addPage);
    const reorderPages = useEditorStore((s) => s.reorderPages);
    const renamePage = useEditorStore((s) => s.renamePage);
    const deletePage = useEditorStore((s) => s.deletePage);

    const [adding, setAdding] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<PageSummary | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        const from = pages.findIndex((p) => p.id === active.id);
        const to = pages.findIndex((p) => p.id === over.id);
        if (from < 0 || to < 0) return;
        void reorderPages(arrayMove(pages, from, to).map((p) => p.id));
    }

    async function handleAdd() {
        setAdding(true);
        try {
            await addPage();
            onNavigate?.();
        } catch (e) {
            toast.error(errorMessage(e, "Could not add a page."));
        } finally {
            setAdding(false);
        }
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        await deletePage(deleteTarget.id);
        toast.success("Page deleted.");
        setDeleteTarget(null);
    }

    return (
        <div className="flex h-full w-full flex-col">
            <div className="flex items-center justify-between gap-2 px-3 py-3">
                <h2 className="text-sm font-semibold text-ink">Pages</h2>
                <Button size="sm" variant="primary" onClick={handleAdd} loading={adding}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Add page
                </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
                {pages.length === 0 ? (
                    <p className="px-1 py-6 text-center text-sm text-ink-faint">No pages yet.</p>
                ) : (
                    <DndContext id="page-sidebar-dnd" sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                        <SortableContext items={pages.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                            <ul className="space-y-3" aria-label="Pages">
                                {pages.map((page, index) => (
                                    <PageItem
                                        key={page.id}
                                        page={page}
                                        index={index}
                                        active={page.id === activePageId}
                                        thumb={thumbnails[page.id]}
                                        onSelect={(id) => {
                                            void switchPage(id);
                                            onNavigate?.();
                                        }}
                                        onRename={renamePage}
                                        onDelete={setDeleteTarget}
                                    />
                                ))}
                            </ul>
                        </SortableContext>
                    </DndContext>
                )}
            </div>

            <ConfirmDialog
                open={deleteTarget !== null}
                title="Delete page?"
                message={deleteTarget ? `This permanently deletes "${deleteTarget.title}". This cannot be undone.` : ""}
                confirmLabel="Delete page"
                danger
                onConfirm={handleDelete}
                onClose={() => setDeleteTarget(null)}
            />
        </div>
    );
}

type PageItemProps = {
    page: PageSummary;
    index: number;
    active: boolean;
    thumb: string | undefined;
    onSelect: (id: number) => void;
    onRename: (id: number, title: string) => Promise<void>;
    onDelete: (page: PageSummary) => void;
};

function PageItem({ page, index, active, thumb, onSelect, onRename, onDelete }: PageItemProps) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id });
    const [renaming, setRenaming] = useState(false);
    const cancelRef = useRef(false);

    async function commitRename(value: string) {
        setRenaming(false);
        const title = value.trim();
        if (cancelRef.current || !title || title === page.title) return;
        try {
            await onRename(page.id, title);
        } catch (e) {
            toast.error(errorMessage(e, "Could not rename the page."));
        }
    }

    return (
        <li
            ref={setNodeRef}
            style={{ transform: CSS.Transform.toString(transform), transition }}
            className={cn("group relative", isDragging && "z-10 opacity-80")}
        >
            <div
                className={cn(
                    "rounded-ctl border bg-surface p-2 transition-colors",
                    active ? "border-accent ring-2 ring-accent/20" : "border-line hover:border-line-strong",
                )}
            >
                <div className="relative">
                    <button
                        type="button"
                        onClick={() => onSelect(page.id)}
                        aria-current={active ? "page" : undefined}
                        aria-label={`Open ${page.title}`}
                        className="block aspect-[3/2] w-full overflow-hidden rounded-lg bg-white ring-1 ring-line"
                    >
                        {thumb ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={thumb} alt="" className="h-full w-full object-cover" draggable={false} />
                        ) : (
                            <span className="flex h-full items-center justify-center text-xs text-ink-faint">Page {index + 1}</span>
                        )}
                    </button>
                    <button
                        type="button"
                        aria-label={`Reorder ${page.title}`}
                        {...attributes}
                        {...listeners}
                        className="absolute left-1 top-1 inline-flex h-6 w-6 cursor-grab touch-none items-center justify-center rounded-md bg-surface/90 text-ink-soft opacity-70 shadow-sm transition-opacity active:cursor-grabbing md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                    >
                        <GripVertical className="h-4 w-4" />
                    </button>
                </div>

                <div className="mt-2 flex items-center gap-1">
                    <span className="w-5 shrink-0 text-center text-xs text-ink-faint">{index + 1}</span>
                    {renaming ? (
                        <input
                            autoFocus
                            defaultValue={page.title}
                            maxLength={120}
                            aria-label="Page title"
                            onFocus={(e) => e.currentTarget.select()}
                            onBlur={(e) => void commitRename(e.currentTarget.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                                if (e.key === "Escape") {
                                    cancelRef.current = true;
                                    setRenaming(false);
                                }
                            }}
                            className="h-7 min-w-0 flex-1 rounded-md border border-accent bg-surface px-2 text-sm text-ink outline-none"
                        />
                    ) : (
                        <span
                            onDoubleClick={() => {
                                cancelRef.current = false;
                                setRenaming(true);
                            }}
                            title="Double-click to rename"
                            className={cn("min-w-0 flex-1 truncate text-sm", active ? "font-medium text-ink" : "text-ink-soft")}
                        >
                            {page.title}
                        </span>
                    )}
                    <Menu
                        label={`Options for ${page.title}`}
                        items={[
                            {
                                label: "Rename",
                                icon: <Pencil className="h-4 w-4" />,
                                onSelect: () => {
                                    cancelRef.current = false;
                                    setRenaming(true);
                                },
                            },
                            { label: "Delete", icon: <Trash2 className="h-4 w-4" />, onSelect: () => onDelete(page), danger: true },
                        ]}
                    />
                </div>
                {page.transcript_status === "pending" && (
                    <p className="mt-1 pl-6 text-[11px] text-ink-faint">Reading handwriting…</p>
                )}
            </div>
        </li>
    );
}
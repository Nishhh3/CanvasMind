"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { PromptDialog } from "@/components/ui/PromptDialog";
import { useProjects } from "@/hooks/useProjects";
import { parseApiDate } from "@/lib/utils";
import { toast } from "@/store/toast";
import type { Project } from "@/types/api";
import { NewProjectDialog } from "./NewProjectDialog";
import { ProjectGrid } from "./ProjectGrid";
import { QuickActions } from "./QuickActions";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { WelcomeSection } from "./WelcomeSection";

type NewDialogState = { open: boolean; mode: "blank" | "import" };

export function DashboardShell() {
    const router = useRouter();
    const { projects, status, error, reload, createProject, renameProject, removeProject } = useProjects();

    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [newDialog, setNewDialog] = useState<NewDialogState>({ open: false, mode: "blank" });
    const [renameTarget, setRenameTarget] = useState<Project | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);

    const sorted = useMemo(
        () =>
            [...projects].sort(
                (a, b) => parseApiDate(b.updated_at).getTime() - parseApiDate(a.updated_at).getTime(),
            ),
        [projects],
    );

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        return q ? sorted.filter((p) => p.name.toLowerCase().includes(q)) : sorted;
    }, [sorted, search]);

    const openNew = (mode: "blank" | "import") => setNewDialog({ open: true, mode });
    const closeNew = () => setNewDialog((s) => ({ ...s, open: false }));

    async function handleCreate(name: string, files: File[]) {
        const result = await createProject(name, files);
        if (files.length > 0) {
            if (result.importError) {
                toast.error(`Project created, but the import failed: ${result.importError}`);
            } else {
                toast.success(`Imported ${result.importedCount} page${result.importedCount === 1 ? "" : "s"}.`);
            }
        }
        closeNew();
        router.push(`/projects/${result.project.id}`);
    }

    async function handleRename(name: string) {
        if (!renameTarget) return;
        await renameProject(renameTarget.id, name);
        toast.success("Project renamed.");
        setRenameTarget(null);
    }

    async function handleDelete() {
        if (!deleteTarget) return;
        await removeProject(deleteTarget.id);
        toast.success("Project deleted.");
        setDeleteTarget(null);
    }

    return (
        <div className="flex min-h-dvh">
            <Sidebar
                recent={sorted.slice(0, 5)}
                collapsed={collapsed}
                onToggleCollapse={() => setCollapsed((c) => !c)}
                onNewProject={() => openNew("blank")}
                onImport={() => openNew("import")}
                mobileOpen={mobileOpen}
                onCloseMobile={() => setMobileOpen(false)}
            />

            <div className="flex min-w-0 flex-1 flex-col">
                <Topbar
                    title="My workspace"
                    search={search}
                    onSearchChange={setSearch}
                    onNewProject={() => openNew("blank")}
                    onOpenMenu={() => setMobileOpen(true)}
                    onRefresh={reload}
                    refreshing={status === "loading"}
                />

                <main className="mx-auto w-full max-w-6xl flex-1 space-y-8 px-3 py-6 sm:space-y-10 sm:px-6 sm:py-8 lg:px-8">
                    <WelcomeSection onNewProject={() => openNew("blank")} onImport={() => openNew("import")} />
                    <QuickActions
                        onNewProject={() => openNew("blank")}
                        onImport={() => openNew("import")}
                        lastProject={sorted[0] ?? null}
                    />
                    <ProjectGrid
                        projects={filtered}
                        totalCount={projects.length}
                        status={status}
                        error={error}
                        searchQuery={search}
                        onRetry={reload}
                        onNewProject={() => openNew("blank")}
                        onRename={setRenameTarget}
                        onDelete={setDeleteTarget}
                    />
                </main>
            </div>

            <NewProjectDialog
                open={newDialog.open}
                initialMode={newDialog.mode}
                onClose={closeNew}
                onCreate={handleCreate}
            />

            <PromptDialog
                open={renameTarget !== null}
                title="Rename project"
                label="Project name"
                initialValue={renameTarget?.name ?? ""}
                confirmLabel="Rename"
                onSubmit={handleRename}
                onClose={() => setRenameTarget(null)}
            />

            <ConfirmDialog
                open={deleteTarget !== null}
                title="Delete project?"
                message={
                    deleteTarget
                        ? `This permanently deletes ${deleteTarget.name} and all of its pages. This cannot be undone.`
                        : ""
                }
                confirmLabel="Delete project"
                danger
                onConfirm={handleDelete}
                onClose={() => setDeleteTarget(null)}
            />
        </div>
    );
}
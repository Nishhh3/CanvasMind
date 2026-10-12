import { AlertCircle, FolderPlus, SearchX } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { LoadStatus } from "@/hooks/useProjects";
import type { Project } from "@/types/api";
import { ProjectCard } from "./ProjectCard";

type ProjectGridProps = {
    projects: Project[];
    totalCount: number;
    status: LoadStatus;
    error: string | null;
    searchQuery: string;
    onRetry: () => void;
    onNewProject: () => void;
    onRename: (project: Project) => void;
    onDelete: (project: Project) => void;
};

function Skeletons() {
    return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="overflow-hidden rounded-card border border-line bg-surface shadow-soft">
                    <div className="skeleton h-32" />
                    <div className="space-y-2 p-4">
                        <div className="skeleton h-3 w-2/3 rounded-full" />
                        <div className="skeleton h-3 w-1/2 rounded-full" />
                    </div>
                </div>
            ))}
        </div>
    );
}

function Notice({
    icon,
    title,
    message,
    action,
}: {
    icon: React.ReactNode;
    title: string;
    message: string;
    action?: React.ReactNode;
}) {
    return (
        <div className="anim-fade flex flex-col items-center rounded-card border border-dashed border-line-strong bg-surface px-6 py-16 text-center shadow-soft">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-accent shadow-sm">{icon}</div>
            <h3 className="mt-4 text-base font-semibold text-ink">{title}</h3>
            <p className="mt-1 max-w-sm text-sm text-ink-soft">{message}</p>
            {action && <div className="mt-5">{action}</div>}
        </div>
    );
}

export function ProjectGrid({
    projects,
    totalCount,
    status,
    error,
    searchQuery,
    onRetry,
    onNewProject,
    onRename,
    onDelete,
}: ProjectGridProps) {
    let body: React.ReactNode;

    if (status === "loading") {
        body = <Skeletons />;
    } else if (status === "error") {
        body = (
            <Notice
                icon={<AlertCircle className="h-6 w-6" aria-hidden="true" />}
                title="Could not load your projects"
                message={error ?? "Please check that the backend is running and try again."}
                action={
                    <Button variant="primary" onClick={onRetry}>
                        Try again
                    </Button>
                }
            />
        );
    } else if (totalCount === 0) {
        body = (
            <Notice
                icon={<FolderPlus className="h-6 w-6" aria-hidden="true" />}
                title="No projects yet"
                message="Create your first project to start writing, drawing and studying with the AI assistant."
                action={
                    <Button variant="primary" onClick={onNewProject}>
                        Create a project
                    </Button>
                }
            />
        );
    } else if (projects.length === 0) {
        body = (
            <Notice
                icon={<SearchX className="h-6 w-6" aria-hidden="true" />}
                title="No matching projects"
                message={`Nothing matches "${searchQuery.trim()}". Try a different search.`}
            />
        );
    } else {
        body = (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {projects.map((project) => (
                    <ProjectCard key={project.id} project={project} onRename={onRename} onDelete={onDelete} />
                ))}
            </div>
        );
    }

    return (
        <section id="projects" aria-labelledby="recent-heading" className="scroll-mt-20">
            <div className="mb-4 flex items-baseline justify-between">
                <h2 id="recent-heading" className="text-lg font-semibold tracking-tight text-ink">
                    Recent projects
                </h2>
                {status === "ready" && totalCount > 0 && (
                    <span className="text-sm text-ink-faint">
                        {projects.length === totalCount ? `${totalCount} total` : `${projects.length} of ${totalCount}`}
                    </span>
                )}
            </div>
            {body}
        </section>
    );
}
"use client";

import { ChevronLeft, ChevronRight, FolderOpen, Home, PenLine, Plus, Upload, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { MOCK_MODE } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/api";

type SidebarProps = {
    recent: Project[];
    collapsed: boolean;
    onToggleCollapse: () => void;
    onNewProject: () => void;
    onImport: () => void;
    mobileOpen: boolean;
    onCloseMobile: () => void;
};

function NavLink({
    href,
    icon,
    label,
    active,
    collapsed,
    onNavigate,
}: {
    href: string;
    icon: ReactNode;
    label: string;
    active: boolean;
    collapsed: boolean;
    onNavigate?: () => void;
}) {
    return (
        <Link
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={collapsed ? label : undefined}
            className={cn(
                "relative flex h-10 items-center gap-3 rounded-ctl px-3 text-sm font-medium transition-colors",
                active ? "bg-accent-soft text-accent" : "text-ink-soft hover:bg-surface-muted hover:text-ink",
                collapsed && "justify-center px-0",
            )}
        >
            {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-accent" aria-hidden="true" />}
            {icon}
            <span className={cn("truncate", collapsed && "sr-only")}>{label}</span>
        </Link>
    );
}

function SidebarContent({
    recent,
    collapsed,
    onToggleCollapse,
    onNewProject,
    onImport,
    onNavigate,
}: Omit<SidebarProps, "mobileOpen" | "onCloseMobile"> & { onNavigate?: () => void }) {
    const pathname = usePathname();

    return (
        <div className="flex h-full flex-col">
            <div className={cn("flex h-16 items-center gap-2 px-4", collapsed && "justify-center px-2")}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ctl bg-accent text-white shadow-sm">
                    <PenLine className="h-5 w-5" aria-hidden="true" />
                </div>
                {!collapsed && <span className="flex-1 text-base font-semibold tracking-tight text-ink">CanvasMind</span>}
                {!collapsed && (
                    <button
                        type="button"
                        onClick={onToggleCollapse}
                        aria-label="Collapse sidebar"
                        className="hidden h-8 w-8 items-center justify-center rounded-ctl text-ink-faint transition hover:bg-surface-muted hover:text-ink lg:inline-flex"
                    >
                        <ChevronLeft className="h-4 w-4" />
                    </button>
                )}
            </div>

            {collapsed && (
                <button
                    type="button"
                    onClick={onToggleCollapse}
                    aria-label="Expand sidebar"
                    className="mx-auto mb-2 hidden h-8 w-8 items-center justify-center rounded-ctl text-ink-faint transition hover:bg-surface-muted hover:text-ink lg:inline-flex"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            )}

            <div className={cn("space-y-2 px-3", collapsed && "px-2")}>
                <button
                    type="button"
                    onClick={() => {
                        onNavigate?.();
                        onNewProject();
                    }}
                    title={collapsed ? "New project" : undefined}
                    className={cn(
                        "flex h-10 w-full items-center justify-center gap-2 rounded-ctl bg-accent text-sm font-medium text-white shadow-sm transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 focus-visible:ring-offset-2 active:scale-[0.98]",
                    )}
                >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span className={cn(collapsed && "sr-only")}>New project</span>
                </button>
            </div>

            <nav aria-label="Primary" className={cn("mt-4 space-y-1 px-3", collapsed && "px-2")}>
                <NavLink
                    href="/"
                    icon={<Home className="h-4 w-4 shrink-0" aria-hidden="true" />}
                    label="Home"
                    active={pathname === "/"}
                    collapsed={collapsed}
                    onNavigate={onNavigate}
                />
                <button
                    type="button"
                    onClick={() => {
                        onNavigate?.();
                        onImport();
                    }}
                    title={collapsed ? "Import notes" : undefined}
                    className={cn(
                        "flex h-10 w-full items-center gap-3 rounded-ctl px-3 text-sm font-medium text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink",
                        collapsed && "justify-center px-0",
                    )}
                >
                    <Upload className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className={cn(collapsed && "sr-only")}>Import notes</span>
                </button>
            </nav>

            <div className={cn("mt-6 min-h-0 flex-1 overflow-y-auto px-3", collapsed && "px-2")}>
                {!collapsed && (
                    <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-ink-faint">Recent projects</p>
                )}
                <nav aria-label="Recent projects" className="space-y-1">
                    {recent.length === 0 && !collapsed && <p className="px-3 text-sm text-ink-faint">No projects yet.</p>}
                    {recent.map((project) => (
                        <NavLink
                            key={project.id}
                            href={`/projects/${project.id}`}
                            icon={<FolderOpen className="h-4 w-4 shrink-0" aria-hidden="true" />}
                            label={project.name}
                            active={pathname === `/projects/${project.id}`}
                            collapsed={collapsed}
                            onNavigate={onNavigate}
                        />
                    ))}
                </nav>
            </div>

            <div className={cn("border-t border-line p-3", collapsed && "px-2")}>
                <div className={cn("flex items-center gap-3 rounded-ctl px-2 py-1.5", collapsed && "justify-center px-0")}>
                    <div
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent"
                        aria-hidden="true"
                    >
                        S
                    </div>
                    {!collapsed && (
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-ink">Student</p>
                            <p className="truncate text-xs text-ink-faint">{MOCK_MODE ? "Mock data mode" : "Connected to API"}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export function Sidebar(props: SidebarProps) {
    const { mobileOpen, onCloseMobile, ...content } = props;

    useEffect(() => {
        if (!mobileOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onCloseMobile();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [mobileOpen, onCloseMobile]);

    return (
        <>
            <aside
                className={cn(
                    "sticky top-0 hidden h-dvh shrink-0 border-r border-line bg-surface transition-[width] duration-200 lg:block",
                    content.collapsed ? "w-[72px]" : "w-64",
                )}
            >
                <SidebarContent {...content} />
            </aside>

            {mobileOpen && (
                <div className="fixed inset-0 z-40 lg:hidden">
                    <div className="anim-fade absolute inset-0 bg-ink/30" onClick={onCloseMobile} aria-hidden="true" />
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="Navigation"
                        className="anim-slide-in absolute inset-y-0 left-0 w-72 max-w-[85vw] bg-surface shadow-pop"
                    >
                        <button
                            type="button"
                            onClick={onCloseMobile}
                            aria-label="Close navigation"
                            className="absolute right-3 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-ctl text-ink-faint hover:bg-surface-muted"
                        >
                            <X className="h-4 w-4" />
                        </button>
                        <SidebarContent {...content} collapsed={false} onNavigate={onCloseMobile} />
                    </div>
                </div>
            )}
        </>
    );
}
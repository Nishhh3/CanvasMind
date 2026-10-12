"use client";

import { Menu as MenuIcon, Plus, RefreshCw, Search } from "lucide-react";
import { MOCK_MODE } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/Button";

type TopbarProps = {
    title: string;
    search: string;
    onSearchChange: (value: string) => void;
    onNewProject: () => void;
    onOpenMenu: () => void;
    onRefresh: () => void;
    refreshing: boolean;
};

export function Topbar({ title, search, onSearchChange, onNewProject, onOpenMenu, onRefresh, refreshing }: TopbarProps) {
    return (
        <header className="sticky top-0 z-20 flex min-h-16 flex-wrap items-center gap-2 border-b border-line bg-app/85 px-3 py-2 backdrop-blur-md sm:h-16 sm:flex-nowrap sm:gap-3 sm:px-6 sm:py-0">
            <Button variant="ghost" size="icon" onClick={onOpenMenu} aria-label="Open navigation" className="lg:hidden">
                <MenuIcon className="h-5 w-5" />
            </Button>

            <h1 className="hidden shrink-0 text-base font-semibold text-ink sm:block">{title}</h1>

            <div className="relative order-last min-w-0 basis-full sm:order-none sm:ml-4 sm:flex-1 sm:basis-auto sm:max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" aria-hidden="true" />
                <input
                    type="search"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Search projects"
                    aria-label="Search projects"
                    className="h-10 w-full rounded-ctl border border-line bg-surface pl-9 pr-3 text-sm text-ink shadow-sm outline-none transition placeholder:text-ink-faint focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
                {MOCK_MODE && (
                    <span className="hidden rounded-full bg-warn-soft px-2.5 py-1 text-xs font-medium text-warn md:inline">
                        Mock data
                    </span>
                )}
                <ThemeToggle />
                <Button variant="ghost" size="icon" onClick={onRefresh} aria-label="Refresh projects" disabled={refreshing}>
                    <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                </Button>
                <Button variant="primary" onClick={onNewProject}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">New project</span>
                    <span className="sr-only sm:hidden">New project</span>
                </Button>
            </div>
        </header>
    );
}
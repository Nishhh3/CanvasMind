"use client";

import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MenuItem = {
    label: string;
    icon?: ReactNode;
    onSelect: () => void;
    danger?: boolean;
    disabled?: boolean;
};

type MenuProps = {
    items: MenuItem[];
    label: string;
    align?: "left" | "right";
    trigger?: ReactNode;
    className?: string;
};

export function Menu({ items, label, align = "right", trigger, className }: MenuProps) {
    const [open, setOpen] = useState(false);
    const rootRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onPointer = (e: PointerEvent) => {
            if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("pointerdown", onPointer);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onPointer);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <div ref={rootRef} className={cn("relative", className)}>
            <button
                type="button"
                aria-label={label}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen((o) => !o)}
                className="inline-flex h-8 min-w-8 items-center justify-center rounded-ctl px-1 text-ink-soft transition hover:bg-surface-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/30"
            >
                {trigger ?? <MoreHorizontal className="h-4 w-4" />}
            </button>
            {open && (
                <div
                    role="menu"
                    className={cn(
                        "anim-pop absolute z-30 mt-1 min-w-44 rounded-ctl border border-line bg-surface p-1 shadow-pop",
                        align === "right" ? "right-0" : "left-0",
                    )}
                >
                    {items.map((item) => (
                        <button
                            key={item.label}
                            type="button"
                            role="menuitem"
                            disabled={item.disabled}
                            onClick={() => {
                                setOpen(false);
                                item.onSelect();
                            }}
                            className={cn(
                                "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors focus-visible:bg-accent-soft focus-visible:outline-none disabled:opacity-50",
                                item.danger ? "text-danger hover:bg-danger-soft" : "text-ink hover:bg-surface-muted",
                            )}
                        >
                            {item.icon}
                            {item.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
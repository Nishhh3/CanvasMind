"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ModalProps = {
    open: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    size?: "sm" | "md" | "lg" | "xl";
    children: ReactNode;
};

const widths = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg", xl: "max-w-3xl" };

const FOCUSABLE = 'a[href],button:not([disabled]),textarea,input,select,[tabindex]:not([tabindex="-1"])';

export function Modal({ open, onClose, title, description, size = "md", children }: ModalProps) {
    const titleId = useId();
    const dialogRef = useRef<HTMLDivElement>(null);
    const onCloseRef = useRef(onClose);

    useEffect(() => {
        onCloseRef.current = onClose;
    });

    useEffect(() => {
        if (!open) return;
        const previous = document.activeElement as HTMLElement | null;
        const root = dialogRef.current;
        const focusables = () => Array.from(root?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []);
        const first = root?.querySelector<HTMLElement>("[data-autofocus]") ?? focusables()[0] ?? root;
        first?.focus();

        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.stopPropagation();
                onCloseRef.current();
                return;
            }
            if (e.key === "Tab") {
                const items = focusables();
                if (items.length === 0) return;
                const firstEl = items[0];
                const lastEl = items[items.length - 1];
                if (e.shiftKey && document.activeElement === firstEl) {
                    e.preventDefault();
                    lastEl.focus();
                } else if (!e.shiftKey && document.activeElement === lastEl) {
                    e.preventDefault();
                    firstEl.focus();
                }
            }
        };
        document.addEventListener("keydown", onKey);
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = previousOverflow;
            previous?.focus?.();
        };
    }, [open]);

    if (!open) return null;

    return (
        <div
            className="anim-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 p-4 backdrop-blur-[2px]"
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <div
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
                tabIndex={-1}
                className={cn(
                    "anim-pop max-h-[90dvh] w-full overflow-y-auto rounded-card border border-line bg-surface p-6 shadow-pop outline-none",
                    widths[size],
                )}
            >
                <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="min-w-0">
                        <h2 id={titleId} className="text-lg font-semibold text-ink">
                            {title}
                        </h2>
                        {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close dialog"
                        className="-mr-2 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-ctl text-ink-faint transition hover:bg-surface-muted hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/30"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                {children}
            </div>
        </div>
    );
}
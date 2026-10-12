"use client";

import { AlertCircle, Check, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToastStore, type ToastKind } from "@/store/toast";

const styles: Record<ToastKind, string> = {
    success: "border-success/30 bg-success-soft text-success",
    error: "border-danger/30 bg-danger-soft text-danger",
    info: "border-line bg-surface text-ink",
};

const icons = {
    success: Check,
    error: AlertCircle,
    info: Info,
};

export function Toaster() {
    const toasts = useToastStore((s) => s.toasts);
    const dismiss = useToastStore((s) => s.dismiss);

    return (
        <div
            className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4"
            role="status"
            aria-live="polite"
        >
            {toasts.map((t) => {
                const Icon = icons[t.kind];
                return (
                    <div
                        key={t.id}
                        className={cn(
                            "anim-pop pointer-events-auto flex max-w-md items-start gap-3 rounded-ctl border px-4 py-3 text-sm shadow-pop",
                            styles[t.kind],
                        )}
                    >
                        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <p className="min-w-0 flex-1 text-ink">{t.message}</p>
                        <button
                            type="button"
                            onClick={() => dismiss(t.id)}
                            aria-label="Dismiss notification"
                            className="text-ink-faint transition hover:text-ink"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
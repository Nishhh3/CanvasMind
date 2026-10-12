import { create } from "zustand";

export type ToastKind = "success" | "error" | "info";
export type ToastItem = { id: number; kind: ToastKind; message: string };

type ToastState = {
    toasts: ToastItem[];
    push: (kind: ToastKind, message: string, ttl?: number) => void;
    dismiss: (id: number) => void;
};

let counter = 0;

export const useToastStore = create<ToastState>((set, get) => ({
    toasts: [],
    push: (kind, message, ttl = 4000) => {
        const id = ++counter;
        set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
        if (typeof window !== "undefined") {
            window.setTimeout(() => get().dismiss(id), ttl);
        }
    },
    dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const toast = {
    success: (message: string) => useToastStore.getState().push("success", message),
    error: (message: string) => useToastStore.getState().push("error", message, 7000),
    info: (message: string) => useToastStore.getState().push("info", message),
};
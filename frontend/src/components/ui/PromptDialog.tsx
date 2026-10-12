"use client";

import { useState, type FormEvent } from "react";
import { errorMessage } from "@/lib/utils";
import { Button } from "./Button";
import { Modal } from "./Modal";

type PromptDialogProps = {
    open: boolean;
    title: string;
    label: string;
    initialValue?: string;
    confirmLabel?: string;
    placeholder?: string;
    onSubmit: (value: string) => void | Promise<void>;
    onClose: () => void;
};

export function PromptDialog({ open, onClose, title, ...form }: PromptDialogProps) {
    return (
        <Modal open={open} onClose={onClose} title={title} size="sm">
            <PromptForm {...form} onClose={onClose} />
        </Modal>
    );
}

function PromptForm({
    label,
    initialValue = "",
    confirmLabel = "Save",
    placeholder,
    onSubmit,
    onClose,
}: Omit<PromptDialogProps, "open" | "title">) {
    const [value, setValue] = useState(initialValue);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        const trimmed = value.trim();
        if (!trimmed || busy) return;
        setBusy(true);
        setError(null);
        try {
            await onSubmit(trimmed);
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm font-medium text-ink">
                {label}
                <input
                    data-autofocus
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onFocus={(e) => e.currentTarget.select()}
                    placeholder={placeholder}
                    maxLength={120}
                    className="mt-1.5 h-10 w-full rounded-ctl border border-line bg-surface px-3 text-sm font-normal text-ink outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
            </label>
            {error && (
                <p role="alert" className="rounded-ctl bg-danger-soft px-3 py-2 text-sm text-danger">
                    {error}
                </p>
            )}
            <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onClose} disabled={busy}>
                    Cancel
                </Button>
                <Button type="submit" variant="primary" loading={busy} disabled={!value.trim()}>
                    {confirmLabel}
                </Button>
            </div>
        </form>
    );
}
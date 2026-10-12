"use client";

import { useState } from "react";
import { errorMessage } from "@/lib/utils";
import { Button } from "./Button";
import { Modal } from "./Modal";

type ConfirmDialogProps = {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    danger?: boolean;
    onConfirm: () => void | Promise<void>;
    onClose: () => void;
};

export function ConfirmDialog({ open, onClose, title, ...body }: ConfirmDialogProps) {
    return (
        <Modal open={open} onClose={onClose} title={title} size="sm">
            <ConfirmBody {...body} onClose={onClose} />
        </Modal>
    );
}

function ConfirmBody({
    message,
    confirmLabel = "Confirm",
    danger = false,
    onConfirm,
    onClose,
}: Omit<ConfirmDialogProps, "open" | "title">) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleConfirm() {
        setBusy(true);
        setError(null);
        try {
            await onConfirm();
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="space-y-4">
            <p className="text-sm text-ink-soft">{message}</p>
            {error && (
                <p role="alert" className="rounded-ctl bg-danger-soft px-3 py-2 text-sm text-danger">
                    {error}
                </p>
            )}
            <div className="flex justify-end gap-2">
                <Button data-autofocus variant="ghost" onClick={onClose} disabled={busy}>
                    Cancel
                </Button>
                <Button variant={danger ? "danger" : "primary"} onClick={handleConfirm} loading={busy}>
                    {confirmLabel}
                </Button>
            </div>
        </div>
    );
}
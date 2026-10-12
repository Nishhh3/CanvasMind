"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { Modal } from "@/components/ui/Modal";
import { errorMessage } from "@/lib/utils";
import { useEditorStore } from "@/store/editor";
import { toast } from "@/store/toast";

type ImportDialogProps = { open: boolean; onClose: () => void };

export function ImportDialog({ open, onClose }: ImportDialogProps) {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Import notes"
            description="Imported files become new pages at the end of this project."
            size="lg"
        >
            <ImportForm onClose={onClose} />
        </Modal>
    );
}

function ImportForm({ onClose }: { onClose: () => void }) {
    const importFiles = useEditorStore((s) => s.importFiles);
    const [files, setFiles] = useState<File[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (files.length === 0 || busy) return;
        setBusy(true);
        setError(null);
        try {
            const count = await importFiles(files);
            if (count === 0) {
                toast.info("The server accepted the files but returned no pages.");
            } else {
                toast.success(`Imported ${count} page${count === 1 ? "" : "s"}.`);
            }
            onClose();
        } catch (err) {
            setError(errorMessage(err, "Import failed."));
        } finally {
            setBusy(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <FileDropzone files={files} onFilesChange={setFiles} disabled={busy} />
            {error && (
                <p role="alert" className="rounded-ctl bg-danger-soft px-3 py-2 text-sm text-danger">
                    {error}
                </p>
            )}
            <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onClose} disabled={busy}>
                    Cancel
                </Button>
                <Button type="submit" variant="primary" loading={busy} disabled={files.length === 0}>
                    {busy ? "Importing…" : `Import ${files.length > 0 ? files.length : ""} file${files.length === 1 ? "" : "s"}`}
                </Button>
            </div>
        </form>
    );
}
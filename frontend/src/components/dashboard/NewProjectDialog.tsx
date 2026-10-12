"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { FileDropzone } from "@/components/ui/FileDropzone";
import { Modal } from "@/components/ui/Modal";
import { cn, errorMessage, stripExtension } from "@/lib/utils";

type NewProjectDialogProps = {
    open: boolean;
    initialMode: "blank" | "import";
    onClose: () => void;
    onCreate: (name: string, files: File[]) => Promise<void>;
};

export function NewProjectDialog({ open, initialMode, onClose, onCreate }: NewProjectDialogProps) {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Create a project"
            description="A project holds your canvas pages and AI study tools."
            size="lg"
        >
            <NewProjectForm initialImport={initialMode === "import"} onCreate={onCreate} onClose={onClose} />
        </Modal>
    );
}

function NewProjectForm({
    initialImport,
    onCreate,
    onClose,
}: {
    initialImport: boolean;
    onCreate: NewProjectDialogProps["onCreate"];
    onClose: () => void;
}) {
    const [name, setName] = useState("");
    const [withImport, setWithImport] = useState(initialImport);
    const [files, setFiles] = useState<File[]>([]);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const importing = withImport && files.length > 0;
    const effectiveName = name.trim() || (importing ? stripExtension(files[0].name) : "");

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!effectiveName || busy) return;
        setBusy(true);
        setError(null);
        try {
            await onCreate(effectiveName, withImport ? files : []);
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex w-full rounded-ctl border border-line bg-surface-muted p-1 sm:inline-flex sm:w-auto" role="group" aria-label="Start from">
                {[
                    { label: "Blank canvas", value: false },
                    { label: "Import notes", value: true },
                ].map((option) => (
                    <button
                        key={option.label}
                        type="button"
                        aria-pressed={withImport === option.value}
                        disabled={busy}
                        onClick={() => setWithImport(option.value)}
                        className={cn(
                            "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30 sm:flex-none",
                            withImport === option.value ? "bg-surface text-accent shadow-sm" : "text-ink-soft hover:text-ink",
                        )}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            <label className="block text-sm font-medium text-ink">
                Project name
                <input
                    data-autofocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={120}
                    placeholder={importing ? stripExtension(files[0].name) : "For example: Data Structures"}
                    className="mt-1.5 h-11 w-full rounded-ctl border border-line bg-surface px-3 text-sm font-normal text-ink shadow-sm outline-none transition placeholder:text-ink-faint focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
            </label>

            {withImport && <FileDropzone files={files} onFilesChange={setFiles} disabled={busy} />}

            {error && (
                <p role="alert" className="rounded-ctl bg-danger-soft px-3 py-2 text-sm text-danger">
                    {error}
                </p>
            )}

            <div className="flex justify-end gap-2 pt-1">
                <Button variant="ghost" onClick={onClose} disabled={busy}>
                    Cancel
                </Button>
                <Button type="submit" variant="primary" loading={busy} disabled={!effectiveName}>
                    {importing ? "Create and import" : "Create project"}
                </Button>
            </div>
        </form>
    );
}
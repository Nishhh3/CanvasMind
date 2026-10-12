"use client";

import { FileText, Upload, X } from "lucide-react";
import { useCallback, useState } from "react";
import { useDropzone, type Accept, type FileRejection } from "react-dropzone";
import { cn, formatBytes } from "@/lib/utils";

export const IMPORT_ACCEPT: Accept = {
    "application/pdf": [".pdf"],
    "application/vnd.ms-powerpoint": [".ppt"],
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": [".pptx"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/webp": [".webp"],
};

type FileDropzoneProps = {
    files: File[];
    onFilesChange: (files: File[]) => void;
    disabled?: boolean;
};

const keyOf = (f: File) => `${f.name}:${f.size}:${f.lastModified}`;

export function FileDropzone({ files, onFilesChange, disabled }: FileDropzoneProps) {
    const [rejectedMessage, setRejectedMessage] = useState<string | null>(null);

    const onDrop = useCallback(
        (accepted: File[]) => {
            setRejectedMessage(null);
            const known = new Set(files.map(keyOf));
            const fresh = accepted.filter((f) => !known.has(keyOf(f)));
            if (fresh.length > 0) onFilesChange([...files, ...fresh]);
        },
        [files, onFilesChange],
    );

    const onDropRejected = useCallback((rejections: FileRejection[]) => {
        setRejectedMessage(
            `${rejections.length} file${rejections.length === 1 ? "" : "s"} skipped. Supported: PDF, PPT, PPTX, DOCX, PNG, JPG, WEBP.`,
        );
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        accept: IMPORT_ACCEPT,
        onDrop,
        onDropRejected,
        disabled,
        multiple: true,
    });

    return (
        <div className="space-y-3">
            <div
                {...getRootProps()}
                className={cn(
                    "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-2 border-dashed px-4 py-8 text-center transition-colors",
                    isDragActive ? "border-accent bg-accent-soft" : "border-line-strong bg-surface-muted/50 hover:border-accent/60 hover:bg-accent-soft/60",
                    disabled && "pointer-events-none opacity-60",
                )}
            >
                <input {...getInputProps()} aria-label="Choose files to import" />
                <Upload className="h-5 w-5 text-accent" aria-hidden="true" />
                <p className="text-sm font-medium text-ink">
                    {isDragActive ? "Drop files here" : "Drag files here, or click to browse"}
                </p>
                <p className="text-xs text-ink-faint">PDF, PPT, PPTX, DOCX or images. You can add several files.</p>
            </div>

            {rejectedMessage && (
                <p role="alert" className="rounded-ctl bg-warn-soft px-3 py-2 text-xs text-warn">
                    {rejectedMessage}
                </p>
            )}

            {files.length > 0 && (
                <ul className="max-h-40 space-y-1.5 overflow-y-auto">
                    {files.map((file) => (
                        <li
                            key={keyOf(file)}
                            className="flex items-center gap-3 rounded-ctl border border-line bg-surface px-3 py-2 text-sm"
                        >
                            <FileText className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate text-ink">{file.name}</span>
                            <span className="shrink-0 text-xs text-ink-faint">{formatBytes(file.size)}</span>
                            <button
                                type="button"
                                disabled={disabled}
                                onClick={() => onFilesChange(files.filter((f) => keyOf(f) !== keyOf(file)))}
                                aria-label={`Remove ${file.name}`}
                                className="text-ink-faint transition hover:text-danger disabled:opacity-50"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
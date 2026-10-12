export function cn(...parts: Array<string | false | null | undefined>): string {
    return parts.filter(Boolean).join(" ");
}

export function uid(prefix = "id"): string {
    const random =
        typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    return `${prefix}_${random}`;
}

export function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

export function errorMessage(error: unknown, fallback = "Something went wrong."): string {
    if (error instanceof Error && error.message) return error.message;
    if (typeof error === "string" && error) return error;
    return fallback;
}

/** Backend timestamps may be naive UTC (no zone suffix). Treat those as UTC. */
export function parseApiDate(iso: string): Date {
    const hasZone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(iso);
    return new Date(hasZone ? iso : `${iso}Z`);
}

export function formatRelative(iso: string): string {
    const date = parseApiDate(iso);
    const seconds = Math.round((Date.now() - date.getTime()) / 1000);
    if (Number.isNaN(seconds)) return "unknown";
    if (seconds < 45) return "just now";
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} h ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days} d ago`;
    return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function stripExtension(filename: string): string {
    return filename.replace(/\.[^.]+$/, "");
}
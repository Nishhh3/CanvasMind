"use client";
import type { ScopeKind } from "@/types/ai";

export default function ScopeToggle({
  value, onChange,
}: { value: ScopeKind; onChange: (v: ScopeKind) => void }) {
  const opts: { v: ScopeKind; label: string }[] = [
    { v: "page", label: "This page" },
    { v: "project", label: "Whole project" },
  ];
  return (
    <div className="inline-flex w-full rounded-md border border-line p-0.5" role="group" aria-label="AI scope">
      {opts.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          className={`flex-1 rounded px-3 py-1 text-sm transition-colors ${
            value === o.v ? "bg-accent text-white shadow-sm" : "text-ink-soft hover:bg-surface-muted"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

"use client";
import ReactMarkdown from "react-markdown";

export default function MarkdownView({ children }: { children: string }) {
  return (
    <div className="text-sm leading-relaxed text-neutral-800 [&>*+*]:mt-3">
      <ReactMarkdown
        components={{
          h1: (p) => <h1 className="text-lg font-semibold mt-4" {...p} />,
          h2: (p) => <h2 className="text-base font-semibold mt-4" {...p} />,
          h3: (p) => <h3 className="text-sm font-semibold mt-3" {...p} />,
          ul: (p) => <ul className="list-disc pl-5 space-y-1" {...p} />,
          ol: (p) => <ol className="list-decimal pl-5 space-y-1" {...p} />,
          a: (p) => <a className="text-blue-600 underline" target="_blank" rel="noreferrer" {...p} />,
          code: (p) => <code className="rounded bg-neutral-100 px-1 py-0.5 text-[0.85em]" {...p} />,
          pre: (p) => <pre className="overflow-x-auto rounded bg-neutral-100 p-3 text-xs" {...p} />,
          blockquote: (p) => <blockquote className="border-l-2 border-neutral-300 pl-3 text-neutral-600" {...p} />,
          table: (p) => <div className="overflow-x-auto"><table className="text-xs border-collapse" {...p} /></div>,
          th: (p) => <th className="border border-neutral-300 bg-neutral-50 px-2 py-1 text-left" {...p} />,
          td: (p) => <td className="border border-neutral-300 px-2 py-1" {...p} />,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

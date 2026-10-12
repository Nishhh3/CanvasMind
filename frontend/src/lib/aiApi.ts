// AI endpoints. If your lib/api.ts already has a shared fetch helper, you can
// move these functions there and delete this file.
import type {
  ChatMessage, Difficulty, Flashcard, GradeResponse, QType, QuizResponse,
  RecommendResponse, RefineMode, ScopeKind, Selection, Source,
} from "@/types/ai";

import { API_URL } from "@/lib/api";

export type AIScope = {
  projectId: number;
  scope: ScopeKind;
  pageId?: number;
  selection?: Selection;
};

// The editor registers a hook here so unsaved edits are flushed to the backend
// before every AI call (the AI reads the saved page transcript).
let beforeRequest: (() => Promise<unknown>) | null = null;
export function setAIBeforeRequest(fn: (() => Promise<unknown>) | null) {
  beforeRequest = fn;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  if (beforeRequest) {
    try { await beforeRequest(); } catch { /* saving errors are shown by the editor */ }
  }
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.detail) msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {}
    throw new Error(msg);
  }
  return res.json();
}

const base = (s: AIScope) => ({
  project_id: s.projectId,
  scope: s.scope,
  ...(s.scope === "page" && s.pageId != null ? { page_id: s.pageId } : {}),
  ...(s.selection && (s.selection.text || s.selection.image) ? { selection: s.selection } : {}),
});

export const aiApi = {
  ask: (s: AIScope, question: string, history: ChatMessage[]) =>
    post<{ answer: string; grounded: boolean; sources: Source[] }>("/api/ai/ask", {
      ...base(s), question, history,
    }),
  summary: (s: AIScope) => post<{ summary: string }>("/api/ai/summary", base(s)),
  explain: (s: AIScope, concept: string) =>
    post<{ explanation: string; grounded: boolean; sources: Source[] }>("/api/ai/explain", {
      ...base(s), concept,
    }),
  quiz: (s: AIScope, p: { types: QType[]; count: number; difficulty: Difficulty }) =>
    post<QuizResponse>("/api/ai/quiz", { ...base(s), ...p }),
  gradeQuiz: (quiz_id: number | string, answers: { question_id: string; response: string }[]) =>
    post<GradeResponse>("/api/ai/quiz/grade", { quiz_id, answers }),
  flashcards: (s: AIScope, count: number) =>
    post<{ cards: Flashcard[] }>("/api/ai/flashcards", { ...base(s), count }),
  revisionSheet: (s: AIScope) => post<{ sheet: string }>("/api/ai/revision-sheet", base(s)),
  refine: (s: AIScope, mode: RefineMode, text?: string) =>
    post<{ original: string; suggestion: string }>("/api/ai/refine", {
      ...base(s), mode, ...(text ? { text } : {}),
    }),
  recommendations: (s: AIScope) =>
    post<RecommendResponse>("/api/ai/recommendations", base(s)),
};

// Download the project (or a single page) as a PDF.
export async function exportPdf(projectId: number, name = "notes", pageId?: number) {
  // Flush unsaved edits first so the PDF matches what's on screen.
  if (beforeRequest) {
    try { await beforeRequest(); } catch { /* saving errors are shown by the editor */ }
  }
  const qs = pageId != null ? `?page_id=${pageId}` : "";
  const res = await fetch(`${API_URL}/api/projects/${projectId}/export/pdf${qs}`);
  if (!res.ok) {
    let msg = `Export failed (${res.status})`;
    try {
      const j = await res.json();
      if (j?.detail) msg = typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail);
    } catch {}
    throw new Error(msg);
  }
  const url = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name.replace(/[^\w\-]+/g, "_") || "notes"}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
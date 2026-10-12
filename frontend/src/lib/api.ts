import type { ApiClient } from "@/types/api";
import { ApiError } from "./api-error";
import { mockApi } from "./mock-db";

export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
/** Mock mode is explicit. It is never used as a silent fallback when the server fails. */
export const MOCK_MODE = process.env.NEXT_PUBLIC_USE_MOCKS === "true";

async function parseError(res: Response): Promise<ApiError> {
  let detail = `Request failed (${res.status})`;
  try {
    const body: unknown = await res.json();
    if (body && typeof body === "object" && "detail" in body) {
      const d = (body as { detail: unknown }).detail;
      if (typeof d === "string") {
        detail = d;
      } else if (Array.isArray(d)) {
        detail = d
          .map((item) =>
            item && typeof item === "object" && "msg" in item
              ? String((item as { msg: unknown }).msg)
              : JSON.stringify(item),
          )
          .join("; ");
      } else {
        detail = JSON.stringify(d);
      }
    }
  } catch {
    // Non-JSON error body: keep the generic message.
  }
  return new ApiError(detail, res.status);
}

type RequestOptions = Omit<RequestInit, "body"> & { json?: unknown; body?: BodyInit | null };

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { json, headers, body, ...rest } = options;
  const finalHeaders = new Headers(headers);
  let finalBody: BodyInit | null | undefined = body;
  if (json !== undefined) {
    finalHeaders.set("Content-Type", "application/json");
    finalBody = JSON.stringify(json);
  }
  // For FormData we must NOT set Content-Type; the browser adds the multipart boundary.

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...rest, headers: finalHeaders, body: finalBody });
  } catch {
    throw new ApiError(`Cannot reach the server at ${API_URL}. Is the backend running?`, 0);
  }
  if (!res.ok) throw await parseError(res);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

const post = <T>(path: string, json: unknown) => request<T>(path, { method: "POST", json });

const live: ApiClient = {
  projects: {
    list: () => request("/api/projects"),
    create: (name) => post("/api/projects", { name }),
    get: (id) => request(`/api/projects/${id}`),
    rename: (id, name) => request(`/api/projects/${id}`, { method: "PATCH", json: { name } }),
    remove: (id) => request<void>(`/api/projects/${id}`, { method: "DELETE" }),
    importFiles: (id, files) => {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      return request(`/api/projects/${id}/import`, { method: "POST", body: form });
    },
  },
  pages: {
    create: (projectId, title) =>
      post(`/api/projects/${projectId}/pages`, title ? { title } : {}),
    get: (id) => request(`/api/pages/${id}`),
    save: (id, body) => request(`/api/pages/${id}`, { method: "PUT", json: body }),
    rename: (id, title) => request(`/api/pages/${id}`, { method: "PATCH", json: { title } }),
    remove: (id) => request<void>(`/api/pages/${id}`, { method: "DELETE" }),
    reorder: (projectId, pageIds) =>
      post(`/api/projects/${projectId}/pages/reorder`, { page_ids: pageIds }),
  },
  ai: {
    ask: (body) => post("/api/ai/ask", body),
    summary: (body) => post("/api/ai/summary", body),
    explain: (body) => post("/api/ai/explain", body),
    quiz: (body) => post("/api/ai/quiz", body),
    gradeQuiz: (body) => post("/api/ai/quiz/grade", body),
    flashcards: (body) => post("/api/ai/flashcards", body),
    revisionSheet: (body) => post("/api/ai/revision-sheet", body),
    refine: (body) => post("/api/ai/refine", body),
  },
};

/** The only networking entry point for UI code. */
export const api: ApiClient = MOCK_MODE ? mockApi : live;
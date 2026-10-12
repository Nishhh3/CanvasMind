// Mock backend used ONLY when NEXT_PUBLIC_USE_MOCKS=true.
// It mirrors the contract response shapes and stores data in localStorage.
import type {
    ApiClient,
    CanvasObject,
    Page,
    PageContent,
    PageSummary,
    Project,
    Question,
    QuestionType,
    RefineMode,
    Scope,
    Source,
} from "@/types/api";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "@/types/api";
import { ApiError } from "./api-error";
import { stripExtension, uid } from "./utils";

const STORAGE_KEY = "studycanvas.mock-db.v1";
const MOCK_TAG = "_Mock mode: generated locally from your text boxes, not by an AI model._";

type MockDb = {
    nextProjectId: number;
    nextPageId: number;
    projects: Project[];
    pages: Page[];
    quizzes: Record<string, Question[]>;
};

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
const nowIso = () => new Date().toISOString();
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function blankContent(background: string | null = null, objects: CanvasObject[] = []): PageContent {
    return { width: CANVAS_WIDTH, height: CANVAS_HEIGHT, background, objects };
}

function textObject(y: number, text: string, fontSize = 28): CanvasObject {
    return { id: uid("t"), type: "text", x: 60, y, text, fontSize, color: "#1e2335" };
}

function transcriptOf(content: PageContent): string {
    return content.objects
        .filter((o): o is Extract<CanvasObject, { type: "text" }> => o.type === "text")
        .map((o) => o.text)
        .join("\n")
        .trim();
}

function makePage(
    id: number,
    projectId: number,
    position: number,
    title: string,
    content: PageContent,
): Page {
    return {
        id,
        project_id: projectId,
        title,
        position,
        transcript_status: "ready",
        content,
        transcript: transcriptOf(content),
    };
}

function seed(): MockDb {
    const t = nowIso();
    const pages: Page[] = [
        makePage(
            1,
            1,
            0,
            "Introduction to ML",
            blankContent(null, [
                textObject(60, "Machine Learning Basics", 44),
                textObject(140, "Supervised learning uses labelled data to learn a mapping from inputs to outputs."),
                textObject(200, "Unsupervised learning finds structure in unlabelled data, for example clustering."),
            ]),
        ),
        makePage(
            2,
            1,
            1,
            "Overfitting",
            blankContent(null, [
                textObject(60, "Overfitting", 44),
                textObject(140, "A model overfits when it memorises training data and performs poorly on new data."),
                textObject(200, "Regularisation and cross-validation help reduce overfitting."),
            ]),
        ),
    ];
    return {
        nextProjectId: 2,
        nextPageId: 3,
        projects: [{ id: 1, name: "Machine Learning Basics", created_at: t, updated_at: t, page_count: 2 }],
        pages,
        quizzes: {},
    };
}

let cache: MockDb | null = null;

function persist(): void {
    if (typeof window === "undefined" || !cache) return;
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    } catch {
        // Quota exceeded (large images): keep the in-memory copy for this session.
    }
}

function db(): MockDb {
    if (cache) return cache;
    if (typeof window !== "undefined") {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (raw) {
                cache = JSON.parse(raw) as MockDb;
                return cache;
            }
        } catch {
            // Corrupted storage: fall through and reseed.
        }
    }
    cache = seed();
    persist();
    return cache;
}

function projectPages(d: MockDb, projectId: number): Page[] {
    return d.pages.filter((p) => p.project_id === projectId).sort((a, b) => a.position - b.position);
}

function withCount(d: MockDb, project: Project): Project {
    return { ...project, page_count: projectPages(d, project.id).length };
}

function toSummary(p: Page): PageSummary {
    return {
        id: p.id,
        project_id: p.project_id,
        title: p.title,
        position: p.position,
        transcript_status: p.transcript_status,
    };
}

function findProject(d: MockDb, id: number): Project {
    const project = d.projects.find((p) => p.id === id);
    if (!project) throw new ApiError("Project not found", 404);
    return project;
}

function findPage(d: MockDb, id: number): Page {
    const page = d.pages.find((p) => p.id === id);
    if (!page) throw new ApiError("Page not found", 404);
    return page;
}

function addPage(
    d: MockDb,
    projectId: number,
    title: string | undefined,
    content: PageContent = blankContent(),
): Page {
    const position = projectPages(d, projectId).length;
    const page = makePage(
        d.nextPageId++,
        projectId,
        position,
        title?.trim() || `Page ${position + 1}`,
        content,
    );
    d.pages.push(page);
    return page;
}

function readAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new ApiError(`Could not read ${file.name}`, 400));
        reader.readAsDataURL(file);
    });
}

// ---------- AI mock helpers ----------

function gatherText(d: MockDb, scope: Scope): { text: string; sources: Source[] } {
    if (scope.selection?.text?.trim()) {
        return { text: scope.selection.text.trim(), sources: [] };
    }
    const pages =
        scope.scope === "page" && scope.page_id !== undefined
            ? d.pages.filter((p) => p.id === scope.page_id)
            : projectPages(d, scope.project_id);
    const used = pages.filter((p) => p.transcript.trim());
    return {
        text: used.map((p) => p.transcript.trim()).join("\n"),
        sources: used.map((p) => ({ page_id: p.id, title: p.title })),
    };
}

const linesOf = (text: string): string[] =>
    text
        .split(/\n+/)
        .map((l) => l.trim())
        .filter(Boolean);

const normalise = (s: string): string => s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

function buildQuestion(type: QuestionType, line: string, index: number): Question {
    const base = { id: `q${index + 1}`, topic: "Notes", explanation: `From your notes: ${line}` };
    if (type === "mcq") {
        const options = [
            line,
            "None of these statements appear in your notes",
            "All of these statements are false",
            "The notes do not cover this topic",
        ];
        const shift = index % options.length;
        const rotated = [...options.slice(shift), ...options.slice(0, shift)];
        return { ...base, type, question: "Which statement matches your notes?", options: rotated, answer: line };
    }
    if (type === "tf") {
        return { ...base, type, question: `True or false: ${line}`, options: ["True", "False"], answer: "True" };
    }
    const words = line.split(/\s+/);
    const head = words.slice(0, 4).join(" ");
    const rest = words.slice(4).join(" ");
    return {
        ...base,
        type: "short",
        question: `Complete this note, which starts with: ${head}`,
        answer: rest || line,
    };
}

function refineText(original: string, mode: RefineMode): string {
    const lines = linesOf(original);
    const capital = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
    const period = (s: string) => (/[.!?]$/.test(s) ? s : `${s}.`);
    switch (mode) {
        case "simplify":
            return lines.map((l) => period(capital(l.split(/[,;]/)[0].trim()))).join("\n");
        case "grammar":
            return lines.map((l) => period(capital(l))).join("\n");
        case "structure":
            return lines.map((l) => `- ${period(capital(l))}`).join("\n");
        case "improve":
            return lines.map((l) => period(capital(l))).join("\n\n");
        case "exam_ready":
            return `Key points to remember:\n${lines.map((l) => `- ${period(capital(l))}`).join("\n")}`;
    }
}

export const mockApi: ApiClient = {
    projects: {
        async list() {
            await sleep(250);
            const d = db();
            return d.projects.map((p) => withCount(d, p));
        },
        async create(name) {
            await sleep(250);
            const d = db();
            const t = nowIso();
            const project: Project = {
                id: d.nextProjectId++,
                name: name.trim() || "Untitled project",
                created_at: t,
                updated_at: t,
                page_count: 0,
            };
            d.projects.push(project);
            const page = addPage(d, project.id, "Page 1");
            persist();
            return { ...withCount(d, project), pages: [toSummary(page)] };
        },
        async get(id) {
            await sleep(200);
            const d = db();
            const project = findProject(d, id);
            return { ...withCount(d, project), pages: projectPages(d, id).map(toSummary) };
        },
        async rename(id, name) {
            await sleep(150);
            const d = db();
            const project = findProject(d, id);
            project.name = name.trim() || project.name;
            project.updated_at = nowIso();
            persist();
            return withCount(d, project);
        },
        async remove(id) {
            await sleep(200);
            const d = db();
            findProject(d, id);
            d.projects = d.projects.filter((p) => p.id !== id);
            d.pages = d.pages.filter((p) => p.project_id !== id);
            persist();
        },
        async importFiles(id, files) {
            await sleep(700);
            const d = db();
            const project = findProject(d, id);
            const created: PageSummary[] = [];
            for (const file of files) {
                const title = stripExtension(file.name);
                if (file.type.startsWith("image/")) {
                    const dataUrl = await readAsDataUrl(file);
                    created.push(toSummary(addPage(d, id, title, blankContent(dataUrl))));
                } else {
                    const note = textObject(60, `Imported from ${file.name}\n(Mock mode: the file was not parsed.)`);
                    created.push(toSummary(addPage(d, id, title, blankContent(null, [note]))));
                }
            }
            project.updated_at = nowIso();
            persist();
            return { pages: created };
        },
    },

    pages: {
        async create(projectId, title) {
            await sleep(150);
            const d = db();
            const project = findProject(d, projectId);
            const page = addPage(d, projectId, title);
            project.updated_at = nowIso();
            persist();
            return toSummary(page);
        },
        async get(id) {
            await sleep(120);
            return clone(findPage(db(), id));
        },
        async save(id, body) {
            await sleep(250);
            const d = db();
            const page = findPage(d, id);
            // body.image (JPEG data URL) is intentionally not stored in mock mode.
            page.content = clone(body.content);
            page.transcript = transcriptOf(page.content);
            page.transcript_status = "ready";
            findProject(d, page.project_id).updated_at = nowIso();
            persist();
            return toSummary(page);
        },
        async rename(id, title) {
            await sleep(120);
            const d = db();
            const page = findPage(d, id);
            page.title = title.trim() || page.title;
            persist();
            return toSummary(page);
        },
        async remove(id) {
            await sleep(150);
            const d = db();
            const page = findPage(d, id);
            d.pages = d.pages.filter((p) => p.id !== id);
            projectPages(d, page.project_id).forEach((p, i) => {
                p.position = i;
            });
            findProject(d, page.project_id).updated_at = nowIso();
            persist();
        },
        async reorder(projectId, pageIds) {
            await sleep(150);
            const d = db();
            findProject(d, projectId);
            const existing = projectPages(d, projectId);
            const byId = new Map(existing.map((p) => [p.id, p]));
            const ordered: Page[] = [];
            for (const pid of pageIds) {
                const page = byId.get(pid);
                if (!page) throw new ApiError(`Page ${pid} does not belong to this project`, 400);
                ordered.push(page);
                byId.delete(pid);
            }
            ordered.push(...byId.values());
            ordered.forEach((p, i) => {
                p.position = i;
            });
            persist();
            return ordered.map(toSummary);
        },
    },

    ai: {
        async ask(req) {
            await sleep(700);
            const { text, sources } = gatherText(db(), req);
            const words = req.question.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
            const matches = linesOf(text).filter((l) => words.some((w) => l.toLowerCase().includes(w)));
            if (matches.length === 0) {
                return { answer: `I could not find that in your notes.\n\n${MOCK_TAG}`, grounded: false, sources: [] };
            }
            const list = matches.slice(0, 3).map((m) => `- ${m}`).join("\n");
            return { answer: `Based on your notes:\n\n${list}\n\n${MOCK_TAG}`, grounded: true, sources };
        },
        async summary(req) {
            await sleep(800);
            const { text } = gatherText(db(), req);
            const lines = linesOf(text).slice(0, 6);
            if (lines.length === 0) return { summary: `There is no text to summarise yet.\n\n${MOCK_TAG}` };
            return { summary: `## Summary\n\n${lines.map((l) => `- ${l}`).join("\n")}\n\n${MOCK_TAG}` };
        },
        async explain(req) {
            await sleep(700);
            const { text, sources } = gatherText(db(), req);
            const concept = req.concept.toLowerCase();
            const matches = linesOf(text).filter((l) => l.toLowerCase().includes(concept));
            if (matches.length === 0) {
                return { explanation: `Nothing about that concept was found in your notes.\n\n${MOCK_TAG}`, grounded: false, sources: [] };
            }
            return { explanation: `${matches.join("\n\n")}\n\n${MOCK_TAG}`, grounded: true, sources };
        },
        async quiz(req) {
            await sleep(900);
            const d = db();
            const { text } = gatherText(d, req);
            const lines = linesOf(text);
            const pool = lines.length ? lines : ["Add some text boxes to your pages to get questions from your own notes."];
            const types = req.types.length ? req.types : (["mcq"] as QuestionType[]);
            const count = Math.max(1, Math.min(req.count, 20));
            const questions: Question[] = [];
            for (let i = 0; i < count; i++) {
                questions.push(buildQuestion(types[i % types.length], pool[i % pool.length], i));
            }
            const quizId = uid("quiz");
            d.quizzes[quizId] = questions;
            persist();
            return { quiz_id: quizId, questions };
        },
        async gradeQuiz(req) {
            await sleep(500);
            const questions = db().quizzes[req.quiz_id];
            if (!questions) throw new ApiError("Quiz not found", 404);
            const results = questions.map((q) => {
                const response = req.answers.find((a) => a.question_id === q.id)?.response ?? "";
                let correct: boolean;
                if (q.type === "short") {
                    const expected = normalise(q.answer).split(" ").filter(Boolean);
                    const given = new Set(normalise(response).split(" "));
                    const hits = expected.filter((w) => given.has(w)).length;
                    correct = expected.length > 0 && hits / expected.length >= 0.5;
                } else {
                    correct = normalise(response) === normalise(q.answer);
                }
                return {
                    question_id: q.id,
                    correct,
                    feedback: correct ? "Correct." : `Expected: ${q.answer}. ${q.explanation}`,
                };
            });
            return { score: results.filter((r) => r.correct).length, total: questions.length, results };
        },
        async flashcards(req) {
            await sleep(800);
            const { text } = gatherText(db(), req);
            const lines = linesOf(text).slice(0, Math.max(1, req.count));
            return {
                cards: lines.map((line) => ({
                    front: `Explain: ${line.split(/\s+/).slice(0, 5).join(" ")}...`,
                    back: line,
                    topic: "Notes",
                })),
            };
        },
        async revisionSheet(req) {
            await sleep(900);
            const { text } = gatherText(db(), req);
            const lines = linesOf(text);
            if (lines.length === 0) return { sheet: `There is no text to build a revision sheet from yet.\n\n${MOCK_TAG}` };
            return {
                sheet: `# Revision sheet\n\n## Key points\n\n${lines.map((l) => `- ${l}`).join("\n")}\n\n${MOCK_TAG}`,
            };
        },
        async refine(req) {
            await sleep(800);
            const original = req.text?.trim() || gatherText(db(), req).text;
            if (!original) throw new ApiError("There is no text to refine yet. Add a text box or select one.", 400);
            return { original, suggestion: refineText(original, req.mode) };
        },
    },
};
// Shared API contract types. Source of truth: the AlgoArtisans team API contract.
// Do not change these shapes without notifying the backend owner.

export const CANVAS_WIDTH = 1200 as const;
export const CANVAS_HEIGHT = 800 as const;

export type StrokeTool = "pen" | "highlighter" | "eraser";

export type StrokeObject = {
    id: string;
    type: "stroke";
    tool: StrokeTool;
    color: string;
    size: number;
    points: [number, number][];
};

export type TextObject = {
    id: string;
    type: "text";
    x: number;
    y: number;
    text: string;
    fontSize: number;
    color: string;
};

export type CanvasObject = StrokeObject | TextObject;

export type PageContent = {
    width: 1200;
    height: 800;
    background: string | null;
    objects: CanvasObject[];
};

export type Project = {
    id: number;
    name: string;
    created_at: string;
    updated_at: string;
    page_count: number;
};

export type TranscriptStatus = "pending" | "ready" | "failed";

export type PageSummary = {
    id: number;
    project_id: number;
    title: string;
    position: number;
    transcript_status: TranscriptStatus;
};

export type Page = PageSummary & {
    content: PageContent;
    transcript: string;
};

export type ProjectDetail = Project & {
    pages: PageSummary[];
};

export type Scope = {
    project_id: number;
    scope: "page" | "project";
    page_id?: number;
    selection?: {
        text?: string;
        image?: string;
    };
};

export type QuestionType = "mcq" | "tf" | "short";
export type Difficulty = "easy" | "medium" | "hard";
export type RefineMode = "simplify" | "grammar" | "structure" | "improve" | "exam_ready";

export type Question = {
    id: string;
    type: QuestionType;
    question: string;
    options?: string[];
    answer: string;
    explanation: string;
    topic: string;
    source_page_id?: number;
};

export type Source = { page_id: number; title: string };
export type ChatMessage = { role: string; content: string };

export type SavePageRequest = { content: PageContent; image?: string };
export type ImportResponse = { pages: PageSummary[] };

export type AskRequest = Scope & { question: string; history?: ChatMessage[] };
export type AskResponse = { answer: string; grounded: boolean; sources: Source[] };

export type SummaryResponse = { summary: string };

export type ExplainRequest = Scope & { concept: string };
export type ExplainResponse = { explanation: string; grounded: boolean; sources: Source[] };

export type QuizRequest = Scope & {
    types: QuestionType[];
    count: number;
    difficulty: Difficulty;
};
export type QuizResponse = { quiz_id: string; questions: Question[] };

export type QuizGradeRequest = {
    quiz_id: string;
    answers: { question_id: string; response: string }[];
};
export type QuizResult = { question_id: string; correct: boolean; feedback: string };
export type QuizGradeResponse = { score: number; total: number; results: QuizResult[] };

export type Flashcard = { front: string; back: string; topic: string };
export type FlashcardsRequest = Scope & { count: number };
export type FlashcardsResponse = { cards: Flashcard[] };

export type RevisionSheetResponse = { sheet: string };

export type RefineRequest = Scope & { mode: RefineMode; text?: string };
export type RefineResponse = { original: string; suggestion: string };

export type ApiErrorBody = { detail: string };

/** Implemented twice: live HTTP (lib/api.ts) and mock mode (lib/mock-db.ts). */
export interface ApiClient {
    projects: {
        list(): Promise<Project[]>;
        create(name: string): Promise<ProjectDetail>;
        get(id: number): Promise<ProjectDetail>;
        rename(id: number, name: string): Promise<Project>;
        remove(id: number): Promise<void>;
        importFiles(id: number, files: File[]): Promise<ImportResponse>;
    };
    pages: {
        create(projectId: number, title?: string): Promise<PageSummary>;
        get(id: number): Promise<Page>;
        save(id: number, body: SavePageRequest): Promise<PageSummary>;
        rename(id: number, title: string): Promise<PageSummary>;
        remove(id: number): Promise<void>;
        reorder(projectId: number, pageIds: number[]): Promise<PageSummary[]>;
    };
    ai: {
        ask(body: AskRequest): Promise<AskResponse>;
        summary(body: Scope): Promise<SummaryResponse>;
        explain(body: ExplainRequest): Promise<ExplainResponse>;
        quiz(body: QuizRequest): Promise<QuizResponse>;
        gradeQuiz(body: QuizGradeRequest): Promise<QuizGradeResponse>;
        flashcards(body: FlashcardsRequest): Promise<FlashcardsResponse>;
        revisionSheet(body: Scope): Promise<RevisionSheetResponse>;
        refine(body: RefineRequest): Promise<RefineResponse>;
    };
}
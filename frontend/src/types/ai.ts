export type ScopeKind = "page" | "project";
export type Selection = { text?: string; image?: string };

export type Source = { page_id: number; title: string };
export type ChatMessage = { role: "user" | "assistant"; content: string };

export type QType = "mcq" | "tf" | "short";
export type Difficulty = "easy" | "medium" | "hard";

export type Question = {
  id: string;
  type: QType;
  question: string;
  options?: string[];
  answer: string;
  explanation: string;
  topic: string;
  source_page_id?: number;
};
export type QuizResponse = { quiz_id: number | string; questions: Question[] };
export type GradeResult = { question_id: string; correct: boolean; feedback: string };
export type GradeResponse = { score: number; total: number; results: GradeResult[] };

export type Flashcard = { front: string; back: string; topic: string };
export type RefineMode = "simplify" | "grammar" | "structure" | "improve" | "exam_ready";

export type RecommendResponse = {
  weak_topics: { topic: string; accuracy: number }[];
  recommended: string[];
};
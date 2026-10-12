"use client";
import { useState } from "react";
import { aiApi, type AIScope } from "@/lib/aiApi";
import type { Difficulty, GradeResponse, QType, QuizResponse } from "@/types/ai";
import MarkdownView from "./MarkdownView";
import { Btn, ErrorBox, Loading, errMsg } from "./shared";

const TYPE_LABELS: Record<QType, string> = { mcq: "Multiple choice", tf: "True / False", short: "Short answer" };

export default function QuizTab({ scope }: { scope: AIScope }) {
  const [types, setTypes] = useState<QType[]>(["mcq"]);
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [quiz, setQuiz] = useState<QuizResponse | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [grade, setGrade] = useState<GradeResponse | null>(null);
  const [busy, setBusy] = useState<"gen" | "grade" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleType = (t: QType) =>
    setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  async function generate() {
    setBusy("gen"); setError(null); setGrade(null); setAnswers({});
    try { setQuiz(await aiApi.quiz(scope, { types, count, difficulty })); }
    catch (e) { setError(errMsg(e)); }
    finally { setBusy(null); }
  }

  async function submit() {
    if (!quiz) return;
    setBusy("grade"); setError(null);
    try {
      const payload = quiz.questions.map((q) => ({ question_id: q.id, response: answers[q.id] ?? "" }));
      setGrade(await aiApi.gradeQuiz(quiz.quiz_id, payload));
    } catch (e) { setError(errMsg(e)); }
    finally { setBusy(null); }
  }

  const reset = () => { setQuiz(null); setGrade(null); setAnswers({}); setError(null); };

  // ---------- setup ----------
  if (!quiz) {
    return (
      <div className="space-y-4">
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-neutral-800">Question types</legend>
          <div className="flex flex-wrap gap-3">
            {(Object.keys(TYPE_LABELS) as QType[]).map((t) => (
              <label key={t} className="flex items-center gap-1.5 text-sm">
                <input type="checkbox" checked={types.includes(t)} onChange={() => toggleType(t)} />
                {TYPE_LABELS[t]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="flex gap-4">
          <label className="text-sm">
            Questions
            <input
              type="number" min={1} max={20} value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
              className="mt-1 block w-20 rounded-md border border-line bg-surface px-2 py-1 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <label className="text-sm">
            Difficulty
            <select
              value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}
              className="mt-1 block rounded-md border border-line bg-surface px-2 py-1 text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option>
            </select>
          </label>
        </div>
        <Btn onClick={generate} disabled={busy !== null || types.length === 0}>Start quiz</Btn>
        {busy === "gen" && <Loading label="Writing questions..." />}
        {error && <ErrorBox message={error} onRetry={generate} />}
      </div>
    );
  }

  // ---------- taking / results ----------
  const resultFor = (id: string) => grade?.results.find((r) => r.question_id === id);
  const answeredAll = quiz.questions.every((q) => (answers[q.id] ?? "").trim() !== "");

  return (
    <div className="space-y-4">
      {grade && (
        <div className="rounded-lg border border-neutral-300 bg-neutral-50 p-3 text-center">
          <div className="text-2xl font-semibold">{grade.score} / {grade.total}</div>
          <div className="text-sm text-neutral-600">{Math.round((grade.score / Math.max(1, grade.total)) * 100)}% correct</div>
        </div>
      )}

      {quiz.questions.map((q, idx) => {
        const res = resultFor(q.id);
        return (
          <div key={q.id} className={`rounded-lg border p-3 ${
            res ? (res.correct ? "border-green-300 bg-green-50" : "border-red-300 bg-red-50") : "border-neutral-200"
          }`}>
            <p className="mb-2 text-sm font-medium text-neutral-900">{idx + 1}. {q.question}</p>

            {q.type === "mcq" && (
              <div className="space-y-1">
                {q.options?.map((o) => (
                  <label key={o} className="flex items-start gap-2 text-sm">
                    <input
                      type="radio" name={q.id} disabled={!!grade}
                      checked={answers[q.id] === o}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: o }))}
                      className="mt-1"
                    />
                    {o}
                  </label>
                ))}
              </div>
            )}

            {q.type === "tf" && (
              <div className="flex gap-4">
                {["true", "false"].map((v) => (
                  <label key={v} className="flex items-center gap-2 text-sm capitalize">
                    <input
                      type="radio" name={q.id} disabled={!!grade}
                      checked={answers[q.id] === v}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: v }))}
                    />
                    {v}
                  </label>
                ))}
              </div>
            )}

            {q.type === "short" && (
              <textarea
                rows={3} disabled={!!grade} value={answers[q.id] ?? ""}
                onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                className="w-full rounded-md border border-line bg-surface p-2 text-sm text-ink outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                placeholder="Your answer"
              />
            )}

            {res && (
              <div className="mt-3 space-y-1 border-t border-neutral-200 pt-2 text-sm">
                <p className="font-medium">{res.correct ? "Correct" : "Not quite"}</p>
                {res.feedback && <MarkdownView>{res.feedback}</MarkdownView>}
                {!res.correct && <p><span className="font-medium">Answer:</span> {q.answer}</p>}
                {q.explanation && <p className="text-neutral-600">{q.explanation}</p>}
              </div>
            )}
          </div>
        );
      })}

      {error && <ErrorBox message={error} onRetry={submit} />}
      {busy === "grade" && <Loading label="Grading..." />}
      <div className="flex gap-2">
        {!grade && <Btn onClick={submit} disabled={busy !== null || !answeredAll}>Submit answers</Btn>}
        <Btn variant="ghost" onClick={reset}>{grade ? "New quiz" : "Cancel"}</Btn>
      </div>
    </div>
  );
}

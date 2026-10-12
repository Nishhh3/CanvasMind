from typing import Literal

from pydantic import BaseModel, Field


class SelectionIn(BaseModel):
    text: str | None = None
    image: str | None = None  # JPEG/PNG data URL of the selected region


class ScopeIn(BaseModel):
    project_id: int
    scope: Literal["page", "project"] = "project"
    page_id: int | None = None
    selection: SelectionIn | None = None


class HistoryMsg(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class AskIn(ScopeIn):
    question: str = Field(min_length=1, max_length=4000)
    history: list[HistoryMsg] = Field(default_factory=list)


class ExplainIn(ScopeIn):
    concept: str = Field(min_length=1, max_length=500)


class QuizIn(ScopeIn):
    types: list[Literal["mcq", "tf", "short"]] = Field(default_factory=lambda: ["mcq", "tf", "short"])
    count: int = Field(default=5, ge=1, le=20)
    difficulty: Literal["easy", "medium", "hard"] = "medium"


class AnswerIn(BaseModel):
    question_id: str
    response: str = ""


class GradeIn(BaseModel):
    quiz_id: int
    answers: list[AnswerIn]


class FlashcardsIn(ScopeIn):
    count: int = Field(default=10, ge=1, le=40)


class RefineIn(ScopeIn):
    mode: Literal["simplify", "grammar", "structure", "improve", "exam_ready"]
    text: str | None = None


class SourceOut(BaseModel):
    page_id: int
    title: str


class AskOut(BaseModel):
    answer: str
    grounded: bool
    sources: list[SourceOut]
    warning: str | None = None


class ExplainOut(BaseModel):
    explanation: str
    grounded: bool
    sources: list[SourceOut]
    warning: str | None = None

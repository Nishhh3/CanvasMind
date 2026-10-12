from datetime import datetime

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel

from app.canvas_models import utcnow


class Quiz(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    created_at: datetime = Field(default_factory=utcnow)
    questions: list = Field(default_factory=list, sa_column=Column(JSON))


class QuizAttempt(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    quiz_id: int = Field(foreign_key="quiz.id", index=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    question_id: str
    topic: str = "General"
    correct: bool = False
    created_at: datetime = Field(default_factory=utcnow)

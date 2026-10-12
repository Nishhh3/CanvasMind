from datetime import datetime, timezone

from sqlalchemy import Column, JSON
from sqlmodel import Field, SQLModel


def utcnow() -> datetime:
    # timezone-aware UTC (newer SQLModel requires it); API output ends with "Z"
    return datetime.now(timezone.utc)


def new_page_content() -> dict:
    return {"width": 1200, "height": 800, "background": None, "objects": []}


class Project(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    name: str
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class Page(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    project_id: int = Field(foreign_key="project.id", index=True)
    title: str = "Untitled page"
    position: int = 0
    content: dict = Field(default_factory=new_page_content, sa_column=Column(JSON))
    transcript: str = ""
    transcript_status: str = "ready"  # "pending" | "ready" | "failed"

from datetime import datetime, timezone
from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer


def _iso_utc(d: datetime) -> str:
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d.isoformat().replace("+00:00", "Z")


UtcDatetime = Annotated[datetime, PlainSerializer(_iso_utc, return_type=str)]


# ---- canvas page content (what the frontend draws) ----------------------
class StrokeObject(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    type: Literal["stroke"]
    tool: Literal["pen", "highlighter", "eraser"] = "pen"
    color: str = "#000000"
    size: float = 2
    points: list[list[float]] = []


class TextObject(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str
    type: Literal["text"]
    x: float
    y: float
    text: str = ""
    fontSize: float = 24
    color: str = "#000000"


CanvasObject = Annotated[Union[StrokeObject, TextObject], Field(discriminator="type")]


class PageContent(BaseModel):
    model_config = ConfigDict(extra="allow")
    width: int = 1200
    height: int = 800
    background: str | None = None
    objects: list[CanvasObject] = Field(default_factory=list)


# ---- responses ----------------------------------------------------------
class ProjectRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    created_at: UtcDatetime
    updated_at: UtcDatetime
    page_count: int = 0


class PageSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    project_id: int
    title: str
    position: int
    transcript_status: str


class PageRead(PageSummary):
    content: PageContent
    transcript: str


class ProjectDetail(ProjectRead):
    pages: list[PageSummary]


# ---- requests -----------------------------------------------------------
class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class ProjectUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class PageCreate(BaseModel):
    title: str | None = Field(default=None, max_length=200)


class PageRename(BaseModel):
    title: str = Field(min_length=1, max_length=200)


class PageUpdate(BaseModel):
    content: PageContent
    image: str | None = None  # JPEG/PNG data URL of the composite page


class ReorderRequest(BaseModel):
    page_ids: list[int]

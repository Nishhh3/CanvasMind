"""Turns pages into grounded context for the AI, and keeps transcripts fresh."""
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

from fastapi import HTTPException
from sqlmodel import Session, select

from app.canvas_models import Page, Project
from app.db import engine
from app.services import ai
from app.services.storage import decode_data_url, find_page_image, read_page_source
from app.services.transcript import text_from_content
import logging


MAX_CONTEXT_CHARS = 48_000

log = logging.getLogger(__name__)

def has_strokes(content: dict) -> bool:
    return any(
        o.get("type") == "stroke" and o.get("tool") != "eraser"
        for o in (content or {}).get("objects", [])
    )


def needs_vision(page: Page) -> bool:
    """Handwriting/drawings, or an imported image page with no extracted text,
    can only be read by the vision model (from the saved page snapshot)."""
    if not find_page_image(page.id):
        return False
    content = page.content or {}
    if has_strokes(content):
        return True
    return bool(content.get("background")) and not read_page_source(page.id)


def text_transcript(page: Page) -> str:
    """Exact text: extracted source text + typed text boxes (no AI needed)."""
    parts = [read_page_source(page.id).strip(), text_from_content(page.content or {})]
    return "\n\n".join(p for p in parts if p)


def apply_text_transcript(page: Page) -> None:
    new = text_transcript(page)
    content = page.content or {}
    if new:
        page.transcript, page.transcript_status = new, "ready"
    elif content.get("background") or has_strokes(content):
        log.warning("page %s has handwriting/image content but no page snapshot to read", page.id)
        page.transcript_status = "failed"  # shows the warning and retries next time
    else:
        page.transcript, page.transcript_status = "", "ready"


def transcribe_page(session: Session, page: Page) -> None:
    """Refresh page.transcript (vision model when needed, otherwise exact text)."""
    if needs_vision(page):
        img = find_page_image(page.id)
        try:
            text = ai.transcribe_image(img.read_bytes(), img.suffix.lstrip("."))
            page.transcript = text or text_transcript(page)
            page.transcript_status = "ready"
        except ai.AIError as e:
               log.error("vision transcription failed for page %s: %s", page.id, e)
               page.transcript = text_transcript(page) or page.transcript
               page.transcript_status = "failed"
    else:
        apply_text_transcript(page)
    session.add(page)
    session.commit()
    session.refresh(page)


def transcribe_pages_bg(page_ids: list[int], workers: int = 4) -> None:
    """Background job: transcribe many pending pages in parallel (own sessions)."""

    def one(pid: int) -> None:
        with Session(engine) as session:
            page = session.get(Page, pid)
            if page and page.transcript_status == "pending":
                transcribe_page(session, page)

    with ThreadPoolExecutor(max_workers=workers) as pool:
        list(pool.map(one, page_ids))


def ensure_fresh(session: Session, pages: list[Page]) -> None:
    for page in pages:
        if page.transcript_status in ("pending", "failed"):
            transcribe_page(session, page)


@dataclass
class NotesContext:
    pages: list[Page]
    text: str
    focus: str | None = None
    truncated: bool = False
    warning: str | None = None
    titles: dict[int, str] = field(default_factory=dict)

    @property
    def empty(self) -> bool:
        return not self.text.strip() and not self.focus

    @property
    def page_ids(self) -> set[int]:
        return {p.id for p in self.pages}

    @property
    def plain(self) -> str:
        """Raw notes text without the page labels (used when refining whole pages)."""
        return "\n\n".join(p.transcript.strip() for p in self.pages if (p.transcript or "").strip())


def load_scope(session: Session, req) -> NotesContext:
    """req needs: project_id, scope ("page"|"project"), page_id, selection."""
    if not session.get(Project, req.project_id):
        raise HTTPException(404, "Project not found")

    all_pages = list(
        session.exec(
            select(Page).where(Page.project_id == req.project_id).order_by(Page.position)
        ).all()
    )
    if req.scope == "page":
        if req.page_id is None:
            raise HTTPException(400, "page_id is required when scope is 'page'")
        pages = [p for p in all_pages if p.id == req.page_id]
        if not pages:
            raise HTTPException(400, "That page does not belong to this project")
    else:
        pages = all_pages

    ensure_fresh(session, pages)

    chunks, total, truncated = [], 0, False
    for p in pages:
        body = (p.transcript or "").strip()
        if not body:
            continue
        chunk = f"### Page {p.position + 1}: {p.title} [id={p.id}]\n{body}\n"
        if total + len(chunk) > MAX_CONTEXT_CHARS:
            room = MAX_CONTEXT_CHARS - total
            if room > 500:
                chunks.append(chunk[:room] + "\n[...cut: notes too long]")
            truncated = True
            break
        chunks.append(chunk)
        total += len(chunk)

    focus = None
    sel = getattr(req, "selection", None)
    if sel and sel.text and sel.text.strip():
        focus = sel.text.strip()
    elif sel and sel.image:
        try:
            raw, ext = decode_data_url(sel.image)
        except ValueError as e:
            raise HTTPException(400, str(e))
        focus = ai.transcribe_image(raw, ext) or None

    warning = None
    if any(p.transcript_status == "failed" for p in pages):
        warning = "Some handwritten pages could not be read, so answers may be incomplete."

    return NotesContext(
        pages=pages,
        text="\n".join(chunks),
        focus=focus,
        truncated=truncated,
        warning=warning,
        titles={p.id: p.title for p in all_pages},
    )

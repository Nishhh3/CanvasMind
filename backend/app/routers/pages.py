import time

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from fastapi.responses import FileResponse, Response
from sqlmodel import Session, select

from app.canvas_models import Page, Project, utcnow
from app.db import engine, get_session
from app.schemas import PageRead, PageRename, PageSummary, PageUpdate
from app.services import notes
from app.services.storage import delete_page_image, find_page_image, save_page_image

router = APIRouter()

PREFETCH_DELAY = 8  # seconds of quiet before transcribing in the background
_latest: dict[int, int] = {}


def get_page_or_404(session: Session, page_id: int) -> Page:
    page = session.get(Page, page_id)
    if not page:
        raise HTTPException(404, "Page not found")
    return page


def touch_project(session: Session, project_id: int) -> None:
    project = session.get(Project, project_id)
    if project:
        project.updated_at = utcnow()
        session.add(project)


def _prefetch(page_id: int, token: int) -> None:
    """Debounced: only the most recent save of a page actually transcribes."""
    time.sleep(PREFETCH_DELAY)
    if _latest.get(page_id) != token:
        return
    with Session(engine) as session:
        page = session.get(Page, page_id)
        if page and page.transcript_status == "pending":
            notes.transcribe_page(session, page)


@router.get("/{page_id}", response_model=PageRead)
def get_page(page_id: int, session: Session = Depends(get_session)):
    return PageRead.model_validate(get_page_or_404(session, page_id))


@router.put("/{page_id}", response_model=PageSummary)
def save_page(
    page_id: int,
    body: PageUpdate,
    background: BackgroundTasks,
    session: Session = Depends(get_session),
):
    page = get_page_or_404(session, page_id)
    if body.image:
        try:
            save_page_image(page.id, body.image)
        except ValueError as e:
            raise HTTPException(400, str(e))

    page.content = body.content.model_dump(mode="json")  # new dict -> change detected

    if notes.needs_vision(page):
        # handwriting / scanned background: read it with the vision model.
        # AI endpoints refresh pending pages on demand; this prefetches in the
        # background once the student pauses.
        page.transcript_status = "pending"
        _latest[page.id] = _latest.get(page.id, 0) + 1
        background.add_task(_prefetch, page.id, _latest[page.id])
    else:
        notes.apply_text_transcript(page)

    session.add(page)
    touch_project(session, page.project_id)
    session.commit()
    session.refresh(page)
    return PageSummary.model_validate(page)


@router.patch("/{page_id}", response_model=PageSummary)
def rename_page(
    page_id: int, body: PageRename, session: Session = Depends(get_session)
):
    page = get_page_or_404(session, page_id)
    page.title = body.title.strip()
    session.add(page)
    touch_project(session, page.project_id)
    session.commit()
    session.refresh(page)
    return PageSummary.model_validate(page)


@router.delete("/{page_id}")
def delete_page(page_id: int, session: Session = Depends(get_session)):
    page = get_page_or_404(session, page_id)
    siblings = session.exec(
        select(Page).where(Page.project_id == page.project_id).order_by(Page.position)
    ).all()
    if len(siblings) <= 1:
        raise HTTPException(400, "A project needs at least one page")
    delete_page_image(page.id)
    session.delete(page)
    for index, sibling in enumerate(s for s in siblings if s.id != page.id):
        sibling.position = index
        session.add(sibling)
    touch_project(session, page.project_id)
    session.commit()
    return {"ok": True}


@router.get("/{page_id}/image")
def get_page_image(page_id: int, session: Session = Depends(get_session)):
    get_page_or_404(session, page_id)
    path = find_page_image(page_id)
    if not path:
        raise HTTPException(404, "No snapshot saved for this page yet")
    return Response(path.read_bytes(), media_type=path.media_type, headers={"Cache-Control": "no-cache"})

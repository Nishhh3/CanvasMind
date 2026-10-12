from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlmodel import Session, func, select

from app.canvas_models import Page, utcnow
from app.db import get_session
from app.routers.projects import get_project_or_404, project_pages
from app.schemas import PageSummary
from app.services import importer, notes
from app.services.storage import (
    delete_page_image,
    save_import_image,
    save_page_image_bytes,
    write_page_source,
)

router = APIRouter()

MAX_FILE_BYTES = 40 * 1024 * 1024
MAX_PAGES_PER_IMPORT = 120


def _is_blank(page: Page) -> bool:
    content = page.content or {}
    return not content.get("objects") and not content.get("background") and not (page.transcript or "").strip()


@router.post("/{project_id}/import")
def import_files(
    project_id: int,
    background: BackgroundTasks,
    files: list[UploadFile] = File(...),
    replace_blank: bool = True,
    session: Session = Depends(get_session),
):
    """Import PDF / PPTX / DOCX / TXT / MD / images as new pages at the end of the
    project. If the project only has one empty page and replace_blank is true,
    that empty page is removed (so the student doesn't keep a stray blank page)."""
    project = get_project_or_404(session, project_id)

    drafts: list[importer.PageDraft] = []
    warnings: list[str] = []
    remaining = MAX_PAGES_PER_IMPORT
    for upload in files:
        name = upload.filename or "file"
        data = upload.file.read()
        if len(data) > MAX_FILE_BYTES:
            warnings.append(f"{name}: file is larger than {MAX_FILE_BYTES // (1024 * 1024)} MB, skipped.")
            continue
        try:
            file_drafts, file_warnings = importer.import_file(name, data, remaining)
        except importer.ImportProblem as e:
            warnings.append(f"{name}: {e}")
            continue
        drafts += file_drafts
        warnings += file_warnings
        remaining -= len(file_drafts)
        if remaining <= 0:
            warnings.append("Page limit reached for this import; remaining files were skipped.")
            break

    if not drafts:
        raise HTTPException(400, " ".join(warnings) or "Nothing could be imported.")

    existing = project_pages(session, project_id)
    if replace_blank and len(existing) == 1 and _is_blank(existing[0]):
        delete_page_image(existing[0].id)
        session.delete(existing[0])
        session.commit()
        existing = []
    position = (max((p.position for p in existing), default=-1)) + 1

    created: list[Page] = []
    for d in drafts:
        bg_url = save_import_image(d.background) if d.background else None
        page = Page(
            project_id=project_id,
            title=d.title,
            position=position,
            content={"width": 1200, "height": d.height, "background": bg_url, "objects": d.objects},
        )
        session.add(page)
        session.commit()
        session.refresh(page)
        if d.background:
            save_page_image_bytes(page.id, d.background)  # snapshot used for vision
        write_page_source(page.id, d.source_text)
        if d.vision:
            page.transcript, page.transcript_status = "", "pending"
        else:
            notes.apply_text_transcript(page)
        session.add(page)
        session.commit()
        session.refresh(page)
        created.append(page)
        position += 1

    project.updated_at = utcnow()
    session.add(project)
    session.commit()

    pending = [p.id for p in created if p.transcript_status == "pending"]
    if pending:
        background.add_task(notes.transcribe_pages_bg, pending)

    return {"pages": [PageSummary.model_validate(p) for p in created], "warnings": warnings}

"""Export a project's pages (or a single page) as one PDF.

Each page's saved snapshot image becomes one PDF page, in page order, so
handwriting, drawings and imported scans look exactly as they do on the canvas.
"""
import io
import logging
import re

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from PIL import Image
from sqlmodel import Session, select

from app.canvas_models import Page, Project
from app.db import get_session
from app.services.storage import find_page_image

log = logging.getLogger(__name__)

router = APIRouter()  # mounted at /api/projects


def _load_rgb(stored) -> Image.Image:
    """Open a StoredImage (from find_page_image) and flatten any transparency
    onto white (PDF has no alpha). StoredImage is not a path or file object, so
    read its bytes and hand those to Pillow."""
    img = Image.open(io.BytesIO(stored.read_bytes()))
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        bg = Image.new("RGB", img.size, "white")
        bg.paste(img, mask=img.split()[-1])
        return bg
    return img.convert("RGB")


def _safe_name(text: str) -> str:
    return re.sub(r"[^\w\-]+", "_", text).strip("_") or "notes"


@router.get("/{project_id}/export/pdf")
def export_pdf(project_id: int, page_id: int | None = None, session: Session = Depends(get_session)):
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")

    pages = list(
        session.exec(
            select(Page).where(Page.project_id == project_id).order_by(Page.position)
        ).all()
    )
    if page_id is not None:
        pages = [p for p in pages if p.id == page_id]
        if not pages:
            raise HTTPException(400, "That page does not belong to this project")

    images: list[Image.Image] = []
    skipped = 0
    for p in pages:
        stored = find_page_image(p.id)
        if not stored:
            skipped += 1
            log.warning("pdf export: page %s has no saved snapshot, skipping", p.id)
            continue
        try:
            images.append(_load_rgb(stored))
        except Exception:
            skipped += 1
            log.exception("pdf export: could not read image for page %s", p.id)

    if not images:
        raise HTTPException(400, "None of the pages have an image to export yet. Open a page and try again.")

    buf = io.BytesIO()
    images[0].save(buf, format="PDF", save_all=True, append_images=images[1:], resolution=150.0)

    title = getattr(project, "name", None) or getattr(project, "title", None) or "notes"
    filename = f"{_safe_name(str(title))}.pdf"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    if skipped:
        headers["X-Skipped-Pages"] = str(skipped)
    return Response(content=buf.getvalue(), media_type="application/pdf", headers=headers)
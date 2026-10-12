from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session, func, select

from app.canvas_models import Page, Project, utcnow
from app.db import get_session
from app.schemas import (
    PageCreate,
    PageSummary,
    ProjectCreate,
    ProjectDetail,
    ProjectRead,
    ProjectUpdate,
    ReorderRequest,
)
from app.services.storage import delete_page_image

router = APIRouter()


def get_project_or_404(session: Session, project_id: int) -> Project:
    project = session.get(Project, project_id)
    if not project:
        raise HTTPException(404, "Project not found")
    return project


def project_pages(session: Session, project_id: int) -> list[Page]:
    return list(
        session.exec(
            select(Page).where(Page.project_id == project_id).order_by(Page.position)
        ).all()
    )


def to_read(project: Project, page_count: int) -> ProjectRead:
    return ProjectRead(
        id=project.id,
        name=project.name,
        created_at=project.created_at,
        updated_at=project.updated_at,
        page_count=page_count,
    )


def to_detail(session: Session, project: Project) -> ProjectDetail:
    pages = project_pages(session, project.id)
    return ProjectDetail(
        id=project.id,
        name=project.name,
        created_at=project.created_at,
        updated_at=project.updated_at,
        page_count=len(pages),
        pages=[PageSummary.model_validate(p) for p in pages],
    )


@router.get("", response_model=list[ProjectRead])
def list_projects(session: Session = Depends(get_session)):
    projects = session.exec(select(Project).order_by(Project.updated_at.desc())).all()
    counts = dict(
        session.exec(select(Page.project_id, func.count()).group_by(Page.project_id)).all()
    )
    return [to_read(p, counts.get(p.id, 0)) for p in projects]


@router.post("", response_model=ProjectDetail)
def create_project(body: ProjectCreate, session: Session = Depends(get_session)):
    project = Project(name=body.name.strip())
    session.add(project)
    session.commit()
    session.refresh(project)
    session.add(Page(project_id=project.id, title="Page 1", position=0))
    session.commit()
    return to_detail(session, project)


@router.get("/{project_id}", response_model=ProjectDetail)
def get_project(project_id: int, session: Session = Depends(get_session)):
    return to_detail(session, get_project_or_404(session, project_id))


@router.patch("/{project_id}", response_model=ProjectRead)
def rename_project(
    project_id: int, body: ProjectUpdate, session: Session = Depends(get_session)
):
    project = get_project_or_404(session, project_id)
    project.name = body.name.strip()
    project.updated_at = utcnow()
    session.add(project)
    session.commit()
    session.refresh(project)
    return to_read(project, len(project_pages(session, project.id)))


@router.delete("/{project_id}")
def delete_project(project_id: int, session: Session = Depends(get_session)):
    project = get_project_or_404(session, project_id)
    for page in project_pages(session, project_id):
        delete_page_image(page.id)
        session.delete(page)
    session.delete(project)
    session.commit()
    return {"ok": True}


@router.post("/{project_id}/pages", response_model=PageSummary)
def create_page(
    project_id: int, body: PageCreate, session: Session = Depends(get_session)
):
    project = get_project_or_404(session, project_id)
    last = session.exec(
        select(func.max(Page.position)).where(Page.project_id == project_id)
    ).one()
    position = 0 if last is None else last + 1
    title = (body.title or "").strip() or f"Page {position + 1}"
    page = Page(project_id=project_id, title=title, position=position)
    session.add(page)
    project.updated_at = utcnow()
    session.add(project)
    session.commit()
    session.refresh(page)
    return PageSummary.model_validate(page)


@router.post("/{project_id}/pages/reorder", response_model=list[PageSummary])
def reorder_pages(
    project_id: int, body: ReorderRequest, session: Session = Depends(get_session)
):
    project = get_project_or_404(session, project_id)
    pages = project_pages(session, project_id)
    if sorted(body.page_ids) != sorted(p.id for p in pages):
        raise HTTPException(
            400, "page_ids must contain every page of the project exactly once"
        )
    by_id = {p.id: p for p in pages}
    for index, pid in enumerate(body.page_ids):
        by_id[pid].position = index
        session.add(by_id[pid])
    project.updated_at = utcnow()
    session.add(project)
    session.commit()
    return [PageSummary.model_validate(by_id[pid]) for pid in body.page_ids]

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import ai_models  # noqa: F401  (registers quiz tables)
from app.core.config import settings
from app.db import init_db
from app.routers import chat, health, imports, items, pages, projects, study
from app.services.storage import STORAGE_DIR


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix="/api", tags=["health"])
app.include_router(items.router, prefix="/api/items", tags=["items"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(imports.router, prefix="/api/projects", tags=["import"])
app.include_router(pages.router, prefix="/api/pages", tags=["pages"])
app.include_router(study.router, prefix="/api/ai", tags=["ai"])
app.include_router(study.insights_router, prefix="/api/projects", tags=["ai"])

# uploaded / imported files, served at /files/...
app.mount("/files", StaticFiles(directory=STORAGE_DIR), name="files")

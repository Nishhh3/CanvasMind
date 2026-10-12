from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import ai_models  # noqa: F401  (registers quiz tables)
from app import stored_file  # noqa: F401  (registers the file table)
from app.routers.files import router as files_router
from app.core.config import settings
from app.db import init_db
from app.routers import chat, health, imports, items, pages, projects, study
from app.routers import chat, export, health, imports, items, pages, projects, study



@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.include_router(export.router, prefix="/api/projects", tags=["export"])

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=settings.cors_origin_regex or None,
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
app.include_router(files_router, prefix="/files", tags=["files"])


from sqlmodel import Session, SQLModel, create_engine

from app.core.config import settings

_url = settings.database_url

if _url.startswith("sqlite"):
    engine = create_engine(_url, connect_args={"check_same_thread": False})
else:
    # Postgres (Supabase). prepare_threshold=None keeps it working through the
    # transaction pooler (port 6543); pool_pre_ping drops connections the pooler closed.
    engine = create_engine(
        _url,
        pool_pre_ping=True,
        pool_recycle=300,
        pool_size=5,
        max_overflow=5,
        connect_args={"prepare_threshold": None},
    )


def init_db() -> None:
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session

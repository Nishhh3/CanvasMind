from sqlalchemy import Column, LargeBinary
from sqlmodel import Field, SQLModel


class StoredFile(SQLModel, table=True):
    """A small file kept in the database (page snapshots, imported images, source text)."""

    key: str = Field(primary_key=True, max_length=200)
    content_type: str = "application/octet-stream"
    data: bytes = Field(sa_column=Column(LargeBinary, nullable=False))

"""Files kept in the database: page snapshots, imported page images, imported source text.

Same functions as the old on-disk version, so notes.py / pages.py / imports.py keep working.
"""
import base64
import re
import uuid
from pathlib import Path

from sqlmodel import Session, select

from app.db import engine
from app.stored_file import StoredFile

# kept so old imports (e.g. main.py) do not break; nothing is written here any more
STORAGE_DIR = Path(__file__).resolve().parents[2] / "storage"

MAX_IMAGE_BYTES = 8 * 1024 * 1024
_DATA_URL = re.compile(r"^data:image/(png|jpeg|jpg|webp);base64,", re.I)
_EXTS = ("jpg", "png", "webp")
CONTENT_TYPES = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}


def decode_data_url(data_url: str) -> tuple[bytes, str]:
    m = _DATA_URL.match(data_url)
    if not m:
        raise ValueError("image must be a base64 data URL (png, jpeg or webp)")
    try:
        raw = base64.b64decode(data_url[m.end():], validate=True)
    except Exception:
        raise ValueError("image is not valid base64")
    if len(raw) > MAX_IMAGE_BYTES:
        raise ValueError("image is too large (max 8 MB)")
    ext = m.group(1).lower()
    return raw, "jpg" if ext == "jpeg" else ext


class StoredImage:
    """Looks like the Path the old code returned: .suffix and .read_bytes()."""

    def __init__(self, key: str):
        self.key = key
        self.suffix = "." + key.rsplit(".", 1)[-1]

    @property
    def media_type(self) -> str:
        return CONTENT_TYPES.get(self.suffix.lstrip("."), "application/octet-stream")

    def read_bytes(self) -> bytes:
        with Session(engine) as session:
            row = session.get(StoredFile, self.key)
            return row.data if row else b""


def _page_key(page_id: int, ext: str) -> str:
    return f"pages/{page_id}.{ext}"


def find_page_image(page_id: int) -> StoredImage | None:
    keys = [_page_key(page_id, e) for e in _EXTS]
    with Session(engine) as session:
        found = set(session.exec(select(StoredFile.key).where(StoredFile.key.in_(keys))).all())
    for k in keys:
        if k in found:
            return StoredImage(k)
    return None


def _delete_keys(session: Session, keys: list[str]) -> None:
    for k in keys:
        row = session.get(StoredFile, k)
        if row:
            session.delete(row)


def save_page_image_bytes(page_id: int, raw: bytes, ext: str = "jpg") -> StoredImage:
    key = _page_key(page_id, ext)
    with Session(engine) as session:
        _delete_keys(session, [_page_key(page_id, e) for e in _EXTS if e != ext])
        session.merge(StoredFile(key=key, content_type=CONTENT_TYPES.get(ext, "image/jpeg"), data=raw))
        session.commit()
    return StoredImage(key)


def save_page_image(page_id: int, data_url: str) -> StoredImage:
    raw, ext = decode_data_url(data_url)
    return save_page_image_bytes(page_id, raw, ext)


def delete_page_image(page_id: int) -> None:
    """Called whenever a page is deleted: removes its snapshot AND source text."""
    keys = [_page_key(page_id, e) for e in _EXTS] + [f"sources/{page_id}.txt"]
    with Session(engine) as session:
        _delete_keys(session, keys)
        session.commit()


# ---- imported files -------------------------------------------------------
def save_import_image(raw: bytes, ext: str = "jpg") -> str:
    """Stores an imported page background; returns its URL path (/files/imports/...)."""
    name = f"{uuid.uuid4().hex}.{ext}"
    with Session(engine) as session:
        session.add(StoredFile(key=f"imports/{name}", content_type=CONTENT_TYPES.get(ext, "image/jpeg"), data=raw))
        session.commit()
    return f"/files/imports/{name}"


def read_import_file(name: str) -> tuple[bytes, str] | None:
    with Session(engine) as session:
        row = session.get(StoredFile, f"imports/{name}")
        return (row.data, row.content_type) if row else None


def write_page_source(page_id: int, text: str) -> None:
    """Text that came from the imported file (and is NOT drawn as text boxes)."""
    key = f"sources/{page_id}.txt"
    with Session(engine) as session:
        if text.strip():
            session.merge(StoredFile(key=key, content_type="text/plain", data=text.encode("utf-8")))
        else:
            _delete_keys(session, [key])
        session.commit()


def read_page_source(page_id: int) -> str:
    with Session(engine) as session:
        row = session.get(StoredFile, f"sources/{page_id}.txt")
        return row.data.decode("utf-8") if row else ""

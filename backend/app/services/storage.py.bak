"""Files on disk: page snapshots, imported backgrounds, imported source text."""
import base64
import re
import uuid
from pathlib import Path

STORAGE_DIR = Path(__file__).resolve().parents[2] / "storage"
PAGES_DIR = STORAGE_DIR / "pages"
IMPORTS_DIR = STORAGE_DIR / "imports"
SOURCES_DIR = STORAGE_DIR / "sources"
for _d in (PAGES_DIR, IMPORTS_DIR, SOURCES_DIR):
    _d.mkdir(parents=True, exist_ok=True)

MAX_IMAGE_BYTES = 8 * 1024 * 1024
_DATA_URL = re.compile(r"^data:image/(png|jpeg|jpg|webp);base64,", re.I)
_EXTS = ("jpg", "png", "webp")


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


def find_page_image(page_id: int) -> Path | None:
    for ext in _EXTS:
        p = PAGES_DIR / f"{page_id}.{ext}"
        if p.exists():
            return p
    return None


def _clear_page_images(page_id: int) -> None:
    for ext in _EXTS:
        (PAGES_DIR / f"{page_id}.{ext}").unlink(missing_ok=True)


def save_page_image_bytes(page_id: int, raw: bytes, ext: str = "jpg") -> Path:
    _clear_page_images(page_id)
    path = PAGES_DIR / f"{page_id}.{ext}"
    path.write_bytes(raw)
    return path


def save_page_image(page_id: int, data_url: str) -> Path:
    raw, ext = decode_data_url(data_url)
    return save_page_image_bytes(page_id, raw, ext)


def delete_page_image(page_id: int) -> None:
    """Called whenever a page is deleted: removes its snapshot AND source text."""
    _clear_page_images(page_id)
    (SOURCES_DIR / f"{page_id}.txt").unlink(missing_ok=True)


# ---- imported files -------------------------------------------------------
def save_import_image(raw: bytes, ext: str = "jpg") -> str:
    """Stores an imported page background; returns its URL path (/files/...)."""
    name = f"{uuid.uuid4().hex}.{ext}"
    (IMPORTS_DIR / name).write_bytes(raw)
    return f"/files/imports/{name}"


def write_page_source(page_id: int, text: str) -> None:
    """Text that came from the imported file (and is NOT drawn as text boxes)."""
    path = SOURCES_DIR / f"{page_id}.txt"
    if text.strip():
        path.write_text(text, encoding="utf-8")
    else:
        path.unlink(missing_ok=True)


def read_page_source(page_id: int) -> str:
    path = SOURCES_DIR / f"{page_id}.txt"
    return path.read_text(encoding="utf-8") if path.exists() else ""

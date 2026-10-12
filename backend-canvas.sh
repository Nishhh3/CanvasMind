#!/usr/bin/env bash
# Backend patch: keep page snapshots, imported page images and extracted source text
# in the database instead of backend/storage, so they survive Render restarts.
#   - app/stored_file.py        : table for file bytes
#   - app/services/storage.py   : same functions as before, backed by the database
#   - app/routers/files.py      : GET /files/imports/{name} (replaces the StaticFiles mount)
#   - app/main.py, routers/pages.py: small edits (backups: *.bak)
# Needs patch 3 (import) installed. Run from the project root:
#   bash add_db_files_backend.sh
# Safe to re-run.
set -e

for f in backend/app/services/storage.py backend/app/main.py backend/app/routers/pages.py backend/app/db.py; do
  [ -f "$f" ] || { echo "!! $f not found. Run from the project root (patches 1-3 must be installed)."; exit 1; }
done
for f in backend/app/services/storage.py backend/app/main.py backend/app/routers/pages.py; do
  [ -f "$f.bak" ] || cp "$f" "$f.bak"
done

# ------------------------------------------------------------ stored_file
cat > backend/app/stored_file.py <<'EOF'
from sqlalchemy import Column, LargeBinary
from sqlmodel import Field, SQLModel


class StoredFile(SQLModel, table=True):
    """A small file kept in the database (page snapshots, imported images, source text)."""

    key: str = Field(primary_key=True, max_length=200)
    content_type: str = "application/octet-stream"
    data: bytes = Field(sa_column=Column(LargeBinary, nullable=False))
EOF

# ---------------------------------------------------------------- storage
cat > backend/app/services/storage.py <<'EOF'
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
EOF

# ------------------------------------------------------------ files router
cat > backend/app/routers/files.py <<'EOF'
import re

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

from app.services.storage import read_import_file

router = APIRouter()
_NAME = re.compile(r"^[a-f0-9]{32}\.(jpg|png|webp)$")


@router.get("/imports/{name}")
def get_import_image(name: str):
    if not _NAME.match(name):
        raise HTTPException(404, "Not found")
    found = read_import_file(name)
    if not found:
        raise HTTPException(404, "Not found")
    data, content_type = found
    return Response(
        data,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=31536000, immutable"},
    )
EOF

# ------------------------------------------------------------------- main
M=backend/app/main.py
# 1. drop the old static mount
sed -i \
  -e '/^from fastapi.staticfiles import StaticFiles/d' \
  -e '/^from app.services.storage import STORAGE_DIR/d' \
  -e '/^app.mount("\/files"/d' \
  -e '/^# uploaded \/ imported files, served at/d' \
  "$M"
# 2. register the file table
grep -q 'import stored_file' "$M" || \
  sed -i 's|^from app import ai_models.*|&\nfrom app import stored_file  # noqa: F401  (registers the file table)|' "$M"
# 3. import the files router under its own name
grep -q '^from app.routers.files import router as files_router' "$M" || \
  sed -i 's|^from app import stored_file.*|&\nfrom app.routers.files import router as files_router|' "$M"
# 4. include it (also repairs the older "files.router" version of this patch)
sed -i 's|app.include_router(files.router,|app.include_router(files_router,|' "$M"
grep -q 'app.include_router(files_router' "$M" || \
  sed -i '/^app.include_router(study.insights_router/a app.include_router(files_router, prefix="/files", tags=["files"])' "$M"
# 5. verify every piece is present
if grep -q 'StaticFiles' "$M" \
   || ! grep -q 'import stored_file' "$M" \
   || ! grep -q '^from app.routers.files import router as files_router' "$M" \
   || ! grep -q 'app.include_router(files_router' "$M"; then
  echo "!! main.py did not patch cleanly (it differs from what I expected). Restoring the backup."
  cp "$M.bak" "$M"
  echo "   Edit main.py by hand:"
  echo "     from app import stored_file  # noqa: F401"
  echo "     from app.routers.files import router as files_router"
  echo "     app.include_router(files_router, prefix=\"/files\", tags=[\"files\"])"
  echo "   and remove the StaticFiles import, the STORAGE_DIR import and the app.mount(\"/files\", ...) line."
  exit 1
fi
echo "main.py patched"

# ------------------------------------------------------------------ pages
if grep -q 'path.read_bytes()' backend/app/routers/pages.py; then
  echo "pages.py is already patched."
else
  sed -i \
    -e 's|from fastapi.responses import FileResponse$|from fastapi.responses import FileResponse, Response|' \
    -e 's|return FileResponse(path, headers={"Cache-Control": "no-cache"})|return Response(path.read_bytes(), media_type=path.media_type, headers={"Cache-Control": "no-cache"})|' \
    backend/app/routers/pages.py
  if ! grep -q 'path.read_bytes()' backend/app/routers/pages.py; then
    echo "!! pages.py did not patch cleanly. Restoring the backup. Edit get_page_image by hand to return"
    echo "   Response(path.read_bytes(), media_type=path.media_type)"
    cp backend/app/routers/pages.py.bak backend/app/routers/pages.py
    exit 1
  fi
  echo "pages.py patched"
fi

echo ""
echo "Done. Files are now stored in the database."
echo "  - Restart the backend. The 'storedfile' table is created automatically on startup."
echo "  - Existing files in backend/storage are NOT migrated. Re-import any notes that show blank backgrounds."
echo "  - Imported images are now served by /files/imports/{name} from the database."
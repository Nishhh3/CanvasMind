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

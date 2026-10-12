def text_from_content(content: dict | None) -> str:
    """Return the typed text boxes of a page, in reading order (top to bottom,
    then left to right). Handwriting and drawings are not handled here; the
    vision model reads those from the page snapshot (see services/notes.py)."""
    texts = [
        o
        for o in (content or {}).get("objects", [])
        if o.get("type") == "text" and (o.get("text") or "").strip()
    ]
    texts.sort(key=lambda o: (round((o.get("y") or 0) / 20), o.get("x") or 0))
    return "\n".join(o["text"].strip() for o in texts)
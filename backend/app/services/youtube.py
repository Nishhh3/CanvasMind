"""Turn a student's request for videos into YouTube links.

LLMs invent video URLs that look real but are dead. So the model only supplies
short search queries, and the app builds the links itself. A YouTube search URL
always works and needs no API key.
"""
import re
from urllib.parse import quote_plus

VIDEO_INTENT = re.compile(r"\byoutube\b|\bvideos?\b|\btutorials?\b|\bwatch\b", re.I)
MARKER = re.compile(r"\[\[YOUTUBE:\s*(.+?)\]\]", re.I)


def wants_video(text: str) -> bool:
    return bool(VIDEO_INTENT.search(text or ""))


def search_url(query: str) -> str:
    return "https://www.youtube.com/results?search_query=" + quote_plus(query.strip())


def _clean(query: str) -> str:
    # brackets/parentheses would break the markdown link text
    return re.sub(r"[\[\]()]", "", str(query)).strip()[:100]


def links_markdown(queries, fallback: str = "", limit: int = 3) -> str:
    """Markdown list of YouTube search links, ready to append to an answer."""
    cleaned: list[str] = []
    for q in queries if isinstance(queries, list) else []:
        q = _clean(q)
        if q and q.lower() not in (c.lower() for c in cleaned):
            cleaned.append(q)
    if not cleaned and _clean(fallback):
        cleaned = [_clean(fallback)]
    if not cleaned:
        return ""
    lines = [f"- [{q}]({search_url(q)})" for q in cleaned[:limit]]
    return "\n\n**Watch on YouTube**\n" + "\n".join(lines)


def replace_markers(text: str) -> str:
    """Replace [[YOUTUBE: query]] markers (used by the free-form chat endpoint) with links."""

    def sub(m: re.Match) -> str:
        q = _clean(m.group(1))
        return f"[Search YouTube: {q}]({search_url(q)})" if q else ""

    return MARKER.sub(sub, text)
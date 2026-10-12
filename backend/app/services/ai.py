"""Low-level OpenRouter calls: text, JSON, and vision transcription."""
import base64
import json
import re

import httpx

from app.core.config import settings

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class AIError(Exception):
    pass


def _post(messages: list[dict], model: str | None = None, temperature: float | None = None,
          max_tokens: int = 6000) -> str:
    if not settings.openrouter_api_key:
        raise AIError("OPENROUTER_API_KEY is not set in backend/.env")
    payload: dict = {
        "model": model or settings.llm_model,
        "messages": messages,
        "max_tokens": max_tokens,  # without this, OpenRouter reserves the model's max and returns 402
    }
    if temperature is not None:
        payload["temperature"] = temperature
    try:
        r = httpx.post(
            OPENROUTER_URL,
            headers={"Authorization": f"Bearer {settings.openrouter_api_key}"},
            json=payload,
            timeout=120,
        )
        r.raise_for_status()
        content = r.json()["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as e:
        raise AIError(f"OpenRouter {e.response.status_code}: {e.response.text[:300]}")
    except (httpx.HTTPError, KeyError, IndexError, ValueError, TypeError) as e:
        raise AIError(f"OpenRouter request failed: {e}")
    if isinstance(content, list):  # some models return content parts
        content = "".join(p.get("text", "") for p in content if isinstance(p, dict))
    return content or ""

def build_messages(system: str, user: str, history: list[dict] | None = None) -> list[dict]:
    msgs = [{"role": "system", "content": system}]
    msgs += [{"role": m["role"], "content": m["content"]} for m in (history or [])]
    msgs.append({"role": "user", "content": user})
    return msgs


def complete(system: str, user: str, history: list[dict] | None = None,
             model: str | None = None, temperature: float | None = 0.2) -> str:
    return _post(build_messages(system, user, history), model=model, temperature=temperature)


def _extract_json(text: str):
    t = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.I)
    try:
        return json.loads(t)
    except ValueError:
        pass
    start, end = t.find("{"), t.rfind("}")
    if start != -1 and end > start:
        return json.loads(t[start : end + 1])
    raise ValueError("no JSON object found")


def complete_json(system: str, user: str, history: list[dict] | None = None,
                  model: str | None = None, temperature: float | None = 0.2) -> dict:
    """Ask for a JSON object; retry once if the reply isn't parseable."""
    text = complete(system, user, history, model, temperature)
    try:
        return _extract_json(text)
    except ValueError:
        retry = user + "\n\nYour previous reply was not valid JSON. Reply with ONLY one valid JSON object."
        text = complete(system, retry, history, model, temperature)
        try:
            return _extract_json(text)
        except ValueError:
            raise AIError("The model did not return valid JSON. Please try again.")


TRANSCRIBE_PROMPT = (
    "Transcribe everything written on this note page, exactly as written, in reading order. "
    "Keep headings, bullet points and numbering. Write formulas in plain text or LaTeX. "
    "For diagrams, tables or drawings, add one short line in square brackets describing them, "
    "e.g. [diagram: process state transition graph]. Do not explain, summarise or correct anything. "
    "Output only the transcription. If the page is blank, output nothing."
)


def transcribe_image(raw: bytes, ext: str = "jpg") -> str:
    mime = "jpeg" if ext in ("jpg", "jpeg") else ext
    data_url = f"data:image/{mime};base64,{base64.b64encode(raw).decode()}"
    messages = [
        {
            "role": "user",
            "content": [
                {"type": "text", "text": TRANSCRIBE_PROMPT},
                {"type": "image_url", "image_url": {"url": data_url}},
            ],
        }
    ]
    return _post(messages, model=settings.vision_model or settings.llm_model, temperature=0).strip()

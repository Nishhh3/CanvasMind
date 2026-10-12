# LLM access through OpenRouter (OpenAI-compatible API, one key, many models).
# Put all AI / third-party API calls here so routers stay thin.
import httpx

from app.core.config import settings

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class LLMError(Exception):
    pass


def chat(
    messages: list[dict],
    model: str | None = None,
    temperature: float | None = None,
) -> str:
    """Send a full chat history: [{"role": "user"|"assistant"|"system", "content": "..."}]"""
    if not settings.openrouter_api_key:
        raise LLMError("OPENROUTER_API_KEY is not set in backend/.env")

    payload: dict = {"model": model or settings.llm_model, "messages": messages}
    if temperature is not None:
        payload["temperature"] = temperature

    try:
        r = httpx.post(
            OPENROUTER_URL,
            headers={"Authorization": f"Bearer {settings.openrouter_api_key}"},
            json=payload,
            timeout=90,
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]
    except httpx.HTTPStatusError as e:
        raise LLMError(f"OpenRouter {e.response.status_code}: {e.response.text[:300]}")
    except (httpx.HTTPError, KeyError, IndexError, ValueError) as e:
        raise LLMError(f"OpenRouter request failed: {e}")


def ask(prompt: str, system: str | None = None, model: str | None = None) -> str:
    """One-shot helper: ask(prompt) -> answer text."""
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})
    return chat(messages, model=model)

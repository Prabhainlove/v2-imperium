"""Job Agent LLM client.

Minimal, defensive wrapper around an OpenAI-compatible Chat Completions endpoint.

Environment variables:
- `IMPERIUM_LLM_API_KEY` (or `OPENAI_API_KEY`)
- `IMPERIUM_LLM_MODEL` (default: gpt-4o-mini)
- `IMPERIUM_LLM_BASE_URL` (default: https://api.openai.com/v1)
- `IMPERIUM_LLM_CHAT_COMPLETIONS_URL` (optional: full URL override)
- `IMPERIUM_LLM_API_KEY_HEADER` (default: Authorization)
- `IMPERIUM_LLM_API_KEY_PREFIX` (default: Bearer )
- `IMPERIUM_LLM_TIMEOUT_SECONDS` (default: 45)
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any

try:
    import requests
except ImportError:  # pragma: no cover - optional LLM dependency
    requests = None


@dataclass(slots=True)
class LLMClientConfig:
    api_key: str = os.getenv("IMPERIUM_LLM_API_KEY") or os.getenv("OPENAI_API_KEY", "")
    model: str = os.getenv("IMPERIUM_LLM_MODEL", "gpt-4o-mini")
    base_url: str = os.getenv("IMPERIUM_LLM_BASE_URL", "https://api.openai.com/v1")
    chat_completions_url: str | None = os.getenv("IMPERIUM_LLM_CHAT_COMPLETIONS_URL")
    api_key_header: str = os.getenv("IMPERIUM_LLM_API_KEY_HEADER", "Authorization")
    api_key_prefix: str = os.getenv("IMPERIUM_LLM_API_KEY_PREFIX", "Bearer ")
    timeout_seconds: int = int(os.getenv("IMPERIUM_LLM_TIMEOUT_SECONDS", "45"))
    temperature: float = float(os.getenv("IMPERIUM_LLM_TEMPERATURE", "0.2"))


class OpenAICompatibleLLMClient:
    def __init__(self, config: LLMClientConfig | None = None) -> None:
        self.config = config or LLMClientConfig()

    @property
    def enabled(self) -> bool:
        return bool(str(self.config.api_key).strip())

    def chat(
        self,
        *,
        messages: list[dict[str, str]],
        max_tokens: int = 800,
        temperature: float | None = None,
    ) -> str:
        if not self.enabled:
            raise RuntimeError(
                "LLM client is not configured. Set IMPERIUM_LLM_API_KEY or OPENAI_API_KEY."
            )
        if requests is None:
            raise RuntimeError("The optional 'requests' package is required for LLM calls.")

        url = self.config.chat_completions_url
        if not url:
            url = self.config.base_url.rstrip("/") + "/chat/completions"

        headers = {
            "Content-Type": "application/json",
            str(self.config.api_key_header): f"{self.config.api_key_prefix}{self.config.api_key}",
        }

        payload: dict[str, Any] = {
            "model": self.config.model,
            "messages": messages,
            "temperature": self.config.temperature if temperature is None else temperature,
            "max_tokens": max_tokens,
        }

        response = requests.post(url, headers=headers, json=payload, timeout=self.config.timeout_seconds)
        response.raise_for_status()

        data = response.json()
        choices = data.get("choices") or []
        if not choices:
            raise RuntimeError("LLM response missing choices")

        message = choices[0].get("message") or {}
        content = message.get("content")
        if not isinstance(content, str) or not content.strip():
            raise RuntimeError("LLM response missing content")

        return content.strip()

    def chat_json(
        self,
        *,
        messages: list[dict[str, str]],
        max_tokens: int = 900,
        temperature: float | None = None,
    ) -> dict[str, Any]:
        text = self.chat(messages=messages, max_tokens=max_tokens, temperature=temperature)
        candidate = _extract_json_object(text)
        return json.loads(candidate)


def _extract_json_object(text: str) -> str:
    cleaned = text.strip()

    if cleaned.startswith("```"):
        lines = [line for line in cleaned.splitlines() if not line.strip().startswith("```")]
        cleaned = "\n".join(lines).strip()

    try:
        json.loads(cleaned)
        return cleaned
    except Exception:
        pass

    for start in [idx for idx, ch in enumerate(cleaned) if ch == "{"]:
        depth = 0
        in_string = False
        escape = False
        for end in range(start, len(cleaned)):
            ch = cleaned[end]
            if in_string:
                if escape:
                    escape = False
                elif ch == "\\":
                    escape = True
                elif ch == '"':
                    in_string = False
                continue

            if ch == '"':
                in_string = True
                continue

            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    candidate = cleaned[start : end + 1]
                    try:
                        json.loads(candidate)
                        return candidate
                    except Exception:
                        break

    raise ValueError("Unable to extract JSON object from LLM response")

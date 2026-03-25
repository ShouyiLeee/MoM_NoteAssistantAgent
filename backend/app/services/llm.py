"""
LLM service — single entry point for all Gemini calls.
All agents must call this service; never call the Gemini SDK directly.
"""

import json
from google import genai
from google.genai import types
from app.config import settings


class GeminiLLM:
    def __init__(self):
        self.client = genai.Client(api_key=settings.GEMINI_API_KEY)
        self.model = settings.LLM_MODEL

    async def generate(self, prompt: str, system: str | None = None) -> str:
        """Generate a plain-text response."""
        text = prompt
        if system:
            text = f"{system}\n\n{prompt}"

        response = await self.client.aio.models.generate_content(
            model=self.model,
            contents=[types.Content(role="user", parts=[types.Part(text=text)])],
        )
        result = response.text
        if result is None:
            raise ValueError("LLM returned empty response (possibly blocked by safety filters)")
        return result

    async def generate_json(self, prompt: str, system: str | None = None, max_retries: int = 2) -> dict:
        """Generate a response and parse it as JSON.
        Strips markdown code fences if present.
        Retries up to max_retries times on parse failure.
        """
        json_prompt = f"{prompt}\n\nRespond ONLY with valid JSON. No markdown, no explanation."
        last_error: Exception | None = None
        raw = ""
        for attempt in range(max_retries):
            try:
                raw = await self.generate(json_prompt, system)
                return _parse_json(raw)
            except json.JSONDecodeError as e:
                last_error = e
                json_prompt = (
                    f"{prompt}\n\n"
                    "Your previous response was not valid JSON. "
                    "Respond ONLY with valid JSON. No markdown, no explanation."
                )
            except Exception:
                raise  # Non-JSON errors should propagate immediately
        raise ValueError(
            f"LLM returned invalid JSON after {max_retries} attempts. "
            f"Last response: {raw[:300]}..."
        ) from last_error


def _parse_json(text: str) -> dict:
    text = text.strip()
    # Strip ```json ... ``` or ``` ... ```
    if text.startswith("```"):
        lines = text.splitlines()
        # Remove first and last fence lines
        inner = lines[1:-1] if lines[-1].strip() == "```" else lines[1:]
        text = "\n".join(inner).strip()
    return json.loads(text)


# Singleton used throughout the app
llm = GeminiLLM()

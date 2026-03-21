"""
LLM Tools — wraps all Gemini LLM operations as registered tools.
"""

from app.tools.registry import registry
from app.services.llm import llm


@registry.register(
    name="generate_text",
    description="Generate a plain-text response using Gemini LLM.",
    parameters={
        "prompt": {"type": "str", "required": True, "description": "The prompt to send"},
        "system": {"type": "str", "required": False, "description": "System instruction"},
    },
    category="llm",
)
async def generate_text(prompt: str, system: str | None = None) -> str:
    """Generate plain text via LLM."""
    return await llm.generate(prompt=prompt, system=system)


@registry.register(
    name="generate_json",
    description="Generate a JSON response from LLM. Auto-strips markdown fences and retries on parse failure.",
    parameters={
        "prompt": {"type": "str", "required": True, "description": "The prompt to send"},
        "system": {"type": "str", "required": False, "description": "System instruction"},
    },
    category="llm",
)
async def generate_json(prompt: str, system: str | None = None) -> dict:
    """Generate structured JSON via LLM with retry handling."""
    return await llm.generate_json(prompt=prompt, system=system)

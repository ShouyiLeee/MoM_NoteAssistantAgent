"""
Tool Registry — central registry for all MCP-style tools.

Each tool is a callable async function with:
- A name (unique identifier)
- A description (for LLM/agent discovery)
- A JSON schema for parameters
- An execute function

Agents call tools via `registry.execute(tool_name, **params)` instead
of importing services directly. This creates a clean boundary between
agent logic and service implementation.
"""

import inspect
from dataclasses import dataclass, field
from typing import Any, Callable, Awaitable


@dataclass
class ToolDefinition:
    """Metadata + callable for a single registered tool."""
    name: str
    description: str
    parameters: dict[str, Any]   # JSON-schema-like parameter spec
    fn: Callable[..., Awaitable[Any]]
    category: str = "general"


class ToolRegistry:
    """
    Central registry of all available tools.

    Usage:
        registry = ToolRegistry()

        @registry.register(
            name="generate_text",
            description="Generate text via LLM",
            parameters={"prompt": {"type": "str", "required": True}},
            category="llm",
        )
        async def generate_text(prompt: str, system: str | None = None) -> str:
            ...

        result = await registry.execute("generate_text", prompt="Hello")
    """

    def __init__(self):
        self._tools: dict[str, ToolDefinition] = {}

    def register(
        self,
        name: str,
        description: str,
        parameters: dict[str, Any],
        category: str = "general",
    ):
        """Decorator to register an async function as a tool."""
        def decorator(fn: Callable[..., Awaitable[Any]]):
            self._tools[name] = ToolDefinition(
                name=name,
                description=description,
                parameters=parameters,
                fn=fn,
                category=category,
            )
            return fn
        return decorator

    async def execute(self, tool_name: str, **kwargs) -> Any:
        """Execute a tool by name with keyword arguments."""
        if tool_name not in self._tools:
            available = ", ".join(sorted(self._tools.keys()))
            raise KeyError(
                f"Tool '{tool_name}' not found. Available: {available}"
            )
        tool = self._tools[tool_name]
        return await tool.fn(**kwargs)

    def get_tool(self, name: str) -> ToolDefinition | None:
        return self._tools.get(name)

    def list_tools(self, category: str | None = None) -> list[ToolDefinition]:
        """List all tools, optionally filtered by category."""
        tools = list(self._tools.values())
        if category:
            tools = [t for t in tools if t.category == category]
        return tools

    def get_tool_schemas(self, category: str | None = None) -> list[dict]:
        """Return JSON schemas for tools (useful for LLM function-calling)."""
        return [
            {
                "name": t.name,
                "description": t.description,
                "parameters": t.parameters,
                "category": t.category,
            }
            for t in self.list_tools(category)
        ]


# ── Singleton registry ────────────────────────────────────────────────────────
registry = ToolRegistry()

"""
MCP Tools Package — central tool registry and all tool definitions.

Import this package to ensure all tools are registered with the registry.

Usage:
    from app.tools import registry

    result = await registry.execute("generate_text", prompt="Hello")
    tools = registry.list_tools(category="llm")
"""

from app.tools.registry import registry  # noqa: F401

# Import all tool modules to trigger registration
import app.tools.llm_tools        # noqa: F401
import app.tools.embedding_tools  # noqa: F401
import app.tools.rag_tools        # noqa: F401
import app.tools.db_tools         # noqa: F401

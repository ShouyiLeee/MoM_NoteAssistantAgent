from typing import TypedDict, Annotated, Literal
from langchain_core.messages import BaseMessage
import operator


class AgentState(TypedDict):
    """Shared state passed between all agents in the LangGraph graph."""

    # Conversation history (appended by each node)
    messages: Annotated[list[BaseMessage], operator.add]

    # Identity
    user_id: str

    # Routing
    intent: Literal["note", "analysis", "simulation", "memory", "unknown"]

    # Raw user input or uploaded content
    raw_input: str

    # Note Agent output
    interview_data: dict | None

    # Analysis Agent: retrieved RAG context
    retrieved_context: list[str]

    # Final response to be returned to the API caller
    response: str

    # Optional: collection scoping
    collection_id: str | None

    # Simulation Agent session state
    mock_session: dict | None

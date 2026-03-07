"""
LangGraph Orchestrator — the main entry point for all user requests.

Graph flow:
    START → orchestrator → [note_agent | analysis_agent | simulation_agent | memory_agent] → END

The orchestrator classifies user intent and routes to the correct agent.
If intent is pre-set in the state (e.g. by API routes), it skips classification.
"""

from langgraph.graph import StateGraph, START, END
from langchain_core.messages import HumanMessage

from app.agents.state import AgentState
from app.agents.note_agent import note_agent_node
from app.agents.memory_agent import memory_agent_node
from app.agents.analysis_agent import analysis_agent_node
from app.agents.simulation_agent import simulation_agent_node
from app.services.llm import llm

INTENT_SYSTEM = """You are an intent classifier for an Interview Intelligence AI system.

Classify the user message into EXACTLY one of these intents:
- note       : User wants to record, upload, or save interview notes/experience
- analysis   : User wants to analyze performance, understand weaknesses, or get insights
- simulation : User wants to practice with a mock interview or generate interview questions
- memory     : User wants to retrieve or browse their interview history

Rules:
- Respond with ONLY the intent word (lowercase, no punctuation)
- When in doubt, default to "analysis"
"""


async def orchestrator_node(state: AgentState) -> dict:
    """Classify intent if not already set, then pass state through."""
    # Respect pre-set intent from API callers
    current_intent = state.get("intent", "unknown")
    if current_intent and current_intent != "unknown":
        return {"intent": current_intent}

    user_message = state["raw_input"]
    intent_raw = await llm.generate(
        prompt=f'User message: "{user_message}"',
        system=INTENT_SYSTEM,
    )
    intent = intent_raw.strip().lower().split()[0]  # take first word only

    valid_intents = {"note", "analysis", "simulation", "memory"}
    if intent not in valid_intents:
        intent = "analysis"

    return {
        "intent": intent,
        "messages": [HumanMessage(content=user_message)],
    }


def route_by_intent(state: AgentState) -> str:
    """Conditional edge: map intent to the target node name."""
    routing = {
        "note": "note_agent",
        "analysis": "analysis_agent",
        "simulation": "simulation_agent",
        "memory": "memory_agent",
    }
    return routing.get(state.get("intent", "analysis"), "analysis_agent")


def build_graph():
    """Build and compile the LangGraph multi-agent graph."""
    graph = StateGraph(AgentState)

    # Register nodes
    graph.add_node("orchestrator", orchestrator_node)
    graph.add_node("note_agent", note_agent_node)
    graph.add_node("analysis_agent", analysis_agent_node)
    graph.add_node("simulation_agent", simulation_agent_node)
    graph.add_node("memory_agent", memory_agent_node)

    # Entry point
    graph.add_edge(START, "orchestrator")

    # Conditional routing from orchestrator
    graph.add_conditional_edges(
        "orchestrator",
        route_by_intent,
        {
            "note_agent": "note_agent",
            "analysis_agent": "analysis_agent",
            "simulation_agent": "simulation_agent",
            "memory_agent": "memory_agent",
        },
    )

    # All agents exit to END
    graph.add_edge("note_agent", END)
    graph.add_edge("analysis_agent", END)
    graph.add_edge("simulation_agent", END)
    graph.add_edge("memory_agent", END)

    return graph.compile()


# Compiled graph — import and call .ainvoke(state) in API routes
interview_graph = build_graph()

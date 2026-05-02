from __future__ import annotations
from datetime import datetime
from typing import Literal, Any
from pydantic import BaseModel, Field


# ── Status types ──────────────────────────────────────────────────────────────

TodoStatusLiteral = Literal["pending", "running", "needs_user", "done", "failed"]
TripStatusLiteral = Literal["planning", "confirmed"]
ConversationPhaseLiteral = Literal[
    "discovery", "trip_shape", "hotels", "flights", "activities", "confirmed"
]
AgentTaskStatusLiteral = Literal["running", "done", "failed"]
AgentTypeLiteral = Literal["hotel", "flight", "itinerary"]
TravelPlanItemType = Literal["hotel", "flight", "restaurant", "activity", "transport"]

# ── Todo ──────────────────────────────────────────────────────────────────────

class TodoModel(BaseModel):
    id: str = Field(alias="_id")
    trip_id: str
    user_id: str
    text: str
    agent: Literal["FlightAgent", "StayAgent", "ItineraryAgent"]
    status: TodoStatusLiteral = "pending"
    sub_status: str | None = None
    memory_facts_used: list[str] = []
    result: dict[str, Any] | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


# ── Agent Task (live background agents) ──────────────────────────────────────

class AgentTaskResult(BaseModel):
    name: str
    description: str = ""
    price: str = ""
    image_url: str = ""
    booking_url: str = ""
    details: dict[str, Any] = {}
    found_at: datetime = Field(default_factory=datetime.utcnow)


class AgentTaskModel(BaseModel):
    id: str = Field(alias="_id")
    trip_id: str
    agent_type: AgentTypeLiteral
    status: AgentTaskStatusLiteral = "running"
    query: str = ""
    results: list[dict[str, Any]] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


# ── Travel Plan Item ─────────────────────────────────────────────────────────

class TravelPlanItemModel(BaseModel):
    id: str = Field(alias="_id")
    trip_id: str
    item_type: TravelPlanItemType
    name: str
    details: dict[str, Any] = {}
    booking_url: str = ""
    status: Literal["planned", "booked"] = "planned"
    day: str | None = None
    time_slot: Literal["morning", "afternoon", "evening", "dinner"] | None = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


# ── Message ───────────────────────────────────────────────────────────────────

class MessageModel(BaseModel):
    id: str = Field(alias="_id")
    trip_id: str
    user_id: str
    role: Literal["user", "assistant"]
    content: str
    ts: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


# ── Trip ──────────────────────────────────────────────────────────────────────

class TripDates(BaseModel):
    start: str
    end: str


class TripDocument(BaseModel):
    title: str
    category: Literal["visa", "insurance", "confirmation", "checklist", "note"]
    summary: str
    source: Literal["agent", "user"] = "agent"
    created_at: datetime = Field(default_factory=datetime.utcnow)


class TripModel(BaseModel):
    id: str = Field(alias="_id")
    user_id: str
    destination: str
    dates: TripDates
    status: TripStatusLiteral = "planning"
    conversation_phase: ConversationPhaseLiteral = "discovery"
    flights: list[dict[str, Any]] = []
    stays: list[dict[str, Any]] = []
    itinerary: list[dict[str, Any]] = []
    trip_documents: list[TripDocument] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True


# ── API request / response bodies ─────────────────────────────────────────────

class SendMessageRequest(BaseModel):
    user_id: str = "alex"
    text: str


class SendMessageResponse(BaseModel):
    reply: str
    todos: list[TodoModel] = []
    phase: ConversationPhaseLiteral = "discovery"
    suggestions: list[dict[str, Any]] | None = None
    deploy_agents: list[dict[str, Any]] | None = None


class DeployAgentRequest(BaseModel):
    agent_type: AgentTypeLiteral
    query: str


class AddTravelPlanRequest(BaseModel):
    item_type: TravelPlanItemType
    name: str
    details: dict[str, Any] = {}
    booking_url: str = ""
    source_task_id: str | None = None
    day: str | None = None
    time_slot: Literal["morning", "afternoon", "evening", "dinner"] | None = None


class ConfirmTodoRequest(BaseModel):
    booking_ref: str | None = None


class ConfirmTodoResponse(BaseModel):
    todo: TodoModel


# ── Planner structured output ─────────────────────────────────────────────────

class PlannerTodo(BaseModel):
    text: str = Field(description="Short description of what this agent should do")
    agent: Literal["FlightAgent", "StayAgent", "ItineraryAgent"] = Field(
        description="Which specialist agent handles this todo"
    )


class DeployAgentSpec(BaseModel):
    agent_type: AgentTypeLiteral = Field(description="Type of agent to deploy")
    query: str = Field(description="What the agent should search for")


class PlannerOutput(BaseModel):
    chat_reply: str = Field(
        description="Warm, brief message for the user. always entirely lowercase."
    )
    phase: ConversationPhaseLiteral = Field(
        description="Current conversation phase after this reply"
    )
    suggestions: list[dict[str, Any]] | None = Field(
        default=None,
        description="Structured suggestions (destinations/hotels/flights/restaurants) to show the user",
    )
    deploy_agents: list[DeployAgentSpec] | None = Field(
        default=None,
        description="Agents to deploy as background tasks. Only when user confirms preferences.",
    )
    todos: list[PlannerTodo] = Field(
        default_factory=list,
        description="Legacy specialist tasks — only in confirmed phase",
    )


# ── Retrieval pack ─────────────────────────────────────────────────────────────

class RetrievalPack(BaseModel):
    memory_context: list[str] = []
    trip_context: dict[str, Any] = {}
    recent_messages: list[dict[str, Any]] = []
    corpus_hints: dict[str, Any] = {}
    corpus_data: dict[str, Any] = Field(
        default_factory=dict,
        description="Actual JSON corpus data loaded for the planner",
    )
    is_on_trip: bool = False
    today_itinerary: list[dict[str, Any]] = []

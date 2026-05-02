from typing import TypedDict, NotRequired, Any


class ViaState(TypedDict):
    user_id: str
    trip_id: str
    user_message: str
    messages: list[dict[str, Any]]
    retrieval: dict[str, Any]
    memory_context: list[str]
    todos: list[dict[str, Any]]
    specialist_results: dict[str, Any]
    chat_reply: str

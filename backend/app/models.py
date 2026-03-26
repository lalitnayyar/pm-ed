from pydantic import BaseModel, Field


class Card(BaseModel):
    id: str
    title: str
    details: str


class Column(BaseModel):
    id: str
    title: str
    cardIds: list[str]


class BoardData(BaseModel):
    columns: list[Column]
    cards: dict[str, Card]


class BoardResponse(BaseModel):
    username: str
    board: BoardData
    updated_at: str


class BoardUpdateRequest(BaseModel):
    board: BoardData


class AiPingRequest(BaseModel):
    prompt: str = Field(default="What is 2+2?")


class AiPingResponse(BaseModel):
    model: str
    answer: str


class AiKanbanResponse(BaseModel):
    schemaVersion: str = Field(default="1.0")
    reply: str
    boardUpdate: BoardData | None = None


class AiChatRequest(BaseModel):
    username: str = "user"
    prompt: str
    conversationHistory: list[dict[str, str]] = Field(default_factory=list)


class AiChatResponse(BaseModel):
    username: str
    reply: str
    boardUpdate: BoardData | None = None
    updated_at: str | None = None

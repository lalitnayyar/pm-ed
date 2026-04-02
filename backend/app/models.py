from typing import Literal

from pydantic import BaseModel, Field, model_validator


class Card(BaseModel):
    id: str
    title: str
    details: str
    priority: Literal["low", "medium", "high"] | None = None
    due_date: str | None = None  # ISO date string YYYY-MM-DD
    labels: list[str] = Field(default_factory=list)


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

    @model_validator(mode="after")
    def validate_board_content(self) -> "BoardUpdateRequest":
        if not self.board.columns:
            raise ValueError("Board must have at least one column")
        for col in self.board.columns:
            if not col.title or not col.title.strip():
                raise ValueError("Column title cannot be empty")
            if len(col.title) > 100:
                raise ValueError("Column title exceeds 100 characters")
        for card in self.board.cards.values():
            if not card.title or not card.title.strip():
                raise ValueError("Card title cannot be empty")
            if len(card.title) > 200:
                raise ValueError("Card title exceeds 200 characters")
            if not card.details or not card.details.strip():
                raise ValueError("Card details cannot be empty")
            if len(card.details) > 2000:
                raise ValueError("Card details exceeds 2000 characters")
        return self


# ── Auth models ──────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    username: str = Field(min_length=2, max_length=50)
    password: str = Field(min_length=6, max_length=128)
    email: str | None = Field(default=None, max_length=255)


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str | None
    created_at: str


class AuthResponse(BaseModel):
    token: str
    user: UserResponse


# ── Multi-board models ────────────────────────────────────────────────────────

class BoardInfo(BaseModel):
    id: int
    name: str
    description: str
    created_at: str
    updated_at: str


class BoardListResponse(BaseModel):
    boards: list[BoardInfo]


class BoardDetailResponse(BaseModel):
    id: int
    name: str
    description: str
    board: BoardData
    updated_at: str


class CreateBoardRequest(BaseModel):
    name: str = Field(default="My Board", min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)


class UpdateBoardMetaRequest(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)


class UpdateBoardRequest(BaseModel):
    board: BoardData

    @model_validator(mode="after")
    def validate_board_content(self) -> "UpdateBoardRequest":
        if not self.board.columns:
            raise ValueError("Board must have at least one column")
        for col in self.board.columns:
            if not col.title or not col.title.strip():
                raise ValueError("Column title cannot be empty")
            if len(col.title) > 100:
                raise ValueError("Column title exceeds 100 characters")
        for card in self.board.cards.values():
            if not card.title or not card.title.strip():
                raise ValueError("Card title cannot be empty")
            if len(card.title) > 200:
                raise ValueError("Card title exceeds 200 characters")
            if not card.details or not card.details.strip():
                raise ValueError("Card details cannot be empty")
            if len(card.details) > 2000:
                raise ValueError("Card details exceeds 2000 characters")
        return self


# ── AI models ─────────────────────────────────────────────────────────────────

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
    boardId: int | None = None


class AiChatResponse(BaseModel):
    username: str
    reply: str
    boardUpdate: BoardData | None = None
    updated_at: str | None = None

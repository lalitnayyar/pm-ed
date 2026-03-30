from pydantic import BaseModel, Field, model_validator


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
            if len(card.details) > 1000:
                raise ValueError("Card details exceeds 1000 characters")
        return self


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

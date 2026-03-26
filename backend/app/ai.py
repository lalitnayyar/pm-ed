import json
import os

import httpx

from app.ai_validation import validate_ai_response, validate_board_update, AiResponseValidationError
from app.models import AiKanbanResponse, BoardData


OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
MODEL_NAME = "openai/gpt-oss-120b"


def ask_openrouter(prompt: str) -> str:
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not set")

    payload = {
        "model": MODEL_NAME,
        "messages": [{"role": "user", "content": prompt}],
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    with httpx.Client(timeout=30.0) as client:
        response = client.post(OPENROUTER_URL, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

    choices = data.get("choices", [])
    if not choices:
        raise RuntimeError("OpenRouter returned no choices")

    message_content = choices[0].get("message", {}).get("content")
    if isinstance(message_content, str):
        return message_content.strip()

    if isinstance(message_content, list):
        parts: list[str] = []
        for item in message_content:
            if isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
        combined = "\n".join(parts).strip()
        if combined:
            return combined

    raise RuntimeError("OpenRouter returned an unsupported response format")


def ask_openrouter_kanban(
    prompt: str,
    current_board: BoardData,
    conversation_history: list[dict[str, str]] | None = None,
) -> AiKanbanResponse:
    """
    Request kanban-aware AI response with structured output.
    
    Args:
        prompt: User's message
        current_board: Current board state to send to AI
        conversation_history: Previous messages for context
        
    Returns:
        AiKanbanResponse with validated reply and optional boardUpdate
        
    Raises:
        RuntimeError: If API key missing or request fails
        AiResponseValidationError: If response doesn't match schema
    """
    api_key = os.getenv("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not set")
    
    if conversation_history is None:
        conversation_history = []
    
    # Build messages with conversation history
    messages = []
    
    # Add system message
    messages.append({
        "role": "system",
        "content": (
            "You are a helpful Kanban board assistant. You help users manage tasks and organize their work. "
            "When the user asks you to modify the board, suggest updates as part of your response. "
            "Always respond in this JSON format:\n"
            "{\n"
            '  "schemaVersion": "1.0",\n'
            '  "reply": "Your message to the user",\n'
            '  "boardUpdate": null\n'
            "}\n"
            "Or if suggesting board changes:\n"
            "{\n"
            '  "schemaVersion": "1.0",\n'
            '  "reply": "Explanation of changes",\n'
            '  "boardUpdate": { "columns": [...], "cards": {...} }\n'
            "}\n"
            "The boardUpdate field should contain the complete updated board state if you're making changes.\n"
            "Only include boardUpdate if you're actually changing the board."
        )
    })
    
    # Add conversation history
    for msg in conversation_history[-10:]:  # Last 10 messages max for context
        messages.append(msg)
    
    # Add current board state as context
    messages.append({
        "role": "user",
        "content": (
            f"Current board state:\n{json.dumps(current_board.model_dump(), indent=2)}\n\n"
            f"User message: {prompt}"
        )
    })
    
    payload = {
        "model": MODEL_NAME,
        "messages": messages,
        "temperature": 0.7,
    }
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    
    with httpx.Client(timeout=30.0) as client:
        response = client.post(OPENROUTER_URL, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
    
    choices = data.get("choices", [])
    if not choices:
        raise RuntimeError("OpenRouter returned no choices")
    
    # Extract message content
    message = choices[0].get("message", {})
    message_content = message.get("content")
    
    if not isinstance(message_content, str):
        raise RuntimeError("OpenRouter returned non-string content")
    
    # Parse as JSON
    try:
        response_data = json.loads(message_content)
    except json.JSONDecodeError as e:
        raise RuntimeError(f"AI response is not valid JSON: {str(e)}")
    
    # Validate response format
    try:
        ai_response = validate_ai_response(response_data)
    except AiResponseValidationError as e:
        raise RuntimeError(f"AI response validation failed: {str(e)}")
    
    # Validate board update if present
    try:
        validate_board_update(ai_response.boardUpdate, current_board)
    except AiResponseValidationError as e:
        raise RuntimeError(f"Board update validation failed: {str(e)}")
    
    return ai_response

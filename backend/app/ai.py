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

    with httpx.Client(timeout=120.0) as client:
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
        "tool_choice": "none",   # prevent the model from emitting tool_calls (which sets content=None)
    }
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    
    with httpx.Client(timeout=120.0) as client:
        response = client.post(OPENROUTER_URL, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()

    choices = data.get("choices", [])
    if not choices:
        raise RuntimeError("OpenRouter returned no choices")
    
    # Extract message content (may be a string, a list of content parts, or None)
    message = choices[0].get("message", {})
    message_content = message.get("content")

    if isinstance(message_content, str):
        raw_text = message_content.strip()
    elif isinstance(message_content, list):
        parts: list[str] = []
        for item in message_content:
            if isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
        raw_text = "\n".join(parts).strip()
        if not raw_text:
            raise RuntimeError("OpenRouter returned an empty content list")
    elif message_content is None:
        # Some models return content=None when they emit tool_calls or refusals.
        # Check sibling fields before giving up.
        refusal = message.get("refusal")
        if isinstance(refusal, str) and refusal.strip():
            raise RuntimeError(f"AI refused the request: {refusal.strip()}")

        # Reasoning models (o1-style) may put text in a 'reasoning' field.
        reasoning = message.get("reasoning") or message.get("reasoning_content")
        if isinstance(reasoning, str) and reasoning.strip():
            raw_text = reasoning.strip()
        else:
            finish_reason = choices[0].get("finish_reason", "unknown")
            raise RuntimeError(
                f"AI returned no content (finish_reason={finish_reason!r}). "
                "Please try again or rephrase your request."
            )
    else:
        raise RuntimeError(
            f"OpenRouter returned unexpected content type: {type(message_content).__name__}"
        )

    # Strip markdown code fences (```json ... ``` or ``` ... ```)
    if raw_text.startswith("```"):
        lines = raw_text.splitlines()
        # drop first line (```json or ```) and last line (```)
        inner = lines[1:] if len(lines) > 1 else lines
        if inner and inner[-1].strip() == "```":
            inner = inner[:-1]
        raw_text = "\n".join(inner).strip()

    # Parse as JSON
    try:
        response_data = json.loads(raw_text)
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

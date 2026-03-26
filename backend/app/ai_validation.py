"""
Validation logic for AI structured responses.

This module ensures AI responses conform to the schema defined in docs/AI_SCHEMA.md
"""

from app.models import AiKanbanResponse, BoardData


class AiResponseValidationError(Exception):
    """Raised when AI response fails validation."""
    pass


def validate_ai_response(response_data: dict) -> AiKanbanResponse:
    """
    Validate and parse AI response against schema.
    
    Raises:
        AiResponseValidationError: If response doesn't match schema or validation rules fail
        
    Returns:
        AiKanbanResponse: Validated response object
    """
    # Check schema version
    schema_version = response_data.get("schemaVersion")
    if schema_version != "1.0":
        raise AiResponseValidationError(
            f"Invalid schemaVersion: expected '1.0', got '{schema_version}'"
        )
    
    # Check reply exists and is non-empty
    reply = response_data.get("reply")
    if not isinstance(reply, str) or len(reply.strip()) == 0:
        raise AiResponseValidationError("reply must be a non-empty string")
    
    if len(reply) > 2000:
        raise AiResponseValidationError("reply exceeds max length of 2000 characters")
    
    # Parse as Pydantic model (this validates structure)
    try:
        ai_response = AiKanbanResponse.model_validate(response_data)
    except Exception as e:
        raise AiResponseValidationError(f"Failed to parse response: {str(e)}")
    
    return ai_response


def validate_board_update(
    board_update: BoardData | None,
    current_board: BoardData
) -> None:
    """
    Validate board update against current board state.
    
    Ensures:
    - All column IDs match existing columns
    - No new columns are created
    - All cardIds reference existing or new cards
    - At least one column exists
    
    Raises:
        AiResponseValidationError: If validation fails
    """
    if board_update is None:
        return
    
    # At least one column required
    if not board_update.columns:
        raise AiResponseValidationError("boardUpdate must have at least one column")
    
    # Get existing column IDs
    existing_column_ids = {col.id for col in current_board.columns}
    updated_column_ids = {col.id for col in board_update.columns}
    
    # No new columns allowed
    new_columns = updated_column_ids - existing_column_ids
    if new_columns:
        raise AiResponseValidationError(
            f"Cannot create new columns. Invalid: {new_columns}"
        )
    
    # All updated cards must reference existing or new card IDs
    existing_card_ids = set(current_board.cards.keys())
    updated_card_ids = set(board_update.cards.keys())
    
    # Collect all card references in the updated board
    referenced_card_ids = set()
    for column in board_update.columns:
        referenced_card_ids.update(column.cardIds)
    
    # Referenced cards must exist in updated cards dict
    missing_cards = referenced_card_ids - updated_card_ids
    if missing_cards:
        raise AiResponseValidationError(
            f"cardIds reference non-existent cards: {missing_cards}"
        )
    
    # Validate individual card constraints
    for card_id, card in board_update.cards.items():
        if not card.title or len(card.title.strip()) == 0:
            raise AiResponseValidationError(f"Card {card_id} has empty title")
        
        if len(card.title) > 200:
            raise AiResponseValidationError(
                f"Card {card_id} title exceeds 200 characters"
            )
        
        if not card.details or len(card.details.strip()) == 0:
            raise AiResponseValidationError(f"Card {card_id} has empty details")
        
        if len(card.details) > 1000:
            raise AiResponseValidationError(
                f"Card {card_id} details exceed 1000 characters"
            )
    
    # Validate column constraints
    for column in board_update.columns:
        if not column.title or len(column.title.strip()) == 0:
            raise AiResponseValidationError(f"Column {column.id} has empty title")
        
        if len(column.title) > 100:
            raise AiResponseValidationError(
                f"Column {column.id} title exceeds 100 characters"
            )

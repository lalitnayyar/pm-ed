# AI Structured Output Schema (Part 9)

## Overview

This schema defines the strict contract between the backend and OpenRouter AI for Kanban-aware responses. The AI returns both a chat reply (required) and optional board updates (optional).

## Schema Version

- Version: `1.0`
- Last Updated: 2026-03-26

## Structured Output Format

The AI response is a JSON object with the following structure:

```json
{
  "schemaVersion": "1.0",
  "reply": "Chat message to display to the user",
  "boardUpdate": {
    "columns": [
      { "id": "col-id", "title": "Updated Title", "cardIds": ["card-1"] }
    ],
    "cards": {
      "card-1": {
        "id": "card-1",
        "title": "Card Title",
        "details": "Card Details"
      }
    }
  }
}
```

## Field Definitions

### Top Level

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schemaVersion` | string | Yes | Schema version (must be "1.0") |
| `reply` | string | Yes | Chat message to display to user. Non-empty, max 2000 chars. |
| `boardUpdate` | object | No | Optional board mutations. Omit if no changes needed. |

### boardUpdate (when present)

Must match the exact structure of BoardData:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `columns` | array | Yes | Array of Column objects. Must preserve all column IDs. |
| `cards` | object | Yes | Map of card ID to Card object. Invalid card IDs in cardIds will be rejected. |

### Column in boardUpdate.columns

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Column ID. Must match existing column IDs. |
| `title` | string | Yes | Column title. Non-empty, max 100 chars. Optional rename allowed. |
| `cardIds` | array | Yes | Array of card IDs in this column. Order matters. May be empty. |

### Card in boardUpdate.cards

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | string | Yes | Card ID. Must be unique within cards object. |
| `title` | string | Yes | Card title. Non-empty, max 200 chars. |
| `details` | string | Yes | Card details. Non-empty, max 1000 chars. |

## Validation Rules

1. **schemaVersion must be "1.0"**: Exact string match.
2. **reply must be non-empty string**: Length > 0 and <= 2000 characters.
3. **boardUpdate is optional**: If omitted, no board changes applied.
4. **When boardUpdate is present**:
   - All column IDs must match existing board columns
   - No new columns can be created
   - All cardIds must reference existing cards
   - Cards object can only reference existing or new cards
   - At least one column must exist
5. **No schema violations result in rejection**: If validation fails, return error to user without applying any changes.

## Request Context (sent to AI)

The backend sends this context to OpenRouter:

```json
{
  "systemPrompt": "You are a Kanban board assistant. Help users manage tasks. When appropriate, suggest board updates.",
  "currentBoard": {
    "columns": [...],
    "cards": {...}
  },
  "conversationHistory": [
    { "role": "user", "content": "previous messages..." },
    { "role": "assistant", "content": "previous responses..." }
  ],
  "userMessage": "What should I prioritize?"
}
```

The AI should consider the current board state when making suggestions.

## Example Responses

### Example 1: Chat reply only, no board changes

```json
{
  "schemaVersion": "1.0",
  "reply": "Based on your current board, I'd recommend focusing on the cards in Review first to unblock the team.",
  "boardUpdate": null
}
```

Or omit boardUpdate entirely:

```json
{
  "schemaVersion": "1.0",
  "reply": "Based on your current board, I'd recommend focusing on the cards in Review first to unblock the team."
}
```

### Example 2: Update card and move it

```json
{
  "schemaVersion": "1.0",
  "reply": "I've updated the card title for clarity and moved it to In Progress.",
  "boardUpdate": {
    "columns": [
      { "id": "col-backlog", "title": "Backlog", "cardIds": ["card-1"] },
      { "id": "col-discovery", "title": "Discovery", "cardIds": ["card-3"] },
      { "id": "col-progress", "title": "In Progress", "cardIds": ["card-4", "card-5", "card-2"] },
      { "id": "col-review", "title": "Review", "cardIds": ["card-6"] },
      { "id": "col-done", "title": "Done", "cardIds": ["card-7", "card-8"] }
    ],
    "cards": {
      "card-1": { "id": "card-1", "title": "Align roadmap themes", "details": "Draft quarterly themes with impact statements and metrics." },
      "card-2": { "id": "card-2", "title": "Review and prioritize customer signals", "details": "Check high-priority support tags and sales notes." },
      "card-3": { "id": "card-3", "title": "Prototype analytics view", "details": "Sketch initial dashboard layout and key drill-downs." },
      "card-4": { "id": "card-4", "title": "Refine status language", "details": "Standardize column labels and tone across the board." },
      "card-5": { "id": "card-5", "title": "Design card layout", "details": "Add hierarchy and spacing for scanning dense lists." },
      "card-6": { "id": "card-6", "title": "QA micro-interactions", "details": "Verify hover, focus, and loading states." },
      "card-7": { "id": "card-7", "title": "Ship marketing page", "details": "Final copy approved and asset pack delivered." },
      "card-8": { "id": "card-8", "title": "Close onboarding sprint", "details": "Document release notes and share internally." }
    }
  }
}
```

### Example 3: Create a new card

```json
{
  "schemaVersion": "1.0",
  "reply": "I've added a new task to your backlog for the urgent issue.",
  "boardUpdate": {
    "columns": [
      { "id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-2", "card-9"] },
      { "id": "col-discovery", "title": "Discovery", "cardIds": ["card-3"] },
      { "id": "col-progress", "title": "In Progress", "cardIds": ["card-4", "card-5"] },
      { "id": "col-review", "title": "Review", "cardIds": ["card-6"] },
      { "id": "col-done", "title": "Done", "cardIds": ["card-7", "card-8"] }
    ],
    "cards": {
      "card-1": { "id": "card-1", "title": "Align roadmap themes", "details": "Draft quarterly themes with impact statements and metrics." },
      "card-2": { "id": "card-2", "title": "Gather customer signals", "details": "Review support tags, sales notes, and churn feedback." },
      "card-3": { "id": "card-3", "title": "Prototype analytics view", "details": "Sketch initial dashboard layout and key drill-downs." },
      "card-4": { "id": "card-4", "title": "Refine status language", "details": "Standardize column labels and tone across the board." },
      "card-5": { "id": "card-5", "title": "Design card layout", "details": "Add hierarchy and spacing for scanning dense lists." },
      "card-6": { "id": "card-6", "title": "QA micro-interactions", "details": "Verify hover, focus, and loading states." },
      "card-7": { "id": "card-7", "title": "Ship marketing page", "details": "Final copy approved and asset pack delivered." },
      "card-8": { "id": "card-8", "title": "Close onboarding sprint", "details": "Document release notes and share internally." },
      "card-9": { "id": "card-9", "title": "Urgent: Fix auth bug in staging", "details": "Critical JWT validation issue blocking QA testing." }
    }
  }
}
```

## Error Handling

### Invalid Schema

If the AI response does not match this schema:
1. Log the full response for debugging
2. Return error to user: "AI response was malformed. Please try again."
3. Do NOT apply any partial updates
4. Do NOT persist invalid state

### Invalid boardUpdate

If boardUpdate is present but fails validation:
1. Log the validation error details
2. Return error to user: "AI suggested invalid board changes. Please try again."
3. Do NOT apply any partial updates

### Timeouts

If OpenRouter times out:
1. Return error to user: "AI request timed out. Please try again."
2. No board changes applied

## Backward Compatibility

- Clients must check `schemaVersion` field
- If version is not "1.0", reject and report to user
- Future versions will use new version numbers (e.g., "1.1", "2.0")

## Prompting Strategy

When sending requests to the AI, include:
1. Current board state (full JSON)
2. Conversation history (last 10 messages max)
3. Clear instructions to only modify existing entities or add new cards
4. Reminder to respond in this exact JSON format

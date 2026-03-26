# AI Schema Validation Checklist

Use this checklist to verify the structured output design meets MVP requirements before proceeding to Part 10.

## Requirements Coverage

### From AGENTS.md

| Requirement | Schema Design | Status |
|---|---|---|
| "AI is able to create / edit / move one or more cards" | ✓ Supports creating new cards (id generation), editing existing cards, moving cards between columns | **Verify** |
| "The Kanban board has fixed columns that can be renamed" | ✓ Schema supports column title updates but prevents creating/deleting columns | **Verify** |
| "AI chat feature in a sidebar" | ✓ Structured response includes reply text for display | **Verify** |
| Use `openai/gpt-oss-120b` as model | ✓ Prompting strategy designed for this model's capabilities | **Verify** |
| Keep it simple, no over-engineering | ✓ Schema is minimal (3 top-level fields), validation is straightforward | **Verify** |

## Design Validation Tests

### Test 1: Can AI Create Cards?

**Scenario:** User says "Add a task to backlog"

**Expected Response:**
```json
{
  "schemaVersion": "1.0",
  "reply": "I've added 'New task' to your backlog.",
  "boardUpdate": {
    "columns": [...with new cardId in cardIds...],
    "cards": {...existing cards, "card-9": {...new card object...}}
  }
}
```

**Pass Criteria:**
- [ ] New card ID format validated: Should follow `card-N` pattern
- [ ] New card added to cards dict
- [ ] Card ID added to correct column's cardIds array
- [ ] Board persists after update
- [ ] User sees reply in chat

**Question:** Does the schema allow arbitrary card IDs or should we enforce a pattern like `card-1`, `card-2`?

---

### Test 2: Can AI Edit Cards?

**Scenario:** User says "Update task 1 title to 'High Priority'"

**Expected Response:**
```json
{
  "schemaVersion": "1.0",
  "reply": "Updated task 1 title.",
  "boardUpdate": {
    "columns": [...same structure...],
    "cards": {...updated card-1 with new title, other cards unchanged...}
  }
}
```

**Pass Criteria:**
- [ ] Title updated
- [ ] Details preserved if not mentioned
- [ ] All other cards unchanged
- [ ] Column structure unchanged
- [ ] Board persists

---

### Test 3: Can AI Move Cards Between Columns?

**Scenario:** User says "Move task 3 to In Progress"

**Expected Response:**
```json
{
  "schemaVersion": "1.0",
  "reply": "Moved task 3 to In Progress.",
  "boardUpdate": {
    "columns": [
      {"id": "col-1", "title": "Backlog", "cardIds": ["card-1", "card-2"]},
      {"id": "col-2", "title": "In Progress", "cardIds": ["card-3"]}
    ],
    "cards": {...unchanged...}
  }
}
```

**Pass Criteria:**
- [ ] Card removed from source column's cardIds
- [ ] Card added to target column's cardIds
- [ ] Card details unchanged
- [ ] Column titles unchanged
- [ ] All columns still present

---

### Test 4: AI Should Not Create New Columns

**Scenario:** User says "Create a 'Blocked' column"

**Expected Response (should fail validation):**
```json
{
  "schemaVersion": "1.0",
  "reply": "I can't create new columns, but I can add a task...",
  "boardUpdate": null
}
```

**Pass Criteria:**
- [ ] API rejects attempt to create `col-blocked`
- [ ] User sees error: "AI suggested invalid board changes"
- [ ] Board remains unchanged
- [ ] No partial updates applied

---

### Test 5: AI Should Not Delete Columns

**Scenario:** AI returns response with fewer columns

**Expected Behavior:**
Should accept as long as all column IDs still exist (order/cardIds can change)

**Question:** Current implementation allows omitting columns. Should we require all columns always present?

---

### Test 6: AI Cannot Reference Non-Existent Cards

**Scenario:** AI moves `card-99` that doesn't exist

**Expected Response (should fail validation):**
```json
{
  "schemaVersion": "1.0",
  "reply": "Moved task to Done",
  "boardUpdate": {
    "columns": [
      {"id": "col-5", "title": "Done", "cardIds": ["card-99"]}
    ]
  }
}
```

**Pass Criteria:**
- [ ] Validation rejects: "cardIds reference non-existent cards: card-99"
- [ ] Board not updated
- [ ] User sees error
- [ ] User can retry

---

### Test 7: Reply Must Always Be Provided

**Scenario:** AI returns response without reply

**Expected Behavior:**
Should reject validation

**Pass Criteria:**
- [ ] Empty reply rejected
- [ ] Missing reply rejected
- [ ] User sees error
- [ ] Board unchanged

---

### Test 8: Board Update Is Optional

**Scenario:** User asks "What should I prioritize?"

**Expected Response:**
```json
{
  "schemaVersion": "1.0",
  "reply": "Based on your board, I'd recommend focusing on...",
  "boardUpdate": null
}
```

**Pass Criteria:**
- [ ] Response accepted
- [ ] Reply displayed
- [ ] Board unchanged
- [ ] No `updated_at` returned

---

### Test 9: Schema Version Mismatch

**Scenario:** AI returns version "2.0"

**Expected Behavior:**
Should reject

**Pass Criteria:**
- [ ] Validation rejects version "2.0"
- [ ] User sees error
- [ ] Board unchanged

---

### Test 10: Large/Complex Board Operations

**Scenario:** AI suggests moving 5 cards and editing 3 cards in one response

**Expected Behavior:**
Should work correctly with all cards in correct columns

**Pass Criteria:**
- [ ] All 5 moves valid
- [ ] All 3 edits valid
- [ ] Single atomic update (all-or-nothing)
- [ ] No partial state corruption

---

## Documentation Review

| Item | Status |
|---|---|
| Schema clearly documented in [docs/AI_SCHEMA.md](docs/AI_SCHEMA.md) | [ ] |
| Request/response examples are realistic and correct | [ ] |
| Validation rules enumerated and explained | [ ] |
| Error handling strategy documented | [ ] |
| Versioning strategy for future evolution documented | [ ] |
| Prompting strategy documented | [ ] |

---

## Implementation Review

| Item | Status |
|---|---|
| `AiKanbanResponse` Pydantic model matches schema | [ ] |
| `validate_ai_response()` enforces all rules | [ ] |
| `validate_board_update()` prevents invalid mutations | [ ] |
| `/api/ai/chat` endpoint correctly orchestrates validation | [ ] |
| Tests cover all validation scenarios | [ ] |
| Error messages are clear and actionable | [ ] |

---

## Questions to Consider Before Approval

1. **Card ID Format:** Should card IDs follow a specific pattern (e.g., `card-N`)? Or can AI generate arbitrary IDs?
   - Current: Accepts any ID (validates only if referenced)
   - Recommendation: Keep flexible - let AI generate IDs

2. **Board Update Atomicity:** If AI suggests invalid changes, should we:
   - Reject entire update (current behavior) ✓
   - Accept valid parts, reject invalid parts (risky)
   - Suggestion: Keep all-or-nothing

3. **Column Order:** Should column order be preserved if AI reorders them?
   - Current: Accepts new order if IDs match
   - Recommendation: Accept reordering (allows AI to prioritize columns)

4. **Idempotence:** If user sends identical AI request twice:
   - Should second request produce same or similar response?
   - Current: Depends on conversation history
   - Recommendation: OK - AI can vary responses contextually

5. **Conversation History Limit:** Currently keeps last 10 messages. Sufficient?
   - Pro: Prevents context bloat
   - Con: Loses distant context
   - Recommendation: Keep at 10 for MVP

6. **Card Creation Strategy:** How should new card IDs be generated?
   - Option A: AI generates any ID (current)
   - Option B: Backend generates IDs, AI doesn't control them
   - Option C: Hybrid - suggest, backend validates
   - Recommendation: Stick with Option A (simple)

---

## Approval Recommendation

**Check all passing boxes below before approving:**

- [ ] All 10 design validation tests understood and feasible
- [ ] Documentation is clear to future developers
- [ ] Implementation correctly enforces all rules
- [ ] Error messages guide users to recovery
- [ ] No identified conflicts with business requirements
- [ ] Schema supports expected AI interactions (create/edit/move cards)
- [ ] Versioning allows future evolution
- [ ] No unnecessary complexity added

**If all boxes are checked:** Ready to proceed to Part 10 (Sidebar UI)

**If concerns remain:** Document them below and discuss

---

## Sign-Off Notes

User Review Date: ___________

Notes on Design:

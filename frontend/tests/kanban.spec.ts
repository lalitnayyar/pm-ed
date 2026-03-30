import { expect, test, type Page } from "@playwright/test";

const signIn = async (page: Page) => {
  await page.getByLabel(/username/i).fill("user");
  await page.getByLabel(/password/i).fill("password");
  await page.getByRole("button", { name: /sign in/i }).click();
};

test("loads the kanban board", async ({ page }) => {
  await page.goto("/");
  await signIn(page);
  await expect(page.getByRole("heading", { name: "Kanban Studio" })).toBeVisible();
  await expect(page.locator('[data-testid^="column-"]')).toHaveCount(5);
});

test("adds a card to a column", async ({ page }) => {
  await page.goto("/");
  await signIn(page);
  const firstColumn = page.locator('[data-testid^="column-"]').first();
  await firstColumn.getByRole("button", { name: /add a card/i }).click();
  await firstColumn.getByPlaceholder("Card title").fill("Playwright card");
  await firstColumn.getByPlaceholder("Details").fill("Added via e2e.");
  await firstColumn.getByRole("button", { name: /add card/i }).click();
  await expect(firstColumn.getByText("Playwright card")).toBeVisible();
});

test("moves a card between columns", async ({ page }) => {
  await page.goto("/");
  await signIn(page);
  const card = page.getByTestId("card-card-1");
  const targetColumn = page.getByTestId("column-col-review");
  const cardBox = await card.boundingBox();
  const columnBox = await targetColumn.boundingBox();
  if (!cardBox || !columnBox) {
    throw new Error("Unable to resolve drag coordinates.");
  }

  await page.mouse.move(
    cardBox.x + cardBox.width / 2,
    cardBox.y + cardBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    columnBox.x + columnBox.width / 2,
    columnBox.y + 120,
    { steps: 12 }
  );
  await page.mouse.up();
  await expect(targetColumn.getByTestId("card-card-1")).toBeVisible();
});

test("AI chat sends a message and displays the reply", async ({ page }) => {
  // Mock the AI chat endpoint so the test doesn't need a real OpenRouter key
  await page.route("/api/ai/chat", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        username: "user",
        reply: "Here is my advice for your board.",
        boardUpdate: null,
        updated_at: null,
      }),
    });
  });

  await page.goto("/");
  await signIn(page);

  // Open the AI chat sidebar
  await page.getByRole("button", { name: /ai chat/i }).click();
  await expect(page.getByRole("heading", { name: /ai assistant/i })).toBeVisible();

  // Type and send a message
  await page.getByPlaceholder(/ask me to move/i).fill("How should I prioritize?");
  await page.getByRole("button", { name: /send/i }).click();

  // User message appears
  await expect(page.getByText("How should I prioritize?")).toBeVisible();

  // Assistant reply appears
  await expect(page.getByText("Here is my advice for your board.")).toBeVisible();
});

const MOCK_CARDS = {
  "card-1": { id: "card-1", title: "Align roadmap themes", details: "Draft quarterly themes." },
  "card-2": { id: "card-2", title: "Gather customer signals", details: "Review support tags." },
  "card-3": { id: "card-3", title: "Prototype analytics view", details: "Sketch layout." },
  "card-4": { id: "card-4", title: "Refine status language", details: "Standardize labels." },
  "card-5": { id: "card-5", title: "Design card layout", details: "Add spacing." },
  "card-6": { id: "card-6", title: "QA micro-interactions", details: "Verify hover states." },
  "card-7": { id: "card-7", title: "Ship marketing page", details: "Final copy approved." },
  "card-8": { id: "card-8", title: "Close onboarding sprint", details: "Document release notes." },
};

test("AI chat applies board update from assistant", async ({ page }) => {
  // Mock the AI endpoint to return a board update (rename first column)
  await page.route("/api/ai/chat", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        username: "user",
        reply: "I renamed Backlog to Sprint.",
        boardUpdate: {
          columns: [
            { id: "col-backlog", title: "Sprint", cardIds: ["card-1", "card-2"] },
            { id: "col-discovery", title: "Discovery", cardIds: ["card-3"] },
            { id: "col-progress", title: "In Progress", cardIds: ["card-4", "card-5"] },
            { id: "col-review", title: "Review", cardIds: ["card-6"] },
            { id: "col-done", title: "Done", cardIds: ["card-7", "card-8"] },
          ],
          cards: MOCK_CARDS,
        },
        updated_at: new Date().toISOString(),
      }),
    });
  });

  await page.goto("/");
  await signIn(page);
  await page.getByRole("button", { name: /ai chat/i }).click();
  await page.getByPlaceholder(/ask me to move/i).fill("Rename backlog to Sprint");
  await page.getByRole("button", { name: /send/i }).click();

  // Reply visible in chat
  await expect(page.getByText("I renamed Backlog to Sprint.")).toBeVisible();

  // Board column badge updated in the header (scoped to avoid matching chat messages)
  await expect(page.locator("header").getByText("Sprint", { exact: true })).toBeVisible();
});

test("logs out back to sign in", async ({ page }) => {
  await page.goto("/");
  await signIn(page);

  await page.getByRole("button", { name: /log out/i }).click();
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible();
});

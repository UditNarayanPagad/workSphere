import { expect, test } from "@playwright/test";

test("registers an account and manages a workspace task through the browser", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("tab", { name: "Create account" }).click();
  await page.getByLabel("Your name").fill("E2E Owner");
  await page.getByLabel("Email address").fill(`e2e-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("a-secure-e2e-password");
  await page.getByRole("button", { name: "Create account" }).last().click();

  await expect(page.getByRole("heading", { name: "Welcome back, E2E Owner." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
  await expect(page.getByText("TEAMWORK, IN ONE PLACE")).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "API connected" })).toBeVisible();

  await page.getByLabel("Create a workspace").fill("E2E Product Team");
  await page.getByRole("button", { name: "Create", exact: true }).click();
  await expect(page.getByText("E2E Product Team")).toBeVisible();
  await expect(page.getByRole("status").filter({ hasText: "Your workspace is ready." })).toBeVisible();

  const workspace = page.locator(".workspace-item").filter({ hasText: "E2E Product Team" });
  await workspace.getByRole("button", { name: "Open" }).click();
  await page.getByLabel("Create a project").fill("Launch site");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("combobox", { name: "Project" })).toHaveValue(/.+/);

  await page.locator("#task-title").fill("Prepare launch checklist");
  await page.locator("form").filter({ has: page.locator("#task-title") })
    .getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByText("Prepare launch checklist", { exact: true })).toBeVisible();

  await page.getByLabel("Move Prepare launch checklist").selectOption("in_progress");
  await expect(page.getByLabel("Move Prepare launch checklist")).toHaveValue("in_progress");

  await page.getByRole("button", { name: "Comments" }).click();
  await page.getByLabel("Add a comment").fill("Browser workflow verified.");
  await page.getByRole("button", { name: "Post", exact: true }).click();
  await expect(page.getByText("Browser workflow verified.")).toBeVisible();
});

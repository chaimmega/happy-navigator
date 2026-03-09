/**
 * 01 — Search form basics
 *
 * Tests that the search form renders correctly, mode switching works,
 * submit is gated on valid input, and swap/clear buttons function.
 */

import { test, expect } from "@playwright/test";
import { gotoHome, fillAddressForm } from "../helpers/mock";

test.describe("Search form", () => {
  test.beforeEach(async ({ page }) => {
    await gotoHome(page);
  });

  // ── Page load ──────────────────────────────────────────────────────────────

  test("page loads with correct heading", async ({ page }) => {
    await expect(page.getByRole("heading", { name: /Happy Navigator/i })).toBeVisible();
  });

  test("page has correct document title", async ({ page }) => {
    // Next.js sets the title from metadata; verify it contains the app name
    await expect(page).toHaveTitle(/Happy Navigator/i);
  });

  // ── Mode tabs ──────────────────────────────────────────────────────────────

  test("both mode tabs are visible", async ({ page }) => {
    await expect(page.getByTestId("tab-address")).toBeVisible();
    await expect(page.getByTestId("tab-url")).toBeVisible();
  });

  test("address mode is active by default", async ({ page }) => {
    await expect(page.getByTestId("input-start")).toBeVisible();
    await expect(page.getByTestId("input-end")).toBeVisible();
    await expect(page.getByTestId("input-url")).not.toBeVisible();
  });

  test("switching to URL mode shows URL input and hides address inputs", async ({ page }) => {
    await page.getByTestId("tab-url").click();
    await expect(page.getByTestId("input-url")).toBeVisible();
    // Address inputs should be hidden (not in DOM or hidden)
    await expect(page.getByTestId("input-start")).not.toBeVisible();
    await expect(page.getByTestId("input-end")).not.toBeVisible();
  });

  test("switching back to address mode restores address inputs", async ({ page }) => {
    await page.getByTestId("tab-url").click();
    await page.getByTestId("tab-address").click();
    await expect(page.getByTestId("input-start")).toBeVisible();
    await expect(page.getByTestId("input-end")).toBeVisible();
    await expect(page.getByTestId("input-url")).not.toBeVisible();
  });

  // ── Submit button state ────────────────────────────────────────────────────

  test("submit button is disabled when fields are empty", async ({ page }) => {
    const btn = page.getByTestId("btn-submit");
    await expect(btn).toBeDisabled();
  });

  test("submit button is disabled when only start field is filled", async ({ page }) => {
    await page.getByTestId("input-start").fill("Central Park");
    await expect(page.getByTestId("btn-submit")).toBeDisabled();
  });

  test("submit button is disabled when only end field is filled", async ({ page }) => {
    await page.getByTestId("input-end").fill("Brooklyn Bridge");
    await expect(page.getByTestId("btn-submit")).toBeDisabled();
  });

  test("submit button is enabled after filling both fields", async ({ page }) => {
    await fillAddressForm(page, "Central Park, New York", "Brooklyn Bridge, New York");
    await expect(page.getByTestId("btn-submit")).toBeEnabled();
  });

  test("submit button is enabled in URL mode after filling URL field", async ({ page }) => {
    await page.getByTestId("tab-url").click();
    await page.getByTestId("input-url").fill("https://www.google.com/maps/dir/Central+Park/Brooklyn+Bridge/");
    await expect(page.getByTestId("btn-submit")).toBeEnabled();
  });

  // ── Swap button ────────────────────────────────────────────────────────────

  test("swap button swaps start and end values", async ({ page }) => {
    await page.getByTestId("input-start").fill("Alpha");
    await page.getByTestId("input-end").fill("Beta");

    await page.getByTestId("btn-swap").click();

    await expect(page.getByTestId("input-start")).toHaveValue("Beta");
    await expect(page.getByTestId("input-end")).toHaveValue("Alpha");
  });

  // ── Clear buttons ──────────────────────────────────────────────────────────

  test("clear button on start input resets the field", async ({ page }) => {
    await page.getByTestId("input-start").fill("Central Park");
    // Clear button appears when field has text
    await page.getByTestId("btn-clear-start").click();
    await expect(page.getByTestId("input-start")).toHaveValue("");
  });

  test("clear button on end input resets the field", async ({ page }) => {
    await page.getByTestId("input-end").fill("Brooklyn Bridge");
    await page.getByTestId("btn-clear-end").click();
    await expect(page.getByTestId("input-end")).toHaveValue("");
  });
});

// QA driver: admin portal Offers CMS (Phase 5).
// Usage: node offers-admin-qa.cjs   (admin-portal on :3001, backend on :8000)
const { chromium } = require("C:/Users/Asus/node_modules/playwright");
const fs = require("fs");

const BASE = process.env.QA_ADMIN_BASE || "http://localhost:3001";
const OUT = __dirname + "/shots";
fs.mkdirSync(OUT, { recursive: true });

const EMAIL = "admin@waytero.dev";
const PASSWORD = process.env.QA_ADMIN_PASSWORD || "Admin@WayTero1";

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));

  // ── login ─
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("admin@waytero.dev  or  9000000001").fill(EMAIL);
  await page.getByPlaceholder("Your admin password").fill(PASSWORD);
  await page.keyboard.press("Enter");
  await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 15000 });
  console.log("logged in ->", page.url());

  // ── nav item present ──
  await page.goto(BASE + "/offers", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: /New Offer/i }).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(1500);
  // dismiss the pending-acceptance popup if it pops (unrelated app feature)
  const closeBtn = page.getByRole("button", { name: /^Close$/ });
  if (await closeBtn.isVisible().catch(() => false)) { await closeBtn.click(); await page.waitForTimeout(500); }
  const heading = await page.getByText("Offers", { exact: true }).first().isVisible().catch(() => false);
  console.log("offers page heading visible:", heading);
  await page.screenshot({ path: OUT + "/admin-offers-list.png" });

  // ── editor dialog ──
  await page.getByRole("button", { name: /New Offer/i }).first().click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + "/admin-offer-editor-cab.png" });

  // switch to HOTEL and check coupon autocomplete + hotel picker render
  await page.locator('[role="combobox"]').filter({ hasText: "CAB" }).first().click();
  await page.waitForTimeout(300);
  await page.getByRole("option", { name: "HOTEL", exact: true }).click();
  await page.waitForTimeout(1500);
  await page.getByRole("combobox", { name: /Coupon/i }).first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + "/admin-offer-editor-hotel-coupons.png" });
  const couponOptions = await page.getByRole("option").count();
  console.log("coupon options shown:", couponOptions);
  await page.keyboard.press("Escape");

  // add a hotel via the autocomplete
  await page.getByPlaceholder("Search active hotels").click();
  await page.waitForTimeout(1200);
  const hotelCount = await page.getByRole("option").count();
  console.log("hotel options shown:", hotelCount);
  if (hotelCount > 0) {
    await page.getByRole("option").first().click();
    await page.waitForTimeout(1500);
    await page.screenshot({ path: OUT + "/admin-offer-editor-hotel-added.png" });
  }
  await page.keyboard.press("Escape");

  console.log("console errors:", errors.length ? errors.slice(0, 5) : "none");
  await browser.close();
})().catch((e) => { console.error("QA FAILED:", e.message); process.exit(1); });

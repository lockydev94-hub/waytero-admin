// QA driver: offer badge on admin booking pages (Phase 5).
// Usage: node offers-bookings-qa.cjs  (admin-portal on :3001, backend on :8000)
const { chromium } = require("C:/Users/Asus/node_modules/playwright");
const fs = require("fs");

const BASE = process.env.QA_ADMIN_BASE || "http://localhost:3001";
const OUT = __dirname + "/shots";
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));

  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("admin@waytero.dev  or  9000000001").fill("admin@waytero.dev");
  await page.getByPlaceholder("Your admin password").fill(process.env.QA_ADMIN_PASSWORD || "Admin@WayTero1");
  await page.keyboard.press("Enter");
  await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 15000 });

  // hotel booking detail (master 64 / hb 42 — created by the Phase 3 ride-through QA)
  await page.goto(BASE + "/bookings/64/hotel/42", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(3500);
  // badge text lives inside the MUI Chip label node; getByText on the full
  // string misses because the icon shares the chip element
  const badge = await page.locator(".MuiChip-label", { hasText: "Offer: Smoke Grand Imperial Deluxe" }).count();
  console.log("hotel detail badge:", badge);
  await page.screenshot({ path: OUT + "/admin-hotel-detail-badge.png" });

  // bookings list row chip
  await page.goto(BASE + "/bookings", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder(/search/i).first().fill("HR-2026").catch(() => {});
  await page.waitForTimeout(2500);
  const closeBtn = page.getByRole("button", { name: /^Close$/ });
  if (await closeBtn.isVisible().catch(() => false)) { await closeBtn.click(); await page.waitForTimeout(400); }
  // MUI Tooltip title is not a DOM title attribute; assert on the chip label
  const listChips = await page.locator(".MuiChip-label", { hasText: /^Offer$/ }).count();
  console.log("list rows with offer chip:", listChips);
  await page.screenshot({ path: OUT + "/admin-bookings-list-badge.png" });

  console.log("pageerrors:", errors.length ? errors : "none");
  await browser.close();
})().catch((e) => { console.error("QA FAILED:", e.message); process.exit(1); });

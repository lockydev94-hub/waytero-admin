// QA driver: admin Coupon Management page.
// Setup: cd _qa && npm i playwright   (Chrome channel; admin portal on :3000,
//        backend on :8000)
// Usage: node coupons-qa.cjs
// Optional env: QA_USED_COUPON, QA_PARTNER_COUPON, QA_SPLIT_COUPON,
//               QA_BOOKING_ID, QA_CAB_ID for the settled booking detail check.
const { chromium } = require("playwright");
const fs = require("fs");

const BASE = process.env.QA_ADMIN_BASE || "http://localhost:3000";
const OUT = __dirname + "/shots";
fs.mkdirSync(OUT, { recursive: true });

const EMAIL = "admin@waytero.dev";
const PASSWORD = process.env.QA_ADMIN_PASSWORD || "Admin@WayTero1";
const USED_CODE = process.env.QA_USED_COUPON || "E2EP171543";
const PARTNER_CODE = process.env.QA_PARTNER_COUPON || "E2EO171543";
const SPLIT_CODE = process.env.QA_SPLIT_COUPON || "E2ES171543";
const NEW_CODE = "UI" + String(Date.now()).slice(-6);

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? " | " + detail : ""}`);
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));

  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("admin@waytero.dev  or  9000000001").fill(EMAIL);
  await page.getByPlaceholder("Your admin password").fill(PASSWORD);
  await page.keyboard.press("Enter");
  await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 15000 });

  await page.goto(BASE + "/coupons", { waitUntil: "domcontentloaded" });
  await page.getByText("Coupon Management", { exact: true }).waitFor({ timeout: 30000 });
  // The pending-acceptance popup opens a moment after the page and would sit
  // over the table, intercepting every click.
  await page.waitForTimeout(2500);
  const closeBtn = page.getByRole("button", { name: /^Close$/ });
  if (await closeBtn.isVisible().catch(() => false)) { await closeBtn.click(); await page.waitForTimeout(600); }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: OUT + "/coupons-list.png" });

  check("coupon page renders", true);

  const search = page.getByPlaceholder("Search code or title…");
  await search.fill(USED_CODE);
  await page.waitForTimeout(800);
  const usedRow = page.locator("tbody tr").filter({ hasText: USED_CODE }).first();
  check("used coupon appears in list", await usedRow.isVisible(), USED_CODE);
  const usedText = await usedRow.innerText();
  check("list shows usage count", /\b1\b/.test(usedText), usedText.replace(/\s+/g, " ").slice(0, 120));
  await page.screenshot({ path: OUT + "/coupons-used-row.png" });

  await usedRow.locator('button:has(svg[data-testid="AssessmentIcon"])').click();
  await page.getByText(/Usage History/).waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);
  const usageText = await page.locator('[role="dialog"]').innerText();
  check("usage drawer shows redemption", /16\.2/.test(usageText), usageText.replace(/\s+/g, " ").slice(0, 160));
  await page.screenshot({ path: OUT + "/coupons-usage.png" });
  await page.locator('[role="dialog"] button:has(svg[data-testid="CloseIcon"])').first().click();
  await page.waitForTimeout(400);

  await usedRow.locator('button:has(svg[data-testid="VisibilityIcon"])').click();
  await page.getByText("Platform funded", { exact: true }).first().waitFor({ timeout: 10000 });
  await page.waitForTimeout(500);
  const viewText = (await page.locator('[role="dialog"]').innerText()).toLowerCase();
  check("details modal shows funding + split", viewText.includes("platform funded") && viewText.includes("total uses"));
  await page.screenshot({ path: OUT + "/coupons-details-platform.png" });
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).last().click();
  await page.waitForTimeout(400);

  // ── partner-only and split funding presentation ──
  await search.fill(PARTNER_CODE);
  await page.waitForTimeout(700);
  const partnerRow = page.locator("tbody tr").filter({ hasText: PARTNER_CODE }).first();
  check("partner-funded coupon is listed", await partnerRow.isVisible());
  check("partner-funded label in table", /Partner funded/.test(await partnerRow.innerText()));
  await partnerRow.locator('button:has(svg[data-testid="VisibilityIcon"])').click();
  await page.waitForTimeout(700);
  await page.screenshot({ path: OUT + "/coupons-details-partner.png" });
  await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).last().click();

  await search.fill(SPLIT_CODE);
  await page.waitForTimeout(700);
  const splitRow = page.locator("tbody tr").filter({ hasText: SPLIT_CODE }).first();
  const splitText = await splitRow.innerText();
  check("split funding percentages shown", /Platform 40% \/ Partner 60%/.test(splitText), splitText.replace(/\s+/g, " "));

  // ── create through the real form ──
  await search.fill("");
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /New Coupon/i }).click();
  await page.getByRole("heading", { name: "Create Coupon" }).waitFor({ timeout: 10000 });
  await page.getByLabel("Coupon Code *").fill(NEW_CODE);
  await page.getByLabel("Title *").fill("UI Coupon E2E");
  await page.getByLabel("Discount Value *").fill("25");
  await page.getByRole("combobox", { name: /Applies To/i }).click();
  await page.getByRole("option", { name: "CAB", exact: true }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + "/coupons-create-basic.png" });

  await page.getByRole("tab", { name: "Service Rules" }).click();
  await page.getByRole("button", { name: /Add Rule/i }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + "/coupons-create-rules.png" });

  await page.getByRole("tab", { name: "Partners (0)" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: OUT + "/coupons-create-partners.png" });

  await page.getByRole("button", { name: "Create Coupon", exact: true }).click();
  await page.getByText("Coupon created", { exact: true }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(1200);
  await search.fill(NEW_CODE);
  await page.waitForTimeout(800);
  const newRow = page.locator("tbody tr").filter({ hasText: NEW_CODE }).first();
  check("coupon created through the UI", await newRow.isVisible(), NEW_CODE);
  check("new coupon shows 25%", /25(\.00)?%/.test(await newRow.innerText()), await newRow.innerText());
  await page.screenshot({ path: OUT + "/coupons-created.png" });

  // ── edit through the real form ──
  await newRow.locator('button:has(svg[data-testid="EditIcon"])').click();
  await page.getByRole("heading", { name: "Edit Coupon" }).waitFor({ timeout: 10000 });
  await page.getByLabel("Title *").fill("UI Coupon Edited");
  await page.getByRole("button", { name: "Update Coupon", exact: true }).click();
  await page.getByText("Coupon updated", { exact: true }).waitFor({ timeout: 15000 });
  await page.waitForTimeout(1200);
  check("coupon edit saved", /UI Coupon Edited/.test(await newRow.innerText()), await newRow.innerText());
  await page.screenshot({ path: OUT + "/coupons-edited.png" });

  // ── the settled coupon booking on the admin cab detail page ──
  const bookingId = process.env.QA_BOOKING_ID || "82";
  const cabId = process.env.QA_CAB_ID || "49";
  await page.goto(`${BASE}/bookings/${bookingId}/cab/${cabId}`, { waitUntil: "domcontentloaded" });
  await page.getByText("Payment", { exact: true }).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  if (await closeBtn.isVisible().catch(() => false)) { await closeBtn.click(); await page.waitForTimeout(500); }
  const detailText = await page.locator("body").innerText();
  check("admin cab detail shows the coupon", detailText.includes(USED_CODE) && detailText.includes("16.2"), detailText.match(/Coupon[^\n]*\n[^\n]*/)?.[0]);
  check(
    "admin cab detail can download the invoice",
    await page.getByRole("button", { name: /Download Invoice/i }).isVisible().catch(() => false),
  );
  await page.screenshot({ path: OUT + "/coupons-booking-detail.png", fullPage: true });

  console.log("console errors:", errors.length ? errors.slice(0, 8) : "none");
  console.log(JSON.stringify({ code: NEW_CODE, passed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length, total: results.length }));
  fs.writeFileSync(OUT + "/coupons-results.json", JSON.stringify({ results, errors, code: NEW_CODE }, null, 2));
  await browser.close();
  if (results.some(r => !r.ok)) process.exit(1);
})().catch((e) => { console.error("QA FAILED:", e.message); process.exit(1); });

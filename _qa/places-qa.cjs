// QA driver: Master Data → Places tab + Landing Pages CMS place type.
// Usage: node places-qa.js   (admin-portal on :3000, backend on :8000)
const { chromium } = require("C:/Users/Asus/node_modules/playwright");
const fs = require("fs");

const BASE = "http://localhost:3000";
const OUT = __dirname + "/shots";
fs.mkdirSync(OUT, { recursive: true });

const EMAIL = "admin@waytero.dev";
const PASSWORD = process.env.QA_ADMIN_PASSWORD || "Admin@WayTero1";

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push("PAGEERROR " + e.message));

  // ── login ──
  await page.goto(BASE + "/login", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("admin@waytero.dev  or  9000000001").fill(EMAIL);
  await page.getByPlaceholder("Your admin password").fill(PASSWORD);
  await page.keyboard.press("Enter");
  await page.waitForURL((u) => !u.pathname.includes("login"), { timeout: 15000 });
  console.log("logged in ->", page.url());

  // ── Settings → Master Data → Places ──
  await page.goto(BASE + "/settings?tab=master-data", { waitUntil: "domcontentloaded" });
  await page.getByRole("tab", { name: /Master Data/i }).click();
  await page.getByRole("tab", { name: /Places/ }).click();
  await page.getByText("Place Management").waitFor({ timeout: 10000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: OUT + "/places-tab.png", fullPage: true });

  const rows = await page.locator("table tbody tr").count();
  const airportVisible = await page.getByText("Biju Patnaik International Airport").isVisible();
  const stationVisible = await page.getByText("Bhubaneswar Railway Station").isVisible();
  const publishedChips = await page.getByText("Published", { exact: true }).count();
  console.log("places rows:", rows, "| airport:", airportVisible, "| station:", stationVisible, "| published chips:", publishedChips);

  // ── Add Place dialog ──
  await page.getByRole("button", { name: /Add Place/ }).first().click();
  await page.getByText("Add Place").first().waitFor({ timeout: 5000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT + "/place-dialog.png" });
  const seoBtn = page.getByRole("button", { name: /SEO overrides/ });
  if (await seoBtn.isVisible()) await seoBtn.click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: OUT + "/place-dialog-seo.png" });
  await page.getByRole("button", { name: "Cancel" }).click();

  // ── Landing Pages CMS shows Place · Cabs rows ──
  await page.goto(BASE + "/cms/landing-pages", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2500);
  await page.getByPlaceholder(/Search city, state or slug/i).fill("Bhubaneswar");
  await page.waitForTimeout(1800);
  const placeChips = await page.getByText("Place · Cabs").count();
  console.log("landing list 'Place · Cabs' chips:", placeChips);
  const scopeCell = await page.getByText("Bhubaneswar Railway Station").count();
  console.log("landing list place scope rows:", scopeCell);
  await page.screenshot({ path: OUT + "/landing-list.png", fullPage: true });

  console.log("console errors:", errors.length ? errors.slice(0, 5) : "none");
  await browser.close();
})().catch((e) => {
  console.error("QA FAILED:", e.message);
  process.exit(1);
});

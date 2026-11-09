// tests/test_food_9_e2e.mjs
import pkg from "../.agents/skills/video-demo/node_modules/playwright/index.js";
const { chromium } = pkg;
import { resolve } from "node:path";

const BASE_URL = "http://localhost:3000";
const SCREENSHOT_DIR = resolve("tests/screenshots");

async function testFood9() {
  console.log("==================================================================");
  console.log("   FOOD RESCUE W6: TESTING LISTING ID 9 & SELLER LOCATION       ");
  console.log("==================================================================\n");

  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  console.log("▶ Membuka halaman detail bahan pakan ID 9 (/food/9)...");
  const response = await page.goto(`${BASE_URL}/food/9`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);

  const status = response.status();
  console.log(`  HTTP Status: ${status}`);

  const pageText = await page.innerText("body");

  // 1. Periksa Nama Toko
  const hasStoreName = pageText.includes("farhad store");
  console.log(`  1. Nama toko "farhad store" muncul: ${hasStoreName}`);

  // 2. Periksa Alamat Penjemputan
  const hasAddress = pageText.includes("testingggg");
  console.log(`  2. Alamat "testingggg" muncul: ${hasAddress}`);

  // 3. Periksa Fallback Text (Harus FALSE / tidak muncul)
  const hasStoreFallback = pageText.includes("Sumber Bahan Terdaftar");
  const hasAddressFallback = pageText.includes("Alamat penjemputan belum dilengkapi oleh penjual");
  console.log(`  3. Fallback nama toko muncul: ${hasStoreFallback} (Harus false)`);
  console.log(`  4. Fallback alamat muncul: ${hasAddressFallback} (Harus false)`);

  // 4. Periksa Koordinat & Tombol Peta Google Maps
  const gmapsLink = await page.locator('a[href*="google.com/maps"]').getAttribute("href");
  const hasCoordinatesInMaps = gmapsLink && gmapsLink.includes("0.5335") && gmapsLink.includes("101.4353");
  console.log(`  5. Link Google Maps terbaca: ${gmapsLink}`);
  console.log(`  6. Koordinat 0.5335, 101.4353 valid di peta: ${hasCoordinatesInMaps}`);

  // 5. Periksa Kerahasiaan Nomor Telepon (Harus TERSEMBUNYI karena is_phone_public = false)
  const phoneRegex = /08[0-9]{8,12}/;
  const hasUnmaskedPhone = phoneRegex.test(pageText);
  console.log(`  7. Nomor telepon tersembunyi (tidak bocor): ${!hasUnmaskedPhone}`);

  // Tangkap Screenshot
  const screenshotPath = resolve(SCREENSHOT_DIR, "07_food_9_detail_seller_location.png");
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`  Screenshot disimpan: tests/screenshots/07_food_9_detail_seller_location.png`);

  await browser.close();

  const allPassed =
    status === 200 &&
    hasStoreName &&
    hasAddress &&
    !hasStoreFallback &&
    !hasAddressFallback &&
    hasCoordinatesInMaps &&
    !hasUnmaskedPhone;

  console.log("\n==================================================================");
  console.log(`RESULT: ${allPassed ? "ALL CHECKS PASSED ✅" : "SOME CHECKS FAILED ❌"}`);
  console.log("==================================================================");

  return allPassed;
}

testFood9().catch(console.error);


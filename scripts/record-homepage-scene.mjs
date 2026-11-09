import { chromium } from "../.agents/skills/video-demo/node_modules/@playwright/test/index.mjs";
import { execFileSync } from "node:child_process";
import { statSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";

const FFMPEG_PATH = "C:\\Users\\LENOVO\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0.2-full_build\\bin\\ffmpeg.exe";
const RECORDINGS_DIR = resolve("recordings_raw");
const OUTPUT_MP4 = resolve("demo-out/homepage-catalog.mp4");
const SAMPLE_MP4 = resolve("FoodRescue_Demo_Sample.mp4");

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function record() {
  console.log("🎬 Memulai sesi perekaman scene: homepage-catalog...");

  const browser = await chromium.launch({
    headless: true,
    args: [
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--window-size=1920,1080",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: RECORDINGS_DIR,
      size: { width: 1920, height: 1080 },
    },
  });

  const page = await context.newPage();

  // Buka URL lokal Food Rescue
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });

  // Injeksi kursor virtual profesional dan lower-third subtitle container
  await page.evaluate(() => {
    // 1. Kursor virtual
    const cursor = document.createElement("div");
    cursor.id = "demo-cursor";
    cursor.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 22px;
      height: 22px;
      border-radius: 50%;
      background: rgba(16, 185, 129, 0.85);
      border: 2.5px solid #ffffff;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4), 0 0 10px rgba(16, 185, 129, 0.6);
      pointer-events: none;
      z-index: 999999;
      transform: translate(-50%, -50%);
      transition: width 0.2s, height 0.2s, background-color 0.2s;
    `;
    document.body.appendChild(cursor);

    // 2. Subtitle / Lower-Third Bar
    const subtitle = document.createElement("div");
    subtitle.id = "demo-subtitle-bar";
    subtitle.style.cssText = `
      position: fixed;
      bottom: 32px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
      border-radius: 20px;
      padding: 14px 28px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      z-index: 999998;
      max-width: 820px;
      text-align: center;
      transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    `;
    subtitle.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; box-shadow: 0 0 8px #10b981;"></span>
        <span style="font-size: 11px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; color: #34d399; font-family: ui-sans-serif, system-ui, sans-serif;">FOOD RESCUE • DEMO TOUR</span>
      </div>
      <div id="demo-subtitle-text" style="font-size: 16px; font-weight: 700; color: #ffffff; font-family: ui-sans-serif, system-ui, sans-serif; line-height: 1.4;">
        Selamat Datang di Food Rescue — Platform Penyelamatan Makanan Surplus
      </div>
      <div id="demo-subtitle-desc" style="font-size: 12.5px; font-weight: 500; color: #94a3b8; font-family: ui-sans-serif, system-ui, sans-serif;">
        Mencegah pemborosan pangan dengan mempertemukan mitra penjual dan pembeli
      </div>
    `;
    document.body.appendChild(subtitle);

    // Global helper untuk update posisi kursor
    window.updateCursor = (x, y, isClick = false) => {
      cursor.style.left = `${x}px`;
      cursor.style.top = `${y}px`;
      if (isClick) {
        cursor.style.transform = "translate(-50%, -50%) scale(0.8)";
        cursor.style.background = "#059669";
        setTimeout(() => {
          cursor.style.transform = "translate(-50%, -50%) scale(1)";
          cursor.style.background = "rgba(16, 185, 129, 0.85)";
        }, 200);
      }
    };

    // Global helper untuk update subtitle
    window.setSubtitle = (title, desc) => {
      const textEl = document.getElementById("demo-subtitle-text");
      const descEl = document.getElementById("demo-subtitle-desc");
      if (textEl && descEl) {
        textEl.style.opacity = "0";
        descEl.style.opacity = "0";
        setTimeout(() => {
          textEl.textContent = title;
          descEl.textContent = desc;
          textEl.style.opacity = "1";
          descEl.style.opacity = "1";
        }, 250);
      }
    };
  });

  // Helper untuk gerakkan kursor halus
  async function moveCursor(startX, startY, endX, endY, steps = 25, duration = 600) {
    const stepTime = duration / steps;
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      // Smooth easeInOutQuad
      const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const x = Math.round(startX + (endX - startX) * ease);
      const y = Math.round(startY + (endY - startY) * ease);
      await page.evaluate(({ cx, cy }) => window.updateCursor(cx, cy), { cx: x, cy: y });
      await sleep(stepTime);
    }
  }

  // --- BEAT 1 (00:00 - 00:05): HERO SECTION & BRAND INTRODUCTION ---
  console.log("📍 Beat 1: Hero Section & Brand Showcase");
  await page.evaluate(() => window.updateCursor(960, 400));
  await sleep(2000);

  // Kursor bergerak ke arah tagline hero
  await moveCursor(960, 400, 720, 320, 25, 1000);
  await sleep(1500);

  // Kursor bergerak ke tombol CTA "Jelajahi Makanan"
  await moveCursor(720, 320, 960, 520, 25, 800);
  await sleep(1200);

  // --- BEAT 2 (00:05 - 00:11): SMOOTH SCROLL TO KATALOG ---
  console.log("📍 Beat 2: Smooth Scrolling to Food Catalogue");
  await page.evaluate(() => {
    window.setSubtitle(
      "Katalog Pangan Layak Konsumsi dari Mitra Terpercaya",
      "Pilihan beragam menu berkualitas: Makanan siap santap, bakery, roti, dan donasi gratis"
    );
  });

  // Scroll lembut ke elemen #katalog
  await page.evaluate(async () => {
    const target = document.querySelector("#katalog") || document.body;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  await sleep(2000);

  // Gerakkan kursor ke area filter kategori
  await moveCursor(960, 520, 500, 260, 30, 900);
  await sleep(1500);

  // --- BEAT 3 (00:11 - 00:18): FILTERING KATALOG CERDAS ---
  console.log("📍 Beat 3: Smart Filters (Category, Type, Delivery)");
  await page.evaluate(() => {
    window.setSubtitle(
      "Sistem Filter Cerdas & Responsif",
      "Saring makanan berdasarkan kategori favorit, tipe donasi/diskon, dan opsi delivery"
    );
  });

  // Cari tombol filter kategori kedua atau donasi
  const filterBtn = await page.locator("button:has-text('Bakery'), button:has-text('Donasi'), button:has-text('Ambil')").first();
  if (await filterBtn.count() > 0) {
    const box = await filterBtn.boundingBox();
    if (box) {
      await moveCursor(500, 260, box.x + box.width / 2, box.y + box.height / 2, 25, 800);
      await page.evaluate(({ cx, cy }) => window.updateCursor(cx, cy, true), { cx: box.x + box.width / 2, cy: box.y + box.height / 2 });
      await filterBtn.click();
      await sleep(1500);
    }
  } else {
    await sleep(2000);
  }

  // --- BEAT 4 (00:18 - 00:24): ZOOM FOCUS PADA KARTU MAKANAN (STOK & WAKTU) ---
  console.log("📍 Beat 4: Spotlight Zoom on Food Card");
  await page.evaluate(() => {
    window.setSubtitle(
      "Informasi Porsi Tersisa & Hitung Mundur Kedaluwarsa",
      "Transparansi penuh: Jumlah porsi real-time, potongan harga, dan lokasi toko mitra"
    );
  });

  // Efek zoom kamera halus ke kartu makanan pertama
  await page.evaluate(() => {
    // Zoom in halus dengan CSS transform
    const mainArea = document.querySelector("main") || document.body;
    mainArea.style.transition = "transform 0.9s cubic-bezier(0.16, 1, 0.3, 1)";
    mainArea.style.transformOrigin = "center 45%";
    mainArea.style.transform = "scale(1.15)";
  });

  await moveCursor(500, 260, 680, 480, 30, 1000);
  await sleep(3500);

  // --- BEAT 5 (00:24 - 00:28): ZOOM OUT & PENUTUP SCENE ---
  console.log("📍 Beat 5: Outro & Smooth Hold");
  await page.evaluate(() => {
    window.setSubtitle(
      "Penyelamatan Pangan Dimulai Dari Sini",
      "Langkah nyata mencegah pemborosan makanan dengan belanja bijak dan berkelanjutan"
    );
    const mainArea = document.querySelector("main") || document.body;
    mainArea.style.transform = "scale(1)";
  });

  await moveCursor(680, 480, 960, 420, 25, 800);
  await sleep(2500);

  // Tutup halaman untuk menyelesaikan rekaman video mentah Playwright
  console.log("💾 Menyimpan rekaman video mentah...");
  await page.close();
  await context.close();
  await browser.close();

  // Cari file webm yang dihasilkan Playwright di folder recordings_raw
  const files = readdirSync(RECORDINGS_DIR).filter((f) => f.endsWith(".webm"));
  if (files.length === 0) {
    throw new Error("Tidak ada file video mentah (.webm) yang dihasilkan!");
  }

  // Ambil file video terbaru
  files.sort((a, b) => statSync(join(RECORDINGS_DIR, b)).mtimeMs - statSync(join(RECORDINGS_DIR, a)).mtimeMs);
  const rawWebmPath = join(RECORDINGS_DIR, files[0]);
  console.log(`📹 File video mentah: ${rawWebmPath} (${(statSync(rawWebmPath).size / 1024 / 1024).toFixed(2)} MB)`);

  // Transcode menggunakan FFmpeg ke MP4 1080p60 H.264
  console.log("⚙️  Melakukan transcode dengan FFmpeg ke Full HD 1080p MP4...");
  const ffmpegArgs = [
    "-y",
    "-i", rawWebmPath,
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "18",
    "-pix_fmt", "yuv420p",
    "-r", "60",
    "-movflags", "+faststart",
    OUTPUT_MP4,
  ];

  execFileSync(FFMPEG_PATH, ffmpegArgs, { stdio: "inherit" });

  // Salin juga ke FoodRescue_Demo_Sample.mp4 di root proyek
  const copyArgs = [
    "-y",
    "-i", OUTPUT_MP4,
    "-c", "copy",
    SAMPLE_MP4,
  ];
  execFileSync(FFMPEG_PATH, copyArgs, { stdio: "inherit" });

  const finalStat = statSync(OUTPUT_MP4);
  console.log("✅ Perekaman dan konversi MP4 berhasil!");
  console.log(`📁 File Utama: ${OUTPUT_MP4}`);
  console.log(`📁 File Sampel: ${SAMPLE_MP4}`);
  console.log(`📊 Ukuran: ${(finalStat.size / 1024 / 1024).toFixed(2)} MB (${finalStat.size} bytes)`);
}

record().catch((err) => {
  console.error("❌ Gagal merekam video:", err);
  process.exit(1);
});

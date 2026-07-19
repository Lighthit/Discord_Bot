import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

import puppeteer from "puppeteer";
import template from "./template.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const githubCss = await fs.readFile(
    path.join(__dirname, "../asset/github-markdown.css"),
    "utf8"
);

export async function renderPdf(htmlContent) {
    const html = template(githubCss, htmlContent);

    const browser = await puppeteer.launch({
      executablePath: '/usr/bin/chromium',
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();

    await page.setContent(html, { waitUntil: "networkidle0" });

    await page.waitForFunction(
        "window.renderMermaidDone === true",
        { timeout: 5000 }
    ).catch(() => {});

    // รอให้ web font ทั้งหมด (โดยเฉพาะ font ของ KaTeX เช่น KaTeX_Math, KaTeX_Size1-4)
    // โหลดและพร้อมใช้งานจริงก่อน print PDF — ถ้า print ก่อนหน้านี้ browser จะคำนวณ
    // ตำแหน่ง/ความสูงของสัญลักษณ์คณิตศาสตร์ด้วย fallback font ชั่วคราว
    // ทำให้สมการเลื่อนตก ไม่ตรงบรรทัดตอน print ออกมาเป็น PDF จริง
    await page.evaluate(() => document.fonts.ready).catch(() => {});

    const pdfUint8Array = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { 
            top: "20mm", 
            bottom: "20mm",
            left: "20mm",
            right: "20mm"
        }
    });

    await browser.close();

    return Buffer.from(pdfUint8Array); // ← สำคัญ! ต้อง return และแปลงเป็น Buffer ชัดเจน
}

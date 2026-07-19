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

    const pdfUint8Array = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "20px", bottom: "20px" }
        // ไม่ใส่ path เลย -> ไม่เขียนไฟล์ ได้ Uint8Array กลับมาแทน
    });

    await browser.close();

    return Buffer.from(pdfUint8Array); // ← สำคัญ! ต้อง return และแปลงเป็น Buffer ชัดเจน
}

// generatePdfFromMarkdown.js
import { renderMarkdown } from "../markdown/markdown.js";
import { renderPdf } from "../markdown/renderPdf.js";

export async function generatePdfBufferFromMarkdown(markdownText, options = {}) {
    const htmlContent = renderMarkdown(markdownText, options);
    const pdfBuffer = await renderPdf(htmlContent);
    return pdfBuffer; // คืนเป็น Buffer ตรงๆ ไม่มีไฟล์เกิดขึ้นบน disk
}
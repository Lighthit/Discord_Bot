import MarkdownIt from "markdown-it";
import markdownItKatex from "markdown-it-katex";
import taskLists from "markdown-it-task-lists";
import anchor from "markdown-it-anchor";
import toc from "markdown-it-table-of-contents";
import { full as markdownItEmoji } from "markdown-it-emoji";
import markdownItFootnote from "markdown-it-footnote";
import hljs from "highlight.js";

const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,

    highlight(str, lang) {

        if (lang === "mermaid") {
            return `<pre class="mermaid">${md.utils.escapeHtml(str)}</pre>`;
        }

        if (lang && hljs.getLanguage(lang)) {

            return `<pre><code class="hljs">${hljs.highlight(str,{
                language:lang
            }).value}</code></pre>`;

        }

        return `<pre><code>${md.utils.escapeHtml(str)}</code></pre>`;
    }

});

md.use(markdownItKatex);
md.use(taskLists);
md.use(anchor);
md.use(markdownItEmoji);
md.use(markdownItFootnote);

// ------------------------------------------------------------------
// Unicode subscript/superscript maps
// (ป้องกันปัญหา Chromium ทิ้งตัวอักษรพวกนี้ตอน font subsetting เวลา print PDF)
// ------------------------------------------------------------------
const SUPER_MAP = {
    "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4",
    "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9",
    "⁺": "+", "⁻": "-", "⁼": "=", "⁽": "(", "⁾": ")",
    "ⁿ": "n", "ᵀ": "T"
};

const SUB_MAP = {
    "₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4",
    "₅": "5", "₆": "6", "₇": "7", "₈": "8", "₉": "9",
    "₊": "+", "₋": "-", "₌": "=", "₍": "(", "₎": ")"
};

const superChars = Object.keys(SUPER_MAP).join("");
const subChars = Object.keys(SUB_MAP).join("");
const SUPER_REGEX = new RegExp(`[${superChars}]+`, "g");
const SUB_REGEX = new RegExp(`[${subChars}]+`, "g");

// นอก code block: แปลงเป็น HTML <sub>/<sup> (แสดงผลเป็นตัวยก/ตัวห้อยจริง)
function convertUnicodeScriptsToHtml(text) {
    let result = text.replace(SUPER_REGEX, (match) => {
        const converted = [...match].map((ch) => SUPER_MAP[ch]).join("");
        return `<sup>${converted}</sup>`;
    });

    result = result.replace(SUB_REGEX, (match) => {
        const converted = [...match].map((ch) => SUB_MAP[ch]).join("");
        return `<sub>${converted}</sub>`;
    });

    return result;
}

// ใน code block: แปลงเป็น ASCII ธรรมดา (^ สำหรับ superscript, _ สำหรับ subscript)
// เพราะ HTML tag จะโดน escapeHtml() กลายเป็นตัวหนังสือดิบ ไม่ render เป็นตัวยก/ตัวห้อยจริง
function convertUnicodeScriptsToAscii(text) {
    let result = text.replace(SUPER_REGEX, (match) => {
        const converted = [...match].map((ch) => SUPER_MAP[ch]).join("");
        return `^${converted}`;
    });

    result = result.replace(SUB_REGEX, (match) => {
        const converted = [...match].map((ch) => SUB_MAP[ch]).join("");
        return `_${converted}`;
    });

    return result;
}

/**
 * แปลง LaTeX-style delimiters ( \( \) และ \[ \] ) ให้เป็นรูปแบบ
 * ที่ markdown-it-katex รู้จัก ( $ $ และ $$ $$ )
 * และแปลง Unicode subscript/superscript:
 *   - นอก code block  -> HTML <sub>/<sup>
 *   - ใน code block   -> ASCII (^, _)
 * เพื่อเลี่ยงปัญหา Chromium ทิ้งตัวอักษร Unicode พิเศษตอน print PDF
 */
function preprocessContent(content) {
    const codeBlocks = [];

    // 1. ดึง fenced code block (```...```) ออกมาเก็บไว้ก่อน พร้อมแปลง unicode script -> ASCII ในตัวมันเอง
    let protectedContent = content.replace(/```[\s\S]*?```/g, (match) => {
        const converted = convertUnicodeScriptsToAscii(match);
        const index = codeBlocks.length;
        codeBlocks.push(converted);
        return `@@CODEBLOCK${index}@@`;
    });

    // 2. ดึง inline code (`...`) ออกมาเก็บไว้ด้วย พร้อมแปลง unicode script -> ASCII เช่นกัน
    protectedContent = protectedContent.replace(/`[^`\n]+`/g, (match) => {
        const converted = convertUnicodeScriptsToAscii(match);
        const index = codeBlocks.length;
        codeBlocks.push(converted);
        return `@@CODEBLOCK${index}@@`;
    });

    // 3. แปลง LaTeX delimiters เฉพาะส่วนที่เหลือ (ไม่ใช่โค้ด)
    //    Block math: \[ ... \]  ->  $$ ... $$
    protectedContent = protectedContent.replace(/\\\[([\s\S]*?)\\\]/g, (_, expr) => `$$${expr}$$`);
    //    Inline math: \( ... \)  ->  $ ... $
    protectedContent = protectedContent.replace(/\\\(([\s\S]*?)\\\)/g, (_, expr) => `$${expr}$`);

    // 4. แปลง Unicode subscript/superscript ให้เป็น <sub>/<sup> (เฉพาะส่วนที่ไม่ใช่โค้ด)
    protectedContent = convertUnicodeScriptsToHtml(protectedContent);

    // 5. เอา code block กลับมาแทนที่ placeholder เดิม (ตอนนี้เป็น ASCII แล้ว ปลอดภัยต่อ font subsetting)
    protectedContent = protectedContent.replace(/@@CODEBLOCK(\d+)@@/g, (_, i) => codeBlocks[parseInt(i)]);

    return protectedContent;
}

export function renderMarkdown(content, options = {}) {
    const { enableToc = false } = options;

    if (enableToc) {
        md.use(toc, { includeLevel: [1, 2, 3] });
    }

    const preprocessed = preprocessContent(content);

    return md.render(preprocessed);
}

export default md;

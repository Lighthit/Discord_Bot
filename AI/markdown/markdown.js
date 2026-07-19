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
// Unicode subscript/superscript -> HTML <sub>/<sup> map
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

function convertUnicodeScripts(text) {
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

/**
 * แปลง LaTeX-style delimiters ( \( \) และ \[ \] ) ให้เป็นรูปแบบ
 * ที่ markdown-it-katex รู้จัก ( $ $ และ $$ $$ )
 * และแปลง Unicode subscript/superscript ให้เป็น HTML <sub>/<sup>
 * โดยไม่แตะเนื้อหาที่อยู่ใน fenced code block ( ``` ) หรือ inline code ( ` )
 */
function preprocessContent(content) {
    const codeBlocks = [];

    // 1. ดึง fenced code block (```...```) ออกมาเก็บไว้ก่อน
    let protectedContent = content.replace(/```[\s\S]*?```/g, (match) => {
        const index = codeBlocks.length;
        codeBlocks.push(match);
        return `@@CODEBLOCK${index}@@`;
    });

    // 2. ดึง inline code (`...`) ออกมาเก็บไว้ด้วย
    protectedContent = protectedContent.replace(/`[^`\n]+`/g, (match) => {
        const index = codeBlocks.length;
        codeBlocks.push(match);
        return `@@CODEBLOCK${index}@@`;
    });

    // 3. แปลง LaTeX delimiters เฉพาะส่วนที่เหลือ (ไม่ใช่โค้ด)
    //    Block math: \[ ... \]  ->  $$ ... $$
    protectedContent = protectedContent.replace(/\\\[([\s\S]*?)\\\]/g, (_, expr) => `$$${expr}$$`);
    //    Inline math: \( ... \)  ->  $ ... $
    protectedContent = protectedContent.replace(/\\\(([\s\S]*?)\\\)/g, (_, expr) => `$${expr}$`);

    // 4. แปลง Unicode subscript/superscript ให้เป็น <sub>/<sup> (เฉพาะส่วนที่ไม่ใช่โค้ด)
    protectedContent = convertUnicodeScripts(protectedContent);

    // 5. เอา code block กลับมาแทนที่ placeholder เดิม
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

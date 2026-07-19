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

/**
 * แปลง LaTeX-style delimiters ( \( \) และ \[ \] ) ให้เป็นรูปแบบ
 * ที่ markdown-it-katex รู้จัก ( $ $ และ $$ $$ )
 * โดยไม่แตะเนื้อหาที่อยู่ใน fenced code block ( ``` ) หรือ inline code ( ` )
 */
function convertLatexDelimiters(content) {
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

    // 4. เอา code block กลับมาแทนที่ placeholder เดิม
    protectedContent = protectedContent.replace(/@@CODEBLOCK(\d+)@@/g, (_, i) => codeBlocks[parseInt(i)]);

    return protectedContent;
}

export function renderMarkdown(content, options = {}) {
    const { enableToc = false } = options;

    if (enableToc) {
        md.use(toc, { includeLevel: [1, 2, 3] });
    }

    const preprocessed = convertLatexDelimiters(content);

    return md.render(preprocessed);
}

export default md;

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

export function renderMarkdown(content, options = {}) {
    const { enableToc = false } = options;

    if (enableToc) {
        md.use(toc, { includeLevel: [1, 2, 3] });
    }

    return md.render(content);
}

export default md;
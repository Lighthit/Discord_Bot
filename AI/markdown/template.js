export default function template(css, content) {
    return `
<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">

<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">

<style>

${css}

body{
    margin:40px;
}

.markdown-body{
    max-width:100%;
    margin:auto;
}

pre{
    overflow:auto;
}

table{
    width:100%;
}

img{
    max-width:100%;
}

.mermaid{
    display:flex;
    justify-content:center;
    background:transparent;
}

/* กันสมการ inline ที่มีตัวห้อย+ตัวยกซ้อนกัน (เช่น T_A^B) หรือสัญลักษณ์สูง
   ไปทับกับบรรทัดข้างบน-ล่าง เพราะ line-height ปกติของย่อหน้าไม่พอ */
.markdown-body p,
.markdown-body li {
    line-height: 2.4;
}

/* สมการแบบ block (\[ ... \]) ให้มีระยะห่างบน-ล่างชัดเจน ไม่ชนข้อความรอบข้าง */
.katex-display {
    margin: 1.4em 0;
    overflow-x: auto;
    overflow-y: hidden;
}

</style>

</head>

<body class="markdown-body">

${content}

<script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
<script>
    mermaid.initialize({ startOnLoad: false, theme: "default" });
    window.renderMermaidDone = false;
    mermaid.run({ querySelector: ".mermaid" }).then(() => {
        window.renderMermaidDone = true;
    }).catch(() => {
        window.renderMermaidDone = true; // กัน hang ถ้า error
    });
</script>

</body>

</html>
`;
}

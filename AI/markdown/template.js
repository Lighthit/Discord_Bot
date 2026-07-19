export default function template(css, content) {
    return `
<!DOCTYPE html>
<html lang="en">

<head>

<meta charset="UTF-8">

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
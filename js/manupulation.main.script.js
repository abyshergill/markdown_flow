const editor = document.getElementById('editor');
const previewPane = document.getElementById('preview-pane');
const floatingToolbar = document.getElementById('floating-toolbar');
let isSyncing = false;

// --- 1. Custom Marked Renderer ---
const renderer = new marked.Renderer();
renderer.image = function(href, title, text) {
    return `<div class="dummy-media" data-src="${href}" data-alt="${text}" contenteditable="false">
            <span style="font-size: 24px;">🖼️</span><br>
            <strong>${text || 'Image Placeholder'}</strong><br>
            <small>${href}</small>
        </div>`;
};
marked.setOptions({ renderer: renderer });

// --- 2. Turndown Setup ---
const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
turndownService.use(turndownPluginGfm.gfm);
turndownService.addRule('dummyMedia', {
    filter: (node) => node.nodeName === 'DIV' && node.classList.contains('dummy-media'),
    replacement: (content, node) => `![${node.getAttribute('data-alt')}](${node.getAttribute('data-src')})`
});

// --- 3. Sync Functions ---
function syncToPreview() {
    if (isSyncing) return;
    isSyncing = true;
    previewPane.innerHTML = marked.parse(editor.value);
    isSyncing = false;
}

function syncToEditor() {
    if (isSyncing) return;
    isSyncing = true;
    editor.value = turndownService.turndown(previewPane.innerHTML);
    isSyncing = false;
}

editor.addEventListener('input', syncToPreview);
previewPane.addEventListener('input', syncToEditor);

// --- 4. Insertion Logic ---
window.insertAtCursor = function(text) {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    editor.value = editor.value.substring(0, start) + text + editor.value.substring(end);
    editor.selectionStart = editor.selectionEnd = start + text.length;
    editor.focus();
    syncToPreview();
};

window.insertVisualLink = function() {
    const url = prompt("URL:", "https://");
    if (url) document.execCommand('insertHTML', false, `<a href="${url}">Link</a>`);
    syncToEditor();
};

window.insertVisualImage = function() {
    const url = prompt("Image URL:", "https://");
    if (url) {
        const html = `<div class="dummy-media" data-src="${url}" data-alt="Image" contenteditable="false">🖼️<br><strong>Image</strong><br><small>${url}</small></div><p><br></p>`;
        document.execCommand('insertHTML', false, html);
    }
    syncToEditor();
};

window.insertVisualTable = function() {
    const html = `<table><thead><tr><th>Header</th><th>Header</th></tr></thead><tbody><tr><td>Data</td><td>Data</td></tr></tbody></table><p><br></p>`;
    document.execCommand('insertHTML', false, html);
    syncToEditor();
};

window.addTableRow = function() {
    const sel = window.getSelection();
    const row = sel.anchorNode.parentElement.closest('tr');
    if (row) {
        const newRow = row.cloneNode(true);
        Array.from(newRow.cells).forEach(cell => cell.innerHTML = 'New');
        row.after(newRow);
        syncToEditor();
    }
};

window.addTableCol = function() {
    const sel = window.getSelection();
    const cell = sel.anchorNode.parentElement.closest('td, th');
    if (cell) {
        const index = cell.cellIndex;
        const table = cell.closest('table');
        Array.from(table.rows).forEach(row => {
            const newCell = row.cells[index].cloneNode(true);
            newCell.innerHTML = 'New';
            row.cells[index].after(newCell);
        });
        syncToEditor();
    }
};

window.formatText = function(cmd) {
    if (cmd === 'code') {
        const sel = window.getSelection().toString();
        document.execCommand('insertHTML', false, `<code>${sel}</code>`);
    } else if (cmd === 'H1' || cmd === 'H2' || cmd === 'H3') {
        document.execCommand('formatBlock', false, cmd);
    } else {
        document.execCommand(cmd, false, null);
    }
    syncToEditor();
    previewPane.focus(); 
};

// --- 5. UI Behaviors ---
document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel.isCollapsed && previewPane.contains(sel.anchorNode)) {
        const rect = sel.getRangeAt(0).getBoundingClientRect();
        floatingToolbar.style.display = 'flex';
        floatingToolbar.style.top = `${rect.top - 45}px`;
        floatingToolbar.style.left = `${rect.left + (rect.width / 2) - (floatingToolbar.offsetWidth / 2)}px`;
    } else {
        floatingToolbar.style.display = 'none';
    }
    
    if(floatingToolbar.style.display === 'flex') {
        document.querySelectorAll('#floating-toolbar button').forEach(b => b.classList.remove('active'));
        if (document.queryCommandState('bold')) document.getElementById('btn-bold').classList.add('active');
        if (document.queryCommandState('italic')) document.getElementById('btn-italic').classList.add('active');
        if (document.queryCommandState('insertUnorderedList')) document.getElementById('btn-list').classList.add('active');
    }
});

document.getElementById('file-input').addEventListener('change', (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => { editor.value = event.target.result; syncToPreview(); };
    reader.readAsText(file);
});

document.getElementById('btn-download').addEventListener('click', () => {
    const blob = new Blob([editor.value], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'document.md';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
});

// NEW: HTML EXPORT LOGIC
document.getElementById('btn-export-html').addEventListener('click', () => {
    const rawHtml = marked.parse(editor.value);
    const htmlTemplate = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Exported Document</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 2rem; }
h1, h2, h3 { border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; margin-top: 1.5em; }
code { background-color: #f6f8fa; padding: 0.2em 0.4em; border-radius: 3px; font-family: monospace; }
pre { background-color: #f6f8fa; padding: 16px; overflow: auto; border-radius: 3px; }
blockquote { border-left: 0.25em solid #dfe2e5; color: #6a737d; padding: 0 1em; margin: 0; }
table { border-collapse: collapse; width: 100%; margin-bottom: 1rem; }
th, td { border: 1px solid #dfe2e5; padding: 6px 13px; }
img { max-width: 100%; }
</style>
</head>
<body>
${rawHtml}
</body>
</html>`;
    const blob = new Blob([htmlTemplate], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
});

document.getElementById('btn-export-pdf').addEventListener('click', () => {
    const btn = document.getElementById('btn-export-pdf');
    const originalText = btn.innerText; btn.innerText = "⏳ Generating..."; btn.disabled = true;
    previewPane.setAttribute('contenteditable', 'false');

    const opt = {
        margin: [15, 10, 15, 10], filename: 'document.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy', 'avoid-all'] }
    };

    html2pdf().set(opt).from(document.getElementById('pdf-wrapper')).save().then(() => {
        btn.innerText = originalText; btn.disabled = false;
        previewPane.setAttribute('contenteditable', 'true');
    });
});

document.getElementById('theme-toggle').addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    document.body.setAttribute('data-theme', isDark ? 'light' : 'dark');
    document.getElementById('theme-toggle').innerText = isDark ? '🌙 Dark Mode' : '☀️ Light Mode';
});

const resizer = document.getElementById('resizer');
const leftPane = document.getElementById('editor-container');
let isResizing = false;

resizer.addEventListener('mousedown', () => { isResizing = true; resizer.classList.add('active'); document.body.style.userSelect = 'none'; });
document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    let newWidth = Math.max(15, Math.min(85, (e.clientX / window.innerWidth) * 100));
    leftPane.style.width = `${newWidth}%`;
});
document.addEventListener('mouseup', () => { isResizing = false; resizer.classList.remove('active'); document.body.style.userSelect = ''; });

syncToPreview();
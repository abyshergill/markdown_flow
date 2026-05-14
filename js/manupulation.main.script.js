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

        // --- 4. TOGGLE SMART Insertion Logic (Markdown Side) ---
        
        window.insertPrefix = function(prefix, defaultText) {
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            
            let lineStart = editor.value.lastIndexOf('\n', start - 1) + 1;
            let lineEnd = editor.value.indexOf('\n', end);
            if (lineEnd === -1) lineEnd = editor.value.length;
            
            const fullLines = editor.value.substring(lineStart, lineEnd);
            if (!fullLines) {
                const newText = prefix + defaultText;
                editor.value = editor.value.substring(0, lineStart) + newText + editor.value.substring(lineEnd);
                editor.selectionStart = lineStart + prefix.length;
                editor.selectionEnd = lineStart + prefix.length + defaultText.length;
                editor.focus();
                syncToPreview();
                return;
            }

            const lines = fullLines.split('\n');
            const isHeader = prefix.startsWith('#');
            const allHavePrefix = lines.every(line => line.trim().startsWith(prefix.trim()));
            
            let newLines;
            if (allHavePrefix) {
                newLines = lines.map(line => line.replace(prefix, ''));
            } else {
                newLines = lines.map(line => {
                    let cleanLine = line;
                    if (isHeader) {
                        cleanLine = line.replace(/^#+\s/, ''); 
                    }
                    if (cleanLine.startsWith(prefix)) return cleanLine; 
                    return prefix + cleanLine;
                });
            }
            
            const replacement = newLines.join('\n');
            editor.value = editor.value.substring(0, lineStart) + replacement + editor.value.substring(lineEnd);
            editor.selectionStart = lineStart;
            editor.selectionEnd = lineStart + replacement.length;
            editor.focus();
            syncToPreview();
        };

        window.insertWrapper = function(wrapStart, wrapEnd, defaultText) {
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            const selectedText = editor.value.substring(start, end);
            
            const textBefore = editor.value.substring(start - wrapStart.length, start);
            const textAfter = editor.value.substring(end, end + wrapEnd.length);
            
            if (textBefore === wrapStart && textAfter === wrapEnd) {
                editor.value = editor.value.substring(0, start - wrapStart.length) + selectedText + editor.value.substring(end + wrapEnd.length);
                editor.selectionStart = start - wrapStart.length;
                editor.selectionEnd = editor.selectionStart + selectedText.length;
                editor.focus();
                syncToPreview();
                return;
            }
            
            if (selectedText.startsWith(wrapStart) && selectedText.endsWith(wrapEnd) && selectedText.length >= wrapStart.length + wrapEnd.length) {
                const strippedText = selectedText.substring(wrapStart.length, selectedText.length - wrapEnd.length);
                editor.value = editor.value.substring(0, start) + strippedText + editor.value.substring(end);
                editor.selectionStart = start;
                editor.selectionEnd = start + strippedText.length;
                editor.focus();
                syncToPreview();
                return;
            }

            if (selectedText) {
                const newText = wrapStart + selectedText + wrapEnd;
                editor.value = editor.value.substring(0, start) + newText + editor.value.substring(end);
                editor.selectionStart = start;
                editor.selectionEnd = start + newText.length;
            } else {
                const newText = wrapStart + defaultText + wrapEnd;
                editor.value = editor.value.substring(0, start) + newText + editor.value.substring(end);
                editor.selectionStart = start + wrapStart.length;
                editor.selectionEnd = start + wrapStart.length + defaultText.length;
            }
            editor.focus();
            syncToPreview();
        };

        window.insertLink = function() {
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            const selectedText = editor.value.substring(start, end) || 'Link Text';
            const newText = `[${selectedText}](https://)`;
            editor.value = editor.value.substring(0, start) + newText + editor.value.substring(end);
            editor.selectionStart = start + selectedText.length + 3;
            editor.selectionEnd = start + selectedText.length + 11;
            editor.focus();
            syncToPreview();
        }

        window.insertImage = function() {
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            const selectedText = editor.value.substring(start, end) || 'Image Alt';
            const newText = `![${selectedText}](https://)`;
            editor.value = editor.value.substring(0, start) + newText + editor.value.substring(end);
            editor.selectionStart = start + selectedText.length + 4;
            editor.selectionEnd = start + selectedText.length + 12;
            editor.focus();
            syncToPreview();
        }

        window.insertAtCursor = function(text) {
            const start = editor.selectionStart;
            const end = editor.selectionEnd;
            editor.value = editor.value.substring(0, start) + text + editor.value.substring(end);
            editor.selectionStart = editor.selectionEnd = start + text.length;
            editor.focus();
            syncToPreview();
        };

        // --- 5. TOGGLE SMART Visual Preview Inserts ---
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
            const sel = window.getSelection();
            
            if (cmd === 'code') {
                let node = sel.anchorNode;
                let codeNode = null;
                while (node && node !== previewPane) {
                    if (node.nodeName === 'CODE' && node.parentNode.nodeName !== 'PRE') { codeNode = node; break; }
                    node = node.parentNode;
                }
                if (codeNode) {
                    codeNode.outerHTML = codeNode.innerHTML;
                } else {
                    const text = sel.toString();
                    if (text) document.execCommand('insertHTML', false, `<code>${text}</code>`);
                }
            } 
            else if (cmd === 'pre') {
                let node = sel.anchorNode;
                let preNode = null;
                while (node && node !== previewPane) {
                    if (node.nodeName === 'PRE') { preNode = node; break; }
                    node = node.parentNode;
                }
                if (preNode) {
                    const p = document.createElement('p');
                    p.innerHTML = preNode.innerText || '<br>';
                    preNode.parentNode.replaceChild(p, preNode);
                } else {
                    const text = sel.toString() || 'Code Block';
                    document.execCommand('insertHTML', false, `<pre><code>${text}</code></pre><p><br></p>`);
                }
            } 
            else if (['H1', 'H2', 'H3', 'blockquote'].includes(cmd)) {
                let node = sel.anchorNode;
                let inBlock = false;
                while (node && node !== previewPane) {
                    if (node.nodeName === cmd.toUpperCase()) { inBlock = true; break; }
                    node = node.parentNode;
                }
                
                if (inBlock) {
                    document.execCommand('formatBlock', false, 'p'); 
                } else {
                    document.execCommand('formatBlock', false, cmd); 
                }
            } 
            else {
                document.execCommand(cmd, false, null);
            }
            syncToEditor();
            previewPane.focus();
        };

        // --- 6. UI Behaviors ---
        previewPane.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                const sel = window.getSelection();
                if (!sel.rangeCount) return;
                
                let node = sel.anchorNode;
                while (node && node !== previewPane) {
                    if (node.nodeName === 'BLOCKQUOTE') {
                        e.preventDefault(); 
                        const p = document.createElement('p');
                        p.innerHTML = '<br>'; 
                        node.parentNode.insertBefore(p, node.nextSibling);
                        
                        const range = document.createRange();
                        range.setStart(p, 0);
                        range.collapse(true);
                        sel.removeAllRanges();
                        sel.addRange(range);
                        
                        syncToEditor();
                        return;
                    }
                    node = node.parentNode;
                }
            }
        });

        document.addEventListener('selectionchange', () => {
            const sel = window.getSelection();
            if (!sel.isCollapsed && previewPane.contains(sel.anchorNode)) {
                const rect = sel.getRangeAt(0).getBoundingClientRect();
                floatingToolbar.style.display = 'flex';
                floatingToolbar.style.top = `${rect.top - 50}px`;
                floatingToolbar.style.left = `${rect.left}px`;
            } else {
                floatingToolbar.style.display = 'none';
            }
        });

        document.getElementById('file-input').addEventListener('change', (e) => {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => {
                editor.value = event.target.result;
                syncToPreview();
            };
            reader.readAsText(file);
        });

        document.getElementById('btn-download').addEventListener('click', () => {
            const blob = new Blob([editor.value], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = 'doc.md'; a.click();
        });

        // --- 7. SMART PDF EXPORT LOGIC ---
        document.getElementById('btn-export-pdf').addEventListener('click', () => {
            const element = document.getElementById('pdf-wrapper');
            const btn = document.getElementById('btn-export-pdf');
            
            // Store original state
            const originalText = btn.innerText;
            const originalTheme = document.body.getAttribute('data-theme');
            
            // Set loading state and enforce light mode
            btn.innerText = "⏳ Generating...";
            btn.disabled = true;
            previewPane.setAttribute('contenteditable', 'false');
            document.body.setAttribute('data-theme', 'light');

            const opt = {
                margin: [15, 10, 15, 10], 
                filename: 'document.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            // Use a tiny timeout to let the CSS paint Light Mode before generating
            setTimeout(() => {
                html2pdf().set(opt).from(element).save().then(() => {
                    // Restore to original state
                    document.body.setAttribute('data-theme', originalTheme);
                    btn.innerText = originalText; 
                    btn.disabled = false;
                    previewPane.setAttribute('contenteditable', 'true');
                });
            }, 100);
        });

        document.getElementById('theme-toggle').addEventListener('click', () => {
            const theme = document.body.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.body.setAttribute('data-theme', theme);
        });

        const resizer = document.getElementById('resizer');
        const leftPane = document.getElementById('editor-container');
        let drag = false;
        resizer.addEventListener('mousedown', () => drag = true);
        document.addEventListener('mousemove', (e) => {
            if (!drag) return;
            leftPane.style.width = `${(e.clientX / window.innerWidth) * 100}%`;
        });
        document.addEventListener('mouseup', () => drag = false);

        window.onload = syncToPreview;
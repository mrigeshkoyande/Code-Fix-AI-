document.addEventListener('DOMContentLoaded', () => {
    /* ── Element refs ───────────────────────────────────────── */
    const langSelect      = document.getElementById('lang-select');
    const langLabel       = document.getElementById('lang-label');
    const codeEditor      = document.getElementById('code-editor');
    const lineNumbers     = document.getElementById('line-numbers');
    const syntaxText      = document.getElementById('syntax-text');
    const syntaxStatus    = document.getElementById('syntax-status');
    const consoleContent  = document.getElementById('console-content');
    const chatWindow      = document.getElementById('chat-window');
    const chatInput       = document.getElementById('chat-input');
    const sendBtn         = document.getElementById('send-btn');
    const runBtn          = document.getElementById('run-code');
    const clearBtn        = document.getElementById('clear-btn');
    const copyBtn         = document.getElementById('copy-btn');
    const clearConsoleBtn = document.getElementById('clear-console');
    const clearChatBtn    = document.getElementById('clear-chat');

    /* ── Language label map ─────────────────────────────────── */
    const fileExtMap = {
        Python: 'main.py', JavaScript: 'script.js', TypeScript: 'index.ts',
        C: 'main.c', 'C++': 'main.cpp', Java: 'Main.java',
        HTML: 'index.html', CSS: 'styles.css'
    };

    langSelect.addEventListener('change', () => {
        const lang = langSelect.value;
        langLabel.textContent = fileExtMap[lang] || lang.toLowerCase();
        codeEditor.placeholder = `# Write your ${lang} code here...\n# Click 'Check Syntax' or press Ctrl+Enter to run`;
    });

    /* ── Line Numbers ───────────────────────────────────────── */
    function updateLineNumbers() {
        const lines = codeEditor.value.split('\n').length;
        let html = '';
        for (let i = 1; i <= lines; i++) html += i + '\n';
        lineNumbers.textContent = html;
    }
    codeEditor.addEventListener('input', updateLineNumbers);
    codeEditor.addEventListener('scroll', () => {
        lineNumbers.scrollTop = codeEditor.scrollTop;
    });
    updateLineNumbers();

    /* ── Tab key in editor ──────────────────────────────────── */
    codeEditor.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = codeEditor.selectionStart;
            const end   = codeEditor.selectionEnd;
            codeEditor.value = codeEditor.value.substring(0, start) + '    ' + codeEditor.value.substring(end);
            codeEditor.selectionStart = codeEditor.selectionEnd = start + 4;
            updateLineNumbers();
        }
        if (e.ctrlKey && e.key === 'Enter') runBtn.click();
    });

    /* ── Check Syntax ───────────────────────────────────────── */
    document.getElementById('check-syntax').addEventListener('click', async () => {
        const code = codeEditor.value.trim();
        setSyntaxStatus('running', 'CHECKING...');
        syntaxText.innerHTML = '<span style="color:var(--text-muted)">Analyzing your code…</span>';

        if (!code) {
            setSyntaxStatus('idle', 'IDLE');
            syntaxText.innerHTML = 'Please write some code first.';
            return;
        }
        try {
            const res  = await fetch('/check_syntax', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, language: langSelect.value })
            });
            const data = await res.json();
            if (data.success) {
                setSyntaxStatus('ok', 'CLEAN');
                syntaxText.innerHTML = `<span style="color:var(--green-500)">✔ No syntax errors found!</span><br><span style="color:var(--text-secondary)">Your code looks clean and ready to run.</span>`;
            } else {
                setSyntaxStatus('error', 'ERROR');
                syntaxText.innerHTML = `<span style="color:var(--red-400)">${data.message}</span>`;
            }
        } catch {
            setSyntaxStatus('error', 'ERROR');
            syntaxText.innerHTML = '<span style="color:var(--red-400)">❌ Could not connect to server.</span>';
        }
    });

    function setSyntaxStatus(type, label) {
        syntaxStatus.textContent = label;
        syntaxStatus.className   = 'panel-status';
        if (type === 'ok')      syntaxStatus.classList.add('ok');
        if (type === 'error')   syntaxStatus.classList.add('error');
        if (type === 'running') syntaxStatus.classList.add('running');
    }

    /* ── Run Code ───────────────────────────────────────────── */
    runBtn.addEventListener('click', async () => {
        const code = codeEditor.value.trim();
        if (!code) {
            showConsole('⚠ Please write some code first.', 'warn');
            return;
        }
        runBtn.classList.add('loading');
        runBtn.disabled = true;
        showConsole('Running…', 'muted');

        try {
            const res  = await fetch('/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code, language: langSelect.value })
            });
            const data = await res.json();
            if (data.success) {
                showConsole(data.output || '✔ Code executed successfully (no output)', 'success');
            } else {
                showConsole('Error:\n' + data.error, 'error');
            }
        } catch {
            showConsole('❌ Failed to connect to server.', 'error');
        } finally {
            runBtn.classList.remove('loading');
            runBtn.disabled = false;
        }
    });

    function showConsole(text, type = 'muted') {
        consoleContent.textContent = text;
        consoleContent.className   = 'console-text';
        if (type === 'success') consoleContent.classList.add('success');
        if (type === 'error')   consoleContent.classList.add('error');
        if (type === 'warn')    consoleContent.style.color = 'var(--yellow-400)';
        else                    consoleContent.style.color = '';
    }

    /* ── Clear & Copy ───────────────────────────────────────── */
    clearBtn.addEventListener('click', () => {
        codeEditor.value = '';
        updateLineNumbers();
        setSyntaxStatus('idle', 'IDLE');
        syntaxText.innerHTML = 'Click <strong>Check Syntax</strong> to analyze your code for errors.';
    });

    copyBtn.addEventListener('click', () => {
        if (!codeEditor.value.trim()) return;
        navigator.clipboard.writeText(codeEditor.value);
        const orig = copyBtn.innerHTML;
        copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`;
        copyBtn.style.color = 'var(--green-500)';
        setTimeout(() => { copyBtn.innerHTML = orig; copyBtn.style.color = ''; }, 1800);
    });

    clearConsoleBtn.addEventListener('click', () => {
        showConsole('Output will appear here after execution...', 'muted');
    });

    /* ── Toolbar demo buttons ───────────────────────────────── */
    const demoMap = {
        'auto-fix': { icon: '✨', msg: 'Auto-Fix is coming soon! Check back later.' },
        'explain':  { icon: '💡', msg: 'Explain feature is coming soon! Use the AI chat instead.' },
        'format':   { icon: '≡',  msg: 'Auto-Format is coming soon!' },
        'improve':  { icon: '⭐', msg: 'Code Improve is coming soon!' },
        'example':  { icon: '📄', msg: 'Loading example code…', action: loadExample },
    };
    Object.entries(demoMap).forEach(([id, cfg]) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.addEventListener('click', () => {
            if (cfg.action) { cfg.action(); return; }
            addAiMessage(cfg.msg);
        });
    });

    function loadExample() {
        codeEditor.value = `# Example: Fibonacci sequence
def fibonacci(n):
    if n <= 0:
        return []
    elif n == 1:
        return [0]
    sequence = [0, 1]
    while len(sequence) < n:
        sequence.append(sequence[-1] + sequence[-2])
    return sequence

result = fibonacci(10)
print("Fibonacci sequence:", result)
print("Sum:", sum(result))`;
        updateLineNumbers();
        langSelect.value = 'Python';
        langLabel.textContent = 'main.py';
        addAiMessage('📄 Example code loaded! Click <strong>Run Code</strong> to execute it, or <strong>Check Syntax</strong> to analyze it.');
    }

    /* ── Clear chat ─────────────────────────────────────────── */
    clearChatBtn.addEventListener('click', () => {
        chatWindow.innerHTML = '';
        addAiMessage('Chat cleared. How can I help you with your code?');
    });

    /* ── Chat auto-resize ───────────────────────────────────── */
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = Math.min(chatInput.scrollHeight, 100) + 'px';
    });

    /* ── Quick prompts ──────────────────────────────────────── */
    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            chatInput.value = btn.dataset.prompt;
            chatInput.dispatchEvent(new Event('input'));
            sendBtn.click();
        });
    });

    /* ── Chat send ──────────────────────────────────────────── */
    function sendChat() {
        const text = chatInput.value.trim();
        if (!text) return;
        addUserMessage(text);
        chatInput.value = '';
        chatInput.style.height = 'auto';

        sendBtn.disabled = true;
        setTimeout(() => {
            const code = codeEditor.value.trim();
            const reply = generateReply(text, code);
            addAiMessage(reply);
            sendBtn.disabled = false;
        }, 650);
    }

    sendBtn.addEventListener('click', sendChat);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendChat();
        }
    });

    function generateReply(query, code) {
        const q = query.toLowerCase();
        if (!code) return "📝 I don't see any code in the editor yet. Paste your code and I'll help you!";
        if (q.includes('fix') || q.includes('error') || q.includes('syntax'))
            return `🔍 Try clicking <strong>Check Syntax</strong> first to identify exact errors. Once you see the error, I can explain how to fix it!`;
        if (q.includes('explain') || q.includes('what') || q.includes('does'))
            return `💡 I can see you have ${code.split('\n').length} lines of code. The <strong>Explain</strong> feature (coming soon) will give a full breakdown. For now, ask me about a specific part!`;
        if (q.includes('improve') || q.includes('better') || q.includes('optimize'))
            return `⭐ Looking at your code, consider: (1) Adding docstrings to functions, (2) Using descriptive variable names, (3) Breaking long functions into smaller ones.`;
        if (q.includes('run') || q.includes('execute'))
            return `▶ Click the green <strong>Run Code</strong> button (top right) or press <kbd>Ctrl+Enter</kbd> in the editor to run your code!`;
        return `Got it! I'm here to help with your code. For syntax checking, use the <strong>Check Syntax</strong> button. For running code, use <strong>Run Code</strong> or <kbd>Ctrl+Enter</kbd>.`;
    }

    function addUserMessage(text) {
        const div = document.createElement('div');
        div.className = 'message user-message';
        div.innerHTML = `
            <div class="msg-avatar user-avatar">U</div>
            <div class="user-bubble">${escapeHtml(text)}</div>`;
        chatWindow.appendChild(div);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    function addAiMessage(html) {
        const div = document.createElement('div');
        div.className = 'message ai-message';
        div.innerHTML = `
            <div class="msg-avatar">AI</div>
            <div class="ai-bubble">${html}</div>`;
        chatWindow.appendChild(div);
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }

    function escapeHtml(str) {
        return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }
});
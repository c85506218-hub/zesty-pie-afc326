// ── Config helpers ──
const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbzxBPnmPRxdnR99HU6i7gqhBeAJKNRFhw4iEIZalFLbwzizu0j61wXUtRiPGvrHsVqYSQ/exec';

const cfg = {
  get geminiKey()  { return localStorage.getItem('emo_gemini_key') || ''; },
  get gasUrl()     { return localStorage.getItem('emo_gas_url') || DEFAULT_GAS_URL; },
  get dashPass()   { return localStorage.getItem('emo_dash_pass') || 'admin'; },
  set geminiKey(v) { localStorage.setItem('emo_gemini_key', v); },
  set gasUrl(v)    { localStorage.setItem('emo_gas_url', v); },
  set dashPass(v)  { localStorage.setItem('emo_dash_pass', v); },
};

// ── Emotion config ──
const EMOTION_MAP = {
  快樂: { emoji: '😊', en: 'happy' },
  悲傷: { emoji: '😢', en: 'sad' },
  憤怒: { emoji: '😠', en: 'angry' },
  焦慮: { emoji: '😰', en: 'anxious' },
  壓力: { emoji: '😫', en: 'stressed' },
  孤獨: { emoji: '🥺', en: 'lonely' },
  平靜: { emoji: '😌', en: 'calm' },
  興奮: { emoji: '🤩', en: 'excited' },
  疲倦: { emoji: '😴', en: 'tired' },
  困惑: { emoji: '😕', en: 'confused' },
};

const RESOURCES = [
  '深呼吸練習', '冥想放鬆', '規律運動', '聆聽音樂',
  '寫日記抒發', '聯絡親友', '尋求專業諮商', '正念練習',
  '閱讀書籍', '戶外散步', '充足睡眠', '健康飲食',
  '創意活動（畫畫/手作）', '看喜歡的影片或節目',
];

const GEMINI_PROMPT = `你是一個溫暖有同理心的情緒支持AI助手，使用繁體中文回應。

分析用戶的訊息，以 JSON 格式回覆（不要加 markdown 代碼塊，直接輸出純 JSON）：
{
  "emotion": "從以下選一個最符合的情緒：快樂、悲傷、憤怒、焦慮、壓力、孤獨、平靜、興奮、疲倦、困惑",
  "response": "溫暖有同理心的回應，2-3句話，要像朋友聊天的語氣",
  "resources": ["從以下清單選2-3個最適合的建議：${RESOURCES.join('、')}"]
}

注意：resources 陣列只能包含上述清單中的項目，原文照抄不要修改。`;

// ── Gemini API ──
async function callGemini(userText) {
  if (!cfg.geminiKey) throw new Error('請先在設定中填入 Gemini API 金鑰');

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${cfg.geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: GEMINI_PROMPT }, { text: `用戶說：${userText}` }] }],
        generationConfig: { temperature: 0.75, maxOutputTokens: 512 },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API 錯誤 ${res.status}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

  // strip possible markdown fences
  const clean = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(clean);
}

// ── Save to Google Sheets (no-cors) ──
async function saveRecord(payload) {
  if (!cfg.gasUrl) return;
  try {
    await fetch(cfg.gasUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (_) { /* silent – data may still save */ }
}

// ── UI helpers ──
const chatEl  = document.getElementById('chat-container');
const inputEl = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');

function scrollBottom() {
  chatEl.scrollTop = chatEl.scrollHeight;
}

function showToast(msg, type = 'error') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  setTimeout(() => { t.className = 'toast hidden'; }, 3500);
}

function addUserBubble(text) {
  const row = document.createElement('div');
  row.className = 'msg-row user';
  row.innerHTML = `
    <div class="avatar user-av">😊</div>
    <div class="bubble">
      <div class="bubble-text">${escHtml(text)}</div>
    </div>`;
  chatEl.appendChild(row);
  scrollBottom();
}

function addTypingIndicator() {
  const row = document.createElement('div');
  row.className = 'msg-row ai';
  row.id = 'typing-indicator';
  row.innerHTML = `
    <div class="avatar ai">🌟</div>
    <div class="bubble">
      <div class="bubble-text typing">
        <span></span><span></span><span></span>
      </div>
    </div>`;
  chatEl.appendChild(row);
  scrollBottom();
  return row;
}

function removeTyping() {
  document.getElementById('typing-indicator')?.remove();
}

function addAiBubble(emotion, response, resources) {
  const emoInfo = EMOTION_MAP[emotion] || { emoji: '💬', en: 'neutral' };
  const emoClass = `emo-${emotion}`;

  const resHtml = resources.map(r =>
    `<div class="resource-item"><div class="resource-dot"></div>${escHtml(r)}</div>`
  ).join('');

  const row = document.createElement('div');
  row.className = 'msg-row ai';
  row.innerHTML = `
    <div class="avatar ai">🌟</div>
    <div class="bubble">
      <span class="emotion-badge ${emoClass}">${emoInfo.emoji} ${emotion}</span>
      <div class="bubble-text">${escHtml(response)}</div>
      ${resources.length ? `
      <div class="resources-card">
        <div class="resources-title">✨ 給你的建議</div>
        <div class="resources-list">${resHtml}</div>
      </div>` : ''}
    </div>`;
  chatEl.appendChild(row);
  scrollBottom();
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

// ── Send flow ──
async function send(text) {
  text = text.trim();
  if (!text) return;

  if (!cfg.geminiKey) {
    showToast('請先點右上角 ⚙️ 設定 Gemini API 金鑰');
    return;
  }

  inputEl.value = '';
  inputEl.style.height = 'auto';
  sendBtn.disabled = true;

  addUserBubble(text);
  const typingRow = addTypingIndicator();

  try {
    const result = await callGemini(text);
    removeTyping();

    const { emotion = '困惑', response = '我在聽你說...', resources = [] } = result;
    const emoInfo = EMOTION_MAP[emotion] || { emoji: '💬', en: 'neutral' };

    addAiBubble(emotion, response, resources);

    // save to Sheets
    saveRecord({
      userInput: text,
      emotion,
      emotionEn: emoInfo.en,
      response,
      resources,
    });

  } catch (err) {
    removeTyping();
    showToast('⚠️ ' + err.message);
    // show friendly fallback
    addAiBubble('困惑', '抱歉，我現在無法連線，請稍後再試。', []);
  } finally {
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

// ── Quick send ──
function quickSend(text) {
  inputEl.value = text;
  send(text);
}

// ── Events ──
sendBtn.addEventListener('click', () => send(inputEl.value));

inputEl.addEventListener('keydown', e => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send(inputEl.value);
  }
});

inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
});

// ── Settings modal ──
const settingsModal = document.getElementById('settings-modal');
const settingsBtn   = document.getElementById('settings-btn');

function openSettings() {
  document.getElementById('cfg-gemini-key').value = cfg.geminiKey;
  document.getElementById('cfg-gas-url').value    = cfg.gasUrl;
  document.getElementById('cfg-dash-pass').value  = cfg.dashPass;
  settingsModal.classList.remove('hidden');
}

settingsBtn.addEventListener('click', openSettings);
document.getElementById('settings-close').addEventListener('click', () => {
  settingsModal.classList.add('hidden');
});
document.getElementById('settings-save').addEventListener('click', () => {
  cfg.geminiKey = document.getElementById('cfg-gemini-key').value.trim();
  cfg.gasUrl    = document.getElementById('cfg-gas-url').value.trim();
  cfg.dashPass  = document.getElementById('cfg-dash-pass').value.trim() || 'admin';
  settingsModal.classList.add('hidden');
  showToast('設定已儲存 ✓', 'success');
});

settingsModal.addEventListener('click', e => {
  if (e.target === settingsModal) settingsModal.classList.add('hidden');
});

// ── Init: prompt settings if no key ──
if (!cfg.geminiKey) {
  setTimeout(openSettings, 600);
}

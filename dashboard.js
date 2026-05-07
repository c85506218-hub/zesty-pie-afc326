// ── Config ──
const DEFAULT_GAS_URL = 'https://script.google.com/macros/s/AKfycbzxBPnmPRxdnR99HU6i7gqhBeAJKNRFhw4iEIZalFLbwzizu0j61wXUtRiPGvrHsVqYSQ/exec';

// ── Auth ──
const PASS_KEY = 'emo_dash_pass';
const getPass = () => localStorage.getItem(PASS_KEY) || 'admin';

const lockScreen = document.getElementById('lock-screen');
const dashboard  = document.getElementById('dashboard');
const lockInput  = document.getElementById('lock-input');
const lockBtn    = document.getElementById('lock-btn');

function unlock() {
  if (lockInput.value === getPass()) {
    lockScreen.style.display = 'none';
    dashboard.style.display  = 'block';
    loadData();
  } else {
    lockInput.style.border = '1.5px solid #EF4444';
    lockInput.value = '';
    lockInput.placeholder = '密碼錯誤，請再試';
    setTimeout(() => {
      lockInput.style.border = '';
      lockInput.placeholder = '••••••';
    }, 1800);
  }
}

lockBtn.addEventListener('click', unlock);
lockInput.addEventListener('keydown', e => { if (e.key === 'Enter') unlock(); });

// ── Colours ──
const EMOTION_COLORS = {
  快樂: '#F59E0B', 悲傷: '#3B82F6', 憤怒: '#EF4444',
  焦慮: '#F97316', 壓力: '#8B5CF6', 孤獨: '#6B7280',
  平靜: '#10B981', 興奮: '#EC4899', 疲倦: '#9CA3AF', 困惑: '#D97706',
};
const PALETTE = [
  '#7C3AED','#06B6D4','#10B981','#F59E0B','#EF4444',
  '#8B5CF6','#EC4899','#3B82F6','#F97316','#6B7280',
  '#D97706','#059669','#DC2626','#7C3AED','#0EA5E9',
];

// chart instances
let pieChart, lineChart, barChart;

function showToast(msg, type = 'error') {
  const t = document.getElementById('dash-toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  setTimeout(() => { t.className = 'toast hidden'; }, 3500);
}

// ── Load data ──
async function loadData() {
  const gasUrl = localStorage.getItem('emo_gas_url') || DEFAULT_GAS_URL;

  if (!gasUrl) {
    showToast('請先在主頁 ⚙️ 設定 Google Apps Script 網址');
    renderEmpty();
    return;
  }

  try {
    document.getElementById('refresh-btn').textContent = '⏳';
    const res  = await fetch(gasUrl, { cache: 'no-cache' });
    const json = await res.json();
    render(json);
    document.getElementById('last-updated').textContent =
      '更新：' + new Date().toLocaleTimeString('zh-TW');
  } catch (err) {
    showToast('無法載入資料：' + err.message);
    renderEmpty();
  } finally {
    document.getElementById('refresh-btn').textContent = '🔄';
  }
}

document.getElementById('refresh-btn').addEventListener('click', loadData);

// ── Render ──
function render(data) {
  const { emotionCounts = {}, monthlyData = {}, resourceCounts = {}, total = 0 } = data;

  // Stats
  document.getElementById('stat-total').textContent = total;

  const topEmo = Object.entries(emotionCounts).sort((a,b) => b[1]-a[1])[0];
  const topEmoInfo = EMOTION_COLORS[topEmo?.[0]] ? topEmo[0] : '—';
  document.getElementById('stat-top-emotion').textContent = topEmo ? topEmo[0] : '—';

  const currentMonth = new Date().toISOString().slice(0,7);
  document.getElementById('stat-this-month').textContent = monthlyData[currentMonth] || 0;
  document.getElementById('stat-emotion-types').textContent = Object.keys(emotionCounts).length;

  renderPie(emotionCounts);
  renderLine(monthlyData);
  renderBar(resourceCounts);
}

function renderEmpty() {
  document.getElementById('stat-total').textContent = '0';
  document.getElementById('stat-top-emotion').textContent = '—';
  document.getElementById('stat-this-month').textContent = '0';
  document.getElementById('stat-emotion-types').textContent = '0';
  renderPie({});
  renderLine({});
  renderBar({});
}

// ── Pie chart ──
function renderPie(emotionCounts) {
  const labels = Object.keys(emotionCounts);
  const values = Object.values(emotionCounts);
  const colors = labels.map(l => EMOTION_COLORS[l] || '#9CA3AF');

  if (pieChart) pieChart.destroy();

  const ctx = document.getElementById('pie-chart').getContext('2d');
  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: '#fff',
        hoverOffset: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            font: { family: 'Noto Sans TC', size: 12 },
            padding: 12,
            usePointStyle: true,
          },
        },
        tooltip: {
          callbacks: {
            label: ctx => {
              const total = ctx.dataset.data.reduce((a,b) => a+b, 0);
              const pct = total ? Math.round(ctx.parsed / total * 100) : 0;
              return ` ${ctx.label}：${ctx.parsed} 次（${pct}%）`;
            },
          },
        },
      },
      cutout: '58%',
    },
  });
}

// ── Line chart ──
function renderLine(monthlyData) {
  // sort by month
  const entries = Object.entries(monthlyData).sort((a,b) => a[0].localeCompare(b[0]));

  // fill missing months
  if (entries.length > 1) {
    const filled = fillMonths(entries[0][0], entries[entries.length-1][0], monthlyData);
    entries.length = 0;
    entries.push(...filled);
  }

  const labels = entries.map(([k]) => k.replace('-', '/'));
  const values = entries.map(([,v]) => v);

  if (lineChart) lineChart.destroy();

  const ctx = document.getElementById('line-chart').getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 260);
  grad.addColorStop(0, 'rgba(124,58,237,0.22)');
  grad.addColorStop(1, 'rgba(124,58,237,0)');

  lineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: '對話次數',
        data: values,
        borderColor: '#7C3AED',
        backgroundColor: grad,
        borderWidth: 2.5,
        pointBackgroundColor: '#7C3AED',
        pointRadius: 5,
        pointHoverRadius: 7,
        tension: 0.4,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { mode: 'index', intersect: false },
      },
      scales: {
        x: {
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { font: { family: 'Noto Sans TC', size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { stepSize: 1, font: { family: 'Noto Sans TC', size: 11 } },
        },
      },
    },
  });
}

function fillMonths(start, end, data) {
  const result = [];
  const cur = new Date(start + '-01');
  const endDate = new Date(end + '-01');
  while (cur <= endDate) {
    const key = cur.toISOString().slice(0,7);
    result.push([key, data[key] || 0]);
    cur.setMonth(cur.getMonth() + 1);
  }
  return result;
}

// ── Bar chart ──
function renderBar(resourceCounts) {
  const entries = Object.entries(resourceCounts)
    .sort((a,b) => b[1]-a[1])
    .slice(0, 14); // top 14

  const labels = entries.map(([k]) => k);
  const values = entries.map(([,v]) => v);
  const colors = labels.map((_, i) => PALETTE[i % PALETTE.length]);

  if (barChart) barChart.destroy();

  const ctx = document.getElementById('bar-chart').getContext('2d');
  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: '推薦次數',
        data: values,
        backgroundColor: colors.map(c => c + 'CC'),
        borderColor: colors,
        borderWidth: 1.5,
        borderRadius: 8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ` 推薦 ${ctx.parsed.y} 次` },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            font: { family: 'Noto Sans TC', size: 11 },
            maxRotation: 30,
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: 'rgba(0,0,0,0.05)' },
          ticks: { stepSize: 1, font: { size: 11 } },
        },
      },
    },
  });
}

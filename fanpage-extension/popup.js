// =====================================================================
// Popup: lưu cấu hình, gửi lệnh cho content script, xuất nhật ký
// =====================================================================
const $ = (id) => document.getElementById(id);
const now = new Date();

const DEFAULTS = {
  pageUrl: 'https://www.facebook.com/tieuhoc.thcspascal',
  month: now.getMonth() + 1,
  year: now.getFullYear(),
  useFilter: true,
  doLike: true, doShare: true, doComment: true, autoShare: true,
  comments: [
    'Tuyệt vời quá! 👏',
    'Chúc mừng các con và thầy cô! 🎉',
    'Hoạt động rất ý nghĩa ❤️',
    'Pascal luôn tự hào! 💪',
    'Những khoảnh khắc thật đẹp 😍',
    'Cảm ơn nhà trường đã tổ chức chương trình rất hay!'
  ].join('\n'),
  mode: 'semi',
  maxPosts: 15, minDelay: 8, maxDelay: 20
};

for (let m = 1; m <= 12; m++) {
  const o = document.createElement('option'); o.value = m; o.textContent = `Tháng ${m}`; $('month').appendChild(o);
}

const status = (t) => { $('status').textContent = t; };

async function loadCfg() {
  const { pasCfg } = await chrome.storage.local.get('pasCfg');
  const c = { ...DEFAULTS, ...(pasCfg || {}) };
  for (const k of ['pageUrl', 'month', 'year', 'comments', 'mode', 'maxPosts', 'minDelay', 'maxDelay']) $(k).value = c[k];
  for (const k of ['useFilter', 'doLike', 'doShare', 'doComment', 'autoShare']) $(k).checked = c[k];
  $('autoWarn').hidden = c.mode !== 'auto';
  refreshLogInfo();
}

function readCfg() {
  const minDelay = Math.max(2, +$('minDelay').value || 8);
  const maxDelay = Math.max(minDelay + 1, +$('maxDelay').value || 20);
  return {
    pageUrl: $('pageUrl').value.trim(),
    month: +$('month').value, year: +$('year').value,
    useFilter: $('useFilter').checked,
    doLike: $('doLike').checked, doShare: $('doShare').checked, doComment: $('doComment').checked,
    autoShare: $('autoShare').checked,
    comments: $('comments').value,
    mode: $('mode').value,
    maxPosts: Math.max(1, +$('maxPosts').value || 15),
    minDelay, maxDelay
  };
}

async function saveCfg() { await chrome.storage.local.set({ pasCfg: readCfg() }); }
document.querySelectorAll('input,select,textarea').forEach((el) => el.addEventListener('change', saveCfg));
$('mode').addEventListener('change', () => { $('autoWarn').hidden = $('mode').value !== 'auto'; });

async function activeTab() { const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); return t; }

$('openPage').onclick = async () => {
  const url = $('pageUrl').value.trim() || DEFAULTS.pageUrl;
  const t = await activeTab();
  await chrome.tabs.update(t.id, { url });
  status('Đang mở fanpage... đợi trang tải xong rồi bấm Bắt đầu.');
};

$('start').onclick = async () => {
  // Lấy câu bình luận + link fanpage do BGH cài trên PEM (nếu đã kết nối)
  if (pemConnected && $('useServerConfig').checked) {
    const month = `${$('year').value}-${String($('month').value).padStart(2, '0')}`;
    const r = await bg({ type: 'pemConfig', month });
    if (r.ok) {
      $('comments').value = r.campaign.comments.join('\n');
      $('pageUrl').value = r.campaign.pageUrl;
    } else {
      status('Không lấy được cấu hình từ PEM (' + r.error + ') - dùng cấu hình trong extension.');
    }
  }
  await saveCfg();
  const c = readCfg();
  const comments = c.comments.split('\n').map((s) => s.trim()).filter(Boolean);
  if (c.doComment && !comments.length) return status('Cần ít nhất 1 câu bình luận mẫu.');
  if (!c.doLike && !c.doShare && !c.doComment) return status('Chọn ít nhất 1 thao tác.');
  if (c.mode === 'auto' && !confirm('Chế độ TỰ ĐỘNG có nguy cơ bị Facebook chặn tính năng hoặc khoá tài khoản. Tiếp tục?')) return;

  const t = await activeTab();
  if (!/facebook\.com/.test(t.url || '')) return status('Hãy mở fanpage trên tab hiện tại trước (nút "Mở fanpage").');
  try {
    const r = await chrome.tabs.sendMessage(t.id, { type: 'start', cfg: { ...c, comments } });
    status(r?.ok ? 'Đã bắt đầu - theo dõi bảng tiến độ trên trang.' : (r?.error || 'Không khởi động được.'));
    if (r?.ok) window.close();
  } catch (e) {
    status('Chưa kết nối được với trang. Hãy tải lại (F5) tab Facebook rồi thử lại.');
  }
};

$('stop').onclick = async () => {
  const t = await activeTab();
  try { await chrome.tabs.sendMessage(t.id, { type: 'stop' }); status('Đã gửi lệnh dừng.'); }
  catch { status('Không có tiến trình nào đang chạy trên tab này.'); }
};

// ---------------- Kết nối PEM ----------------
let pemConnected = false;
const bg = (msg) => chrome.runtime.sendMessage(msg).catch((e) => ({ ok: false, error: e.message }));

function renderPem(conn, queued = 0) {
  pemConnected = !!conn;
  $('pemDisconnected').hidden = pemConnected;
  $('pemConnected').hidden = !pemConnected;
  if (conn) {
    $('pemWho').textContent = `✔ Đã kết nối: ${conn.fullName} (${conn.department})` + (queued ? ` · ${queued} bài chờ gửi` : '');
  }
}

$('pemConnect').onclick = async () => {
  const url = ($('pemUrl').value.trim() || 'https://pem-snowy.vercel.app').replace(/\/+$/, '');
  const token = $('pemToken').value.trim();
  if (!token) return status('Nhập mã kết nối lấy từ PEM.');
  let origin;
  try { origin = new URL(url).origin; } catch { return status('Địa chỉ PEM không hợp lệ.'); }
  // Địa chỉ khác mặc định cần xin quyền truy cập
  const builtIn = ['https://pem-snowy.vercel.app', 'http://localhost:3000'];
  if (!builtIn.includes(origin)) {
    const granted = await chrome.permissions.request({ origins: [origin + '/*'] });
    if (!granted) return status('Cần cho phép extension truy cập ' + origin);
  }
  status('Đang kết nối...');
  const r = await bg({ type: 'pemConnect', url, token });
  if (!r.ok) return status('Kết nối thất bại: ' + r.error);
  $('pemToken').value = '';
  renderPem(r.conn);
  status('Đã kết nối PEM.');
};

$('pemDisconnect').onclick = async () => {
  await bg({ type: 'pemDisconnect' });
  renderPem(null);
  status('Đã ngắt kết nối PEM.');
};

$('pemSync').onclick = async () => {
  status('Đang đồng bộ...');
  const r = await bg({ type: 'pemSyncAll' });
  status(r.ok ? `Đã gửi ${r.saved} bài lên PEM.` : 'Đồng bộ lỗi: ' + r.error);
  const s = await bg({ type: 'pemStatus' });
  if (s.ok) renderPem(s.conn, s.queued);
};

bg({ type: 'pemStatus' }).then((s) => { if (s.ok) renderPem(s.conn, s.queued); });

// ---------------- Nhật ký ----------------
async function getLog() { return (await chrome.storage.local.get('pasLog')).pasLog || {}; }
function monthKey() { return `${$('year').value}-${String($('month').value).padStart(2, '0')}`; }

async function refreshLogInfo() {
  const log = await getLog();
  const rows = Object.values(log).filter((r) => (r.date || '').startsWith(monthKey()));
  const cnt = (k) => rows.filter((r) => r[k]).length;
  $('logInfo').textContent = `Tháng đang chọn: ${rows.length} bài · Thích ${cnt('liked')} · Chia sẻ ${cnt('shared')} · Bình luận ${cnt('commented')}`;
}
$('month').addEventListener('change', refreshLogInfo);
$('year').addEventListener('change', refreshLogInfo);

$('copyLinks').onclick = async () => {
  const log = await getLog();
  const links = Object.entries(log).filter(([, r]) => (r.date || '').startsWith(monthKey()))
    .sort((a, b) => a[1].date.localeCompare(b[1].date)).map(([u]) => u);
  await navigator.clipboard.writeText(links.join('\n'));
  status(`Đã copy ${links.length} link - dán thẳng vào Google Sheet.`);
};

$('exportCsv').onclick = async () => {
  const log = await getLog();
  const yn = (v) => (v ? 'x' : '');
  const lines = [['Ngày đăng', 'Link bài viết', 'Đã thích', 'Đã chia sẻ', 'Đã bình luận', 'Thời điểm xử lý'].join(',')];
  Object.entries(log).sort((a, b) => (a[1].date || '').localeCompare(b[1].date || '')).forEach(([u, r]) => {
    lines.push([r.date, u, yn(r.liked), yn(r.shared), yn(r.commented), r.at].map((v) => `"${v ?? ''}"`).join(','));
  });
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = `fanpage-log-${monthKey()}.csv`; a.click();
};

$('clearLog').onclick = async () => {
  if (!confirm('Xoá toàn bộ nhật ký? Extension sẽ không nhớ bài nào đã xử lý.')) return;
  await chrome.storage.local.remove('pasLog'); refreshLogInfo(); status('Đã xoá nhật ký.');
};

loadCfg();

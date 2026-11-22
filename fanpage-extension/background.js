// =====================================================================
// PAS Fanpage Helper - service worker:
// 1. Giao tiếp với web PEM (qua pem-bridge.js / externally_connectable)
// 2. Hàng đợi gửi bù kết quả khi mất mạng
// 3. Tự động chạy ngầm theo lịch hằng ngày (chrome.alarms) hoặc khi web bấm "Chạy ngay"
// =====================================================================
const DEFAULT_PEM_URL = 'https://pem-snowy.vercel.app';
const ALARM_NAME = 'pemFanpageAuto';
const DEFAULT_AUTO_CFG = {
  enabled: false,
  hour: 11,
  minute: 30,
  maxPosts: 5,
  lastRunDate: null,
  lastRunAt: null,
  lastRunStatus: null
};

const todayKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

async function getConn() {
  const { pemConn } = await chrome.storage.local.get('pemConn');
  return pemConn || null; // { url, token, fullName, department }
}

async function getAutoCfg() {
  const { pemAutoCfg } = await chrome.storage.local.get('pemAutoCfg');
  return { ...DEFAULT_AUTO_CFG, ...(pemAutoCfg || {}) };
}

async function setAutoCfg(patch) {
  const next = { ...(await getAutoCfg()), ...patch };
  await chrome.storage.local.set({ pemAutoCfg: next });
  return next;
}

async function pemFetch(path, opts = {}, conn) {
  const c = conn || (await getConn());
  if (!c?.token) throw new Error('Chưa kết nối PEM');
  const res = await fetch(c.url.replace(/\/+$/, '') + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', 'X-PEM-Token': c.token, ...(opts.headers || {}) }
  });
  const json = await res.json().catch(() => ({ success: false, message: `Phản hồi không hợp lệ (${res.status})` }));
  if (!res.ok || !json.success) throw new Error(json.message || `Lỗi ${res.status}`);
  return json;
}

// ---------------- Hàng đợi gửi bù ----------------
async function queueItems(items) {
  const { pemQueue = [] } = await chrome.storage.local.get('pemQueue');
  await chrome.storage.local.set({ pemQueue: [...pemQueue, ...items].slice(-1000) });
}

async function sendItems(items) {
  const { pemQueue = [] } = await chrome.storage.local.get('pemQueue');
  const all = [...pemQueue, ...items];
  if (!all.length) return { saved: 0 };
  let saved = 0;
  try {
    for (let i = 0; i < all.length; i += 100) {
      const r = await pemFetch('/api/fanpage/report', { method: 'POST', body: JSON.stringify({ items: all.slice(i, i + 100) }) });
      saved += r.saved || 0;
    }
    await chrome.storage.local.set({ pemQueue: [] });
    return { saved };
  } catch (e) {
    await chrome.storage.local.set({ pemQueue: [] });
    await queueItems(all);
    throw e;
  }
}

function logToItems(log) {
  return Object.entries(log || {})
    .filter(([url, r]) => url.startsWith('https://') && /^\d{4}-\d{2}-\d{2}$/.test(r.date || ''))
    .map(([url, r]) => ({ postUrl: url, postDate: r.date, liked: !!r.liked, shared: !!r.shared, commented: !!r.commented }));
}

// ---------------- Chạy ngầm trên tab nền ----------------
let activeRun = null; // { tabId, startedAt, timeoutId }

function waitForTabComplete(tabId, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
      reject(new Error('Tải trang Facebook quá thời gian'));
    }, timeoutMs);

    function onUpdated(id, info) {
      if (id === tabId && info.status === 'complete') {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(onUpdated);
        resolve();
      }
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
  });
}

async function cleanupActiveRun(statusText) {
  if (!activeRun) return;
  const { tabId, timeoutId } = activeRun;
  activeRun = null;
  clearTimeout(timeoutId);
  try { await chrome.tabs.remove(tabId); } catch {}
  await setAutoCfg({
    lastRunDate: todayKey(),
    lastRunAt: new Date().toISOString(),
    lastRunStatus: statusText
  });
}

async function startBackgroundRun(opts = {}) {
  if (activeRun) return { alreadyRunning: true };
  const conn = await getConn();
  if (!conn) throw new Error('Chưa kết nối PEM');

  const autoCfg = await getAutoCfg();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const { campaign } = await pemFetch(`/api/fanpage/config?month=${encodeURIComponent(month)}`, { method: 'GET' }, conn);

  const tab = await chrome.tabs.create({ url: campaign.pageUrl, active: false });
  const timeoutId = setTimeout(() => cleanupActiveRun('Hết thời gian chờ (10 phút)'), 10 * 60 * 1000);
  activeRun = { tabId: tab.id, startedAt: Date.now(), timeoutId };

  try {
    await waitForTabComplete(tab.id, 30000);
    // Chờ Facebook render xong feed
    await new Promise((r) => setTimeout(r, 3500));
    if (!activeRun || activeRun.tabId !== tab.id) return { stopped: true };

    const req = campaign.requiredActions || { like: true, share: true, comment: true };
    const cfg = {
      pageUrl: campaign.pageUrl,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      useFilter: true,
      doLike: !!req.like,
      doShare: !!req.share,
      doComment: !!req.comment,
      autoShare: true,
      comments: Array.isArray(campaign.comments) ? campaign.comments : [],
      mode: 'auto',
      maxPosts: Math.max(1, Math.min(30, Number(opts.maxPosts) || autoCfg.maxPosts || 5)),
      minDelay: 10,
      maxDelay: 22
    };

    const res = await chrome.tabs.sendMessage(tab.id, { type: 'start', cfg });
    if (!res?.ok) throw new Error(res?.error || 'Không khởi động được trên tab Facebook');
    return { started: true, tabId: tab.id };
  } catch (e) {
    await cleanupActiveRun('Lỗi: ' + (e.message || 'Không rõ'));
    throw e;
  }
}

// ---------------- Lịch hẹn chrome.alarms ----------------
function ensureAlarm() {
  chrome.alarms.get(ALARM_NAME, (a) => {
    if (!a) chrome.alarms.create(ALARM_NAME, { periodInMinutes: 20 });
  });
}
chrome.runtime.onInstalled.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(ensureAlarm);
ensureAlarm();

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== ALARM_NAME) return;
  try {
    const conn = await getConn();
    const cfg = await getAutoCfg();
    if (!conn || !cfg.enabled || activeRun) return;
    const now = new Date();
    const today = todayKey(now);
    if (cfg.lastRunDate === today) return;

    const nowMins = now.getHours() * 60 + now.getMinutes();
    const targetMins = (Number(cfg.hour) || 0) * 60 + (Number(cfg.minute) || 0);
    if (nowMins < targetMins) return;

    await startBackgroundRun({ maxPosts: cfg.maxPosts });
  } catch (e) {
    console.warn('[PAS Helper] Auto alarm error:', e);
  }
});

// ---------------- Message handlers ----------------
const handlers = {
  async pemPing() {
    const [{ pemQueue = [] }, conn, autoCfg] = await Promise.all([
      chrome.storage.local.get('pemQueue'),
      getConn(),
      getAutoCfg()
    ]);
    return { version: '2.1.0', conn, queued: pemQueue.length, autoCfg, running: !!activeRun };
  },
  async pemConnect({ url, token }) {
    const conn = { url: (url || DEFAULT_PEM_URL).trim().replace(/\/+$/, ''), token: (token || '').trim() };
    const r = await pemFetch('/api/fanpage/config', { method: 'GET' }, conn);
    const saved = { ...conn, fullName: r.me.fullName, department: r.me.department };
    await chrome.storage.local.set({ pemConn: saved });
    return { conn: saved, campaign: r.campaign, autoCfg: await getAutoCfg() };
  },
  async pemDisconnect() {
    await chrome.storage.local.remove('pemConn');
    return {};
  },
  async pemStatus() {
    const { pemQueue = [] } = await chrome.storage.local.get('pemQueue');
    return { conn: await getConn(), queued: pemQueue.length, autoCfg: await getAutoCfg(), running: !!activeRun };
  },
  async pemSetAuto({ enabled, hour, minute, maxPosts }) {
    const autoCfg = await setAutoCfg({
      ...(typeof enabled === 'boolean' ? { enabled } : {}),
      ...(hour !== undefined ? { hour: Math.max(0, Math.min(23, Number(hour) || 0)) } : {}),
      ...(minute !== undefined ? { minute: Math.max(0, Math.min(59, Number(minute) || 0)) } : {}),
      ...(maxPosts !== undefined ? { maxPosts: Math.max(1, Math.min(30, Number(maxPosts) || 5)) } : {})
    });
    ensureAlarm();
    return { autoCfg };
  },
  async pemRunNow({ maxPosts } = {}) {
    return startBackgroundRun({ maxPosts });
  },
  async pemStopRun() {
    if (!activeRun) return { stopped: false };
    try { await chrome.tabs.sendMessage(activeRun.tabId, { type: 'stop' }); } catch {}
    await cleanupActiveRun('Đã dừng thủ công');
    return { stopped: true };
  },
  async pemRunFinished({ summary } = {}, sender) {
    if (activeRun && (!sender?.tab || sender.tab.id === activeRun.tabId)) {
      const s = summary?.stats || {};
      const statusText = summary?.error
        ? `Dừng (${summary.error})`
        : summary?.stopped
        ? 'Đã dừng'
        : `Xong: Thích ${s.liked || 0} · Chia sẻ ${s.shared || 0} · Bình luận ${s.commented || 0}`;
      await cleanupActiveRun(statusText);
    }
    return {};
  },
  async pemConfig({ month }) {
    const r = await pemFetch(`/api/fanpage/config?month=${encodeURIComponent(month)}`, { method: 'GET' });
    return { campaign: r.campaign };
  },
  async pemReport({ items }) {
    if (!(await getConn())) return { skipped: true };
    try {
      return await sendItems(items || []);
    } catch (e) {
      return { queued: true, error: e.message };
    }
  },
  async pemSyncAll() {
    const { pasLog } = await chrome.storage.local.get('pasLog');
    return sendItems(logToItems(pasLog));
  }
};

function dispatchMessage(msg, sender, sendResponse) {
  const fn = handlers[msg?.type];
  if (!fn) return false;
  fn(msg, sender)
    .then((data) => sendResponse({ ok: true, ...data }))
    .catch((e) => sendResponse({ ok: false, error: e.message }));
  return true;
}

chrome.runtime.onMessage.addListener(dispatchMessage);
chrome.runtime.onMessageExternal.addListener(dispatchMessage);

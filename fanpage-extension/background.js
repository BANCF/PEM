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

// ---------------- Chạy trên cửa sổ Facebook hiển thị ----------------
// KHÔNG chạy trên tab ẩn: Chrome ngừng vẽ trang ẩn/bị che nên Facebook không tải thêm bài,
// không cuộn được, không focus được ô bình luận. Vì vậy mỗi lượt chạy mở 1 cửa sổ riêng ở phía trước.
//
// Service worker MV3 bị Chrome tắt sau ~30 giây rảnh, nên trạng thái lượt chạy phải lưu trong
// chrome.storage.session (không dùng biến toàn cục) và hẹn giờ bằng chrome.alarms (không dùng setTimeout).
const RUN_KEY = 'pemActiveRun'; // { windowId, tabId, startedAt }
const RUN_TIMEOUT_ALARM = 'pemFanpageRunTimeout';
const RUN_TIMEOUT_MIN = 20;
const REMIND_NOTIF_ID = 'pemFanpageRemind';
const MAX_REMINDERS_PER_DAY = 3;
const REMIND_SNOOZE_MIN = 60;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getActiveRun() {
  const { [RUN_KEY]: run } = await chrome.storage.session.get(RUN_KEY);
  if (!run) return null;
  // Cửa sổ có thể đã bị đóng khi service worker đang tắt -> dọn trạng thái cũ
  try {
    await chrome.tabs.get(run.tabId);
    return run;
  } catch {
    await chrome.storage.session.remove(RUN_KEY);
    return null;
  }
}

function waitForTabComplete(tabId, timeoutMs = 30000) {
  return new Promise((resolve, reject) => {
    const finish = (fn) => {
      clearTimeout(timer);
      chrome.tabs.onUpdated.removeListener(onUpdated);
      fn();
    };
    const timer = setTimeout(() => finish(() => reject(new Error('Tải trang Facebook quá thời gian'))), timeoutMs);
    function onUpdated(id, info) {
      if (id === tabId && info.status === 'complete') finish(resolve);
    }
    chrome.tabs.onUpdated.addListener(onUpdated);
    // Trang có thể đã tải xong trước khi kịp gắn listener
    chrome.tabs.get(tabId).then((t) => { if (t.status === 'complete') finish(resolve); }).catch(() => {});
  });
}

async function notify(id, title, message, extra = {}) {
  try {
    await chrome.notifications.create(id, { type: 'basic', iconUrl: 'icon.png', title, message, ...extra });
  } catch (e) {
    console.warn('[PAS Helper] notify', e);
  }
}

async function finishRun(statusText, { closeWindow = true } = {}) {
  const { [RUN_KEY]: run } = await chrome.storage.session.get(RUN_KEY);
  if (!run) return;
  await chrome.storage.session.remove(RUN_KEY);
  chrome.alarms.clear(RUN_TIMEOUT_ALARM);
  if (closeWindow) {
    try { await chrome.windows.remove(run.windowId); } catch {}
  }
  await setAutoCfg({ lastRunAt: new Date().toISOString(), lastRunStatus: statusText });
  notify('pemFanpageDone', 'PAS Fanpage Helper', statusText);
}

async function startRun(opts = {}) {
  const existing = await getActiveRun();
  if (existing) {
    // Đang chạy rồi -> đưa cửa sổ lên trước cho giáo viên thấy
    try { await chrome.windows.update(existing.windowId, { focused: true }); } catch {}
    return { alreadyRunning: true };
  }
  const conn = await getConn();
  if (!conn) throw new Error('Chưa kết nối PEM');

  const autoCfg = await getAutoCfg();
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const { campaign } = await pemFetch(`/api/fanpage/config?month=${encodeURIComponent(month)}`, { method: 'GET' }, conn);

  chrome.notifications.clear(REMIND_NOTIF_ID);
  const win = await chrome.windows.create({ url: campaign.pageUrl, focused: true, type: 'normal', width: 1100, height: 900 });
  const tabId = win.tabs[0].id;
  await chrome.storage.session.set({ [RUN_KEY]: { windowId: win.id, tabId, startedAt: Date.now() } });
  chrome.alarms.create(RUN_TIMEOUT_ALARM, { delayInMinutes: RUN_TIMEOUT_MIN });
  // Ghi ngày chạy NGAY khi bắt đầu để lịch hẹn không mở lại trong cùng ngày, kể cả khi service worker bị tắt giữa chừng
  await setAutoCfg({ lastRunDate: todayKey(now), lastRunAt: now.toISOString(), lastRunStatus: 'Đang chạy...' });

  try {
    await waitForTabComplete(tabId, 30000);
    // Chờ Facebook render xong feed
    await sleep(3500);
    const run = await getActiveRun();
    if (!run || run.tabId !== tabId) return { stopped: true };

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

    // Content script có thể chưa sẵn sàng ngay khi trang vừa tải xong -> thử lại vài lần
    let res = null;
    let lastErr = null;
    for (let i = 0; i < 4 && !res; i++) {
      try { res = await chrome.tabs.sendMessage(tabId, { type: 'start', cfg }); }
      catch (e) { lastErr = e; await sleep(1500); }
    }
    if (!res) throw new Error('Không liên lạc được với trang Facebook' + (lastErr ? ` (${lastErr.message})` : ''));
    if (!res.ok) throw new Error(res.error || 'Không khởi động được trên trang Facebook');
    return { started: true, tabId };
  } catch (e) {
    await finishRun('Lỗi: ' + (e.message || 'Không rõ'));
    throw e;
  }
}

// Giáo viên tự đóng cửa sổ Facebook -> kết thúc lượt chạy
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { [RUN_KEY]: run } = await chrome.storage.session.get(RUN_KEY);
  if (run && run.tabId === tabId) await finishRun('Đã đóng cửa sổ Facebook', { closeWindow: false });
});

// ---------------- Lịch hẹn: tới giờ thì NHẮC, giáo viên bấm mới chạy ----------------
function ensureAlarm() {
  chrome.alarms.get(ALARM_NAME, (a) => {
    if (!a) chrome.alarms.create(ALARM_NAME, { periodInMinutes: 20 });
  });
}
chrome.runtime.onInstalled.addListener(ensureAlarm);
chrome.runtime.onStartup.addListener(ensureAlarm);
ensureAlarm();

async function maybeRemind() {
  const conn = await getConn();
  const cfg = await getAutoCfg();
  if (!conn || !cfg.enabled || (await getActiveRun())) return;
  const now = new Date();
  const today = todayKey(now);
  if (cfg.lastRunDate === today) return;

  const nowMins = now.getHours() * 60 + now.getMinutes();
  const targetMins = (Number(cfg.hour) || 0) * 60 + (Number(cfg.minute) || 0);
  if (nowMins < targetMins) return;

  // Mỗi ngày nhắc tối đa MAX_REMINDERS_PER_DAY lần, cách nhau ít nhất REMIND_SNOOZE_MIN phút
  const count = cfg.remindDate === today ? cfg.remindCount || 0 : 0;
  if (count >= MAX_REMINDERS_PER_DAY) return;
  if (cfg.remindDate === today && cfg.nextRemindAt && Date.now() < cfg.nextRemindAt) return;

  await setAutoCfg({ remindDate: today, remindCount: count + 1, nextRemindAt: Date.now() + REMIND_SNOOZE_MIN * 60000 });
  await notify(REMIND_NOTIF_ID, 'Tới giờ tương tác fanpage trường', `Bấm "Chạy ngay" để Thích / Chia sẻ / Bình luận tối đa ${cfg.maxPosts} bài. Cửa sổ Facebook sẽ mở ra, đừng thu nhỏ trong lúc chạy.`, {
    requireInteraction: true,
    buttons: [{ title: 'Chạy ngay' }, { title: `Để sau ${REMIND_SNOOZE_MIN} phút` }]
  });
}

async function runFromNotification() {
  chrome.notifications.clear(REMIND_NOTIF_ID);
  try {
    const cfg = await getAutoCfg();
    await startRun({ maxPosts: cfg.maxPosts });
  } catch (e) {
    notify('pemFanpageError', 'Không chạy được', e.message || 'Lỗi không rõ');
  }
}

chrome.notifications.onClicked.addListener((id) => {
  if (id === REMIND_NOTIF_ID) runFromNotification();
});
chrome.notifications.onButtonClicked.addListener((id, btn) => {
  if (id !== REMIND_NOTIF_ID) return;
  if (btn === 0) runFromNotification();
  else chrome.notifications.clear(REMIND_NOTIF_ID); // "Để sau": lần nhắc kế tiếp đã hẹn sẵn trong nextRemindAt
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  try {
    if (alarm.name === ALARM_NAME) await maybeRemind();
    else if (alarm.name === RUN_TIMEOUT_ALARM) {
      const run = await getActiveRun();
      if (run) {
        try { await chrome.tabs.sendMessage(run.tabId, { type: 'stop' }); } catch {}
        await finishRun(`Hết thời gian chờ (${RUN_TIMEOUT_MIN} phút)`);
      }
    }
  } catch (e) {
    console.warn('[PAS Helper] Alarm error:', e);
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
    return { version: '2.2.0', conn, queued: pemQueue.length, autoCfg, running: !!(await getActiveRun()) };
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
    return { conn: await getConn(), queued: pemQueue.length, autoCfg: await getAutoCfg(), running: !!(await getActiveRun()) };
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
    return startRun({ maxPosts });
  },
  async pemStopRun() {
    const run = await getActiveRun();
    if (!run) return { stopped: false };
    try { await chrome.tabs.sendMessage(run.tabId, { type: 'stop' }); } catch {}
    await finishRun('Đã dừng thủ công');
    return { stopped: true };
  },
  async pemRunFinished({ summary } = {}, sender) {
    const run = await getActiveRun();
    if (run && sender?.tab?.id === run.tabId) {
      const s = summary?.stats || {};
      const statusText = summary?.error
        ? `Dừng (${summary.error})`
        : summary?.stopped
        ? 'Đã dừng'
        : `Xong: Thích ${s.liked || 0} · Chia sẻ ${s.shared || 0} · Bình luận ${s.commented || 0}`;
      // Để giáo viên kịp nhìn bảng kết quả trên trang rồi mới đóng cửa sổ
      await sleep(4000);
      await finishRun(statusText);
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

// =====================================================================
// PAS Fanpage Helper - content script chạy trên facebook.com
// =====================================================================
(() => {
  if (window.__pasHelperLoaded) return;
  window.__pasHelperLoaded = true;

  const S = FB_SELECTORS;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const rnd = (a, b) => Math.floor(a + Math.random() * (b - a));
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const anyOf = (list, root = document) => {
    for (const s of list) { const e = root.querySelector(s); if (e) return e; }
    return null;
  };
  const lastDialog = () => $$('[role="dialog"]').pop() || null;

  const state = { running: false, paused: false, stop: false };
  let cfg = null;
  let stats = { found: 0, liked: 0, commented: 0, shared: 0, skipped: 0 };
  let lastComment = '';

  // ---------------------------------------------------------------
  // Bảng tiến độ nổi trên trang
  // ---------------------------------------------------------------
  let panel;
  function ensurePanel() {
    if (panel) return;
    panel = document.createElement('div');
    panel.id = 'pas-helper-panel';
    panel.innerHTML = `
      <div style="font-weight:700;margin-bottom:6px">PAS Fanpage Helper</div>
      <div id="pas-msg" style="margin-bottom:6px">Sẵn sàng</div>
      <div id="pas-stats" style="font-size:12px;opacity:.85;margin-bottom:8px"></div>
      <button id="pas-pause">Tạm dừng</button>
      <button id="pas-stop">Dừng</button>`;
    Object.assign(panel.style, {
      position: 'fixed', top: '70px', right: '16px', zIndex: 2147483647, width: '280px',
      background: '#1f2937', color: '#fff', padding: '12px', borderRadius: '10px',
      font: '13px/1.4 system-ui, sans-serif', boxShadow: '0 6px 24px rgba(0,0,0,.4)'
    });
    panel.querySelectorAll('button').forEach((b) => Object.assign(b.style, {
      marginRight: '6px', padding: '4px 10px', borderRadius: '6px', border: 0, cursor: 'pointer'
    }));
    document.body.appendChild(panel);
    panel.querySelector('#pas-pause').onclick = () => {
      state.paused = !state.paused;
      panel.querySelector('#pas-pause').textContent = state.paused ? 'Tiếp tục' : 'Tạm dừng';
      say(state.paused ? 'Đã tạm dừng' : 'Tiếp tục chạy');
    };
    panel.querySelector('#pas-stop').onclick = () => { state.stop = true; say('Đang dừng...'); };
  }
  function say(msg, highlight = false) {
    ensurePanel();
    const el = panel.querySelector('#pas-msg');
    el.textContent = msg;
    el.style.color = highlight ? '#fde047' : '#fff';
    panel.querySelector('#pas-stats').textContent =
      `Bài trong tháng: ${stats.found} · Thích: ${stats.liked} · Bình luận: ${stats.commented} · Chia sẻ: ${stats.shared} · Bỏ qua: ${stats.skipped}`;
  }

  async function waitIfPaused() { while (state.paused && !state.stop) await sleep(500); }
  async function humanDelay() { await waitIfPaused(); await sleep(rnd(cfg.minDelay * 1000, cfg.maxDelay * 1000)); }

  // ---------------------------------------------------------------
  // Phát hiện cảnh báo của Facebook
  // ---------------------------------------------------------------
  function checkDanger() {
    if (/checkpoint/.test(location.href)) return 'Facebook yêu cầu xác minh (checkpoint)';
    for (const d of $$('[role="dialog"],[role="alertdialog"],[role="alert"]')) {
      const t = d.innerText || '';
      const hit = S.dangerTexts.find((x) => t.includes(x));
      if (hit) return `Facebook cảnh báo: "${hit}"`;
    }
    return null;
  }
  function assertSafe() {
    const d = checkDanger();
    if (d) { state.stop = true; say('ĐÃ DỪNG - ' + d, true); throw new Error(d); }
  }

  // ---------------------------------------------------------------
  // Nhật ký (lưu trong chrome.storage.local)
  // ---------------------------------------------------------------
  async function loadLog() { return (await chrome.storage.local.get('pasLog')).pasLog || {}; }
  async function saveEntry(url, patch) {
    const log = await loadLog();
    log[url] = { ...(log[url] || {}), ...patch, at: new Date().toISOString() };
    await chrome.storage.local.set({ pasLog: log });
    return log[url];
  }

  // Gửi kết quả 1 bài về PEM (qua service worker). Lỗi mạng sẽ được xếp hàng gửi bù.
  async function reportToPem(url) {
    try {
      const r = (await loadLog())[url];
      if (!r) return;
      const res = await chrome.runtime.sendMessage({
        type: 'pemReport',
        items: [{ postUrl: url, postDate: r.date, liked: !!r.liked, shared: !!r.shared, commented: !!r.commented }]
      });
      if (res?.queued) console.warn('[PAS Helper] Chưa gửi được về PEM, sẽ gửi bù:', res.error);
    } catch (e) {
      console.warn('[PAS Helper] reportToPem', e);
    }
  }

  // ---------------------------------------------------------------
  // Bộ lọc tháng của Facebook
  // ---------------------------------------------------------------
  async function clickOption(texts) {
    const opt = $$(S.option).find((o) => texts.includes(o.textContent.trim()));
    if (opt) { opt.click(); await sleep(1000); return true; }
    return false;
  }
  async function applyFilter() {
    const btn = anyOf(S.filterButton);
    if (!btn) { say('Không thấy nút Bộ lọc - sẽ tự lọc theo ngày đăng'); return false; }
    btn.scrollIntoView({ block: 'center' }); await sleep(800);
    btn.click(); await sleep(1800);
    const dlg = lastDialog(); if (!dlg) return false;
    let combos = $$(S.combobox, dlg);
    combos[0]?.click(); await sleep(900);
    if (!(await clickOption([String(cfg.year)]))) { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); return false; }
    combos = $$(S.combobox, dlg);
    combos[1]?.click(); await sleep(900);
    await clickOption(S.monthOptionText(cfg.month));
    const done = $$('[role="button"]', dlg).find((b) => S.doneButtonText.includes(b.textContent.trim()));
    done?.click(); await sleep(3500);
    say(`Đã áp dụng bộ lọc Tháng ${cfg.month}/${cfg.year}`);
    return true;
  }

  // ---------------------------------------------------------------
  // Đọc thông tin bài viết
  // ---------------------------------------------------------------
  function getPost(shareBtn) {
    const byPos = shareBtn.closest(S.postContainer);
    if (byPos) return byPos;
    // Dự phòng: khối cha lớn nhất chỉ chứa đúng 1 nút Chia sẻ
    const shareSel = S.shareButton.join(',');
    let c = shareBtn;
    while (c.parentElement && c.parentElement.querySelectorAll(shareSel).length === 1) c = c.parentElement;
    return c;
  }

  function parseDateFromLink(a) {
    const label = a.getAttribute('aria-label') || '';
    let m = label.match(S.timestampRegex);
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    const text = a.textContent.trim();
    m = text.match(S.relativeRegex);
    if (m) {
      const n = +m[1]; const unit = m[2];
      const ms = /phút|m/.test(unit) ? n * 6e4 : /giờ|h/.test(unit) ? n * 3.6e6 : n * 8.64e7;
      return new Date(Date.now() - ms);
    }
    if (/^Vừa xong$|^Just now$/.test(text)) return new Date();
    m = text.match(S.shortDateRegex);
    if (m) return new Date(m[3] ? +m[3] : new Date().getFullYear(), +m[2] - 1, +m[1]);
    return null;
  }

  async function getPostInfo(post) {
    const isPostLink = (a) => /\/posts\/|pfbid|\/reel\/|\/videos\/|\/photo|permalink|story_fbid/.test(a.href);
    let links = $$('a[href]', post).filter((a) => isPostLink(a) || S.timestampRegex.test(a.getAttribute('aria-label') || ''));
    // Facebook chỉ gắn link thật khi rê chuột -> giả lập rê chuột rồi đọc lại
    if (!links.some((a) => S.timestampRegex.test(a.getAttribute('aria-label') || ''))) {
      $$('a[role="link"]', post).slice(0, 8).forEach((a) => a.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })));
      await sleep(400);
      links = $$('a[href]', post).filter((a) => isPostLink(a) || S.timestampRegex.test(a.getAttribute('aria-label') || ''));
    }
    for (const a of links) {
      const date = parseDateFromLink(a);
      if (date) return { date, url: a.href.split('?')[0].replace('web.facebook.com', 'www.facebook.com') };
    }
    return { date: null, url: null };
  }

  const inTargetMonth = (d) => d.getFullYear() === cfg.year && d.getMonth() + 1 === cfg.month;
  const isOlder = (d) => d.getFullYear() < cfg.year || (d.getFullYear() === cfg.year && d.getMonth() + 1 < cfg.month);

  // ---------------------------------------------------------------
  // Các thao tác
  // ---------------------------------------------------------------
  async function doLike(post) {
    const b = anyOf(S.likeNotYet, post);
    if (!b) return 'already'; // nhãn đã đổi -> đã thả cảm xúc trước đó
    b.scrollIntoView({ block: 'center' }); await sleep(rnd(600, 1400));
    b.click(); await sleep(1500);
    assertSafe();
    return anyOf(S.likeNotYet, post) ? 'failed' : 'liked';
  }

  function waitFor(cond, timeoutMs) {
    return new Promise(async (resolve) => {
      const end = Date.now() + timeoutMs;
      while (Date.now() < end && !state.stop) {
        const v = cond(); if (v) return resolve(v);
        await sleep(400);
      }
      resolve(null);
    });
  }

  async function doShare(post) {
    const sb = anyOf(S.shareButton, post);
    if (!sb) return 'failed';
    sb.scrollIntoView({ block: 'center' }); await sleep(rnd(600, 1200));
    sb.click();
    const dlg = await waitFor(() => $$('[role="dialog"]').find((d) => anyOf(S.shareNow, d)), 8000);
    if (!dlg) return 'failed';
    const nowBtn = anyOf(S.shareNow, dlg);

    if (cfg.mode === 'auto' || cfg.autoShare) {
      // Tự bấm "Chia sẻ ngay"
      say('Đang tự chia sẻ bài viết...');
      await sleep(rnd(1200, 2500));
      nowBtn.click();
      // Chia sẻ thành công thì hộp thoại tự đóng
      const closed = await waitFor(() => !document.contains(dlg) || !dlg.offsetParent, 10000);
      await sleep(1500); assertSafe();
      if (!closed) { await closeDialog(dlg); return 'failed'; }
      return 'shared';
    }
    // Bán tự động: chờ người dùng bấm "Chia sẻ ngay" (hoặc Đóng để bỏ qua)
    let clicked = false;
    nowBtn.addEventListener('click', () => { clicked = true; }, { once: true });
    say('👉 Bấm "Chia sẻ ngay" để chia sẻ, hoặc Đóng để bỏ qua bài này', true);
    await waitFor(() => !document.contains(dlg) || !dlg.offsetParent, 180000);
    await sleep(1500); assertSafe();
    return clicked ? 'shared' : 'skipped';
  }

  function pickComment() {
    const list = cfg.comments.filter((c) => c && c !== lastComment);
    const c = (list.length ? list : cfg.comments)[rnd(0, (list.length || cfg.comments.length))];
    lastComment = c;
    return c;
  }

  async function doComment(post) {
    let scope = post;
    let openedDialog = null;
    let box = anyOf(S.commentBox, post);
    if (!box) {
      const before = $$('[role="dialog"]').length;
      anyOf(S.commentButton, post)?.click();
      await sleep(2000);
      if ($$('[role="dialog"]').length > before) { openedDialog = lastDialog(); scope = openedDialog; }
      box = anyOf(S.commentBox, scope) || anyOf(S.commentBox, post);
    }
    if (!box) return 'failed';

    // Đã bình luận rồi? (so tên tài khoản trong nhãn ô bình luận với tên người bình luận)
    const label = box.getAttribute('aria-label') || '';
    const prefix = S.commentBoxNamePrefix.find((p) => label.startsWith(p));
    const myName = prefix ? label.slice(prefix.length).trim() : '';
    if (myName && $$('a', scope).some((a) => a.textContent.trim() === myName && !a.closest('[role="textbox"]'))) {
      if (openedDialog) await closeDialog(openedDialog);
      return 'already';
    }

    const text = pickComment();
    box.scrollIntoView({ block: 'center' }); await sleep(rnd(500, 1000));
    box.focus(); box.click(); await sleep(400);
    for (const ch of text) { document.execCommand('insertText', false, ch); await sleep(rnd(40, 140)); }
    await sleep(rnd(800, 1500));

    const isEmpty = () => (box.innerText || '').trim() === '';
    let submitted = false;
    const markSubmit = () => { submitted = true; };
    const submitBtn = anyOf(S.commentSubmitButton, scope);
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) submitted = true; }, { capture: true });
    submitBtn?.addEventListener('click', markSubmit, { once: true });

    if (cfg.mode === 'auto') {
      if (submitBtn && submitBtn.getAttribute('aria-disabled') !== 'true') {
        submitBtn.click();
      } else {
        box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }));
      }
      submitted = true;
      await sleep(2500);
    }
    let result = 'commented';
    if (!isEmpty()) {
      say('👉 Kiểm tra bình luận rồi bấm Enter để gửi (xoá trắng ô để bỏ qua)', true);
      box.focus();
      const ok = await waitFor(isEmpty, 180000);
      result = (ok && submitted) ? 'commented' : 'skipped';
    }
    await sleep(1500); assertSafe();
    if (openedDialog) await closeDialog(openedDialog);
    return result;
  }

  async function closeDialog(dlg) {
    const c = anyOf(S.closeDialog, dlg);
    if (c) c.click(); else document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await sleep(1200);
  }

  // ---------------------------------------------------------------
  // Vòng lặp chính
  // ---------------------------------------------------------------
  async function run() {
    state.running = true; state.stop = false; state.paused = false;
    stats = { found: 0, liked: 0, commented: 0, shared: 0, skipped: 0 };
    ensurePanel();
    say(`Bắt đầu: Tháng ${cfg.month}/${cfg.year} - chế độ ${cfg.mode === 'auto' ? 'TỰ ĐỘNG' : 'bán tự động'}`);

    let runError = null;
    try {
      if (cfg.useFilter) await applyFilter();
      const seen = new Set();
      let olderStreak = 0, idle = 0, processed = 0;

      while (!state.stop && processed < cfg.maxPosts && idle < 8) {
        await waitIfPaused();
        let progressed = false;

        for (const shareBtn of $$(S.shareButton.join(','))) {
          if (state.stop || processed >= cfg.maxPosts) break;
          const post = getPost(shareBtn);
          const info = await getPostInfo(post);
          const key = info.url || null;
          if (!key || seen.has(key)) continue;
          seen.add(key); progressed = true;

          if (!info.date) continue;
          if (!inTargetMonth(info.date)) {
            if (isOlder(info.date)) olderStreak++;
            continue; // bài ghim / bài mới hơn hoặc cũ hơn tháng chọn
          }
          olderStreak = 0;
          stats.found++;

          const log = await loadLog();
          const prev = log[key] || {};
          const need = {
            like: cfg.doLike && !prev.liked,
            share: cfg.doShare && !prev.shared,
            comment: cfg.doComment && !prev.commented
          };
          if (!need.like && !need.share && !need.comment) { stats.skipped++; say('Bỏ qua bài đã xử lý trước đó'); continue; }

          say(`Đang xử lý bài ngày ${info.date.toLocaleDateString('vi-VN')}`);
          const d = info.date;
          const entry = { date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` };

          if (need.like) {
            const r = await doLike(post);
            if (r === 'liked') stats.liked++;
            entry.liked = r === 'liked' || r === 'already';
            await saveEntry(key, entry); await humanDelay();
          }
          if (need.share && !state.stop) {
            const r = await doShare(post);
            if (r === 'shared') stats.shared++;
            entry.shared = r === 'shared';
            await saveEntry(key, entry); await humanDelay();
          }
          if (need.comment && !state.stop) {
            const r = await doComment(post);
            if (r === 'commented') stats.commented++;
            entry.commented = r === 'commented' || r === 'already';
            await saveEntry(key, entry); await humanDelay();
          }
          processed++;
          say(`Xong ${processed}/${cfg.maxPosts} bài`);
          reportToPem(key);
        }

        if (olderStreak >= 3) { say('Đã hết bài trong tháng đã chọn'); break; }
        idle = progressed ? 0 : idle + 1;
        window.scrollBy({ top: window.innerHeight * 0.8, behavior: 'smooth' });
        await sleep(rnd(1800, 3000));
      }
      if (!state.stop) say(`HOÀN TẤT ✔ (${processed} bài được xử lý)`);
    } catch (e) {
      runError = e?.message || String(e);
      console.warn('[PAS Helper]', e);
    } finally {
      state.running = false;
      chrome.runtime.sendMessage({
        type: 'pemRunFinished',
        summary: { stats, stopped: state.stop, error: runError }
      }).catch(() => {});
    }
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'start') {
      if (state.running) { sendResponse({ ok: false, error: 'Đang chạy rồi' }); return; }
      cfg = msg.cfg; run(); sendResponse({ ok: true });
    } else if (msg.type === 'stop') {
      state.stop = true; sendResponse({ ok: true });
    } else if (msg.type === 'ping') {
      sendResponse({ ok: true, running: state.running });
    }
  });
})();

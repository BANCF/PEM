// Hàm kích hoạt điểm danh có kiểm tra "Đã chạy hôm nay chưa?"
const triggerDailyAttendance = () => {
    let today = new Date().toLocaleDateString('vi-VN');
    chrome.storage.local.get(['ohke_last_run_date'], (res) => {
        if (res.ohke_last_run_date !== today) {
            // Hôm nay chưa chạy -> Kích hoạt
            chrome.storage.local.set({ 'pending_action': 'AUTO_V33' }, () => {
                const targetUrl = "https://idcloud.vn/61892/appstart/classhub/";
                chrome.tabs.query({ url: "*://*.idcloud.vn/*" }, (tabs) => {
                    if (tabs.length > 0) chrome.tabs.update(tabs[0].id, { url: targetUrl, active: true });
                    else chrome.tabs.create({ url: targetUrl, active: true });
                });
            });
        }
    });
};

const setDailyAlarm = () => {
    let now = new Date();
    let scheduled = new Date();
    scheduled.setHours(16, 15, 0, 0);
    
    if (now.getTime() >= scheduled.getTime()) {
        scheduled.setDate(scheduled.getDate() + 1); // Hẹn cho ngày mai
    }
    
    let delayInMinutes = (scheduled.getTime() - now.getTime()) / 60000;
    chrome.alarms.create('daily_attendance', { delayInMinutes, periodInMinutes: 1440 });
};

// ==========================================
// THIẾT LẬP RESET VÉ NGÀY (DAY-PASS EXPIRY)
// ==========================================
const setResetDayPassAlarm = () => {
    let now = new Date();
    let resetScheduled = new Date();
    resetScheduled.setHours(0, 0, 0, 0);
    if (now.getTime() >= resetScheduled.getTime()) resetScheduled.setDate(resetScheduled.getDate() + 1);
    chrome.alarms.create('reset_day_pass', { delayInMinutes: (resetScheduled.getTime() - now.getTime()) / 60000, periodInMinutes: 1440 });
};
setResetDayPassAlarm(); // Gọi ngay khi khởi chạy background

chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.set({ 'ohke_in_class_auto': "" });
    setResetDayPassAlarm();
});

// 2. Lắng nghe lệnh từ content.js
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === 'ENABLE_DAILY_CRON') {
        setDailyAlarm();
        let now = new Date();
        if (now.getHours() > 16 || (now.getHours() === 16 && now.getMinutes() >= 15)) {
            triggerDailyAttendance();
        }
        sendResponse({status: "Alarm set"});
    } else if (msg.action === 'DISABLE_DAILY_CRON') {
        chrome.alarms.clear('daily_attendance');
        sendResponse({status: "Alarm cleared"});
    } else if (msg.action === 'OPEN_CLASSHUB_TAB') {
        // Mở tab mới khi user bấm nút Bật Auto từ trang ngoài
        chrome.storage.local.get(['pending_action'], (res) => {
            let act = res.pending_action || 'AUTO_V33'; // Không ghi đè nếu đã set (vd: AUTO_SCOUT_IN_CLASS)
            chrome.storage.local.set({ 'pending_action': act }, () => {
                const targetUrl = "https://idcloud.vn/61892/appstart/classhub/";
                chrome.tabs.create({ url: targetUrl, active: true });
            });
        });
        sendResponse({status: "Tab opened"});
    } else if (msg.action === 'ACTION_SCHEDULE_SYNCED') {
        let schedule = msg.schedule || [];
        schedule.forEach(item => {
            let triggerTime = item.triggerTime;
            if (triggerTime <= Date.now()) triggerTime = Date.now() + 5000; // Trễ 5s an toàn
            chrome.alarms.create(`in_class_${item.id}`, { when: triggerTime });
        });
        sendResponse({status: "Schedule synced"});
    } else if (msg.action === 'ACTION_SUICIDE_TAB') {
        if (sender.tab && sender.tab.id) {
            try {
                chrome.tabs.remove(sender.tab.id).catch(() => {});
            } catch(e) {}
        }
        sendResponse({status: "Tab closed"});
    }
    return true;
});

// Lắng nghe chuông báo thức (Hoạt động cả khi mở trình duyệt trễ)
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'daily_attendance') {
        triggerDailyAttendance();
    } else if (alarm.name === 'reset_day_pass') {
        chrome.storage.local.set({ 'ohke_in_class_auto': "" });
    } else if (alarm.name.startsWith('in_class_')) {
        let classId = alarm.name.replace('in_class_', '');
        chrome.tabs.create({ 
            url: "https://idcloud.vn/61892/appstart/classhub?mode=ghost_attendance&id=" + classId, 
            active: true, 
            pinned: true 
        });
    }
});

// 1. Click icon -> Bơm tool vào trang hiện tại (Floating Control Center)
chrome.action.onClicked.addListener((tab) => {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['xlsx.full.min.js', 'content.js']
    }).catch(err => console.log("Lỗi chèn tool: Trang này không hỗ trợ Extension."));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes("idcloud.vn")) {
        chrome.storage.local.get(['pending_action'], (res) => {
            if (res.pending_action || tab.url.includes('mode=ghost_attendance')) {
                setTimeout(() => {
                    chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ['xlsx.full.min.js', 'content.js']
                    }).catch(err => console.log("Lỗi chèn tool tự động:", err));
                }, 1000);
            }
        });
    }
});
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
        chrome.storage.local.set({ 'pending_action': 'AUTO_V33' }, () => {
            const targetUrl = "https://idcloud.vn/61892/appstart/classhub/";
            chrome.tabs.create({ url: targetUrl, active: true });
        });
        sendResponse({status: "Tab opened"});
    }
    return true;
});

// Lắng nghe chuông báo thức (Hoạt động cả khi mở trình duyệt trễ)
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'daily_attendance') {
        triggerDailyAttendance();
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
            if (res.pending_action) {
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
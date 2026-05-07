chrome.action.onClicked.addListener((tab) => {
    chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['xlsx.full.min.js', 'content.js']
    }).catch(err => console.log("Lỗi chèn tool:", err));
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Chỉ kích hoạt khi tab load complete và url hợp lệ
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes("idcloud.vn")) {
        chrome.storage.local.get(['pending_action'], (res) => {
            if (res.pending_action) {
                // Đợi 1 giây để giao diện React/Angular của ClassHub nạp xong
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
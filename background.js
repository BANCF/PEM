chrome.action.onClicked.addListener((tab) => {
    if (tab.url.includes("idcloud.vn") && (tab.url.includes("classhub") || tab.url.includes("classroom"))) {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['xlsx.full.min.js', 'content.js']
        });
    }
});
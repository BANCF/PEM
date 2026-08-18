const express = require('express');
const cors = require('cors');
const ClasshubAPI = require('./ClasshubAPI');

const app = express();
app.use(cors());
app.use(express.json());

let clients = [];
let currentAPI = null;
let foundClasses = [];

// Gửi Log tới tất cả kết nối SSE
function sendLog(message) {
    clients.forEach(client => client.res.write(`data: ${JSON.stringify({ message })}\n\n`));
}

// 1. Kênh Stream Log (SSE)
app.get('/api/stream', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    clients.push({ req, res });
    res.write(`data: ${JSON.stringify({ message: "🟢 Đã kết nối luồng Log Console..." })}\n\n`);

    req.on('close', () => {
        clients = clients.filter(c => c.req !== req);
    });
});

// 2. Kênh Connect
app.post('/api/connect', async (req, res) => {
    const { loginUrl, username, password, rawCookie, tenantId = "61892", teacherName } = req.body;
    
    // Khởi tạo API (với teacherName tạm thời là "Unknown" nếu chưa nhập)
    currentAPI = new ClasshubAPI(tenantId, teacherName || "Unknown", sendLog);
    
    if (rawCookie) {
        currentAPI.setRawCookie(rawCookie);
        if (!teacherName) {
            let huntRes = await currentAPI.autoHuntTeacherName();
            if (!huntRes.success) return res.status(400).json({ success: false, message: "Không thể tự động tìm Tên Giáo Viên. Vui lòng nhập thủ công!" });
        }
        return res.json({ success: true, message: "Đã nạp Cookie thủ công thành công" });
    }
    
    if (!loginUrl || !username || !password) {
        return res.status(400).json({ success: false, message: "Thiếu thông tin đăng nhập" });
    }

    let loginResult = await currentAPI.login(loginUrl, username, password);
    if (!loginResult.success) {
        return res.status(401).json({ success: false, message: loginResult.error });
    }

    // Tự động tìm tên giáo viên nếu chưa nhập
    if (!teacherName) {
        let huntRes = await currentAPI.autoHuntTeacherName();
        if (!huntRes.success) return res.status(400).json({ success: false, message: "Đăng nhập thành công nhưng không tìm thấy Tên Giáo Viên. Vui lòng thử nhập tay!" });
    }

    res.json({ success: true, message: "Đăng nhập Ohke thành công!" });
});

// 3. Kênh Scan
app.post('/api/scan', async (req, res) => {
    if (!currentAPI) return res.status(400).json({ success: false, message: "Vui lòng Kết Nối trước" });
    
    sendLog("======================================");
    sendLog(`Bắt đầu quy trình quét lớp cho: ${currentAPI.teacherName}`);
    
    let allClasses = await currentAPI.scanAllClasses();
    sendLog(`Đã thu thập được ${allClasses.length} lớp học thô trên hệ thống.`);
    
    foundClasses = currentAPI.filterMyClasses(allClasses);
    sendLog(`Đã lọc ra ${foundClasses.length} lớp học của ${currentAPI.teacherName}.`);
    
    // Lọc thêm các lớp ĐỦ ĐIỀU KIỆN ĐIỂM DANH (chưa chốt sổ và đã đến giờ)
    let eligibleClasses = currentAPI.getEligibleClasses(foundClasses);
    foundClasses = eligibleClasses; // Lưu lại để dùng cho API attendance
    sendLog(`Đã chọn ra ${eligibleClasses.length} lớp học đủ điều kiện điểm danh.`);
    
    res.json({ success: true, count: eligibleClasses.length, classes: eligibleClasses });
});

// 4. Kênh Attendance
app.post('/api/attendance', async (req, res) => {
    if (!currentAPI) return res.status(400).json({ success: false, message: "Chưa kết nối Ohke" });
    if (foundClasses.length === 0) return res.status(400).json({ success: false, message: "Không có lớp học nào để điểm danh" });

    res.json({ success: true, message: "Đang tiến hành điểm danh ngầm..." });
    
    sendLog("======================================");
    sendLog(`BẮT ĐẦU CHẠY ĐIỂM DANH CHO ${foundClasses.length} LỚP...`);

    // Chạy ngầm điểm danh
    (async () => {
        for (let c of foundClasses) {
            await currentAPI.submitAttendanceFlow(c);
            await new Promise(r => setTimeout(r, 1000));
        }
        sendLog("🎉 QUÁ TRÌNH ĐIỂM DANH ĐÃ HOÀN TẤT TRỌN VẸN!");
    })();
});

// 4. Kênh Hủy Điểm Danh Tương Lai
app.post('/api/revert-future', async (req, res) => {
    if (!currentAPI) {
        return res.status(400).json({ success: false, message: "Chưa kết nối Ohke" });
    }

    try {
        let allMyClasses = await currentAPI.scanAllClasses();
        let revertRes = await currentAPI.revertFutureClasses(allMyClasses);
        res.json({ success: true, count: revertRes.count });
    } catch(e) {
        res.status(500).json({ success: false, message: e.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 Classhub Backend Server đang chạy tại http://localhost:${PORT}`);
});

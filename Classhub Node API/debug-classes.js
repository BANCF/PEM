const ClasshubAPI = require('./ClasshubAPI');
const api = new ClasshubAPI('61892', 'vuhoanglinh', console.log, null);
const fs = require('fs');

async function test() {
    let cookies = [];
    try {
        cookies = JSON.parse(fs.readFileSync('cookies.json', 'utf8'));
    } catch(e) {}
    api.setRawCookie(cookies.map(c => `${c.name}=${c.value}`).join('; '));

    let classes = await api.scanAllClasses();
    console.log(`\n============== REPORT ==============`);
    console.log(`Tìm thấy tổng cộng ${classes.length} lớp.`);
    for (let c of classes) {
        let entity = c.entity || c;
        let time = entity.class_hour_start_time || "";
        let code = entity.class_hour_code || entity.class_name || c.id;
        let studentStatus = String(entity.attendance_sheet_status || "").toUpperCase();
        let teacherStatus = String(entity.instructor_attendance_status || entity.instructor_attendance_sheet_status || "").toUpperCase();
        let oldStatus = String(entity.status || "").toUpperCase();
        
        let unlockInfo = api.getClassUnlockInfo(entity, 5);
        
        console.log(`[${time}] ${code}`);
        console.log(`   ├─ HS: ${studentStatus}`);
        console.log(`   ├─ GV: ${teacherStatus}`);
        console.log(`   ├─ T: ${oldStatus}`);
        console.log(`   └─ Safe: ${unlockInfo.isSafe}`);
    }
}
test();

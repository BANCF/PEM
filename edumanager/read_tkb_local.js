const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.resolve('..', 'TKB Tuần 8 năm 2026.xlsx');

try {
  const workbook = XLSX.readFile(filePath);
  const worksheet = workbook.Sheets['TKB SangChieu'];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
  
  // Row 1 (0-indexed) has class names
  const classCols = {}; // colIndex -> ClassName
  const row1 = data[1];
  for (let c = 0; c < row1.length; c++) {
    const val = row1[c];
    if (val && typeof val === 'string' && val !== 'Thứ' && val !== 'Tiết' && val !== 'Thời gian') {
      classCols[c] = val.trim();
    }
  }

  const teacherSchedules = {}; // name -> { Day: { Period: { Class, Subject, Time } } }
  
  let currentDay = null;
  let currentPeriod = null;
  let currentTime = null;

  for (let r = 2; r < data.length; r++) {
    const row = data[r];
    
    // Column 0 is Day
    if (row[0]) {
      currentDay = row[0].toString().trim();
    }
    
    if (!currentDay) continue;

    // We have multiple 'Tiết' and 'Thời gian' columns (e.g. at 1, 2, or 15, 16)
    // We just take the first valid ones for the current row to represent the period.
    // Or just look at col 1 and 2.
    let period = row[1] || row[15] || row[61] || row[76]; 
    let time = row[2] || row[16] || row[62] || row[77];

    if (!period && !time) continue;

    for (const cStr in classCols) {
      const c = parseInt(cStr);
      const className = classCols[c];
      
      const subject = row[c];
      const teacherStr = row[c+1]; // Teacher can be comma/slash separated

      if (subject && teacherStr) {
        const teachers = teacherStr.toString().split(/[\/,]/).map(t => t.trim()).filter(t => t);
        for (const t of teachers) {
          if (!teacherSchedules[t]) teacherSchedules[t] = {};
          if (!teacherSchedules[t][currentDay]) teacherSchedules[t][currentDay] = [];
          
          teacherSchedules[t][currentDay].push({
            period: period?.toString().trim(),
            time: time?.toString().trim(),
            className: className,
            subject: subject.toString().trim()
          });
        }
      }
    }
  }

  fs.writeFileSync('parsed_schedule.json', JSON.stringify({
    classesFound: Object.values(classCols),
    teachersFound: Object.keys(teacherSchedules).length,
    sampleTeacher: teacherSchedules['Huyền']
  }, null, 2));
  console.log("Wrote to parsed_schedule.json");
} catch (e) {
  console.error("Error reading file:", e);
}

const fs = require('fs');
let code = fs.readFileSync('../content.js', 'utf8');
let actions = [...code.matchAll(/bttAction_[^\s"']+/g)].map(m => m[0]);
let markAll = [...code.matchAll(/MARK_ALL_STUDENT_ATTENDANCE_RECORDS_AS_PRESENT/g)].map(m => m[0]);
console.log('Actions:', [...new Set(actions)]);
console.log('MarkAll:', [...new Set(markAll)]);

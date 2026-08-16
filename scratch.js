const fs = require('fs'); 
let html = fs.readFileSync('idcloud.vn/robots.txt.html', 'utf8'); 
let ohkePrefix = 'field-a2njke547h'; 
let r = new RegExp(`ojs\\['${ohkePrefix}'\\][\\s\\S]*?/([a-zA-Z0-9_]+)_(?:Viewer|Model)`); 
console.log(html.match(r));

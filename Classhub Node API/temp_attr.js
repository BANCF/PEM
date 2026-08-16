const fs = require('fs');
let content = fs.readFileSync('debug_x253B2_Model.json', 'utf8');
let json = JSON.parse(content);
let html = json.html;
let idx = html.indexOf('V&utilde; Ho&agrave;ng Linh');
let leftStr = html.substring(Math.max(0, idx - 2000), idx);
let eqMatches = [...leftStr.matchAll(/([a-zA-Z0-9_-]+)=(['"])/g)];
if (eqMatches.length > 0) {
    let lastMatch = eqMatches[eqMatches.length - 1];
    console.log('Attribute name:', lastMatch[1]);
}

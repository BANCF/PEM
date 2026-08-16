const fs = require('fs');
let content = fs.readFileSync('debug_x253B2_Model.json', 'utf8');
let json = JSON.parse(content);
let html = json.html;
let dataEnvMatches = html.match(/data-env=(['"])(.*?)\1/g);
console.log('data-env inside HTML:', dataEnvMatches ? dataEnvMatches.length : 0);
let scriptMatches = html.match(/<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi);
console.log('script json inside HTML:', scriptMatches ? scriptMatches.length : 0);

if (scriptMatches) {
    let rawJson = scriptMatches[0].replace(/<script[^>]*>|<\/script>/gi, '');
    let parsed = JSON.parse(rawJson);
    if (parsed.data) {
        console.log('Found data array! Length:', parsed.data.length);
        console.log('First item:', JSON.stringify(parsed.data[0]).substring(0, 100));
    } else {
        console.log('Parsed script json keys:', Object.keys(parsed));
        if (parsed.p2c) console.log('p2c:', parsed.p2c);
    }
}

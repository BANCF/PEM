const fs = require('fs');
let html = fs.readFileSync('debug_study.html', 'utf8');
let envMatches = html.match(/data-env=(['"])(.*?)\1/g);
console.log('data-env inside HTML:', envMatches ? envMatches.length : 0);
if (envMatches) {
    let e = envMatches[0];
    let m = e.match(/data-env=(['"])(.*?)\1/);
    if (m) {
        let content = m[2];
        content = content.replace(/&quot;/g, '"').replace(/&lbrace;/g, '{').replace(/&lcub;/g, '{').replace(/&rbrace;/g, '}').replace(/&rcub;/g, '}').replace(/&lowbar;/g, '_').replace(/&colon;/g, ':').replace(/&comma;/g, ',').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        try {
            let json = JSON.parse(content);
            console.log('Parsed Env 0 Prefix:', json.ohke_prefix, 'SubformID:', json[':field_subform_id']);
        } catch(err) {}
    }
}
let scriptIdx = html.indexOf('let url =');
if (scriptIdx !== -1) {
    console.log('URL snippet:', html.substring(scriptIdx, scriptIdx + 100));
}

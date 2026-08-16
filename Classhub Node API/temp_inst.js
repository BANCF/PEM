const fs = require('fs');
let content = fs.readFileSync('debug_x253B2_Model.json', 'utf8');
let json = JSON.parse(content);
let html = json.html;
let matches = html.match(/data-entity=(['"])(.*?)\1/g);
if (matches && matches.length > 0) {
    let e = matches[0];
    let m = e.match(/data-entity=(['"])(.*?)\1/);
    let str = m[2];
    str = str.replace(/&quot;/g, '"').replace(/&lbrace;/g, '{').replace(/&lcub;/g, '{').replace(/&rbrace;/g, '}').replace(/&rcub;/g, '}').replace(/&lbrack;/g, '[').replace(/&rsqb;/g, ']').replace(/&lowbar;/g, '_').replace(/&colon;/g, ':').replace(/&comma;/g, ',').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    try {
        let parsed = JSON.parse(str);
        console.log('main_instructor:', parsed.main_instructor);
        console.log('__main_instructor:', parsed['__main_instructor']);
        console.log('instructor_site_ids:', parsed.instructor_site_ids);
        console.log('__instructor_site_ids:', parsed['__instructor_site_ids']);
    } catch(err) { console.log(err.message); }
}

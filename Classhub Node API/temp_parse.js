const fs = require('fs');
let html = fs.readFileSync('debug_html_direct.html', 'utf8');
let envMatches = html.match(/data-env=(['"])(.*?)\1/g);
if (envMatches) {
    envMatches.forEach((e, i) => {
        let m = e.match(/data-env=(['"])(.*?)\1/);
        if (m) {
            let content = m[2];
            content = content.replace(/&quot;/g, '"')
                             .replace(/&lbrace;/g, '{')
                             .replace(/&lcub;/g, '{')
                             .replace(/&rbrace;/g, '}')
                             .replace(/&rcub;/g, '}')
                             .replace(/&lowbar;/g, '_')
                             .replace(/&colon;/g, ':')
                             .replace(/&comma;/g, ',')
                             .replace(/&amp;/g, '&')
                             .replace(/&lt;/g, '<')
                             .replace(/&gt;/g, '>');
            try {
                let json = JSON.parse(content);
                console.log('Parsed Env', i, 'Prefix:', json.ohke_prefix, 'SubformID:', json[':field_subform_id']);
            } catch(err) {
                console.log('Failed to parse Env', i, err.message);
            }
        }
    });
}

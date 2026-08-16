const fs = require('fs');
let content = fs.readFileSync('debug_x253B2_Model.json', 'utf8');
let json = JSON.parse(content);
let html = json.html;

let envMatches = html.match(/data-env=(['"])(.*?)\1/g);
console.log('data-env matches:', envMatches ? envMatches.length : 0);
if (envMatches) {
    envMatches.forEach((e, i) => {
        let m = e.match(/data-env=(['"])(.*?)\1/);
        if (m) {
            let dataStr = m[2];
            dataStr = dataStr.replace(/&quot;/g, '"').replace(/&lbrace;/g, '{').replace(/&lcub;/g, '{').replace(/&rbrace;/g, '}').replace(/&rcub;/g, '}').replace(/&lowbar;/g, '_').replace(/&colon;/g, ':').replace(/&comma;/g, ',').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
            try {
                let parsed = JSON.parse(dataStr);
                if (parsed.study_class_id || parsed.id) {
                    console.log('Env', i, 'Class Name:', parsed.class_name, 'Teacher:', parsed.instructor);
                } else if (parsed.ohke_prefix) {
                    console.log('Env', i, 'SubformID:', parsed[':field_subform_id']);
                }
            } catch(err) {}
        }
    });
}

const fs = require('fs');

const html = fs.readFileSync('scratch/classhub_response.html', 'utf8');
const regex = /data-entity="([^"]+)"/g;

let matches;
const classes = [];

function decodeHtmlEntities(text) {
  return text
    .replace(/&lbrace;/g, '{')
    .replace(/&rcub;/g, '}')
    .replace(/&quot;/g, '"')
    .replace(/&colon;/g, ':')
    .replace(/&comma;/g, ',')
    .replace(/&lbrack;/g, '[')
    .replace(/&rsqb;/g, ']')
    .replace(/&lowbar;/g, '_')
    .replace(/&num;/g, '#')
    .replace(/&amp;/g, '&')
    .replace(/&bsol;/g, '\\')
    .replace(/&sol;/g, '/')
    .replace(/&abreve;/g, 'ă') // Handle Vietnamese entities if necessary, though it's inside JSON strings
    // In many cases, it might be easier to use a proper decoder, but let's try this first
}

while ((matches = regex.exec(html)) !== null) {
  let encoded = matches[1];
  if (encoded.includes('&lbrace;')) {
    let decoded = decodeHtmlEntities(encoded);
    try {
      let data = JSON.parse(decoded);
      if (data.id && data.student_class_name && data.study_module_code) {
        classes.push(data);
      }
    } catch (e) {
      console.error("Parse error for:", decoded.substring(0, 50), e);
    }
  }
}

console.log("Found classes:", classes.length);
if (classes.length > 0) {
  console.log(classes[0]);
}

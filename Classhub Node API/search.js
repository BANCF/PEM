const fs = require('fs'); const code = fs.readFileSync('../content.js', 'utf8'); const matches = [...code.matchAll(/API 3:[\s\S]*?API 4:/g)]; for (const m of matches) console.log('===\n', m[0]);

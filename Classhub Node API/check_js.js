const axios = require('axios');
axios.get('https://idcloud.vn/61892/appstart/digitalismspace/login').then(async r => {
    let html = r.data;
    let scripts = html.match(/<script src="([^"]+)"><\/script>/g);
    console.log("Scripts:", scripts);
    
    // We want to find ohke.js or similar and check 'getData'
    let ohkeUrl = 'https://idcloud.vn/appstart/resource/js/ohke.js'; // guess
    try {
        let js = await axios.get(ohkeUrl);
        if (js.data.includes('getData')) {
            let m = js.data.match(/getData.*?\{([\s\S]*?)\}/);
            console.log("getData function snippet:\n", m ? m[0].substring(0, 500) : "not found");
        }
    } catch(e) {}
});

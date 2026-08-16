const ClasshubAPI = require('./ClasshubAPI');
let api = new ClasshubAPI('61892', 'Linh', console.log);
api.setRawCookie('PHPSESSID=dffkehnpd7d6sssve3tm8hj74n');
api.client.get('/61892/appstart/study_class/').then(res => {
    let html = res.data;
    console.log('Fetched study_class, length:', html.length);
    let envMatches = html.match(/data-env=(['"])(.*?)\1/g);
    console.log('Tabs:', envMatches ? envMatches.length : 0);
}).catch(e => console.log('Error', e.message));

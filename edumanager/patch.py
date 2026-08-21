import re

with open('src/lib/services/classhub.api.ts', 'r', encoding='utf-8') as f:
    content = f.read()

target = '''            // Cơ chế Retry & Backoff cho Cold Session Concurrency Lock
            for (let retry = 0; retry < 2; retry++) {
                resModel = await this.rpcCall(apiUrl, fetchPayload);
                if (!resModel || (!resModel.data && !resModel.html)) {
                    if (retry === 0) {
                        this.log(  🔄 [TIER 1] API trả về rỗng. Đang đợi 1000ms để thử lại (Tránh Ohke Cold Session)...);
                        await new Promise(r => setTimeout(r, 1000));
                        continue;
                    }
                } else {
                    break; // Thành công hoặc có data thì thoát vòng lặp
                }
            }

            if (resModel && !resModel.data && resModel.html) {
                let entityMatches = resModel.html.match(/data-entity=(['"])(.*?)\\1/g);
                if (entityMatches && entityMatches.length > 0) {
                    resModel.data = [];
                    for (let e of entityMatches) {
                        let m = e.match(/data-entity=(['"])(.*?)\\1/);
                        if (m) {
                            let str = m[2];
                            str = str.replace(/&quot;/g, '"').replace(/&lbrace;/g, '{').replace(/&lcub;/g, '{')
                                .replace(/&rbrace;/g, '}').replace(/&rcub;/g, '}').replace(/&lbrack;/g, '[')
                                .replace(/&rsqb;/g, ']').replace(/&lowbar;/g, '_').replace(/&colon;/g, ':')
                                .replace(/&comma;/g, ',').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
                                .replace(/&gt;/g, '>');
                            try {
                                resModel.data.push(JSON.parse(str));
                            } catch (err) { }
                        }
                    }
                }
            }'''

replacement = '''            // Cơ chế Retry & Backoff Bọc Thép (Xử lý Ohke Load Balancer Multi-Worker)
            for (let retry = 0; retry < 3; retry++) {
                resModel = await this.rpcCall(apiUrl, fetchPayload);
                
                // Tiền xử lý html để lấy data
                if (resModel && !resModel.data && resModel.html) {
                    let entityMatches = resModel.html.match(/data-entity=(['"])(.*?)\\1/g);
                    if (entityMatches && entityMatches.length > 0) {
                        resModel.data = [];
                        for (let e of entityMatches) {
                            let m = e.match(/data-entity=(['"])(.*?)\\1/);
                            if (m) {
                                let str = m[2];
                                str = str.replace(/&quot;/g, '"').replace(/&lbrace;/g, '{').replace(/&lcub;/g, '{')
                                    .replace(/&rbrace;/g, '}').replace(/&rcub;/g, '}').replace(/&lbrack;/g, '[')
                                    .replace(/&rsqb;/g, ']').replace(/&lowbar;/g, '_').replace(/&colon;/g, ':')
                                    .replace(/&comma;/g, ',').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
                                    .replace(/&gt;/g, '>');
                                try {
                                    resModel.data.push(JSON.parse(str));
                                } catch (err) { }
                            }
                        }
                    }
                }

                // Kiểm tra xem data có thực sự được bóc ra không?
                if (!resModel || !resModel.data || resModel.data.length === 0) {
                    if (retry < 2) {
                        this.log(  🔄 [TIER 1] Ohke Cold Node phát hiện (API trống). Đang đợi ms để thử lại...);
                        await new Promise(r => setTimeout(r, 1000 * (retry + 1)));
                        continue;
                    }
                } else {
                    break;
                }
            }'''

content = content.replace(target, replacement)

with open('src/lib/services/classhub.api.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")

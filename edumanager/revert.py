import re

with open('src/lib/services/classhub.api.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# find the whole for loop for retry
match = re.search(r'// Cơ chế Retry & Backoff Bọc Thép \(Xử lý Ohke Load Balancer Multi-Worker\).*?break;\s*\}\s*\}', content, re.DOTALL)

if match:
    replacement = '''            // Cơ chế Retry & Backoff cho Cold Session Concurrency Lock
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
                            } catch(err) {}
                        }
                    }
                }
            }'''
    content = content[:match.start()] + replacement + content[match.end():]
    with open('src/lib/services/classhub.api.ts', 'w', encoding='utf-8') as f:
        f.write(content)
    print("Done revert api")
else:
    print("Regex not matched api!")

with open('src/lib/services/classhub.service.ts', 'r', encoding='utf-8') as f2:
    content2 = f2.read()

match2 = re.search(r'// Bắn 1 request mồi \(Warm-up ping\) vào đúng API x24F76_Model để đánh thức Cold Session.*?\} catch\(e\) \{\}', content2, re.DOTALL)
if match2:
    rep2 = '''// Bắn 1 request mồi (Warm-up ping) để đánh thức Cold Session trên server Ohke
          // tránh bị drop khi 5 requests đồng thời ập tới ở vòng lặp sau.
          try {
              api.log("🔥 Đang gửi request mồi (Warm-up) để đánh thức Ohke Session...");
              await api.rpcCall(//appstart/classhub/xSB_Model, { ":field_subform_id": 0, "page": 0, "params": {} });
          } catch(e) {}'''
    content2 = content2[:match2.start()] + rep2 + content2[match2.end():]
    with open('src/lib/services/classhub.service.ts', 'w', encoding='utf-8') as f2_out:
        f2_out.write(content2)
    print("Done revert service")
else:
    print("Regex not matched service!")

import re

with open('src/lib/services/classhub.api.ts', 'r', encoding='utf-8') as f:
    content = f.read()

content = re.sub(r'this\.log\(  🔄 \[TIER 1\] Ohke Cold Node phát hiện \(API trống\)\. Đang đợi ms để thử lại\.\.\.\);', 'this.log(  🔄 [TIER 1] Ohke Cold Node phát hiện (API trống). Đang đợi ms để thử lại...);', content)

with open('src/lib/services/classhub.api.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print("Done fix")

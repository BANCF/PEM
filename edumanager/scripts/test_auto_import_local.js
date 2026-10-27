const fs = require('fs');
const path = require('path');

async function testLocalImport() {
  const targetUrl = process.env.PEM_URL || "http://localhost:3000/api/schedule/auto-import";
  const secretKey = process.env.TKB_AUTO_IMPORT_SECRET || "PEM_TKB_SECRET_2026";

  console.log(`📡 Đang gửi request test tới: ${targetUrl}`);

  // Tìm file Excel mẫu trong thư mục
  let sampleFilePath = path.resolve(__dirname, '..', 'TKB Tuần 8 năm 2026.xlsx');
  if (!fs.existsSync(sampleFilePath)) {
    // Check if there's any xlsx in parent or current dir
    const files = fs.readdirSync(path.resolve(__dirname, '..')).filter(f => f.endsWith('.xlsx'));
    if (files.length > 0) {
      sampleFilePath = path.resolve(__dirname, '..', files[0]);
    }
  }

  if (!fs.existsSync(sampleFilePath)) {
    console.error("❌ Không tìm thấy tệp .xlsx mẫu để test.");
    console.log("ℹ️ Tuy nhiên, bạn có thể tạo thử request với Base64 dữ liệu giả lập.");
    return;
  }

  console.log(`📄 Đọc file mẫu: ${sampleFilePath}`);
  const fileBuffer = fs.readFileSync(sampleFilePath);
  const base64Data = fileBuffer.toString('base64');

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-import-secret': secretKey
      },
      body: JSON.stringify({
        fileName: path.basename(sampleFilePath),
        fileBase64: base64Data,
        weekName: "Tuần 8 (Test Local)"
      })
    });

    const result = await response.json();
    console.log("----------------------------------------");
    console.log(`Status Code: ${response.status}`);
    console.log("KẾT QUẢ PHẢN HỒI:");
    console.log(JSON.stringify(result, null, 2));
    console.log("----------------------------------------");
  } catch (err) {
    console.error("❌ Lỗi kết nối tới Server local:", err.message);
  }
}

testLocalImport();

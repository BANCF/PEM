const http = require('http');

console.log('🚀 Đang chạy giả lập Vercel Cron cho môi trường Local...');
console.log('Hệ thống sẽ tự động quét và gửi thông báo báo tiết mỗi 60 giây.\n');

setInterval(() => {
  const now = new Date();
  console.log(`[${now.toLocaleTimeString()}] Đang gọi API Cron /api/cron/reminders/class-start...`);
  
  // Gọi API local (giả sử Next.js đang chạy ở cổng 3000)
  http.get('http://localhost:3000/api/cron/reminders/class-start?secret=my-super-secret-cron-key', (res) => {
    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });
    res.on('end', () => {
      console.log(`[KẾT QUẢ]: ${data}\n`);
    });
  }).on('error', (err) => {
    console.log(`[LỖI]: Không thể kết nối tới máy chủ Local (Có thể bạn chưa chạy npm run dev). Lỗi: ${err.message}\n`);
  });
}, 60000);

// Gọi thử ngay lần đầu tiên
console.log('Đang gọi thử lần 1...');
http.get('http://localhost:3000/api/cron/reminders/class-start?secret=my-super-secret-cron-key', (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log(`[KẾT QUẢ LẦN 1]: ${data}\n`);
  });
}).on('error', (err) => {
    console.log(`[LỖI LẦN 1]: Không thể kết nối. ${err.message}\n`);
});

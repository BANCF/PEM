import puppeteer, { Browser, Page } from 'puppeteer';

export class AttendanceBot {
  private static readonly CLASS_VIEWER_URL = 'https://idcloud.vn/47817/appstart/classroom_pro/Viewer/';

  /**
   * Run the attendance bot to mark attendance for multiple classes
   */
  static async runBulkAttendance(cookie: string, classIds: string[]): Promise<{ success: boolean; message: string; details: any[] }> {
    let browser: Browser | null = null;
    const details = [];
    let successCount = 0;
    
    try {
      console.log(`[AttendanceBot] Khởi động trình duyệt quét ${classIds.length} lớp...`);
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();
      
      // Inject session cookie
      await page.setCookie({
        name: 'PHPSESSID',
        value: cookie,
        domain: 'idcloud.vn'
      });

      for (const classId of classIds) {
        console.log(`[AttendanceBot] Điều hướng tới URL lớp ${classId}...`);
        try {
          await page.goto(`${this.CLASS_VIEWER_URL}${classId}`, { waitUntil: 'networkidle2' });

          console.log(`[AttendanceBot] Lớp ${classId}: Đang tìm tab Attendance...`);
          const clickedTab = await page.evaluate(() => {
            const tabs = Array.from(document.querySelectorAll('.ohke-tab-btn'));
            const attendanceTab = tabs.find(t => (t as HTMLElement).innerText.includes('Attendance'));
            if (attendanceTab) {
              (attendanceTab as HTMLElement).click();
              return true;
            }
            return false;
          });

          if (!clickedTab) {
            console.log(`[AttendanceBot] Lớp ${classId}: Không tìm thấy tab Attendance.`);
            details.push({ classId, status: 'skipped', reason: 'Không có tab Attendance' });
            continue;
          }
          
          console.log(`[AttendanceBot] Lớp ${classId}: Chờ Attendance Center tải dữ liệu...`);
          try {
            await page.waitForFunction(() => {
              const text = document.body.innerText.toUpperCase();
              return text.includes("TEACHER'S ATTENDANCE") || text.includes("MARK ALL AS PRESENT");
            }, { timeout: 8000 });
          } catch (e) {
            console.log(`[AttendanceBot] Lớp ${classId}: Không có tiết điểm danh hôm nay hoặc bị timeout.`);
            details.push({ classId, status: 'skipped', reason: 'Không có nút điểm danh' });
            continue;
          }

          console.log(`[AttendanceBot] Lớp ${classId}: Tìm nút điểm danh giáo viên...`);
          const clickedTeacher = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('a, button, div, span'));
            const btn = btns.find(b => {
              const text = (b as HTMLElement).innerText.toUpperCase();
              return text.includes("TEACHER'S ATTENDANCE NOT YET MARKED") || text.includes("TEACHER 'S ATTENDANCE NOT YET MARKED");
            });
            if (btn) {
              (btn as HTMLElement).click();
              return true;
            }
            return false;
          });

          if (clickedTeacher) {
            console.log(`[AttendanceBot] Lớp ${classId}: Đã mở modal giáo viên. Đang tìm nút PRESENT...`);
            await new Promise(r => setTimeout(r, 1500));
            
            const clickedPresent = await page.evaluate(() => {
              const btns = Array.from(document.querySelectorAll('a, button, div'));
              const btn = btns.find(b => {
                const text = (b as HTMLElement).innerText.toUpperCase();
                return text.includes('PRESENT') && !text.includes('NOT YET MARKED');
              });
              if (btn) {
                (btn as HTMLElement).click();
                return true;
              }
              return false;
            });
            
            if (clickedPresent) {
              console.log(`[AttendanceBot] Lớp ${classId}: Điểm danh giáo viên thành công!`);
              await new Promise(r => setTimeout(r, 1500));
            }
          }

          console.log(`[AttendanceBot] Lớp ${classId}: Tìm nút điểm danh học sinh...`);
          const clickedMarkAll = await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll('a, button, div'));
            const btn = btns.find(b => {
              const text = (b as HTMLElement).innerText.toUpperCase();
              return text.includes('MARK ALL AS PRESENT');
            });
            if (btn) {
              (btn as HTMLElement).click();
              return true;
            }
            return false;
          });

          if (clickedMarkAll) {
            console.log(`[AttendanceBot] Lớp ${classId}: Điểm danh học sinh thành công!`);
            // Đợi hệ thống save dữ liệu
            await new Promise(r => setTimeout(r, 3000));
            details.push({ classId, status: 'success', reason: 'Đã điểm danh học sinh' });
            successCount++;
          } else {
            console.log(`[AttendanceBot] Lớp ${classId}: Không tìm thấy nút Mark All As Present (có thể đã điểm danh).`);
            details.push({ classId, status: 'skipped', reason: 'Học sinh đã được điểm danh' });
          }
        } catch (innerErr) {
          console.error(`[AttendanceBot] Lỗi khi xử lý lớp ${classId}:`, innerErr);
          details.push({ classId, status: 'error', reason: 'Lỗi không xác định' });
        }
      } // End of loop
      
      return {
        success: true,
        message: `Hoàn tất quét ${classIds.length} lớp. Đã điểm danh thành công ${successCount} lớp có tiết hôm nay.`,
        details
      };

    } catch (err: any) {
      console.error(`[AttendanceBot] Lỗi hệ thống:`, err);
      return {
        success: false,
        message: err.message || "Lỗi không xác định khi chạy Bot.",
        details
      };
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }
}

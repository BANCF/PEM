import { adminDb } from "@/lib/firebase/admin";
import crypto from "crypto";

const IDCLOUD_LOGIN_URL = "https://idcloud.vn/61892/appstart/digitalismspace/jsonPostSignIn";

export class ClassHubService {
  /**
   * Đảm bảo lấy được Session Cookie hợp lệ từ ClassHub
   * Mỗi lần gọi sẽ tự động re-login để lấy cookie mới nhất, đảm bảo không bị timeout
   */
  static async getValidSession(uid: string): Promise<string> {
    const userDoc = await adminDb.collection("users").doc(uid).get();
    
    if (!userDoc.exists) {
      throw new Error("User not found");
    }

    const userData = userDoc.data();
    if (!userData?.classhubUsername || !userData?.classhubPassword) {
      throw new Error("Tài khoản chưa cấu hình ClassHub");
    }

    const username = userData.classhubUsername;
    // Decode base64 
    const rawPassword = Buffer.from(userData.classhubPassword, "base64").toString("utf8");
    // Mã hóa SHA-256 (Theo chuẩn của idcloud.vn)
    const password = crypto.createHash("sha256").update(rawPassword).digest("hex");

    const response = await fetch(IDCLOUD_LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "ohke-ajax": "1",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      },
      body: JSON.stringify({
        "login-form": {
          username: username,
          password: password,
          remember_me: "1"
        }
      })
    });

    if (!response.ok) {
      throw new Error(`ClassHub Login Failed with status ${response.status}`);
    }

    const setCookieHeader = response.headers.get("set-cookie");
    if (!setCookieHeader) {
      throw new Error("Đăng nhập ClassHub thành công nhưng không lấy được Cookie");
    }

    // Update session vào database
    await adminDb.collection("users").doc(uid).update({
      classhubCookie: setCookieHeader,
      classhubLastVerified: new Date().toISOString(),
      classhubStatus: "CONNECTED"
    });

    return setCookieHeader;
  }

  /**
   * API Lấy danh sách lớp học từ ClassHub
   */
  static async fetchClasses(uid: string) {
    const cookie = await this.getValidSession(uid);
    console.log("[ClassHub] Fetching classes using cookie");
    
    const SITE_ID = "47817"; // Hardcode for Pascal school for now
    const classRes = await fetch(`https://idcloud.vn/${SITE_ID}/appstart/classroom_pro/source=deeplink`, {
      headers: {
        "Cookie": cookie,
        "User-Agent": "Mozilla/5.0"
      }
    });

    if (!classRes.ok) {
      throw new Error(`Lỗi khi lấy danh sách lớp, status: ${classRes.status}`);
    }

    const html = await classRes.text();
    const regex = /data-entity="([^"]+)"/g;
    let matches;
    const classes = [];

    const decodeHtmlEntities = (text: string) => {
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
        .replace(/&abreve;/g, 'ă');
    };

    while ((matches = regex.exec(html)) !== null) {
      const encoded = matches[1];
      if (encoded.includes('&lbrace;')) {
        const decoded = decodeHtmlEntities(encoded);
        try {
          const data = JSON.parse(decoded);
          if (data.id && data.student_class_name && data.study_module_code) {
            classes.push({
              id: data.id,
              className: data.student_class_name.trim(),
              moduleName: data.module_name,
              code: data.code,
              numberOfStudents: parseInt(data.number_of_students || "0"),
              studyClassStatus: data.study_class_status,
              raw_data: data
            });
          }
        } catch (e) {
          console.error("Parse error for entity");
        }
      }
    }

    return {
      success: true,
      message: "Lấy danh sách lớp thành công",
      data: classes
    };
  }

  /**
   * API Đẩy điểm lên ClassHub (Sẽ implement sau)
   */
  static async pushGrades(uid: string, payload: any) {
    const cookie = await this.getValidSession(uid);
    console.log("[ClassHub] Pushing grades payload:", payload);
    return { success: true };
  }

  /**
   * API Tự động điểm danh thông qua AttendanceBot (Puppeteer)
   */
  static async pushAttendance(uid: string) {
    const cookieHeader = await this.getValidSession(uid);
    
    // Extract PHPSESSID from cookie string (e.g. "PHPSESSID=bkat9mn614s7m8rm5o4lrujosk; path=/")
    const match = cookieHeader.match(/PHPSESSID=([^;]+)/);
    if (!match) {
      throw new Error("Không tìm thấy PHPSESSID hợp lệ.");
    }
    const phpsessid = match[1];

    // 1. Lấy danh sách tất cả các lớp của giáo viên này trên ClassHub
    const classesResponse = await this.fetchClasses(uid);
    if (!classesResponse.success || !classesResponse.data || classesResponse.data.length === 0) {
      throw new Error("Không tìm thấy danh sách lớp nào trên ClassHub.");
    }

    const classIds = classesResponse.data.map((cls: any) => cls.id);
    console.log(`[ClassHub] Tìm thấy ${classIds.length} lớp. Bắt đầu chạy Bot quét điểm danh...`);
    
    // 2. Import dynamically to avoid loading puppeteer on edge/client if ever imported there
    const { AttendanceBot } = await import('./attendance.bot');
    
    const result = await AttendanceBot.runBulkAttendance(phpsessid, classIds);
    
    if (!result.success) {
      throw new Error(result.message);
    }
    
    return result;
  }
}

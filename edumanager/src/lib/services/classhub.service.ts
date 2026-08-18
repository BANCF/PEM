import { adminDb } from "@/lib/firebase/admin";
import crypto from "crypto";
import { ClasshubAPI } from "./classhub.api";

const IDCLOUD_LOGIN_URL = "https://idcloud.vn/61892/appstart/digitalismspace/jsonPostSignIn";

export class ClassHubService {
  static async getValidSession(uid: string): Promise<string> {
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) throw new Error("User not found");

    const userData = userDoc.data();
    if (!userData?.classhubUsername || !userData?.classhubPassword) {
      throw new Error("Tài khoản chưa cấu hình ClassHub");
    }

    const username = userData.classhubUsername;
    const rawPassword = Buffer.from(userData.classhubPassword, "base64").toString("utf8");
    const password = crypto.createHash("sha256").update(rawPassword).digest("hex");

    const response = await fetch(IDCLOUD_LOGIN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        "ohke-ajax": "1",
        "User-Agent": "Mozilla/5.0"
      },
      body: JSON.stringify({
        "login-form": { username: username, password: password, remember_me: "1" }
      })
    });

    if (!response.ok) throw new Error(`ClassHub Login Failed with status ${response.status}`);
    const setCookieHeader = response.headers.get("set-cookie");
    if (!setCookieHeader) throw new Error("Đăng nhập ClassHub thành công nhưng không lấy được Cookie");

    await adminDb.collection("users").doc(uid).update({
      classhubCookie: setCookieHeader,
      classhubLastVerified: new Date().toISOString(),
      classhubStatus: "CONNECTED"
    });

    return setCookieHeader;
  }

  static async fetchClasses(uid: string, isDeepScan: boolean = false) {
    const cookie = await this.getValidSession(uid);
    console.log("[ClassHub] Fetching classes using cookie");
    const api = new ClasshubAPI("61892", "", cookie, (msg: string) => console.log(msg));
    
    // 1. Tự động tìm tên giáo viên
    await api.autoHuntTeacherName();
    
    // 2. Quét tất cả các lớp
    const maxPages = isDeepScan ? -1 : 2;
    const allClasses = await api.scanAllClasses(maxPages);
    
    // 3. Lọc ra các lớp của mình
    let myClasses = allClasses;
    if (api.teacherName) {
       myClasses = api.filterMyClasses(allClasses);
    }
    
    // Chỉ hiện các lớp ĐÃ BẮT ĐẦU HỌC (và chưa được điểm danh)
    myClasses = api.getEligibleClasses(myClasses);
    
    // 4. Transform data structure for frontend (matching old format)
    const resultClasses = myClasses.map((c: any) => {
        let entity = c.entity || {};
        return {
           id: c.id,
           className: entity.student_class_name || entity.class_name || "Lớp học",
           moduleName: entity.module_name,
           code: entity.code,
           numberOfStudents: parseInt(entity.number_of_students || "0"),
           studyClassStatus: entity.attendance_sheet_status || entity.status,
           raw_data: entity
        };
    });

    return {
      success: true,
      message: "Lấy danh sách lớp thành công",
      data: resultClasses,
      logs: (api as any).logBuffer || []
    };
  }

  static async pushAttendance(uid: string, isDeepScan: boolean = false) {
    try {
      const cookie = await this.getValidSession(uid);
      const api = new ClasshubAPI("61892", "", cookie, (msg: string) => console.log(msg));
      
      await api.autoHuntTeacherName();
      const maxPages = isDeepScan ? -1 : 2;
      const allClasses = await api.scanAllClasses(maxPages);
      let myClasses = allClasses;
      if (api.teacherName) {
         myClasses = api.filterMyClasses(allClasses);
      }
      
      const eligibleClasses = api.getEligibleClasses(myClasses);

      if (eligibleClasses.length === 0) {
        return { success: true, message: "Tất cả các lớp đã được điểm danh hoặc chưa đến giờ." };
      }

      let successCount = 0;
      let errorCount = 0;

      for (const classItem of eligibleClasses) {
        const result = await api.submitAttendanceFlow(classItem);
        if (result.success && !result.skipped) {
          successCount++;
        } else if (!result.success) {
          errorCount++;
        }
        await new Promise(r => setTimeout(r, 500));
      }

      return { 
        success: true, 
        message: `Đã hoàn tất điểm danh. Thành công: ${successCount}, Lỗi: ${errorCount}`,
        logs: (api as any).logBuffer || []
      };
    } catch (error: any) {
      console.error("[ClassHub Push Attendance Error]", error);
      return { success: false, message: error.message };
    }
  }

  static async revertFutureClassesDev(uid: string) {
    try {
      const cookie = await this.getValidSession(uid);
      const api = new ClasshubAPI("61892", "", cookie, (msg: string) => console.log(msg));
      
      await api.autoHuntTeacherName();
      const allClasses = await api.scanAllClasses();
      let myClasses = allClasses;
      if (api.teacherName) {
         myClasses = api.filterMyClasses(allClasses);
      }
      
      const res = await api.revertFutureClasses(myClasses);
      return res;
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  static async pushGrades(uid: string, payload: any) {
    console.log("[ClassHub] Pushing grades payload:", payload);
    return { success: true };
  }
}

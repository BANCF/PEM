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

  static async rpcCall(url: string, payload: any, cookie: string) {
    const fullUrl = url.startsWith('http') ? url : `https://idcloud.vn${url}`;
    try {
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': cookie,
          'ohke-ajax': '1',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        body: JSON.stringify(payload)
      });
      
      const text = await response.text();
      try {
        return JSON.parse(text);
      } catch (e) {
        return { html: text, isRawHtml: true };
      }
    } catch (err: any) {
      return { status: "error", error: err.message };
    }
  }

  static getClassUnlockInfo(entityData: any, bufferMinutes = 5) {
      if (!entityData) return { isSafe: true, unlockTimestamp: 0, timeString: "" };
      let dateStr = entityData.class_schedule_date || entityData.date || entityData.start_date || "";
      if (!dateStr) return { isSafe: true, unlockTimestamp: 0, timeString: "" };
      
      try {
          let timeStr = entityData.class_hour_start_time || entityData.start_time || "00:00:00";
          let year, month, day;
          
          if (dateStr.includes('/')) {
              let parts = dateStr.split('/');
              day = parseInt(parts[0], 10); month = parseInt(parts[1], 10) - 1; year = parseInt(parts[2], 10);
          } else if (dateStr.includes('-')) {
              let parts = dateStr.split('-');
              year = parseInt(parts[0], 10); month = parseInt(parts[1], 10) - 1; day = parseInt(parts[2], 10);
          } else {
              return { isSafe: true, unlockTimestamp: 0, timeString: "" };
          }

          let timeParts = timeStr.split(':');
          let hours = parseInt(timeParts[0], 10) || 0;
          let minutes = parseInt(timeParts[1], 10) || 0;
          
          let startTimestamp = new Date(year, month, day, hours, minutes, 0).getTime();
          if (isNaN(startTimestamp)) return { isSafe: true, unlockTimestamp: 0, timeString: "" };

          let unlockTimestamp = startTimestamp + (bufferMinutes * 60 * 1000);
          let now = Date.now();
          let unlockDate = new Date(unlockTimestamp);
          let timeString = `${String(unlockDate.getHours()).padStart(2, '0')}:${String(unlockDate.getMinutes()).padStart(2, '0')}`;
          
          return { isSafe: now >= unlockTimestamp, unlockTimestamp: unlockTimestamp, timeString: timeString };
      } catch (e) { return { isSafe: true, unlockTimestamp: 0, timeString: "" }; }
  }

  static async submitAttendanceFlow(uid: string, classItem: any) {
    const cookie = await this.getValidSession(uid);
    const tenantId = "47817"; // Hardcode for Pascal school for now
    const entity = classItem.raw_data;
    const masterKey = String(classItem.id);
    
    let status = String(entity.attendance_sheet_status || entity.status || "").toUpperCase();
    if (status.includes("ACCEPTED")) {
        return { success: true, message: `Lớp ${masterKey} đã chốt sổ.`, skipped: true };
    }
    
    let unlockInfo = this.getClassUnlockInfo(entity, 5);
    if (!unlockInfo.isSafe) {
        return { success: true, message: `Chưa đến giờ (Mở khóa lúc ${unlockInfo.timeString}).`, skipped: true };
    }

    try {
        // BƯỚC 1: API Hunt Giáo viên
        let fetchPayload = {
            master_key: masterKey,
            father_master_key: masterKey,
            master_object_class_name: "study_student_attendance_sheet",
            master_object_class_code: "DOCTYPE-7004",
            id: null
        };
        let apiUrl = `/${tenantId}/appstart/classhub/x24F76_Model`;
        let resModel = await this.rpcCall(apiUrl, fetchPayload, cookie);
        
        let instructorId: string | null = null;
        let instructorUpdateTime = "";

        if (resModel) {
            if (resModel.data && Array.isArray(resModel.data) && resModel.data.length > 0) {
                let tRec = resModel.data[0];
                if (tRec && tRec.id && String(tRec.id) !== masterKey) {
                    instructorId = String(tRec.id);
                    if (tRec.update_time) instructorUpdateTime = tRec.update_time;
                }
            }
            if (!instructorId && resModel.html) {
                let mId = resModel.html.match(/data-id="(\d+)"/i) || resModel.html.match(/id:\s*["']?(\d+)["']?/i);
                if (mId && mId[1] && mId[1] !== masterKey) {
                    instructorId = mId[1];
                    let mTime = resModel.html.match(/(?:data-update-time|update_time)="([^"]+)"/i);
                    if (mTime && mTime[1]) instructorUpdateTime = mTime[1];
                }
            }
        }

        if (!instructorId) {
            instructorId = entity.instructor_sheet_id || entity.instructor_id || masterKey;
        }

        let tUpdateTime = instructorUpdateTime || "";
        if (tUpdateTime === entity.update_time) tUpdateTime = "";

        // BƯỚC 1: Tick Giáo viên Có mặt
        let payloadTeacherTick = {
            id: parseInt(instructorId as string),
            field_name: "status",
            begin_state: "INSTRUCTOR_ATTENDANCE_STATUS_NO_ATTENDANCE",
            to_state: "INSTRUCTOR_ATTENDANCE_STATUS_PRESENT",
            end_state: "INSTRUCTOR_ATTENDANCE_STATUS_PRESENT",
            is_reversal: 0,
            update_time: tUpdateTime,
            mode: "V",
            entity: { id: parseInt(instructorId as string), status: "INSTRUCTOR_ATTENDANCE_STATUS_NO_ATTENDANCE" },
            env: { id: parseInt(instructorId as string), master_key: masterKey, father_master_key: masterKey }
        };

        await this.rpcCall(`/${tenantId}/appstart/classhub/x24F76_jsonPostTransition`, payloadTeacherTick, cookie);
        
        // BƯỚC 2: Chốt sổ Giáo viên
        let payloadTeacherLock = {
            id: masterKey,
            field_name: "instructor_attendance_status",
            begin_state: entity.instructor_attendance_status || "INSTRUCTOR_ATTENDANCE_SHEET_STATUS_PENDING",
            to_state: "INSTRUCTOR_ATTENDANCE_SHEET_STATUS_ACCEPTED",
            end_state: "INSTRUCTOR_ATTENDANCE_SHEET_STATUS_ACCEPTED",
            is_reversal: 0,
            update_time: entity.update_time || "",
            mode: "V",
            entity: entity,
            env: { id: parseInt(masterKey) }
        };
        await this.rpcCall(`/${tenantId}/appstart/classhub/x35FD3_jsonPostTransition`, payloadTeacherLock, cookie);

        // BƯỚC 3: Chốt sổ Học sinh
        let classHourCode = entity.class_hour_code || '';
        let isLessonZero = (classHourCode === 'H0' || String(classHourCode).startsWith('H0.'));
        
        let checkModes = [
            { name: "Tiết trước", endpoint: `/${tenantId}/appstart/classhub/bttAction_x2447C_` },
            { name: "Tất cả có mặt", endpoint: `/${tenantId}/appstart/classhub/bttAction_x2447B_` }
        ];
        if (isLessonZero) checkModes.shift(); 

        let isTrulySuccess = false;

        for (let mode of checkModes) {
            try {
                await this.rpcCall(mode.endpoint, { id: masterKey }, cookie);
            } catch (e3) { }

            let realEnv: any = { id: masterKey, master_key: masterKey, father_master_key: masterKey };
            let currentEntity = Object.assign({}, entity);

            try {
                let resRefresh = await this.rpcCall(`/${tenantId}/appstart/classhub/x35FD2_Viewer`, { id: masterKey }, cookie);
                if (resRefresh) {
                    if (resRefresh.data) {
                        Object.assign(currentEntity, resRefresh.data);
                        if (resRefresh.data.update_time) currentEntity.update_time = resRefresh.data.update_time;
                    }
                    if (resRefresh.html) {
                        let prefixMatch = resRefresh.html.match(/name="ohke_prefix"\s+value="([^"]+)"/);
                        let queryIdMatch = resRefresh.html.match(/name="data_query_id"\s+value="([^"]+)"/);
                        if (prefixMatch) realEnv.ohke_prefix = prefixMatch[1];
                        if (queryIdMatch) realEnv.data_query_id = queryIdMatch[1];
                    }
                }
            } catch (eRefresh) { }

            let payloadApi4 = {
                id: parseInt(masterKey),
                field_name: "attendance_sheet_status",
                begin_state: currentEntity.attendance_sheet_status || "CLASS_SCHEDULE_SLOT_STATUS_PENDING",
                to_state: "CLASS_SCHEDULE_SLOT_STATUS_ACCEPTED",
                end_state: "CLASS_SCHEDULE_SLOT_STATUS_ACCEPTED",
                is_reversal: 0, 
                update_time: currentEntity.update_time || entity.update_time || "",
                mode: "V", 
                entity: currentEntity, 
                env: realEnv
            };
            
            try {
                let res4 = await this.rpcCall(`/${tenantId}/appstart/classhub/x35FD2_jsonPostTransition`, payloadApi4, cookie);
                if (res4 && res4.type === "success") {
                    isTrulySuccess = true;
                    break;
                } else if (res4 && res4.type === "error" && res4.code === "ERR_STUDENT_ATTENDANCE_INCOMPLETED") {
                    continue; // Thử chế độ tiếp theo
                }
            } catch (e4) { }
        }

        if (!isTrulySuccess) {
             return { success: false, message: "Điểm danh học sinh thất bại", class: masterKey };
        }

        return { success: true, class: classItem.id, message: "Điểm danh thành công" };
    } catch(e: any) {
        return { success: false, error: e.message };
    }
  }

  /**
   * API Tự động điểm danh hàng loạt (Dùng RPC siêu tốc, thay thế Puppeteer)
   */
  static async pushAttendance(uid: string) {
    try {
      const classesResponse = await this.fetchClasses(uid);
      if (!classesResponse.success || !classesResponse.data || classesResponse.data.length === 0) {
        throw new Error("Không tìm thấy danh sách lớp nào trên ClassHub.");
      }

      const pendingClasses = classesResponse.data.filter((c: any) => 
        !String(c.studyClassStatus || "").toUpperCase().includes("ACCEPTED") && 
        !String(c.raw_data?.status || "").toUpperCase().includes("ACCEPTED")
      );

      if (pendingClasses.length === 0) {
        return { success: true, message: "Tất cả các lớp đã được điểm danh." };
      }

      let successCount = 0;
      let errorCount = 0;

      for (const classItem of pendingClasses) {
        const result = await this.submitAttendanceFlow(uid, classItem);
        if (result.success && !result.skipped) {
          successCount++;
        } else if (!result.success) {
          errorCount++;
        }
        // Giãn cách request tránh rate limit
        await new Promise(r => setTimeout(r, 500));
      }

      return { 
        success: true, 
        message: `Đã hoàn tất điểm danh. Thành công: ${successCount}, Lỗi: ${errorCount}`
      };
    } catch (error: any) {
      console.error("[ClassHub Push Attendance Error]", error);
      return { success: false, message: error.message };
    }
  }
}

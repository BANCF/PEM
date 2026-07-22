"use client";

import React, { useState } from "react";
import { Upload, FileSpreadsheet, Save, Calendar, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { saveSchedule, FullScheduleData } from "@/lib/services/schedule.service";

export default function ScheduleSettingsPage() {
  const { profile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<FullScheduleData | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setParsedData(null);
    }
  };

  const handleProcessFile = async () => {
    if (!file) return toast.error("Vui lòng chọn file Excel");

    setLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });

      const sheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('sangchieu') || s.toLowerCase().includes('sáng chiều')) || workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];

      if (!data || data.length < 3) {
        throw new Error("File không đúng định dạng chuẩn");
      }

      // Xây dựng map cột lớp học từ dòng thứ 2 (index 1)
      const classCols: Record<number, string> = {};
      const row1 = data[1];
      for (let c = 0; c < row1.length; c++) {
        const val = row1[c];
        if (val && typeof val === 'string' && val.trim() !== 'Thứ' && val.trim() !== 'Tiết' && val.trim() !== 'Thời gian') {
          classCols[c] = val.trim();
        }
      }

      const teachersSchedule: any = {};
      const classesSchedule: any = {};
      let currentDay = null;

      // Đọc từ dòng 3 (index 2) trở đi
      for (let r = 2; r < data.length; r++) {
        const row = data[r];
        
        if (row[0]) {
          currentDay = row[0].toString().trim();
        }
        
        if (!currentDay) continue;

        for (const cStr in classCols) {
          const c = parseInt(cStr);
          const className = classCols[c];
          
          // Xác định cột Tiết và Thời gian tương ứng với khối lớp
          let pCol = 1; let tCol = 2;
          if (c > 15 && c < 61) { pCol = 15; tCol = 16; }
          else if (c > 61 && c < 76) { pCol = 61; tCol = 62; }
          else if (c > 76) { pCol = 76; tCol = 77; }

          let period = row[pCol];
          let time = row[tCol];

          if (!period && !time) continue;
          period = period ? period.toString().trim() : "";
          time = time ? time.toString().trim() : "";
          
          const subject = row[c];
          const teacherStr = row[c+1];

          if (subject && typeof subject === 'string') {
            const subjectTrimmed = subject.trim();
            // Khởi tạo schedule cho lớp
            if (!classesSchedule[className]) classesSchedule[className] = {};
            if (!classesSchedule[className][currentDay]) classesSchedule[className][currentDay] = [];
            
            const scheduleEntry = {
              period,
              time,
              className,
              subject: subjectTrimmed,
              teacher: teacherStr ? teacherStr.toString().trim() : ""
            };

            // Thêm vào TKB của lớp, tránh duplicate tiết (do file excel có thể có nhiều cột thừa)
            const existingClassPeriod = classesSchedule[className][currentDay].find((p: any) => p.period === period);
            if (!existingClassPeriod) {
               classesSchedule[className][currentDay].push(scheduleEntry);
            }

            // Thêm vào TKB của giáo viên
            if (teacherStr && typeof teacherStr === 'string') {
              const teachers = teacherStr.split(/[\/,]/).map(t => t.trim()).filter(t => t);
              for (const t of teachers) {
                if (!teachersSchedule[t]) teachersSchedule[t] = {};
                if (!teachersSchedule[t][currentDay]) teachersSchedule[t][currentDay] = [];
                
                // Tránh duplicate
                const existingTeacherPeriod = teachersSchedule[t][currentDay].find((p: any) => p.period === period);
                if (!existingTeacherPeriod) {
                  teachersSchedule[t][currentDay].push({
                    period,
                    time,
                    className,
                    subject: subjectTrimmed
                  });
                }
              }
            }
          }
        }
      }

      setParsedData({
        updatedAt: new Date().toISOString(),
        updatedBy: profile?.fullName || "Admin",
        teachers: teachersSchedule,
        classes: classesSchedule
      });

      toast.success("Đã phân tích file thành công! Bạn có thể lưu TKB.");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Lỗi khi xử lý file Excel");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!parsedData) return;
    
    setLoading(true);
    try {
      await saveSchedule(parsedData);
      toast.success("Đã cập nhật Thời khóa biểu toàn trường!");
    } catch (error) {
      toast.error("Lỗi khi lưu lên hệ thống");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <Calendar className="text-blue-600" />
            Cập nhật Thời khóa biểu
          </h1>
          <p className="text-slate-500 mt-1">Tải lên file Excel TKB toàn trường (sheet TKB SangChieu) để đồng bộ dữ liệu.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <FileSpreadsheet size={20} className="text-green-600" />
            1. Tải lên File Excel TKB
          </h2>
          
          <div className="space-y-4">
            <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors">
              <input
                type="file"
                accept=".xlsx, .xlsm, .xls"
                onChange={handleFileUpload}
                className="hidden"
                id="excel-upload"
              />
              <label htmlFor="excel-upload" className="cursor-pointer flex flex-col items-center">
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                  <Upload size={32} />
                </div>
                <span className="text-slate-700 font-medium text-lg">
                  {file ? file.name : "Nhấn để chọn file Excel"}
                </span>
                <span className="text-slate-500 text-sm mt-2">Hỗ trợ .xlsx, .xlsm</span>
              </label>
            </div>
            
            <button
              onClick={handleProcessFile}
              disabled={!file || loading}
              className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              {loading ? "Đang xử lý..." : "Phân tích dữ liệu"}
            </button>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <AlertCircle size={20} className="text-amber-500" />
            2. Kiểm tra và Lưu
          </h2>

          {parsedData ? (
            <div className="space-y-6">
              <div className="bg-green-50 text-green-800 p-4 rounded-xl border border-green-200">
                <p className="font-medium text-green-900 mb-2">Thống kê dữ liệu TKB:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>Tìm thấy TKB của <strong>{Object.keys(parsedData.teachers).length}</strong> giáo viên</li>
                  <li>Tìm thấy TKB của <strong>{Object.keys(parsedData.classes).length}</strong> lớp học</li>
                </ul>
              </div>

              <button
                onClick={handleSave}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Save size={20} />
                Lưu và Đồng bộ lên Hệ thống
              </button>
            </div>
          ) : (
            <div className="h-40 flex flex-col items-center justify-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
              <Calendar size={48} className="mb-2 opacity-50" />
              <p>Chưa có dữ liệu. Hãy phân tích file trước.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

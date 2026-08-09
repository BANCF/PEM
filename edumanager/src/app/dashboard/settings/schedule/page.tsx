"use client";

import React, { useState } from "react";
import { Upload, FileSpreadsheet, Save, Calendar, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { saveSchedule, FullScheduleData } from "@/lib/services/schedule.service";

const TEACHER_ALIASES: Record<string, string> = {
  "Linh": "Vũ Linh",
  "M Hiếu": "Mạnh Hiếu",
  "K.Huyền": "Khánh Huyền",
  "Trọng": "Xuân Trọng",
  "Nguyệt": "Minh Nguyệt",
};

const normalizeTeacherNames = (rawName: string): string[] => {
  if (!rawName) return [];
  const parts = rawName.split(/[\/,]/).map(t => t.trim()).filter(t => t);
  return parts.map(p => TEACHER_ALIASES[p] || p);
};

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

      // 1. Phân tích Sheet TKB SangChieu (TKB theo Lớp và Môn học)
      const sangChieuSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('sangchieu') || s.toLowerCase().includes('sáng chiều')) || workbook.SheetNames[0];
      const sangChieuSheet = workbook.Sheets[sangChieuSheetName];
      const sangChieuData = XLSX.utils.sheet_to_json(sangChieuSheet, { header: 1, defval: null }) as any[][];

      if (!sangChieuData || sangChieuData.length < 3) {
        throw new Error("File không đúng định dạng chuẩn");
      }

      const classColMap: Record<number, { className: string; pCol: number; tCol: number }> = {};
      const row1 = sangChieuData[1] || [];

      for (let c = 0; c < row1.length; c++) {
        const val = row1[c];
        if (val && typeof val === 'string') {
          const trimmed = val.trim();
          if (!['thứ', 'tiết', 'thời gian'].includes(trimmed.toLowerCase())) {
            // Tìm cột 'Tiết' gần nhất về phía bên trái
            let pCol = 1;
            for (let p = c - 1; p >= 0; p--) {
              if (row1[p] && typeof row1[p] === 'string' && row1[p].toString().trim().toLowerCase() === 'tiết') {
                pCol = p;
                break;
              }
            }
            // Tìm cột 'Thời gian' gần nhất về phía bên trái
            let tCol = pCol + 1;
            for (let t = c - 1; t >= 0; t--) {
              if (row1[t] && typeof row1[t] === 'string' && row1[t].toString().trim().toLowerCase().includes('thời gian')) {
                tCol = t;
                break;
              }
            }
            classColMap[c] = { className: trimmed, pCol, tCol };
          }
        }
      }

      const teachersSchedule: Record<string, Record<string, any[]>> = {};
      const classesSchedule: Record<string, Record<string, any[]>> = {};
      let currentDay: string | null = null;

      for (let r = 2; r < sangChieuData.length; r++) {
        const row = sangChieuData[r];
        if (!row) continue;

        if (row[0]) {
          const dayStr = row[0].toString().trim();
          const m = dayStr.match(/\d+/);
          if (m) currentDay = m[0];
        }
        if (!currentDay) continue;

        for (const cStr in classColMap) {
          const c = parseInt(cStr);
          const { className, pCol, tCol } = classColMap[c];

          const rawPeriod = row[pCol];
          const rawTime = row[tCol];

          if (rawPeriod === null || rawPeriod === undefined) continue;

          // Chuẩn hóa tiết: CHỈ lấy các chữ số (bỏ các chuỗi rác như "Mạnh Hiếu" hay "Tiết")
          let periodClean = rawPeriod.toString().trim();
          const periodMatch = periodClean.match(/^\d+/);
          if (!periodMatch) continue;
          periodClean = periodMatch[0];

          const timeClean = rawTime ? rawTime.toString().trim() : "";
          const subject = row[c];
          const teacherStr = row[c + 1];

          if (subject && typeof subject === 'string') {
            const subjectTrimmed = subject.trim();
            if (!subjectTrimmed || subjectTrimmed === '0') continue;

            if (!classesSchedule[className]) classesSchedule[className] = {};
            if (!classesSchedule[className][currentDay]) classesSchedule[className][currentDay] = [];

            const existingClassPeriod = classesSchedule[className][currentDay].find((p: any) => p.period === periodClean);
            if (!existingClassPeriod) {
              const normalizedTeachers = teacherStr ? normalizeTeacherNames(teacherStr.toString()) : [];
              classesSchedule[className][currentDay].push({
                period: periodClean,
                time: timeClean,
                className,
                subject: subjectTrimmed,
                teacher: teacherStr ? teacherStr.toString().trim() : ""
              });
            }
          }
        }
      }

      // 2. Phân tích Sheet TKB GV (Ưu tiên nguồn dữ liệu TKB Giáo viên chuẩn xác 100%)
      const gvSheetName = workbook.SheetNames.find(s => s.toLowerCase().includes('tkb gv') || s.toLowerCase().includes('tkb_gv'));
      if (gvSheetName && workbook.Sheets[gvSheetName]) {
        const gvSheet = workbook.Sheets[gvSheetName];
        const gvData = XLSX.utils.sheet_to_json(gvSheet, { header: 1, defval: null }) as any[][];

        if (gvData && gvData.length >= 4) {
          const rowDays = gvData[1] || [];
          const rowPeriods = gvData[2] || [];

          for (let r = 3; r < gvData.length; r++) {
            const row = gvData[r];
            if (!row || !row[1]) continue;

            const rawTeacherName = row[1].toString().trim();
            if (!rawTeacherName || rawTeacherName.toLowerCase() === 'tên gv') continue;

            const teacherNames = normalizeTeacherNames(rawTeacherName);

            let curDay = '2';
            for (let c = 2; c < row.length; c++) {
              if (rowDays[c]) {
                const dMatch = rowDays[c].toString().trim().match(/\d+/);
                if (dMatch) curDay = dMatch[0];
              }

              const rawPeriod = rowPeriods[c];
              if (!rawPeriod) continue;

              const pMatch = rawPeriod.toString().trim().match(/^\d+/);
              if (!pMatch) continue;
              const periodClean = pMatch[0];

              const className = row[c] ? row[c].toString().trim() : "";
              if (!className || className === '0') continue;

              // Tra cứu Tên môn và Khung giờ từ TKB của lớp
              let subject = "Giảng dạy";
              let time = "";

              if (classesSchedule[className] && classesSchedule[className][curDay]) {
                const matchInClass = classesSchedule[className][curDay].find(item => item.period === periodClean);
                if (matchInClass) {
                  subject = matchInClass.subject;
                  time = matchInClass.time;
                }
              }

              for (const tName of teacherNames) {
                if (!teachersSchedule[tName]) teachersSchedule[tName] = {};
                if (!teachersSchedule[tName][curDay]) teachersSchedule[tName][curDay] = [];

                const existingT = teachersSchedule[tName][curDay].find((p: any) => p.period === periodClean);
                if (!existingT) {
                  teachersSchedule[tName][curDay].push({
                    period: periodClean,
                    time,
                    className,
                    subject,
                    teacher: rawTeacherName
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

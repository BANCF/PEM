"use client";

import React, { useState } from "react";
import { Upload, FileSpreadsheet, Save, ClipboardList, AlertCircle } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { 
  saveWeeklySchedule, 
  saveDutySchedule, 
  WeeklyScheduleData, 
  DutyScheduleData,
  DutyMonth
} from "@/lib/services/workSchedule.service";

// Helper to convert Excel serial date to DD/MM/YYYY string
const excelDateToString = (serial: number) => {
  if (!serial || isNaN(serial)) return "";
  const utc_days  = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;                                        
  const date_info = new Date(utc_value * 1000);
  
  const fractional_day = serial - Math.floor(serial) + 0.0000001;
  let total_seconds = Math.floor(86400 * fractional_day);
  
  const seconds = total_seconds % 60;
  total_seconds -= seconds;
  
  const hours = Math.floor(total_seconds / (60 * 60));
  const minutes = Math.floor(total_seconds / 60) % 60;
  
  // Create date considering timezone
  const date = new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
  
  const d = date.getDate().toString().padStart(2, '0');
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};

export default function WorkScheduleSettingsPage() {
  const { profile } = useAuth();
  
  // Weekly State
  const [weeklyFile, setWeeklyFile] = useState<File | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [parsedWeekly, setParsedWeekly] = useState<WeeklyScheduleData | null>(null);
  
  // Duty State
  const [dutyFile, setDutyFile] = useState<File | null>(null);
  const [dutyLoading, setDutyLoading] = useState(false);
  const [parsedDuty, setParsedDuty] = useState<DutyScheduleData | null>(null);

  // --- WEEKLY SCHEDULE PARSER ---
  const handleProcessWeekly = async () => {
    if (!weeklyFile) return toast.error("Vui lòng chọn file Kế hoạch Tuần");

    setWeeklyLoading(true);
    try {
      const arrayBuffer = await weeklyFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });

      // 1. Dùng Sheet đầu tiên hoặc sheet đang active
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][];
      
      let title = "";
      // Tìm tiêu đề
      for (let i = 0; i < Math.min(5, rawData.length); i++) {
        const row = rawData[i];
        if (row && typeof row[0] === 'string' && row[0].toUpperCase().includes("KẾ HOẠCH TUẦN")) {
          title = row[0].trim();
          break;
        }
      }

      // Tìm dòng header của bảng chi tiết
      const headerRowIdx = rawData.findIndex(row => 
        row && row.some(cell => typeof cell === 'string' && cell.trim() === 'Thứ')
      );

      if (headerRowIdx === -1) {
        throw new Error("Không tìm thấy bảng chi tiết (cột Thứ, Cấp, Công việc).");
      }

      const daysMap: Record<string, any> = {};
      let currentDay = "";
      let currentCategory = "";

      for (let r = headerRowIdx + 1; r < rawData.length; r++) {
        const row = rawData[r];
        if (!row || row.length === 0) continue;

        // Cột 0: Thứ (e.g. "Hai \n(03/08)")
        if (row[0] && typeof row[0] === 'string' && row[0].trim() !== "") {
          currentDay = row[0].replace(/\n/g, ' ').trim();
        }

        if (!currentDay) continue; // Skip if we haven't found a day yet

        // Cột 1: Cấp (e.g. "Toàn trường", "Tiểu học", "THCS")
        if (row[1] && typeof row[1] === 'string' && row[1].trim() !== "") {
          let cat = row[1].trim();
          // Chuẩn hóa tên (bỏ qua hoa thường)
          const lowerCat = cat.toLowerCase();
          if (lowerCat === 'toàn trường') cat = 'Toàn trường';
          else if (lowerCat === 'tiểu học') cat = 'Tiểu học';
          else if (lowerCat === 'thcs') cat = 'THCS';
          
          currentCategory = cat;
        }

        // Cột 2: Công việc
        const task = row[2] ? row[2].toString().trim() : "";
        if (task) {
          const requirement = row[3] ? row[3].toString().trim() : "";
          const assignee = row[4] ? row[4].toString().trim() : "";

          if (!daysMap[currentDay]) {
            daysMap[currentDay] = {};
          }
          if (!daysMap[currentDay][currentCategory || "Chung"]) {
            daysMap[currentDay][currentCategory || "Chung"] = [];
          }

          daysMap[currentDay][currentCategory || "Chung"].push({
            id: Math.random().toString(36).substring(7),
            task,
            requirement,
            assignee
          });
        }
      }

      // Format lại thành mảng theo cấu trúc
      const parsedDays = Object.keys(daysMap).map(dayName => {
        const categoriesMap = daysMap[dayName];
        return {
          dayName,
          categories: Object.keys(categoriesMap).map(categoryName => ({
            categoryName,
            activities: categoriesMap[categoryName]
          }))
        };
      });

      setParsedWeekly({
        updatedAt: new Date().toISOString(),
        updatedBy: profile?.fullName || "Admin",
        title: title || `Kế hoạch Tuần`,
        days: parsedDays
      } as unknown as WeeklyScheduleData); // bypass typing temporarily to match new structure

      toast.success("Phân tích Lịch Tuần thành công!");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Lỗi khi xử lý file Lịch Tuần");
    } finally {
      setWeeklyLoading(false);
    }
  };

  const handleSaveWeekly = async () => {
    if (!parsedWeekly) return;
    setWeeklyLoading(true);
    try {
      await saveWeeklySchedule(parsedWeekly);
      toast.success("Đã lưu Lịch Tuần lên hệ thống!");
    } catch (e) {
      toast.error("Lỗi khi lưu Lịch Tuần");
    } finally {
      setWeeklyLoading(false);
    }
  };

  // --- DUTY SCHEDULE PARSER ---
  const handleProcessDuty = async () => {
    if (!dutyFile) return toast.error("Vui lòng chọn file Lịch Trực");

    setDutyLoading(true);
    try {
      const arrayBuffer = await dutyFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array" });

      const months: DutyMonth[] = [];

      workbook.SheetNames.forEach(sheetName => {
        // Process months T8, T9, etc.
        if (!sheetName.match(/^T\d+/i) && !sheetName.toLowerCase().includes("tháng")) return;

        const sheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null }) as any[][];
        
        // Find header row (Thứ, Nội dung)
        const headerRowIdx = rawData.findIndex(row => 
          row && row.some(cell => typeof cell === 'string' && cell.trim() === 'Thứ') &&
          row.some(cell => typeof cell === 'string' && cell.trim() === 'Nội dung')
        );

        if (headerRowIdx === -1) return;

        const headerRow = rawData[headerRowIdx];
        
        // Cột tuần bắt đầu từ index 2
        // Mỗi tuần sẽ có dạng Map: weekName -> DayName -> DutyShift[]
        const weeksMap: Record<string, Record<string, any[]>> = {};

        // Khởi tạo các Tuần từ header
        for (let i = 2; i < headerRow.length; i++) {
          const weekName = headerRow[i] ? headerRow[i].toString().trim() : "";
          if (weekName) {
            weeksMap[weekName] = {};
          }
        }

        const weekNamesList = Object.keys(weeksMap);
        if (weekNamesList.length === 0) return;

        let currentDayName = "";

        for (let r = headerRowIdx + 1; r < rawData.length; r++) {
          const row = rawData[r];
          if (!row || row.length === 0) continue;

          // Cột 0: Thứ (e.g. "Hai")
          if (row[0] && typeof row[0] === 'string' && row[0].trim() !== "") {
            currentDayName = row[0].replace(/\n/g, ' ').trim();
          }

          if (!currentDayName) continue;

          // Cột 1: Nội dung (e.g. "6h50 - 7h30...")
          const content = row[1] ? row[1].toString().trim() : "";
          if (!content) continue;

          // Cột 2+ : Tên người trực của tuần đó
          let weekColIndex = 2;
          for (const weekName of weekNamesList) {
            const assignee = row[weekColIndex] ? row[weekColIndex].toString().trim() : "";
            
            if (assignee) {
              if (!weeksMap[weekName][currentDayName]) {
                weeksMap[weekName][currentDayName] = [];
              }
              weeksMap[weekName][currentDayName].push({
                id: Math.random().toString(36).substring(7),
                content,
                assignee
              });
            }
            weekColIndex++;
          }
        }

        // Format data
        const parsedWeeks = weekNamesList.map(weekName => {
          const daysMap = weeksMap[weekName];
          return {
            weekName,
            days: Object.keys(daysMap).map(dayName => ({
              dayName,
              shifts: daysMap[dayName]
            }))
          };
        }).filter(w => w.days.length > 0);

        if (parsedWeeks.length > 0) {
          months.push({
            monthName: sheetName.trim(),
            weeks: parsedWeeks
          });
        }
      });

      setParsedDuty({
        updatedAt: new Date().toISOString(),
        updatedBy: profile?.fullName || "Admin",
        months
      } as unknown as DutyScheduleData); // bypass typing temporarily to match new structure

      toast.success("Phân tích Lịch Trực thành công!");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Lỗi khi xử lý file Lịch Trực");
    } finally {
      setDutyLoading(false);
    }
  };

  const handleSaveDuty = async () => {
    if (!parsedDuty) return;
    setDutyLoading(true);
    try {
      await saveDutySchedule(parsedDuty);
      toast.success("Đã lưu Lịch Trực lên hệ thống!");
    } catch (e) {
      toast.error("Lỗi khi lưu Lịch Trực");
    } finally {
      setDutyLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <ClipboardList className="text-blue-600" />
            Cập nhật Lịch Làm Việc
          </h1>
          <p className="text-slate-500 mt-1">Tải lên file Excel Kế hoạch Tuần và Lịch Trực Tháng của giáo viên.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* --- WEEKLY SCHEDULE SECTION --- */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <FileSpreadsheet size={18} />
            </div>
            <h2 className="text-lg font-bold text-slate-800">1. Upload Kế hoạch Tuần</h2>
          </div>
          
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors">
            <input
              type="file"
              accept=".xlsx, .xlsm, .xls"
              onChange={e => { setWeeklyFile(e.target.files?.[0] || null); setParsedWeekly(null); }}
              className="hidden"
              id="weekly-upload"
            />
            <label htmlFor="weekly-upload" className="cursor-pointer flex flex-col items-center">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3">
                <Upload size={24} />
              </div>
              <span className="text-slate-700 font-medium text-base">
                {weeklyFile ? weeklyFile.name : "Chọn file Kế hoạch Tuần"}
              </span>
            </label>
          </div>
          
          <button
            onClick={handleProcessWeekly}
            disabled={!weeklyFile || weeklyLoading}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {weeklyLoading ? "Đang xử lý..." : "Phân tích file Lịch Tuần"}
          </button>

          {parsedWeekly && (
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-blue-500 shrink-0 mt-0.5" size={18} />
                <div className="text-sm text-blue-900">
                  <p className="font-bold">Đã phân tích thành công!</p>
                  <p>Tìm thấy {parsedWeekly.days?.length || 0} ngày. Tổng cộng {(parsedWeekly.days || []).reduce((acc, d) => acc + d.categories.reduce((cAcc, c) => cAcc + c.activities.length, 0), 0)} công việc.</p>
                </div>
              </div>
              <button
                onClick={handleSaveWeekly}
                disabled={weeklyLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Save size={18} />
                Lưu Kế Hoạch Tuần
              </button>
            </div>
          )}
        </div>

        {/* --- DUTY SCHEDULE SECTION --- */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 space-y-6">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
              <FileSpreadsheet size={18} />
            </div>
            <h2 className="text-lg font-bold text-slate-800">2. Upload Lịch Trực Tháng</h2>
          </div>
          
          <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:bg-slate-50 transition-colors">
            <input
              type="file"
              accept=".xlsx, .xlsm, .xls"
              onChange={e => { setDutyFile(e.target.files?.[0] || null); setParsedDuty(null); }}
              className="hidden"
              id="duty-upload"
            />
            <label htmlFor="duty-upload" className="cursor-pointer flex flex-col items-center">
              <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-full flex items-center justify-center mb-3">
                <Upload size={24} />
              </div>
              <span className="text-slate-700 font-medium text-base">
                {dutyFile ? dutyFile.name : "Chọn file Lịch Trực"}
              </span>
            </label>
          </div>
          
          <button
            onClick={handleProcessDuty}
            disabled={!dutyFile || dutyLoading}
            className="w-full bg-slate-800 hover:bg-slate-900 text-white py-3 rounded-xl font-medium transition-colors disabled:opacity-50"
          >
            {dutyLoading ? "Đang xử lý..." : "Phân tích file Lịch Trực"}
          </button>

          {parsedDuty && (
            <div className="bg-amber-50/50 p-4 rounded-xl border border-amber-100 space-y-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="text-amber-600 shrink-0 mt-0.5" size={18} />
                <div className="text-sm text-amber-900">
                  <p>Tìm thấy {parsedDuty.months.length} tháng. Tổng cộng {parsedDuty.months.reduce((acc, m) => acc + (m.weeks || []).reduce((wAcc, w) => wAcc + (w.days || []).reduce((dAcc, d) => dAcc + (d.shifts || []).length, 0), 0), 0)} ca trực.</p>
                </div>
              </div>
              <button
                onClick={handleSaveDuty}
                disabled={dutyLoading}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white py-2.5 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Save size={18} />
                Lưu Lịch Trực
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

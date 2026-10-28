"use client";

import React, { useState } from "react";
import { Upload, FileSpreadsheet, Save, Calendar, AlertCircle, Search, X } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";
import { useAuth } from "@/contexts/AuthContext";
import { saveSchedule, getDraftSchedule, saveDraftSchedule, publishDraftSchedule, deleteDraftSchedule, FullScheduleData, getScheduleSettings, saveScheduleSettings, ScheduleSettings } from "@/lib/services/schedule.service";
import { db } from "@/lib/firebase/client";
import { collection, getDocs, query, where } from "firebase/firestore";

import { parseScheduleExcel } from "@/lib/services/scheduleParser";

export default function ScheduleSettingsPage() {
  const { profile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [parsedData, setParsedData] = useState<FullScheduleData | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [draftCheckLoading, setDraftCheckLoading] = useState(true);
  const [teachersList, setTeachersList] = useState<any[]>([]);
  const [clbTeachers, setClbTeachers] = useState<string[]>([]);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [searchTeacher, setSearchTeacher] = useState("");
  const [weekName, setWeekName] = useState("");

  React.useEffect(() => {
    const checkDraft = async () => {
      try {
        const draft = await getDraftSchedule();
        setHasDraft(!!draft);
      } catch (e) {
        console.error("Error checking draft", e);
      } finally {
        setDraftCheckLoading(false);
      }
    };
    checkDraft();

    const fetchSettingsAndTeachers = async () => {
      try {
        const settings = await getScheduleSettings();
        if (settings && settings.clbTeachers) {
          setClbTeachers(settings.clbTeachers);
        }

        const q = query(collection(db, "users"));
        const querySnapshot = await getDocs(q);
        const teachers: any[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          if (data.fullName) teachers.push({ id: doc.id, fullName: data.fullName });
        });
        setTeachersList(teachers);
      } catch (e) {
        console.error(e);
      }
    };
    fetchSettingsAndTeachers();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setParsedData(null);

      // Auto-detect week name from filename
      let detectedWeek = "";
      const matchTuan = selectedFile.name.match(/tuần\s*(\d+)/i);
      const matchSo = selectedFile.name.match(/số\s*(\d+)/i);
      if (matchTuan) detectedWeek = `Tuần ${matchTuan[1]}`;
      else if (matchSo) detectedWeek = `TKB số ${matchSo[1]}`;
      else detectedWeek = selectedFile.name.replace(/\.[^/.]+$/, "");
      setWeekName(detectedWeek);
    }
  };

  const handleSaveClbSettings = async () => {
    setIsSavingSettings(true);
    try {
      await saveScheduleSettings({ clbTeachers });
      toast.success("Đã lưu cấu hình Giáo viên CLB");
    } catch (e) {
      toast.error("Lỗi lưu cấu hình");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleProcessFile = async () => {
    if (!file) return toast.error("Vui lòng chọn file Excel");

    setLoading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const currentWeekName = weekName || "TKB Tuần Sau";
      const data = parseScheduleExcel(arrayBuffer, {
        clbTeachers,
        updatedBy: profile?.fullName || "Admin",
        weekName: currentWeekName,
      });

      setParsedData(data);
      toast.success("Đã phân tích file thành công! Bạn có thể lưu TKB.");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Lỗi khi xử lý file Excel");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!parsedData) return;
    
    setLoading(true);
    try {
      const dataToSave: FullScheduleData = {
        ...parsedData,
        weekName: weekName || parsedData.weekName || "TKB Tuần Sau",
        updatedAt: new Date().toISOString(),
      };
      await saveDraftSchedule(dataToSave);
      setHasDraft(true);
      toast.success("Đã lưu Thời khóa biểu thành bản Nháp (Tuần sau)!");
    } catch (error: any) {
      console.error("Save draft schedule error:", error);
      toast.error(error?.message || "Lỗi khi lưu lên hệ thống");
    } finally {
      setLoading(false);
    }
  };

  const handlePublishDraft = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn áp dụng TKB Nháp thành TKB chính thức cho tuần này? Hành động này sẽ ghi đè TKB hiện tại.")) return;
    setLoading(true);
    try {
      await publishDraftSchedule();
      setHasDraft(false);
      setParsedData(null);
      setFile(null);
      toast.success("Đã áp dụng TKB Nháp thành công!");
    } catch (error) {
      toast.error("Lỗi khi áp dụng TKB");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa TKB Nháp này?")) return;
    setLoading(true);
    try {
      await deleteDraftSchedule();
      setHasDraft(false);
      toast.success("Đã xóa TKB Nháp!");
    } catch (error) {
      toast.error("Lỗi khi xóa TKB Nháp");
    } finally {
      setLoading(false);
    }
  };

  let conflictCount = 0;
  if (parsedData) {
    Object.values(parsedData.teachers).forEach(days => {
      Object.values(days).forEach(periods => {
        const periodMap = new Map();
        periods.forEach(p => {
          periodMap.set(p.period, (periodMap.get(p.period) || 0) + 1);
        });
        periodMap.forEach(count => {
          if (count > 1) conflictCount++;
        });
      });
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <Calendar className="text-blue-600" />
            Cập nhật Thời khóa biểu
          </h1>
          <p className="text-slate-500 mt-1">Tải lên file Excel TKB để kiểm tra trùng tiết và lưu làm bản nháp cho tuần sau.</p>
        </div>
      </div>

      {!draftCheckLoading && hasDraft && (
        <div className="bg-amber-50 p-6 rounded-2xl shadow-sm border border-amber-200 flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-amber-800 flex items-center gap-2">
              <AlertCircle size={20} />
              Đang có TKB Nháp (Tuần sau)
            </h2>
            <p className="text-amber-700 mt-1">Hệ thống đang lưu trữ 1 bản TKB nháp. Bạn có thể áp dụng bản nháp này thành TKB chính thức cho toàn trường.</p>
          </div>
          <div className="flex gap-3 shrink-0">
            <button
              onClick={handleDeleteDraft}
              disabled={loading}
              className="px-4 py-2 bg-white text-red-600 border border-red-200 hover:bg-red-50 rounded-xl font-medium transition-colors"
            >
              Xóa bản nháp
            </button>
            <button
              onClick={handlePublishDraft}
              disabled={loading}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-colors"
            >
              Áp dụng chính thức
            </button>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Calendar size={20} className="text-purple-600" />
              Giáo viên phụ trách Câu Lạc Bộ (CLB)
            </h2>
            <p className="text-sm text-slate-500 mt-1">Các tiết học có chữ "CLB" trong TKB Sáng Chiều sẽ tự động được gán cho những giáo viên này.</p>
          </div>
          <button
            onClick={handleSaveClbSettings}
            disabled={isSavingSettings}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-medium transition-colors whitespace-nowrap"
          >
            {isSavingSettings ? "Đang lưu..." : "Lưu cấu hình"}
          </button>
        </div>
        
        {/* Vùng hiển thị các giáo viên đã chọn (Tags) */}
        <div className="flex flex-wrap gap-2 mb-4">
          {clbTeachers.map(name => (
            <div key={name} className="bg-purple-50 text-purple-700 border border-purple-200 px-3 py-1.5 rounded-full flex items-center gap-2 text-sm font-medium">
              {name}
              <button 
                onClick={() => setClbTeachers(prev => prev.filter(n => n !== name))}
                className="hover:bg-purple-200 rounded-full p-0.5 transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {clbTeachers.length === 0 && (
            <span className="text-sm text-slate-400 italic py-1.5">Chưa có giáo viên nào được chọn</span>
          )}
        </div>

        {/* Ô tìm kiếm và thêm giáo viên */}
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-slate-400" />
          </div>
          <input
            type="text"
            placeholder="Tìm kiếm và thêm giáo viên..."
            value={searchTeacher}
            onChange={(e) => setSearchTeacher(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
          />
          
          {/* Dropdown kết quả tìm kiếm */}
          {searchTeacher.trim() !== "" && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-100 rounded-xl shadow-lg max-h-60 overflow-y-auto z-10 p-1">
              {teachersList
                .filter(t => t.fullName.toLowerCase().includes(searchTeacher.toLowerCase()) && !clbTeachers.includes(t.fullName))
                .map(t => (
                  <button
                    key={t.id}
                    onClick={() => {
                      setClbTeachers([...clbTeachers, t.fullName]);
                      setSearchTeacher("");
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-slate-50 rounded-lg text-sm text-slate-700 font-medium transition-colors"
                  >
                    {t.fullName}
                  </button>
                ))}
              {teachersList.filter(t => t.fullName.toLowerCase().includes(searchTeacher.toLowerCase()) && !clbTeachers.includes(t.fullName)).length === 0 && (
                <div className="px-3 py-3 text-sm text-slate-400 text-center">Không tìm thấy giáo viên phù hợp</div>
              )}
            </div>
          )}
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
                
                {conflictCount > 0 ? (
                  <div className="mt-4 p-3 bg-red-100 text-red-800 rounded-lg border border-red-200 flex items-start gap-2">
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Cảnh báo: </span>
                      Phát hiện <strong>{conflictCount}</strong> trường hợp giáo viên bị trùng tiết (dạy 2 lớp cùng 1 thời điểm). Bạn vẫn có thể lưu Nháp và yêu cầu GV vào xem để báo lại lỗi.
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 p-3 bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-200">
                    <span className="font-bold">Tuyệt vời: </span> Không phát hiện trường hợp trùng tiết nào.
                  </div>
                )}
              </div>

              {/* Tên tuần hiển thị trên TKB */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Tên tuần / Phiên bản TKB (hiển thị trên TKB và khi in PDF):
                </label>
                <input
                  type="text"
                  value={weekName}
                  onChange={(e) => setWeekName(e.target.value)}
                  placeholder="Ví dụ: TKB số 12, Tuần 12..."
                  className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-sm"
                />
              </div>

              <button
                onClick={handleSaveDraft}
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                <Save size={20} />
                Lưu thành TKB Tuần Sau (Dự kiến)
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

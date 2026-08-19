"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ClipboardCheck, Loader2, RefreshCw, AlertTriangle, CheckCircle, Search, Terminal } from "lucide-react";
import toast from "react-hot-toast";

export default function ClasshubAttendancePage() {
  const { profile, user } = useAuth();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [attending, setAttending] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [forceSync, setForceSync] = useState(false);

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const idToken = await user?.getIdToken();
      const response = await fetch(`/api/classhub/sync/classes?forceSync=${forceSync}`, {
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      const result = await response.json();
      if (result.success && result.data) {
        // Filter out classes that are already ACCEPTED
        const pending = result.data.filter((c: any) => {
          let teacherStatus = String(c.raw_data?.instructor_attendance_status || c.raw_data?.instructor_attendance_sheet_status || "").toUpperCase();
          if (teacherStatus.includes("ACCEPTED")) return false; // Mình đã chốt sổ
          
          let status = String(c.studyClassStatus || c.raw_data?.status || c.raw_data?.attendance_sheet_status || "").toUpperCase();
          if (!teacherStatus && status.includes("ACCEPTED")) return false; 
          
          return true;
        });
        setClasses(pending);
        setHasFetched(true);
        if (result.logs) setLogs(result.logs);
      } else {
        toast.error(result.message || "Không thể lấy danh sách lớp");
        if (result.logs) setLogs(result.logs);
      }
    } catch (error) {
      console.error("Fetch classes error", error);
      toast.error("Lỗi khi tải danh sách lớp");
    } finally {
      setLoading(false);
    }
  };

  
  const handleAutoAttend = async () => {
    if (classes.length === 0) return;
    
    const confirmMsg = `Bạn có chắc muốn tự động điểm danh cho ${classes.length} lớp học?`;
    if (!window.confirm(confirmMsg)) return;

    setAttending(true);
    const toastId = toast.loading("Đang thực hiện điểm danh qua API nền...");
    try {
      const idToken = await user?.getIdToken();
      const response = await fetch("/api/classhub/sync/attendance", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ forceSync })
      });
      const result = await response.json();
      
      if (result.success) {
        toast.success(result.message || "Điểm danh hoàn tất!", { id: toastId, duration: 5000 });
        // Refresh list
        fetchClasses();
      } else {
        toast.error(result.message || "Có lỗi xảy ra", { id: toastId });
        if (result.logs) setLogs(result.logs);
      }
    } catch (error) {
      console.error("Auto attend error", error);
      toast.error("Lỗi kết nối", { id: toastId });
    } finally {
      setAttending(false);
    }
  };

  if (!profile) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <ClipboardCheck className="text-emerald-600" />
            Điểm danh ClassHub (Auto API)
          </h1>
          <p className="text-slate-500 mt-1">Đồng bộ và điểm danh siêu tốc trực tiếp từ hệ thống, không cần Extension.</p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="flex gap-3">
            <button 
              onClick={fetchClasses} 
              disabled={loading || attending}
              className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              <Search size={18} className={loading ? "animate-spin" : ""} />
              Quét lớp chưa điểm danh
            </button>
            <button 
              onClick={handleAutoAttend} 
              disabled={classes.length === 0 || loading || attending}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm shadow-emerald-600/20 disabled:opacity-50"
            >
              {attending ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
              Điểm danh 1 chạm
            </button>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer hover:text-slate-800">
            <input 
              type="checkbox" 
              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              checked={forceSync}
              onChange={(e) => setForceSync(e.target.checked)}
              disabled={loading || attending}
            />
            Bỏ qua giới hạn ngày (Quét toàn bộ tab)
          </label>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
          </div>
        ) : classes.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-700 mb-2">Tuyệt vời!</h3>
            <p className="text-slate-500">Tất cả các lớp của bạn đều đã được điểm danh.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                  <th className="py-4 px-6">Lớp học</th>
                  <th className="py-4 px-6">Môn / Tiết</th>
                  <th className="py-4 px-6">Thời gian</th>
                  <th className="py-4 px-6">Sĩ số</th>
                  <th className="py-4 px-6">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {classes.map((cls, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="font-bold text-slate-800">{cls.className}</div>
                      <div className="text-xs text-slate-500 font-mono mt-1">ID: {cls.id}</div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="font-medium text-slate-700">{cls.moduleName || cls.code}</span>
                      {cls.raw_data?.class_hour_code && (
                        <span className="ml-2 px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-bold border border-blue-100">
                          Tiết {cls.raw_data.class_hour_code}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <div className="text-sm font-medium text-slate-700">
                        {cls.raw_data?.class_schedule_date || cls.raw_data?.date}
                      </div>
                      <div className="text-xs text-slate-500">
                        {cls.raw_data?.class_hour_start_time} - {cls.raw_data?.class_hour_end_time}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className="bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md text-sm font-semibold">
                        {cls.numberOfStudents || "?"}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg w-fit border border-amber-200">
                        <AlertTriangle size={14} />
                        <span className="text-xs font-bold">Chưa điểm danh</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

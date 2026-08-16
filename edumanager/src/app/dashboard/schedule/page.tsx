"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getSchedule, getDraftSchedule, FullScheduleData, ScheduleClassInfo } from "@/lib/services/schedule.service";
import { assignmentService } from "@/lib/services/assignment.service";
import { classService } from "@/lib/services/class.service";
import { db } from "@/lib/firebase/client";
import { doc, updateDoc } from "firebase/firestore";
import { Calendar, Printer, Download, User, Users } from "lucide-react";
import toast from "react-hot-toast";
import { generateClassTimetablePdf } from "@/lib/services/pdf.service";
import SwapSearchModal from "@/components/schedule/SwapSearchModal";

// Helper component to render a schedule grid
const ScheduleGrid = ({ 
  scheduleData, 
  title, 
  fullSchedule, 
  currentTeacherName 
}: { 
  scheduleData: Record<string, ScheduleClassInfo[]>, 
  title: string,
  fullSchedule?: FullScheduleData,
  currentTeacherName?: string
}) => {
  const days = ["2", "3", "4", "5", "6"];
  const [activeMobileDay, setActiveMobileDay] = useState("2");
  
  // Modal state
  const [swapModalState, setSwapModalState] = useState<{
    isOpen: boolean;
    day: string;
    period: string;
    cellData: ScheduleClassInfo | null;
  }>({ isOpen: false, day: "", period: "", cellData: null });

  const handleCellClick = (day: string, period: string, cellData: ScheduleClassInfo) => {
    if (fullSchedule && currentTeacherName) {
      setSwapModalState({ isOpen: true, day, period, cellData });
    }
  };

  // Luôn hiển thị ít nhất 9 tiết
  const allPeriodsSet = new Set<string>(["1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  let totalPeriods = 0;
  Object.values(scheduleData).forEach(dayArr => {
    dayArr.forEach(item => {
      if (item && item.period) {
        totalPeriods++;
        const match = item.period.toString().trim().match(/\d+/);
        if (match) allPeriodsSet.add(match[0]);
      }
    });
  });
  const periods = Array.from(allPeriodsSet).sort((a, b) => parseInt(a) - parseInt(b));
  
  const displayTitle = totalPeriods > 0 ? `${title} (Tổng: ${totalPeriods} tiết)` : title;

  if (periods.length === 0) {
    return <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl">Không có dữ liệu thời khóa biểu.</div>;
  }

  const activeDayData = scheduleData[activeMobileDay] || [];

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" id="schedule-print-area">
      <div className="bg-blue-600 text-white p-4 text-center">
        <h2 className="text-xl font-bold uppercase">{displayTitle}</h2>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block overflow-x-auto p-4">
        <table className="w-full text-center border-collapse">
          <thead>
            <tr>
              <th className="border border-slate-300 bg-slate-100 py-3 px-4 w-24 text-slate-700 font-bold">Tiết</th>
              {days.map(day => (
                <th key={day} className="border border-slate-300 bg-slate-100 py-3 px-4 min-w-[150px] text-slate-700 font-bold">Thứ {day}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map(period => (
              <tr key={period} className="hover:bg-slate-50 transition-colors">
                <td className="border border-slate-300 py-4 px-2 font-bold text-slate-700 bg-slate-50">
                  Tiết {period}
                </td>
                {days.map(day => {
                  const dayData = scheduleData[day] || [];
                  const cellDatas = dayData.filter(item => item.period === period);
                  
                  return (
                    <td key={`${day}-${period}`} className="border border-slate-300 py-3 px-2">
                      {cellDatas.length > 0 ? (
                        <div className="flex flex-col gap-2">
                          {cellDatas.map((cellData, idx) => (
                            <div 
                              key={idx}
                              onClick={() => handleCellClick(day, period, cellData)}
                              className={`flex flex-col items-center justify-center space-y-1 ${
                                cellDatas.length > 1 ? 'bg-red-50 border border-red-200 shadow-sm' : 
                                (fullSchedule && currentTeacherName ? 'hover:bg-blue-50 transition-colors' : '')
                              } p-2 rounded-lg`}
                              title={fullSchedule && currentTeacherName ? "Bấm vào để tra cứu giáo viên đổi tiết/dạy thay" : undefined}
                            >
                              {cellDatas.length > 1 && <span className="text-xs font-bold text-red-600 uppercase bg-red-100 px-2 py-0.5 rounded animate-pulse">Trùng Tiết!</span>}
                              <span className={`font-bold text-sm ${cellDatas.length > 1 ? 'text-red-700' : 'text-blue-700'}`}>{cellData.subject}</span>
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-md border ${cellDatas.length > 1 ? 'bg-red-100 text-red-800 border-red-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                                {cellData.className}
                              </span>
                              <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                {cellData.time}
                              </span>
                              {cellData.teacher && (
                                <span className="text-xs text-slate-500 italic">{cellData.teacher}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Day-by-Day Timeline View */}
      <div className="block md:hidden p-4 space-y-4">
        {/* Day Selector Tabs */}
        <div className="flex justify-between bg-slate-100 p-1.5 rounded-xl gap-1">
          {days.map(day => (
            <button
              key={day}
              type="button"
              onClick={() => setActiveMobileDay(day)}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition ${
                activeMobileDay === day
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 hover:bg-slate-200"
              }`}
            >
              Thứ {day}
            </button>
          ))}
        </div>

        {/* Timeline list for selected day */}
        <div className="space-y-3 pt-2">
          {periods.map(period => {
            const cellDatas = activeDayData.filter(item => item.period === period);

            return (
              <div key={period} className={`flex items-center gap-3 p-3.5 rounded-xl border ${cellDatas.length > 1 ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0 border ${cellDatas.length > 1 ? 'bg-red-100 text-red-800 border-red-200' : 'bg-blue-100 text-blue-800 border-blue-200'}`}>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${cellDatas.length > 1 ? 'text-red-600' : 'text-blue-600'}`}>Tiết</span>
                  <span className="text-xl font-black">{period}</span>
                </div>

                <div className="flex-1 min-w-0 space-y-2">
                  {cellDatas.length > 0 ? (
                    cellDatas.map((cellData, idx) => (
                      <div 
                        key={idx}
                        onClick={() => handleCellClick(activeMobileDay, period, cellData)}
                        className={fullSchedule && currentTeacherName ? "cursor-pointer" : ""}
                      >
                        {cellDatas.length > 1 && idx === 0 && <span className="text-xs font-bold text-red-600 uppercase bg-red-100 px-2 py-0.5 rounded mb-1 inline-block animate-pulse">Trùng Tiết!</span>}
                        <div className="flex items-center gap-2">
                          <h4 className={`font-bold text-base ${cellDatas.length > 1 ? 'text-red-700' : 'text-slate-800'}`}>{cellData.subject}</h4>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded border ${cellDatas.length > 1 ? 'bg-red-100 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                            {cellData.className}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                          {cellData.time && (
                            <span className="text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                              {cellData.time}
                            </span>
                          )}
                          {cellData.teacher && <span>GV: {cellData.teacher}</span>}
                        </div>
                        {idx < cellDatas.length - 1 && <div className="border-b border-red-200 my-2"></div>}
                      </div>
                    ))
                  ) : (
                    <span className="text-slate-400 text-sm italic">Nghỉ / Không có tiết</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {swapModalState.cellData && fullSchedule && currentTeacherName && (
        <SwapSearchModal
          isOpen={swapModalState.isOpen}
          onClose={() => setSwapModalState(s => ({ ...s, isOpen: false }))}
          day={swapModalState.day}
          period={swapModalState.period}
          cellData={swapModalState.cellData}
          schedule={fullSchedule}
          teacherName={currentTeacherName}
        />
      )}
    </div>
  );
};

export default function SchedulePage() {
  const { profile } = useAuth();
  const [schedule, setSchedule] = useState<FullScheduleData | null>(null);
  const [draftSchedule, setDraftSchedule] = useState<FullScheduleData | null>(null);
  const [viewMode, setViewMode] = useState<"current" | "draft">("current");
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<"personal" | "homeroom">("personal");
  const [homeroomClasses, setHomeroomClasses] = useState<{ id: string, name: string }[]>([]);
  const [selectedTeacherName, setSelectedTeacherName] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      if (!profile) return;
      try {
        const [sched, draft] = await Promise.all([getSchedule(), getDraftSchedule()]);
        setSchedule(sched);
        setDraftSchedule(draft);

        if (sched) {
          // Try to auto match teacher name if not already saved
          const allTeachers = Object.keys(sched.teachers);
          
          if ((profile as any).scheduleName && allTeachers.includes((profile as any).scheduleName)) {
            setSelectedTeacherName((profile as any).scheduleName);
          } else {
            const exactMatch = allTeachers.find(t => t.toLowerCase() === profile.fullName.toLowerCase());
            const includesMatch = allTeachers.find(t => profile.fullName.toLowerCase().includes(t.toLowerCase()));
            
            if (exactMatch) setSelectedTeacherName(exactMatch);
            else if (includesMatch) setSelectedTeacherName(includesMatch);
            else if (allTeachers.length > 0) setSelectedTeacherName(""); // Let them choose manually
          }
        }

        // Fetch Homeroom classes
        const assignments = await assignmentService.getAssignmentsByTeacherId(profile.id);
        const hrAssignments = assignments.filter(a => a.role === "GVCN" || a.role === "PCN");
        
        const hrClasses = await Promise.all(
          hrAssignments.map(async (a) => {
            const cls = await classService.getClassById(a.classId);
            return cls ? { id: cls.id!, name: cls.name } : null;
          })
        );
        
        setHomeroomClasses(hrClasses.filter(c => c !== null) as { id: string, name: string }[]);
      } catch (error) {
        console.error("Error fetching schedule data", error);
        toast.error("Không thể tải thời khóa biểu");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [profile]);

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const handlePrint = async () => {
    const activeSchedule = viewMode === "current" ? schedule : draftSchedule;
    if (activeTab.startsWith("homeroom-") && activeSchedule) {
      const className = activeTab.split("-")[1];
      const classSched = activeSchedule.classes[className];
      if (!classSched) {
        toast.error("Không có dữ liệu thời khóa biểu để in.");
        return;
      }

      setIsGeneratingPdf(true);
      const toastId = toast.loading("Đang tạo file PDF...");
      try {
        const teacherName = profile?.fullName || "Giáo viên";
        const applicationDate = activeSchedule.weekName || new Date(activeSchedule.updatedAt).toLocaleDateString("vi-VN");
        
        let secondaryClassSched;
        let secondaryClassName;
        
        if (className === '9C' && activeSchedule.classes['9A-C']) {
          secondaryClassSched = activeSchedule.classes['9A-C'];
          secondaryClassName = '9A-C';
        }

        const blob = await generateClassTimetablePdf(
          classSched, 
          className, 
          teacherName, 
          applicationDate,
          secondaryClassSched,
          secondaryClassName
        );
        
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `TKB_Lop_${className}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        toast.success("Tạo file PDF thành công!", { id: toastId });
      } catch (error) {
        console.error("Error generating PDF:", error);
        toast.error("Có lỗi xảy ra khi tạo PDF.", { id: toastId });
      } finally {
        setIsGeneratingPdf(false);
      }
    } else {
      // Default browser print for personal schedule
      window.print();
    }
  };

  const handleNameChange = async (newName: string) => {
    setSelectedTeacherName(newName);
    if (newName && profile) {
      try {
        await updateDoc(doc(db, "users", profile.id), { scheduleName: newName });
        toast.success("Đã lưu liên kết tên TKB!");
      } catch (e) {
        console.error("Error saving scheduleName", e);
      }
    }
  };

  if (loading) {
    return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div></div>;
  }

  const activeSchedule = viewMode === "current" ? schedule : draftSchedule;

  if (!activeSchedule) {
    return (
      <div className="space-y-6">
        {draftSchedule && (
          <div className="flex justify-center bg-white p-2 rounded-xl shadow-sm border border-slate-100 max-w-fit mx-auto">
            <button
              onClick={() => setViewMode("current")}
              className={`px-6 py-2 rounded-lg font-medium transition-colors ${viewMode === "current" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
            >
              TKB Tuần Này
            </button>
            <button
              onClick={() => setViewMode("draft")}
              className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${viewMode === "draft" ? "bg-amber-500 text-white" : "text-amber-700 hover:bg-amber-50"}`}
            >
              TKB Tuần Sau (Nháp)
            </button>
          </div>
        )}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
          <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-700 mb-2">Chưa có dữ liệu Thời khóa biểu</h2>
          <p className="text-slate-500">Quản trị viên chưa cập nhật thời khóa biểu lên hệ thống.</p>
        </div>
      </div>
    );
  }

  const teacherList = Object.keys(activeSchedule.teachers).sort();
  const personalSchedule = selectedTeacherName ? activeSchedule.teachers[selectedTeacherName] : null;

  return (
    <div className="space-y-6">
      {draftSchedule && (
        <div className="flex justify-center bg-white p-2 rounded-xl shadow-sm border border-slate-100 max-w-fit mx-auto print:hidden">
          <button
            onClick={() => setViewMode("current")}
            className={`px-6 py-2 rounded-lg font-medium transition-colors ${viewMode === "current" ? "bg-blue-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            TKB Tuần Này
          </button>
          <button
            onClick={() => setViewMode("draft")}
            className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${viewMode === "draft" ? "bg-amber-500 text-white" : "text-amber-700 hover:bg-amber-50"}`}
          >
            TKB Tuần Sau (Nháp)
          </button>
        </div>
      )}

      {viewMode === "draft" && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl text-amber-800 text-center font-medium print:hidden">
          Đây là Thời Khóa Biểu Dự Kiến cho tuần sau. Nếu phát hiện trùng tiết (ô màu đỏ), vui lòng báo BGH.
        </div>
      )}

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <Calendar className={viewMode === "draft" ? "text-amber-500" : "text-blue-600"} />
            Thời khóa biểu {viewMode === "draft" ? "(Dự kiến)" : ""}
          </h1>
          <p className="text-slate-500 mt-1">Cập nhật lúc: {new Date(activeSchedule.updatedAt).toLocaleString("vi-VN")} bởi {activeSchedule.updatedBy}</p>
        </div>
        
        <button 
          onClick={handlePrint}
          disabled={isGeneratingPdf}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50"
        >
          {isGeneratingPdf ? (
            <div className="animate-spin h-5 w-5 border-2 border-white rounded-full border-t-transparent"></div>
          ) : (
            <Printer size={18} />
          )}
          <span>{isGeneratingPdf ? "Đang tạo..." : "In / Lưu PDF"}</span>
        </button>
      </div>

      <div className="print:hidden flex gap-2 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab("personal")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
            activeTab === "personal" 
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <User size={18} />
          TKB Cá Nhân
        </button>
        
        {homeroomClasses.map(cls => (
          <button
            key={cls.id}
            onClick={() => setActiveTab(`homeroom-${cls.name}` as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all ${
              activeTab === `homeroom-${cls.name}`
                ? "bg-amber-500 text-white shadow-md shadow-amber-500/20" 
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
            }`}
          >
            <Users size={18} />
            TKB Lớp {cls.name}
          </button>
        ))}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #schedule-print-area, #schedule-print-area * {
            visibility: visible;
          }
          #schedule-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}} />

      {activeTab === "personal" && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4 print:hidden">
            <span className="font-medium text-slate-700">Tên TKB của bạn:</span>
            <select 
              value={selectedTeacherName}
              onChange={(e) => handleNameChange(e.target.value)}
              className="px-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-800 font-medium focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              <option value="">-- Chọn tên --</option>
              {teacherList.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <span className="text-sm text-slate-400 italic">(Vui lòng chọn đúng tên nếu hệ thống nhận diện sai)</span>
          </div>

          {personalSchedule ? (
            <ScheduleGrid 
              scheduleData={personalSchedule} 
              title={`Thời Khóa Biểu Giảng Dạy - GV: ${selectedTeacherName}`} 
              fullSchedule={activeSchedule}
              currentTeacherName={selectedTeacherName}
            />
          ) : (
            <div className="text-center p-8 bg-white rounded-xl border border-slate-200 text-slate-500">
              Không tìm thấy thời khóa biểu cho tên này.
            </div>
          )}
        </div>
      )}

      {activeTab.startsWith("homeroom-") && (
        <div className="space-y-4">
          {(() => {
            const className = activeTab.split("-")[1];
            const classSched = activeSchedule.classes[className];
            if (!classSched) {
              return (
                <div className="text-center p-8 bg-white rounded-xl border border-slate-200 text-slate-500">
                  Không tìm thấy thời khóa biểu cho lớp {className}.
                </div>
              );
            }
            return (
              <ScheduleGrid 
                scheduleData={classSched} 
                title={`Thời Khóa Biểu Lớp ${className}`} 
              />
            );
          })()}
        </div>
      )}
    </div>
  );
}

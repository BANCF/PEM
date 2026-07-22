"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { getSchedule, FullScheduleData, ScheduleClassInfo } from "@/lib/services/schedule.service";
import { assignmentService } from "@/lib/services/assignment.service";
import { classService } from "@/lib/services/class.service";
import { db } from "@/lib/firebase/client";
import { doc, updateDoc } from "firebase/firestore";
import { Calendar, Printer, Download, User, Users } from "lucide-react";
import toast from "react-hot-toast";

// Helper component to render a schedule grid
const ScheduleGrid = ({ scheduleData, title }: { scheduleData: Record<string, ScheduleClassInfo[]>, title: string }) => {
  const days = ["2", "3", "4", "5", "6"]; // Thứ 2 đến 6
  // Lấy danh sách các tiết duy nhất để vẽ hàng
  const allPeriodsSet = new Set<string>();
  Object.values(scheduleData).forEach(dayArr => {
    dayArr.forEach(item => allPeriodsSet.add(item.period));
  });
  const periods = Array.from(allPeriodsSet).sort((a, b) => parseInt(a) - parseInt(b));

  if (periods.length === 0) {
    return <div className="p-8 text-center text-slate-500 bg-slate-50 rounded-xl">Không có dữ liệu thời khóa biểu.</div>;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" id="schedule-print-area">
      <div className="bg-blue-600 text-white p-4 text-center">
        <h2 className="text-xl font-bold uppercase">{title}</h2>
      </div>
      <div className="overflow-x-auto p-4">
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
                  const cellData = dayData.find(item => item.period === period);
                  
                  return (
                    <td key={`${day}-${period}`} className="border border-slate-300 py-3 px-2">
                      {cellData ? (
                        <div className="flex flex-col items-center justify-center space-y-1">
                          <span className="font-bold text-blue-700 text-sm">{cellData.subject}</span>
                          <span className="text-xs font-medium px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md border border-slate-200">
                            {cellData.className}
                          </span>
                          <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            {cellData.time}
                          </span>
                          {cellData.teacher && (
                            <span className="text-xs text-slate-500 italic">{cellData.teacher}</span>
                          )}
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
    </div>
  );
};

export default function SchedulePage() {
  const { profile } = useAuth();
  const [schedule, setSchedule] = useState<FullScheduleData | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<"personal" | "homeroom">("personal");
  const [homeroomClasses, setHomeroomClasses] = useState<{ id: string, name: string }[]>([]);
  const [selectedTeacherName, setSelectedTeacherName] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      if (!profile) return;
      try {
        const sched = await getSchedule();
        setSchedule(sched);

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

  const handlePrint = () => {
    window.print();
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

  if (!schedule) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
        <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-700 mb-2">Chưa có dữ liệu Thời khóa biểu</h2>
        <p className="text-slate-500">Quản trị viên chưa cập nhật thời khóa biểu lên hệ thống.</p>
      </div>
    );
  }

  const teacherList = Object.keys(schedule.teachers).sort();
  const personalSchedule = selectedTeacherName ? schedule.teachers[selectedTeacherName] : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100 gap-4 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <Calendar className="text-blue-600" />
            Thời khóa biểu
          </h1>
          <p className="text-slate-500 mt-1">Cập nhật lúc: {new Date(schedule.updatedAt).toLocaleString("vi-VN")} bởi {schedule.updatedBy}</p>
        </div>
        
        <button 
          onClick={handlePrint}
          className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-5 py-2.5 rounded-xl font-medium transition-colors"
        >
          <Printer size={18} />
          <span>In / Lưu PDF</span>
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
            const classSched = schedule.classes[className];
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

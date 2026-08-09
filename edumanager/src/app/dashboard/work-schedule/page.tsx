"use client";

import React, { useState, useEffect } from "react";
import { ClipboardList, CalendarDays, Search, UserCheck, Calendar } from "lucide-react";
import { getWeeklySchedule, getDutySchedule, WeeklyScheduleData, DutyScheduleData } from "@/lib/services/workSchedule.service";
import { useAuth } from "@/contexts/AuthContext";

export default function WorkSchedulePage() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<"weekly" | "duty">("weekly");
  const [loading, setLoading] = useState(true);
  
  // Weekly Data
  const [weeklyData, setWeeklyData] = useState<WeeklyScheduleData | null>(null);
  const [activeDay, setActiveDay] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<string>("Toàn trường");
  const [searchWeekly, setSearchWeekly] = useState("");

  // Duty Data
  const [dutyData, setDutyData] = useState<DutyScheduleData | null>(null);
  const [activeMonth, setActiveMonth] = useState<string>("");
  const [activeDutyWeek, setActiveDutyWeek] = useState<string>("");
  const [searchDuty, setSearchDuty] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [w, d] = await Promise.all([getWeeklySchedule(), getDutySchedule()]);
        
        if (w) {
          setWeeklyData(w);
          if (w.days && w.days.length > 0) setActiveDay(w.days[0].dayName);
        }
        
        if (d) {
          setDutyData(d);
          if (d.months && d.months.length > 0) {
            setActiveMonth(d.months[0].monthName);
            if (d.months[0].weeks && d.months[0].weeks.length > 0) {
              setActiveDutyWeek(d.months[0].weeks[0].weekName);
            }
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const renderWeeklySchedule = () => {
    if (!weeklyData || !weeklyData.days || weeklyData.days.length === 0) {
      return (
        <div className="text-center p-12 bg-white rounded-2xl shadow-sm border border-slate-100">
          <CalendarDays className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900">Chưa có Kế hoạch Tuần</h3>
          <p className="mt-1 text-slate-500">Ban giám hiệu chưa cập nhật Kế hoạch tuần.</p>
        </div>
      );
    }

    const currentDayData = weeklyData.days.find(d => d.dayName === activeDay) || weeklyData.days[0];
    
    // Get unique categories from this day, and ensure the 3 default tabs always exist for consistency if user wants
    const allCategoriesInDay = currentDayData.categories.map(c => c.categoryName);
    
    // Create a fixed order for standard tabs
    const standardTabs = ["Toàn trường", "Tiểu học", "THCS"];
    const otherTabs = allCategoriesInDay.filter(c => !standardTabs.includes(c));
    const displayTabs = [...standardTabs, ...otherTabs];
    
    // Ensure safe fallback
    const safeActiveCategory = displayTabs.includes(activeCategory) ? activeCategory : displayTabs[0];
    
    const currentCategoryData = currentDayData.categories.find(c => c.categoryName === safeActiveCategory);

    return (
      <div className="space-y-6">
        {/* Title and Search */}
        <div className="flex flex-col lg:flex-row gap-4 items-center justify-between bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
           <h2 className="text-xl font-bold text-slate-800 whitespace-pre-wrap leading-relaxed text-center lg:text-left">
             {weeklyData.title}
           </h2>
           <div className="relative w-full lg:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Tìm công việc, người thực hiện..."
              value={searchWeekly}
              onChange={e => setSearchWeekly(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
            {searchWeekly && (
              <button onClick={() => setSearchWeekly("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 hover:text-slate-600">
                Xóa
              </button>
            )}
          </div>
        </div>

        {/* Days Selector */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {weeklyData.days.map(d => (
            <button
              key={d.dayName}
              onClick={() => setActiveDay(d.dayName)}
              className={`whitespace-nowrap px-5 py-3 rounded-xl font-bold transition-all ${
                activeDay === d.dayName 
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/20" 
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              }`}
            >
              {d.dayName.replace(/\n/g, " ")}
            </button>
          ))}
        </div>

        {/* Categories Selector */}
        <div className="flex gap-2 border-b border-slate-200 overflow-x-auto">
           {displayTabs.map(cat => (
             <button
               key={cat}
               onClick={() => setActiveCategory(cat)}
               className={`whitespace-nowrap px-6 py-3 font-bold text-sm transition-colors border-b-2 ${
                 safeActiveCategory === cat
                   ? "border-blue-600 text-blue-600"
                   : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
               }`}
             >
               {cat}
             </button>
           ))}
        </div>

        {/* Activities List */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 space-y-4">
            {!currentCategoryData || currentCategoryData.activities.length === 0 ? (
               <div className="text-center py-12 text-slate-500 flex flex-col items-center">
                 <ClipboardList className="w-12 h-12 text-slate-200 mb-3" />
                 Không có lịch hoạt động nào cho bộ phận <strong>{safeActiveCategory}</strong> vào {activeDay.replace(/\n/g, " ")}.
               </div>
            ) : (() => {
               const filteredActivities = currentCategoryData.activities.filter(act => {
                 if (!searchWeekly) return true;
                 const term = searchWeekly.toLowerCase();
                 return act.task.toLowerCase().includes(term) || 
                        act.assignee.toLowerCase().includes(term) ||
                        act.requirement.toLowerCase().includes(term);
               });

               if (filteredActivities.length === 0) {
                 return (
                   <div className="text-center py-10 text-slate-500">
                     Không tìm thấy kết quả nào phù hợp với "{searchWeekly}"
                   </div>
                 );
               }

               return (
                 <div className="space-y-4">
                   {filteredActivities.map(act => {
                      const isMyTask = profile && act.assignee && (
                        act.assignee.toLowerCase().includes(profile.fullName.toLowerCase()) || 
                        profile.fullName.toLowerCase().includes(act.assignee.toLowerCase())
                      );

                      return (
                        <div key={act.id} className={`p-5 rounded-xl border flex flex-col gap-3 transition-colors ${
                          isMyTask ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200 hover:bg-slate-100"
                        }`}>
                           <div className="flex items-start justify-between gap-4">
                              <h4 className="font-bold text-slate-800 text-lg leading-relaxed flex-1">
                                 {act.task}
                              </h4>
                              {isMyTask && (
                                 <span className="bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full animate-pulse whitespace-nowrap shrink-0 shadow-sm shadow-red-500/30">
                                    CÔNG VIỆC CỦA BẠN
                                 </span>
                              )}
                           </div>
                           
                           {act.requirement && (
                             <div className="text-slate-600 text-sm bg-white/60 p-3 rounded-lg border border-slate-200/60 whitespace-pre-wrap">
                               <span className="font-semibold text-slate-700 mr-2">Yêu cầu:</span>
                               {act.requirement}
                             </div>
                           )}

                           <div className="flex items-center gap-2 mt-2">
                             <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Người thực hiện:</span>
                             <span className={`text-sm font-bold px-3 py-1 rounded-lg ${
                               isMyTask ? "bg-red-100 text-red-700" : "bg-white border border-slate-200 text-slate-700"
                             }`}>
                               {act.assignee || "Chưa phân công"}
                             </span>
                           </div>
                        </div>
                      );
                   })}
                 </div>
               );
            })()}
          </div>
        </div>
      </div>
    );
  };

  const renderDutySchedule = () => {
    if (!dutyData || !dutyData.months || dutyData.months.length === 0) {
      return (
        <div className="text-center p-12 bg-white rounded-2xl shadow-sm border border-slate-100">
          <UserCheck className="mx-auto h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-900">Chưa có Lịch Trực</h3>
          <p className="mt-1 text-slate-500">Ban giám hiệu chưa cập nhật Lịch trực tháng.</p>
        </div>
      );
    }

    const currentMonthData = dutyData.months.find(m => m.monthName === activeMonth) || dutyData.months[0];
    
    // Fallback if activeDutyWeek is invalid for the new month
    const safeActiveWeek = currentMonthData.weeks.some(w => w.weekName === activeDutyWeek) 
      ? activeDutyWeek 
      : (currentMonthData.weeks[0]?.weekName || "");
      
    const currentWeekData = currentMonthData.weeks.find(w => w.weekName === safeActiveWeek);

    return (
      <div className="space-y-6">
        {/* Month Selector */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex gap-2 overflow-x-auto w-full md:w-auto pb-1">
            {dutyData.months.map(m => (
              <button
                key={m.monthName}
                onClick={() => {
                  setActiveMonth(m.monthName);
                  if (m.weeks.length > 0) setActiveDutyWeek(m.weeks[0].weekName);
                }}
                className={`whitespace-nowrap px-5 py-2.5 rounded-xl font-bold transition-colors ${
                  activeMonth === m.monthName 
                    ? "bg-amber-500 text-white shadow-md shadow-amber-500/20" 
                    : "bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100"
                }`}
              >
                Tháng {m.monthName.replace(/lịch trực|tháng/gi, '').trim()}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Tìm nội dung, tên bạn..."
              value={searchDuty}
              onChange={e => setSearchDuty(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500/50"
            />
            {searchDuty && (
              <button onClick={() => setSearchDuty("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-400 hover:text-slate-600">
                Xóa
              </button>
            )}
          </div>
        </div>

        {/* Week Selector */}
        {currentMonthData.weeks.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {currentMonthData.weeks.map(w => (
              <button
                key={w.weekName}
                onClick={() => setActiveDutyWeek(w.weekName)}
                className={`whitespace-nowrap px-4 py-2 rounded-xl font-semibold transition-colors ${
                  safeActiveWeek === w.weekName 
                    ? "bg-indigo-600 text-white shadow-sm" 
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {w.weekName}
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {!currentWeekData ? (
          <div className="text-center p-12 bg-white rounded-2xl border border-slate-100 text-slate-500">
            Không có dữ liệu ca trực.
          </div>
        ) : (
          <div className="grid gap-6">
            {currentWeekData.days.map(day => {
              // Lọc theo search
              const filteredShifts = day.shifts.filter(s => {
                if (!searchDuty) return true;
                const term = searchDuty.toLowerCase();
                return s.content.toLowerCase().includes(term) || s.assignee.toLowerCase().includes(term);
              });

              if (filteredShifts.length === 0) return null;

              return (
                <div key={day.dayName} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="bg-amber-50 border-b border-amber-100 px-5 py-3 flex items-center gap-2">
                    <Calendar size={18} className="text-amber-600" />
                    <h3 className="font-bold text-amber-900 text-lg">{day.dayName.replace(/\n/g, ' ')}</h3>
                  </div>
                  
                  <div className="divide-y divide-slate-100">
                    {filteredShifts.map(shift => {
                      const isMyShift = profile && shift.assignee && (
                        shift.assignee.toLowerCase().includes(profile.fullName.toLowerCase()) || 
                        profile.fullName.toLowerCase().includes(shift.assignee.toLowerCase())
                      );

                      return (
                        <div key={shift.id} className={`p-5 flex flex-col md:flex-row gap-4 transition-colors ${
                          isMyShift ? 'bg-red-50' : 'hover:bg-slate-50'
                        }`}>
                          <div className="flex-1">
                            <p className="text-slate-800 font-medium whitespace-pre-wrap leading-relaxed text-[15px]">
                              {shift.content}
                            </p>
                          </div>
                          
                          <div className="shrink-0 md:w-64 flex flex-col items-start md:items-end justify-center">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                                Phân công:
                              </span>
                            </div>
                            <div className={`px-4 py-2 rounded-xl border font-bold text-sm flex items-center gap-2 ${
                              isMyShift
                                ? "bg-red-500 text-white border-red-600 shadow-md shadow-red-500/30 animate-pulse"
                                : "bg-white text-slate-700 border-slate-200"
                            }`}>
                              {shift.assignee}
                            </div>
                            {isMyShift && (
                              <span className="text-red-500 text-xs font-bold mt-2">
                                CA CỦA BẠN
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="flex justify-center p-12"><div className="animate-spin h-8 w-8 border-4 border-blue-500 rounded-full border-t-transparent"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <ClipboardList className="text-blue-600" />
            Lịch Làm Việc
          </h1>
          <p className="text-slate-500 mt-1">Theo dõi kế hoạch tuần và lịch trực phân công.</p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab("weekly")}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
            activeTab === "weekly" 
              ? "bg-blue-600 text-white shadow-md shadow-blue-500/20" 
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <CalendarDays size={20} />
          Kế Hoạch Tuần
        </button>
        <button
          onClick={() => setActiveTab("duty")}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${
            activeTab === "duty" 
              ? "bg-amber-500 text-white shadow-md shadow-amber-500/20" 
              : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
          }`}
        >
          <UserCheck size={20} />
          Lịch Trực Tháng
        </button>
      </div>

      <div className="animate-in fade-in duration-300">
        {activeTab === "weekly" ? renderWeeklySchedule() : renderDutySchedule()}
      </div>
    </div>
  );
}

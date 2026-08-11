"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase/client";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Trophy, Users, TrendingUp, TrendingDown, Award, Search, FileText, Download, Building2 } from "lucide-react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import * as XLSX from 'xlsx';
import toast from "react-hot-toast";

interface TeacherKPI {
  uid: string;
  fullName: string;
  email: string;
  department: string;
  baseScore: number;
  kudosScore: number;
  penaltyScore: number;
  finalScore: number;
  evalCount: number;
  prevMonthScore?: number;
}

export default function DashboardPage() {
  const { profile, user } = useAuth();
  const [teachersData, setTeachersData] = useState<TeacherKPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"ALL" | "DEPARTMENT">("ALL");
  const [isSyncingAttendance, setIsSyncingAttendance] = useState(false);

  useEffect(() => {
    if (profile?.role === "TTCM" || profile?.role === "TPCM") {
      setViewMode("DEPARTMENT");
    }
  }, [profile]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        // 1. Fetch all teachers, TTCM, TPCM
        const teacherSnap = await getDocs(query(collection(db, "users"), where("role", "in", ["TEACHER", "TTCM", "TPCM"])));
        const teachers: Record<string, TeacherKPI> = {};
        
        teacherSnap.forEach(doc => {
          const data = doc.data();
          teachers[doc.id] = {
            uid: doc.id,
            fullName: data.fullName,
            email: data.email,
            department: data.department || "Chưa phân tổ",
            baseScore: 1000,
            kudosScore: 0,
            penaltyScore: 0,
            finalScore: 1000,
            evalCount: 0
          };
        });

        // 2. Fetch all APPROVED evaluations (To tính điểm)
        // Note: Lẽ ra chỉ query APPROVED, nhưng tạm query hết rồi filter code cho an toàn nếu chưa build index
        const evalSnap = await getDocs(collection(db, "evaluations"));
        
        let pendingCount = 0; // Để đếm số phiếu chờ xử lý cho Admin/BGH
        
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        evalSnap.forEach(doc => {
          const ev = doc.data();
          if (ev.status === "PENDING_APPEAL" || ev.status === "APPEALED") {
            pendingCount++;
          }
          
          const evDate = new Date(ev.createdAt);
          if (evDate.getMonth() !== currentMonth || evDate.getFullYear() !== currentYear) {
            return; // Chỉ tính điểm của tháng hiện tại
          }
          
          if (ev.status === "APPROVED" || ev.status === "PENDING_APPEAL" || ev.status === "APPEALED") {
            // Tạm tính cả phiếu pending vào điểm để giáo viên thấy sự thay đổi (Hoặc tùy rule trường)
            // Ở đây ta tính tất cả phiếu chưa bị REJECTED
            const tid = ev.teacherId;
            if (teachers[tid]) {
              teachers[tid].evalCount++;
              if (ev.type === "KUDOS") {
                teachers[tid].kudosScore += ev.ruleScore;
                teachers[tid].finalScore += ev.ruleScore;
              } else if (ev.type === "PENALTY") {
                teachers[tid].penaltyScore += ev.ruleScore; // ruleScore is negative
                teachers[tid].finalScore += ev.ruleScore;
              }
            }
          }
        });

        // 3. Fetch prev month score
        const prevMonth = currentMonth === 0 ? 12 : currentMonth; // month in snapshot could be 1-12
        const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
        const monthStr = `${prevMonth}`.padStart(2, '0');
        
        const prevSnapshotSnap = await getDocs(query(
          collection(db, "monthly_kpi_snapshots"), 
          where("month", "==", monthStr), 
          where("year", "==", prevYear)
        ));
        
        prevSnapshotSnap.forEach(doc => {
           const d = doc.data();
           if (teachers[d.teacherId]) {
              teachers[d.teacherId].prevMonthScore = d.finalScore;
           }
        });

        // Convert to array and sort by finalScore (desc), then fullName (asc)
        const leaderboard = Object.values(teachers).sort((a, b) => {
          if (b.finalScore !== a.finalScore) {
            return b.finalScore - a.finalScore;
          }
          return a.fullName.localeCompare(b.fullName);
        });
        setTeachersData(leaderboard);

      } catch (error) {
        console.error("Error fetching overview:", error);
      } finally {
        setLoading(false);
      }
    };

    if (profile) {
      fetchLeaderboard();
    }
  }, [profile]);

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;
  }

  const handleExportExcel = () => {
    // Chuẩn bị dữ liệu
    const dataToExport = filteredData.map((t, index) => ({
      "Hạng": index + 1,
      "Họ và Tên": t.fullName,
      "Email": t.email,
      "Tổ Bộ Môn": t.department,
      "Phiếu Đánh Giá": t.evalCount,
      "Điểm Thưởng": t.kudosScore > 0 ? `+${t.kudosScore}` : 0,
      "Điểm Phạt": t.penaltyScore < 0 ? t.penaltyScore : 0,
      "Tổng Điểm KPI": t.finalScore
    }));

    // Tạo worksheet và workbook
    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "KPI Bảng Xếp Hạng");

    // Lấy tháng năm hiện tại cho tên file
    const date = new Date();
    const fileName = `Bao_Cao_KPI_Thang_${date.getMonth() + 1}_${date.getFullYear()}.xlsx`;

    // Lưu file
    XLSX.writeFile(workbook, fileName);
  };

  const handleAutoAttendance = async () => {
    try {
      setIsSyncingAttendance(true);
      const toastId = toast.loading("Đang quét toàn bộ danh sách lớp của bạn để điểm danh (Khoảng 30s-1p)...");
      
      const res = await fetch("/api/classhub/sync/attendance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${await user?.getIdToken()}`
        },
        body: JSON.stringify({})
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success(data.message || "Điểm danh 1-Chạm thành công!", { id: toastId, duration: 6000 });
      } else {
        toast.error(data.error || "Có lỗi xảy ra khi điểm danh", { id: toastId, duration: 5000 });
      }
    } catch (error) {
      console.error("Sync error:", error);
      toast.error("Lỗi kết nối tới Server. Vui lòng thử lại sau.");
    } finally {
      setIsSyncingAttendance(false);
    }
  };

  const totalTeachers = teachersData.length;
  const avgScore = totalTeachers > 0 ? Math.round(teachersData.reduce((acc, curr) => acc + curr.finalScore, 0) / totalTeachers) : 1000;

  // Calculate Department KPIs for Pie Chart
  const departmentKPIs = teachersData.reduce((acc, curr) => {
    if (!acc[curr.department]) {
      acc[curr.department] = { department: curr.department, totalScore: 0, count: 0 };
    }
    acc[curr.department].totalScore += curr.finalScore;
    acc[curr.department].count += 1;
    return acc;
  }, {} as Record<string, { department: string, totalScore: number, count: number }>);

  const pieChartData = Object.values(departmentKPIs).map(d => ({
    name: d.department,
    value: Math.round(d.totalScore / d.count)
  }));

  const departmentLeaderboard = Object.values(departmentKPIs)
    .map(d => ({
      ...d,
      avgScore: Math.round(d.totalScore / d.count)
    }))
    .sort((a, b) => {
      if (b.avgScore !== a.avgScore) {
        return b.avgScore - a.avgScore;
      }
      return a.department.localeCompare(b.department);
    });

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

  // Filtered leaderboard
  let filteredData = teachersData.filter(t => 
    t.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (viewMode === "DEPARTMENT" && profile?.department) {
    filteredData = filteredData.filter(t => t.department === profile.department);
  }

  const isTeacher = profile?.role === "TEACHER";
  const myData = isTeacher ? (teachersData.find(t => t.uid === profile.id) || { finalScore: 1000, kudosScore: 0, penaltyScore: 0, evalCount: 0 }) : null;

  const canShowAutoAttendance = profile?.role === "SUPER_ADMIN" || profile?.canUseAutoAttendance === true;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
      
      {/* Quick Actions (Always visible) */}
      {canShowAutoAttendance && (
        <div className="flex justify-end mt-4 md:mt-0">
          <button
            onClick={handleAutoAttendance}
            disabled={isSyncingAttendance}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl font-bold shadow-lg shadow-indigo-200 transition-all transform hover:-translate-y-1 hover:scale-105 disabled:opacity-50 disabled:transform-none whitespace-nowrap border-2 border-white"
          >
            {isSyncingAttendance ? <Loader2 className="w-5 h-5 animate-spin" /> : <i className="fa fa-magic" />}
            <span>Điểm danh 1-Chạm (ClassHub)</span>
          </button>
        </div>
      )}

      {/* Teacher's Personal Overview */}
      {isTeacher && myData && (
        <div className="mb-10">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h1 className="text-3xl font-bold text-slate-800">Tổng quan điểm số của tôi</h1>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 p-6 rounded-3xl shadow-lg shadow-blue-500/20 text-white flex flex-col items-center justify-center text-center transform transition-transform hover:scale-105">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
                <Trophy size={32} />
              </div>
              <h3 className="text-blue-100 font-medium mb-1">Điểm KPI Hiện tại</h3>
              <p className="text-5xl font-black">{myData.finalScore}</p>
            </div>
            <div className="bg-gradient-to-br from-emerald-400 to-emerald-500 p-6 rounded-3xl shadow-lg shadow-emerald-500/20 text-white flex flex-col items-center justify-center text-center transform transition-transform hover:scale-105">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
                <TrendingUp size={32} />
              </div>
              <h3 className="text-emerald-100 font-medium mb-1">Điểm Thưởng</h3>
              <p className="text-4xl font-bold">+{myData.kudosScore}</p>
            </div>
            <div className="bg-gradient-to-br from-rose-400 to-rose-500 p-6 rounded-3xl shadow-lg shadow-rose-500/20 text-white flex flex-col items-center justify-center text-center transform transition-transform hover:scale-105">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4 backdrop-blur-sm">
                <TrendingDown size={32} />
              </div>
              <h3 className="text-rose-100 font-medium mb-1">Điểm Phạt</h3>
              <p className="text-4xl font-bold">{myData.penaltyScore}</p>
            </div>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Bảng điểm Tổng quan Toàn trường</h1>
        <p className="text-slate-500">Xem nhanh tình hình thi đua, điểm KPI của toàn bộ giáo viên.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
            <Users size={28} />
          </div>
          <div>
            <p className="text-slate-500 font-medium text-sm">Tổng Giáo viên</p>
            <p className="text-3xl font-bold text-slate-800">{totalTeachers}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
            <Trophy size={28} />
          </div>
          <div>
            <p className="text-slate-500 font-medium text-sm">Trung bình KPI toàn trường</p>
            <p className="text-3xl font-bold text-slate-800">{avgScore} <span className="text-sm font-normal text-slate-400">/ 100</span></p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4 hover:shadow-md transition-shadow">
          <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center shrink-0">
            <FileText size={28} />
          </div>
          <div>
            <p className="text-slate-500 font-medium text-sm">Tổng phiếu đánh giá</p>
            <p className="text-3xl font-bold text-slate-800">{teachersData.reduce((acc, curr) => acc + curr.evalCount, 0)}</p>
          </div>
        </div>
      </div>

      {/* Department KPI Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* KPI Chart by Department */}
        {pieChartData.length > 0 && (
          <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-slate-800 flex items-center">
              <Award className="mr-3 text-indigo-500" size={24} />
              Trung bình KPI theo Tổ bộ môn
            </h2>
          </div>
          <div className="h-[400px] w-full flex justify-center items-center relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieChartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={90}
                  outerRadius={140}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name }) => name}
                  labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                >
                  {pieChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} className="stroke-white stroke-2 drop-shadow-sm hover:opacity-80 transition-opacity outline-none" />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)', padding: '12px 16px', fontWeight: 'bold' }}
                  itemStyle={{ color: '#334155' }}
                  formatter={(value) => [`${value} điểm`, 'Trung bình KPI']}
                />
              </PieChart>
            </ResponsiveContainer>
            
            {/* Center Text */}
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
              <p className="text-slate-400 text-sm font-medium">Trung bình</p>
              <p className="text-4xl font-black text-slate-800">{avgScore}</p>
            </div>
          </div>
        </div>
      )}

      {/* Department Leaderboard */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold text-slate-800 flex items-center">
              <Trophy className="mr-3 text-emerald-500" size={24} />
              Bảng Xếp Hạng Tổ Bộ Môn
            </h2>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-slate-500 text-sm">
                  <th className="py-4 px-2 font-medium">Hạng</th>
                  <th className="py-4 px-2 font-medium">Tổ Chuyên Môn</th>
                  <th className="py-4 px-2 font-medium text-center">Số lượng</th>
                  <th className="py-4 px-2 font-medium text-right">KPI TB</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {departmentLeaderboard.map((dep, index) => (
                  <tr key={dep.department} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="py-4 px-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? "bg-yellow-100 text-yellow-700" :
                        index === 1 ? "bg-slate-200 text-slate-700" :
                        index === 2 ? "bg-orange-100 text-orange-700" :
                        "bg-slate-50 text-slate-500"
                      }`}>
                        {index + 1}
                      </div>
                    </td>
                    <td className="py-4 px-2 font-semibold text-slate-800">{dep.department}</td>
                    <td className="py-4 px-2 text-center text-slate-600 font-medium">{dep.count} GV</td>
                    <td className="py-4 px-2 text-right">
                      <span className="inline-block px-3 py-1 bg-emerald-50 text-emerald-700 font-bold rounded-lg border border-emerald-100">
                        {dep.avgScore}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0 bg-slate-50/30">
          <h2 className="text-xl font-bold text-slate-800 flex items-center">
            <Trophy className="mr-3 text-yellow-500" size={24} />
            Bảng xếp hạng Giáo viên
          </h2>
          
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <div className="relative w-full sm:w-72">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Search size={18} />
              </div>
              <input
                type="text"
                placeholder="Tìm tên hoặc tổ bộ môn..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm shadow-sm"
              />
            </div>

            {(profile?.role === "TTCM" || profile?.role === "TPCM") && (
              <div className="flex bg-slate-100 p-1 rounded-xl">
                <button
                  onClick={() => setViewMode("DEPARTMENT")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${viewMode === "DEPARTMENT" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Tổ của tôi
                </button>
                <button
                  onClick={() => setViewMode("ALL")}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${viewMode === "ALL" ? "bg-white text-blue-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
                >
                  Toàn trường
                </button>
              </div>
            )}

            {(profile?.role === "ADMIN" || profile?.role === "BGH") && (
              <button 
                onClick={handleExportExcel}
                className="flex items-center justify-center space-x-2 bg-emerald-500 hover:bg-emerald-600 text-white px-4 py-2.5 rounded-xl font-medium transition-colors shadow-sm whitespace-nowrap"
              >
                <Download size={18} />
                <span className="hidden sm:inline">Xuất Excel</span>
              </button>
            )}
          </div>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <th className="p-5 font-semibold w-20 text-center">Hạng</th>
                <th className="p-5 font-semibold">Giáo viên</th>
                <th className="p-5 font-semibold">Tổ bộ môn</th>
                <th className="p-5 font-semibold text-center">Phiếu ĐG</th>
                <th className="p-5 font-semibold text-center">Thưởng</th>
                <th className="p-5 font-semibold text-center">Phạt</th>
                <th className="p-5 font-semibold text-right">Tổng Điểm</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-12 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center">
                      <Search size={40} className="text-slate-300 mb-3" />
                      <p className="font-medium text-lg">Không tìm thấy giáo viên nào</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredData.map((t, index) => (
                  <tr 
                    key={t.uid} 
                    onClick={() => window.location.href = `/dashboard/teachers/${t.uid}`}
                    className={`border-b border-slate-50 hover:bg-blue-50/40 transition-colors group cursor-pointer ${
                      t.uid === profile?.id ? "bg-blue-50/20" : ""
                    }`}
                  >
                    <td className="p-5 text-center">
                      {index === 0 ? <span className="inline-block w-10 h-10 bg-gradient-to-br from-yellow-300 to-yellow-500 text-yellow-900 rounded-full shadow-md shadow-yellow-500/20 leading-10 font-black text-lg">1</span> :
                       index === 1 ? <span className="inline-block w-9 h-9 bg-gradient-to-br from-slate-200 to-slate-300 text-slate-700 rounded-full shadow-sm leading-9 font-bold">2</span> :
                       index === 2 ? <span className="inline-block w-8 h-8 bg-gradient-to-br from-orange-200 to-orange-300 text-orange-800 rounded-full shadow-sm leading-8 font-bold">3</span> :
                       <span className="text-slate-400 font-medium">{index + 1}</span>}
                    </td>
                    <td className="p-5">
                      <div className="flex items-center flex-wrap gap-2">
                        <p className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors text-base">{t.fullName}</p>
                        {t.uid === profile?.id && <span className="text-[10px] font-bold text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200 uppercase">Bạn</span>}
                        {t.finalScore >= 1005 && <span className="text-[10px] font-bold text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full border border-yellow-200 uppercase flex items-center" title="Ngôi sao Kỷ luật"><Award size={10} className="mr-1"/> Kỷ luật</span>}
                        {t.kudosScore >= 10 && <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 uppercase flex items-center" title="Cống hiến xuất sắc"><TrendingUp size={10} className="mr-1"/> Cống hiến</span>}
                      </div>
                      <p className="text-sm text-slate-500 mt-0.5">{t.email}</p>
                    </td>
                    <td className="p-5">
                      <span className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-semibold border border-slate-200 group-hover:bg-white group-hover:border-slate-300 transition-colors">
                        {t.department}
                      </span>
                    </td>
                    <td className="p-5 text-center text-slate-600 font-medium">{t.evalCount}</td>
                    <td className="p-5 text-center font-bold text-emerald-500">{t.kudosScore > 0 ? `+${t.kudosScore}` : 0}</td>
                    <td className="p-5 text-center font-bold text-rose-500">{t.penaltyScore < 0 ? t.penaltyScore : 0}</td>
                    <td className="p-5 text-right">
                      <div className="flex flex-col items-end">
                        <span className={`inline-block px-4 py-2 font-black text-lg rounded-2xl ${
                          t.finalScore >= 1005 ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg shadow-blue-500/30" : 
                          t.finalScore >= 1000 ? "bg-slate-100 text-slate-700" : 
                          "bg-red-50 text-red-600 border border-red-100"
                        }`}>
                          {t.finalScore}
                        </span>
                        {t.prevMonthScore !== undefined && (
                          <span className={`text-xs font-semibold mt-1 flex items-center ${
                            t.finalScore > t.prevMonthScore ? "text-emerald-500" : 
                            t.finalScore < t.prevMonthScore ? "text-red-500" : 
                            "text-slate-400"
                          }`} title="So với tháng trước">
                            {t.finalScore > t.prevMonthScore ? <TrendingUp size={12} className="mr-0.5" /> : 
                             t.finalScore < t.prevMonthScore ? <TrendingDown size={12} className="mr-0.5" /> : 
                             <span className="mr-0.5">=</span>}
                            Tháng trước: {t.prevMonthScore}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List View (< md) */}
        <div className="block md:hidden divide-y divide-slate-100 p-4 space-y-4">
          {filteredData.length === 0 ? (
            <div className="p-8 text-center text-slate-500">Không tìm thấy giáo viên nào.</div>
          ) : (
            filteredData.map((t, index) => (
              <div 
                key={t.uid}
                onClick={() => window.location.href = `/dashboard/teachers/${t.uid}`}
                className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3 cursor-pointer"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm shrink-0 ${
                      index === 0 ? "bg-yellow-400 text-yellow-950" :
                      index === 1 ? "bg-slate-300 text-slate-800" :
                      index === 2 ? "bg-amber-400 text-amber-950" :
                      "bg-slate-200 text-slate-700"
                    }`}>
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-base">{t.fullName}</h4>
                      <p className="text-xs text-slate-500">{t.department}</p>
                    </div>
                  </div>
                  <span className="font-black text-lg text-blue-700 bg-blue-50 px-3 py-1 rounded-xl border border-blue-200">
                    {t.finalScore}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs bg-white p-2.5 rounded-xl border border-slate-100">
                  <div>
                    <span className="block text-[10px] font-bold text-slate-400 uppercase">Phiếu ĐG</span>
                    <span className="font-bold text-slate-700">{t.evalCount}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-emerald-600 uppercase">Thưởng</span>
                    <span className="font-bold text-emerald-600">{t.kudosScore > 0 ? `+${t.kudosScore}` : 0}</span>
                  </div>
                  <div>
                    <span className="block text-[10px] font-bold text-rose-600 uppercase">Phạt</span>
                    <span className="font-bold text-rose-600">{t.penaltyScore < 0 ? t.penaltyScore : 0}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase/client";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Trophy, Users, TrendingUp, TrendingDown, Award, Search, FileText } from "lucide-react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

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
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const [teachersData, setTeachersData] = useState<TeacherKPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        // 1. Fetch all teachers
        const teacherSnap = await getDocs(query(collection(db, "users"), where("role", "==", "TEACHER")));
        const teachers: Record<string, TeacherKPI> = {};
        
        teacherSnap.forEach(doc => {
          const data = doc.data();
          teachers[doc.id] = {
            uid: doc.id,
            fullName: data.fullName,
            email: data.email,
            department: data.department || "Chưa phân tổ",
            baseScore: 100,
            kudosScore: 0,
            penaltyScore: 0,
            finalScore: 100,
            evalCount: 0
          };
        });

        // 2. Fetch all APPROVED evaluations (To tính điểm)
        // Note: Lẽ ra chỉ query APPROVED, nhưng tạm query hết rồi filter code cho an toàn nếu chưa build index
        const evalSnap = await getDocs(collection(db, "evaluations"));
        
        let pendingCount = 0; // Để đếm số phiếu chờ xử lý cho Admin/BGH
        
        evalSnap.forEach(doc => {
          const ev = doc.data();
          if (ev.status === "PENDING_APPEAL" || ev.status === "APPEALED") {
            pendingCount++;
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

        // Convert to array and sort by finalScore
        const leaderboard = Object.values(teachers).sort((a, b) => b.finalScore - a.finalScore);
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

  // Nếu là giáo viên, hiển thị giao diện cá nhân hóa
  if (profile?.role === "TEACHER") {
    const myData = teachersData.find(t => t.uid === profile.uid) || { finalScore: 100, kudosScore: 0, penaltyScore: 0, evalCount: 0 };
    
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-slate-800">Tổng quan điểm số của tôi</h1>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
              <Trophy size={32} />
            </div>
            <h3 className="text-slate-500 font-medium mb-1">Điểm KPI Hiện tại</h3>
            <p className="text-5xl font-black text-slate-800">{myData.finalScore}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-green-50 text-green-600 rounded-full flex items-center justify-center mb-4">
              <TrendingUp size={32} />
            </div>
            <h3 className="text-slate-500 font-medium mb-1">Điểm Thưởng</h3>
            <p className="text-4xl font-bold text-green-600">+{myData.kudosScore}</p>
          </div>
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mb-4">
              <TrendingDown size={32} />
            </div>
            <h3 className="text-slate-500 font-medium mb-1">Điểm Phạt</h3>
            <p className="text-4xl font-bold text-red-600">{myData.penaltyScore}</p>
          </div>
        </div>
      </div>
    );
  }

  // Giao diện cho ADMIN / BGH / TTCM
  const totalTeachers = teachersData.length;
  const avgScore = totalTeachers > 0 ? Math.round(teachersData.reduce((acc, curr) => acc + curr.finalScore, 0) / totalTeachers) : 100;
  
  // Filtered leaderboard
  const filteredData = teachersData.filter(t => 
    t.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.department.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div>
        <h1 className="text-3xl font-bold text-slate-800 mb-2">Bảng điểm Tổng quan Toàn trường</h1>
        <p className="text-slate-500">Xem nhanh tình hình thi đua, điểm KPI của toàn bộ giáo viên.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center shrink-0">
            <Users size={28} />
          </div>
          <div>
            <p className="text-slate-500 font-medium text-sm">Tổng Giáo viên</p>
            <p className="text-3xl font-bold text-slate-800">{totalTeachers}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shrink-0">
            <Trophy size={28} />
          </div>
          <div>
            <p className="text-slate-500 font-medium text-sm">Trung bình KPI toàn trường</p>
            <p className="text-3xl font-bold text-slate-800">{avgScore} <span className="text-sm font-normal text-slate-400">/ 100</span></p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center space-x-4">
          <div className="w-14 h-14 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center shrink-0">
            <FileText size={28} />
          </div>
          <div>
            <p className="text-slate-500 font-medium text-sm">Tổng phiếu đánh giá</p>
            <p className="text-3xl font-bold text-slate-800">{teachersData.reduce((acc, curr) => acc + curr.evalCount, 0)}</p>
          </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <h2 className="text-lg font-bold text-slate-800 flex items-center">
            <Award className="mr-2 text-yellow-500" />
            Bảng xếp hạng Giáo viên
          </h2>
          
          <div className="relative w-full sm:w-72">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              <Search size={18} />
            </div>
            <input
              type="text"
              placeholder="Tìm tên hoặc tổ bộ môn..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <th className="p-4 font-semibold w-16 text-center">Hạng</th>
                <th className="p-4 font-semibold">Giáo viên</th>
                <th className="p-4 font-semibold">Tổ bộ môn</th>
                <th className="p-4 font-semibold text-center">Phiếu ĐG</th>
                <th className="p-4 font-semibold text-center">Thưởng</th>
                <th className="p-4 font-semibold text-center">Phạt</th>
                <th className="p-4 font-semibold text-right">Tổng Điểm</th>
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500">Không tìm thấy giáo viên nào.</td>
                </tr>
              ) : (
                filteredData.map((t, index) => (
                  <tr 
                    key={t.uid} 
                    onClick={() => window.location.href = `/dashboard/teachers/${t.uid}`}
                    className="border-b border-slate-50 hover:bg-blue-50/50 transition-colors group cursor-pointer"
                  >
                    <td className="p-4 text-center">
                      {index === 0 ? <span className="inline-block w-8 h-8 bg-yellow-100 text-yellow-700 rounded-full leading-8 font-bold">1</span> :
                       index === 1 ? <span className="inline-block w-8 h-8 bg-slate-200 text-slate-700 rounded-full leading-8 font-bold">2</span> :
                       index === 2 ? <span className="inline-block w-8 h-8 bg-orange-100 text-orange-700 rounded-full leading-8 font-bold">3</span> :
                       <span className="text-slate-400 font-medium">{index + 1}</span>}
                    </td>
                    <td className="p-4">
                      <p className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{t.fullName}</p>
                      <p className="text-xs text-slate-500">{t.email}</p>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg text-xs font-medium border border-slate-200">
                        {t.department}
                      </span>
                    </td>
                    <td className="p-4 text-center text-slate-600 font-medium">{t.evalCount}</td>
                    <td className="p-4 text-center font-bold text-green-500">{t.kudosScore > 0 ? `+${t.kudosScore}` : 0}</td>
                    <td className="p-4 text-center font-bold text-red-500">{t.penaltyScore < 0 ? t.penaltyScore : 0}</td>
                    <td className="p-4 text-right">
                      <span className={`inline-block px-3 py-1 rounded-xl font-black text-lg ${
                        t.finalScore >= 100 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>
                        {t.finalScore}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

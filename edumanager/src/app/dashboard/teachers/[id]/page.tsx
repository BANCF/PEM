"use client";

import React, { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { db } from "@/lib/firebase/client";
import { doc, getDoc, collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Trophy, Loader2, TrendingUp, TrendingDown, Clock, CheckCircle, AlertTriangle, XCircle, FileText } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from "recharts";

interface TeacherProfile {
  uid: string;
  fullName: string;
  email: string;
  department: string;
  role: string;
}

interface Evaluation {
  id: string;
  ruleName: string;
  ruleScore: number;
  type: "PENALTY" | "KUDOS";
  status: "PENDING_APPEAL" | "APPEALED" | "APPROVED" | "REJECTED";
  createdAt: string;
  createdByName: string;
  note: string;
  evidenceUrl?: string;
}

export default function TeacherKPIHistoryPage() {
  const { profile } = useAuth();
  const params = useParams();
  const teacherId = params.id as string;
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartMode, setChartMode] = useState<"WEEK" | "MONTH">("MONTH");

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (!teacherId) return;
        // 1. Lấy thông tin giáo viên
        const userDoc = await getDoc(doc(db, "users", teacherId));
        if (userDoc.exists()) {
          setTeacher({ uid: userDoc.id, ...userDoc.data() } as TeacherProfile);
        }

        // 2. Lấy danh sách đánh giá của giáo viên này
        const q = query(
          collection(db, "evaluations"),
          where("teacherId", "==", teacherId)
        );
        const evalSnap = await getDocs(q);
        const evals: Evaluation[] = [];
        evalSnap.forEach((d) => evals.push({ id: d.id, ...d.data() } as Evaluation));
        
        // Sắp xếp giảm dần theo thời gian (mới nhất lên đầu)
        evals.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setEvaluations(evals);

      } catch (error) {
        console.error("Error fetching teacher details:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [teacherId]);

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex justify-center items-center h-[70vh]">
          <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
      </ProtectedRoute>
    );
  }

  if (!teacher) {
    return (
      <ProtectedRoute>
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold text-slate-800">Không tìm thấy hồ sơ giáo viên.</h2>
          <Link href="/dashboard" className="text-blue-600 mt-4 inline-block hover:underline">Quay lại Tổng quan</Link>
        </div>
      </ProtectedRoute>
    );
  }

  // Tính điểm
  let baseScore = 100;
  let kudosScore = 0;
  let penaltyScore = 0;

  evaluations.forEach(ev => {
    if (ev.status !== "REJECTED") {
      if (ev.type === "KUDOS") kudosScore += ev.ruleScore;
      if (ev.type === "PENALTY") penaltyScore += ev.ruleScore;
    }
  });

  const finalScore = baseScore + kudosScore + penaltyScore;

  // Chuẩn bị dữ liệu cho biểu đồ (Chart Data)
  const groupData: Record<string, { label: string; kudos: number; penalty: number; total: number }> = {};
  
  // Helper to get week number
  const getWeekNumber = (d: Date) => {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
    return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
  };

  [...evaluations].reverse().forEach(ev => {
    if (ev.status !== "REJECTED") {
      const date = new Date(ev.createdAt);
      let key = "";
      if (chartMode === "MONTH") {
        key = `T${date.getMonth() + 1}/${date.getFullYear()}`;
      } else {
        key = `Tuần ${getWeekNumber(date)}, ${date.getFullYear()}`;
      }
      
      if (!groupData[key]) {
        groupData[key] = { label: key, kudos: 0, penalty: 0, total: 0 };
      }
      if (ev.type === "KUDOS") groupData[key].kudos += ev.ruleScore;
      if (ev.type === "PENALTY") groupData[key].penalty += ev.ruleScore;
    }
  });

  let currentKPI = 100;
  const chartData = Object.values(groupData).map(d => {
    currentKPI += d.kudos + d.penalty;
    return { ...d, total: currentKPI };
  });

  if (chartData.length === 0) {
    const d = new Date();
    const defaultKey = chartMode === "MONTH" ? `T${d.getMonth() + 1}/${d.getFullYear()}` : `Tuần ${getWeekNumber(d)}, ${d.getFullYear()}`;
    chartData.push({ label: defaultKey, kudos: 0, penalty: 0, total: 100 });
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING_APPEAL": return <span className="flex items-center px-2.5 py-1 bg-yellow-50 text-yellow-700 rounded-lg text-xs font-bold border border-yellow-200"><Clock size={12} className="mr-1"/> Chờ khiếu nại</span>;
      case "APPEALED": return <span className="flex items-center px-2.5 py-1 bg-orange-50 text-orange-700 rounded-lg text-xs font-bold border border-orange-200"><AlertTriangle size={12} className="mr-1"/> Đang khiếu nại</span>;
      case "APPROVED": return <span className="flex items-center px-2.5 py-1 bg-green-50 text-green-700 rounded-lg text-xs font-bold border border-green-200"><CheckCircle size={12} className="mr-1"/> Đã chốt</span>;
      case "REJECTED": return <span className="flex items-center px-2.5 py-1 bg-slate-50 text-slate-500 rounded-lg text-xs font-bold border border-slate-200"><XCircle size={12} className="mr-1"/> Hủy bỏ</span>;
      default: return null;
    }
  };

  return (
    <ProtectedRoute>
      <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
        
        {/* Header Navigation */}
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="text-slate-500 hover:text-blue-600 font-medium transition flex items-center bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200 w-fit hover:shadow-md">
            <ArrowLeft size={18} className="mr-2" /> Quay lại Bảng xếp hạng
          </Link>
        </div>

        {/* Profile Card & Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Profile Info */}
          <div className="lg:col-span-1 bg-[#0F172A] text-white rounded-3xl p-8 shadow-lg relative overflow-hidden flex flex-col items-center text-center">
            <div className="absolute top-0 left-0 w-full h-32 bg-blue-600/20 blur-3xl"></div>
            <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center text-4xl font-black mb-4 relative z-10 border border-white/20 backdrop-blur-md">
              {teacher.fullName.charAt(0)}
            </div>
            <h2 className="text-xl font-bold relative z-10">{teacher.fullName}</h2>
            <p className="text-slate-400 text-sm mb-4 relative z-10">{teacher.email}</p>
            <div className="mt-auto space-y-2 w-full relative z-10">
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Tổ chuyên môn</p>
                <p className="font-semibold text-blue-300">{teacher.department || "Chưa cập nhật"}</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                <p className="text-xs text-slate-400 uppercase tracking-wider mb-1">Quyền hạn</p>
                <p className="font-semibold text-slate-200">{teacher.role}</p>
              </div>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center group hover:border-blue-300 hover:shadow-md transition-all">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Trophy size={32} />
              </div>
              <h3 className="text-slate-500 font-medium mb-1">Điểm KPI Tổng</h3>
              <p className={`text-6xl font-black ${finalScore >= 100 ? "text-slate-800" : "text-red-600"}`}>
                {finalScore}
              </p>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center group hover:border-green-300 hover:shadow-md transition-all">
              <div className="w-16 h-16 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <TrendingUp size={32} />
              </div>
              <h3 className="text-slate-500 font-medium mb-1">Điểm Thưởng</h3>
              <p className="text-5xl font-bold text-green-600">+{kudosScore}</p>
            </div>
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200 flex flex-col items-center justify-center text-center group hover:border-red-300 hover:shadow-md transition-all">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <TrendingDown size={32} />
              </div>
              <h3 className="text-slate-500 font-medium mb-1">Điểm Phạt</h3>
              <p className="text-5xl font-bold text-red-600">{penaltyScore}</p>
            </div>
          </div>
        </div>

        {/* Biểu đồ phân tích (Analytics) */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 space-y-4 sm:space-y-0">
            <div className="flex items-center">
              <TrendingUp className="mr-3 text-indigo-600" size={24} />
              <h2 className="text-2xl font-bold text-slate-800">Phân tích hiệu suất (KPI Trend)</h2>
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl w-fit">
              <button
                onClick={() => setChartMode("WEEK")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${chartMode === "WEEK" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Theo Tuần
              </button>
              <button
                onClick={() => setChartMode("MONTH")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${chartMode === "MONTH" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Theo Tháng
              </button>
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" stroke="#94a3b8" />
                <YAxis domain={['auto', 'auto']} stroke="#94a3b8" />
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <RechartsTooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  labelStyle={{ fontWeight: 'bold', color: '#1e293b', marginBottom: '4px' }}
                />
                <Area type="monotone" dataKey="total" name="Điểm KPI" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorTotal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Timeline Lịch sử */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-8 border-b border-slate-100 flex items-center">
            <FileText className="mr-3 text-blue-600" size={24} />
            <h2 className="text-2xl font-bold text-slate-800">Lịch sử Đánh giá (Timeline)</h2>
          </div>
          
          {evaluations.length === 0 ? (
            <div className="text-center p-16 text-slate-500 bg-slate-50">
              <p>Chưa có dữ liệu đánh giá nào cho giáo viên này.</p>
            </div>
          ) : (
            <div className="p-8">
              <div className="space-y-8 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                
                {evaluations.map((ev, idx) => (
                  <div key={ev.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                    {/* Icon marker */}
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm z-10 ${
                      ev.type === "KUDOS" ? "bg-green-500 text-white" : "bg-red-500 text-white"
                    }`}>
                      {ev.type === "KUDOS" ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    </div>
                    
                    {/* Card */}
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-5 rounded-2xl border border-slate-200 bg-white shadow-sm group-hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-slate-400">
                          {format(new Date(ev.createdAt), "dd/MM/yyyy HH:mm", { locale: vi })}
                        </span>
                        {getStatusBadge(ev.status)}
                      </div>
                      
                      <h4 className="text-lg font-bold text-slate-800 mb-1 flex items-center justify-between">
                        {ev.ruleName}
                        <span className={`text-xl font-black ml-2 ${ev.type === "KUDOS" ? "text-green-500" : "text-red-500"}`}>
                          {ev.type === "KUDOS" ? `+${ev.ruleScore}` : ev.ruleScore}
                        </span>
                      </h4>
                      
                      <p className="text-slate-600 text-sm mb-4 leading-relaxed">
                        <span className="font-semibold text-slate-700">Lý do: </span>
                        {ev.note}
                      </p>

                      <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                        <span className="text-xs font-medium text-slate-500">
                          Lập bởi: <span className="text-slate-800">{ev.createdByName}</span>
                        </span>
                        
                        {ev.evidenceUrl && (
                          <a href={ev.evidenceUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-lg flex items-center transition">
                            Xem minh chứng
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
              </div>
            </div>
          )}
        </div>

      </div>
    </ProtectedRoute>
  );
}

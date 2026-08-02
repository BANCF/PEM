"use client";

import React, { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { db } from "@/lib/firebase/client";
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { 
  FileText, 
  Plus, 
  Loader2, 
  Clock, 
  CheckCircle, 
  AlertTriangle, 
  XCircle, 
  Award, 
  UserCheck, 
  Printer, 
  ChevronRight,
  Send,
  FileCheck2,
  Calendar
} from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { 
  teacherThiDuaService, 
  TeacherThiDuaEvaluation 
} from "@/lib/services/teacherThiDua.service";

interface Evaluation {
  id: string;
  teacherName: string;
  ruleName: string;
  ruleScore: number;
  type: "PENALTY" | "KUDOS";
  status: "PENDING_APPEAL" | "APPEALED" | "APPROVED" | "REJECTED";
  createdAt: string;
  deadlineAt: string;
  createdByName: string;
}

export default function EvaluationsPage() {
  const { profile } = useAuth();
  
  // Navigation Sub-Tabs
  const [activeTab, setActiveTab] = useState<"thiDua" | "kpi">("thiDua");

  // State for Thi Đua (3 Cấp)
  const [thiDuaList, setThiDuaList] = useState<TeacherThiDuaEvaluation[]>([]);
  const [loadingThiDua, setLoadingThiDua] = useState(true);

  // State for KPI Vi Phạm & Khen Thưởng
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loadingKpi, setLoadingKpi] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!profile) return;

      // 1. Fetch Thi Đua List
      try {
        let list: TeacherThiDuaEvaluation[] = [];
        if (profile.role === "TEACHER") {
          list = await teacherThiDuaService.getEvaluationsForTeacher(profile.id, profile.fullName);
        } else {
          list = await teacherThiDuaService.getAllEvaluations();
          if (profile.role === "TTCM" || profile.role === "TPCM") {
            list = list.filter(e => e.department === profile.department || e.teacherId === profile.id);
          }
        }
        setThiDuaList(list);
      } catch (e) {
        console.error("Error fetching thi dua list:", e);
      } finally {
        setLoadingThiDua(false);
      }

      // 2. Fetch KPI Vi Phạm / Khen thưởng
      try {
        let q: any = collection(db, "evaluations");
        if (profile.role === "TEACHER") {
          q = query(collection(db, "evaluations"), where("teacherId", "==", profile.id));
        }
        const querySnapshot = await getDocs(q);
        let evalsData: Evaluation[] = [];
        querySnapshot.forEach((doc) => {
          evalsData.push({ id: doc.id, ...(doc.data() as any) } as Evaluation);
        });

        if (profile.role === "TEACHER") {
          evalsData = evalsData.filter(e => (e as any).teacherId === profile.id);
        } else if (profile.role === "TTCM" || profile.role === "TPCM") {
          evalsData = evalsData.filter(e => (e as any).teacherDepartment === profile.department || (e as any).teacherId === profile.id);
        }

        evalsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        setEvaluations(evalsData);
      } catch (error) {
        console.error("Error fetching evaluations:", error);
      } finally {
        setLoadingKpi(false);
      }
    };

    fetchData();
  }, [profile]);

  const canCreateKpi = profile?.role !== "TEACHER";

  const getKpiStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING_APPEAL": return <span className="flex items-center px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium"><Clock size={12} className="mr-1"/> Chờ khiếu nại</span>;
      case "APPEALED": return <span className="flex items-center px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium"><AlertTriangle size={12} className="mr-1"/> Đang khiếu nại</span>;
      case "APPROVED": return <span className="flex items-center px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium"><CheckCircle size={12} className="mr-1"/> Đã chốt</span>;
      case "REJECTED": return <span className="flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium"><XCircle size={12} className="mr-1"/> Hủy bỏ</span>;
      default: return null;
    }
  };

  const getThiDuaStatusBadge = (st: string) => {
    switch (st) {
      case "DRAFT":
        return <span className="bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full text-xs font-semibold">Nháp</span>;
      case "SUBMITTED_GV":
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1"><Send size={12}/> Chờ TTCM Duyệt</span>;
      case "REVIEWED_TTCM":
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1"><FileCheck2 size={12}/> Chờ BGH Duyệt</span>;
      case "APPROVED_BGH":
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1"><CheckCircle size={12}/> Đã Phê Duyệt</span>;
      default:
        return null;
    }
  };

  return (
    <ProtectedRoute>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* Header Title & Tab Selection */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
              <Award className="text-blue-600" />
              Phiếu Đánh Giá & Thi Đua
            </h1>
            <p className="text-slate-500 mt-1 text-sm">Hệ thống Đánh giá thi đua 3 cấp (GV $\rightarrow$ TTCM $\rightarrow$ BGH) và Vi phạm & KPI.</p>
          </div>

          {/* Sub-Tab Selector */}
          <div className="flex bg-slate-100 p-1.5 rounded-xl gap-1 shrink-0">
            <button
              onClick={() => setActiveTab("thiDua")}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${
                activeTab === "thiDua"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <Award size={16} />
              <span>Chấm Thi Đua (3 Cấp)</span>
            </button>

            <button
              onClick={() => setActiveTab("kpi")}
              className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all flex items-center gap-2 ${
                activeTab === "kpi"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              <FileText size={16} />
              <span>Khen Thưởng & Kỷ Luật</span>
            </button>
          </div>
        </div>

        {/* TAB 1: THI ĐUA (3 CẤP) */}
        {activeTab === "thiDua" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="text-blue-600" size={20} />
                Danh sách Bảng Đánh Giá Thi Đua Hàng Tháng
              </h2>

              <Link
                href="/dashboard/evaluations/thi-dua/new"
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-md flex items-center gap-2"
              >
                <Plus size={18} />
                <span>Tạo Bản Tự Đánh Giá Mới</span>
              </Link>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {loadingThiDua ? (
                <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
              ) : thiDuaList.length === 0 ? (
                <div className="text-center p-12 text-slate-500 flex flex-col items-center">
                  <Award size={48} className="text-slate-300 mb-3" />
                  <p className="font-semibold text-slate-700">Chưa có phiếu đánh giá thi đua nào.</p>
                  <p className="text-sm text-slate-400 mt-1">Bấm nút "Tạo Bản Tự Đánh Giá Mới" để bắt đầu chấm điểm tháng.</p>
                </div>
              ) : (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b text-xs font-bold text-slate-600 uppercase">
                          <th className="p-4">Giáo viên</th>
                          <th className="p-4">Tổ chuyên môn</th>
                          <th className="p-4 text-center">Tháng</th>
                          <th className="p-4 text-center">Tự chấm</th>
                          <th className="p-4 text-center">TTCM chấm</th>
                          <th className="p-4 text-center">BGH chốt</th>
                          <th className="p-4 text-center">Xếp loại</th>
                          <th className="p-4 text-center">Trạng thái</th>
                          <th className="p-4 text-right">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-sm">
                        {thiDuaList.map((item) => (
                          <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-4 font-bold text-slate-800">{item.teacherName}</td>
                            <td className="p-4 text-slate-600">{item.department || "Tổ Chuyên Môn"}</td>
                            <td className="p-4 text-center font-semibold text-blue-700">Tháng {item.month}</td>
                            <td className="p-4 text-center font-bold text-slate-700">{item.totalSelfScore} / 210</td>
                            <td className="p-4 text-center font-bold text-amber-700">{item.totalTtcmScore} / 210</td>
                            <td className="p-4 text-center font-bold text-emerald-700">{item.totalBghScore} / 210</td>
                            <td className="p-4 text-center font-black text-slate-800">
                              <span className="px-2.5 py-1 bg-slate-100 rounded-md border border-slate-200 text-xs">
                                {item.ranking || "Chờ xếp loại"}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <div className="flex justify-center">
                                {getThiDuaStatusBadge(item.status)}
                              </div>
                            </td>
                            <td className="p-4 text-right space-x-2">
                              <Link 
                                href={`/dashboard/evaluations/thi-dua/${item.id}`}
                                className="inline-flex items-center text-blue-600 hover:text-blue-800 font-semibold text-xs bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200"
                              >
                                <span>Chi tiết / Sửa</span>
                                <ChevronRight size={14} className="ml-1" />
                              </Link>

                              <a 
                                href={`/dashboard/print/teacher-evaluation/${item.id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center text-slate-700 hover:text-slate-900 font-semibold text-xs bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200"
                                title="In phiếu PDF/A4"
                              >
                                <Printer size={14} />
                              </a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card List View (< md) */}
                  <div className="block md:hidden divide-y divide-slate-100">
                    {thiDuaList.map((item) => (
                      <div key={item.id} className="p-4 space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <h4 className="font-bold text-slate-800 text-base">{item.teacherName}</h4>
                            <p className="text-xs text-slate-500">{item.department || "Tổ Chuyên Môn"} • Tháng {item.month}</p>
                          </div>
                          {getThiDuaStatusBadge(item.status)}
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                          <div>
                            <span className="block text-[10px] font-bold text-slate-500 uppercase">Tự chấm</span>
                            <span className="font-bold text-blue-700">{item.totalSelfScore} / 210</span>
                          </div>
                          <div>
                            <span className="block text-[10px] font-bold text-slate-500 uppercase">TTCM</span>
                            <span className="font-bold text-amber-700">{item.totalTtcmScore} / 210</span>
                          </div>
                          <div>
                            <span className="block text-[10px] font-bold text-slate-500 uppercase">BGH chốt</span>
                            <span className="font-bold text-emerald-700">{item.totalBghScore} / 210</span>
                          </div>
                        </div>

                        <div className="flex justify-between items-center pt-1">
                          <span className="text-xs font-bold text-slate-700">
                            Xếp loại: <u className="text-blue-700 uppercase">{item.ranking || "Chờ xếp loại"}</u>
                          </span>

                          <div className="flex gap-2">
                            <Link 
                              href={`/dashboard/evaluations/thi-dua/${item.id}`}
                              className="inline-flex items-center text-blue-600 hover:text-blue-800 font-semibold text-xs bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200"
                            >
                              <span>Chi tiết</span>
                              <ChevronRight size={14} className="ml-1" />
                            </Link>

                            <a 
                              href={`/dashboard/print/teacher-evaluation/${item.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center text-slate-700 hover:text-slate-900 font-semibold text-xs bg-slate-100 p-2 rounded-lg border border-slate-200"
                            >
                              <Printer size={14} />
                            </a>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: KHEN THƯỞNG & KỶ LUẬT (KPI) */}
        {activeTab === "kpi" && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Phiếu Đánh Giá Vi Phạm & Khen Thưởng (KPI)</h2>
                <p className="text-xs text-slate-500">Các phiếu thưởng/phạt trực tiếp từ BGH và Ban Quản lý.</p>
              </div>

              {canCreateKpi && (
                <Link 
                  href="/dashboard/evaluations/create" 
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition shadow-md flex items-center shrink-0"
                >
                  <Plus size={18} className="mr-1.5" />
                  Tạo đánh giá mới
                </Link>
              )}
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              {loadingKpi ? (
                <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
              ) : evaluations.length === 0 ? (
                <div className="text-center p-12 text-slate-500 flex flex-col items-center">
                  <FileText size={48} className="text-slate-300 mb-3" />
                  <p>Chưa có phiếu đánh giá vi phạm / khen thưởng nào.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b text-xs font-bold text-slate-600 uppercase">
                        <th className="p-4">Giáo viên</th>
                        <th className="p-4">Quy định áp dụng</th>
                        <th className="p-4 text-center">Điểm</th>
                        <th className="p-4">Ngày tạo</th>
                        <th className="p-4">Người lập</th>
                        <th className="p-4 text-center">Trạng thái</th>
                        <th className="p-4 text-right">Chi tiết</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {evaluations.map((evalItem) => (
                        <tr key={evalItem.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 font-bold text-slate-800">{evalItem.teacherName}</td>
                          <td className="p-4">
                            <span className={`inline-block px-2 py-0.5 text-xs rounded font-bold mb-1 ${evalItem.type === "KUDOS" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                              {evalItem.type}
                            </span>
                            <p className="text-sm text-slate-700 font-medium">{evalItem.ruleName}</p>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`font-bold ${evalItem.ruleScore > 0 ? "text-green-600" : "text-red-600"}`}>
                              {evalItem.ruleScore > 0 ? `+${evalItem.ruleScore}` : evalItem.ruleScore}
                            </span>
                          </td>
                          <td className="p-4 text-sm text-slate-600">
                            {format(new Date(evalItem.createdAt), "dd/MM/yyyy HH:mm", { locale: vi })}
                          </td>
                          <td className="p-4 text-sm text-slate-600">{evalItem.createdByName}</td>
                          <td className="p-4">
                            <div className="flex justify-center">
                              {getKpiStatusBadge(evalItem.status)}
                            </div>
                          </td>
                          <td className="p-4 text-right">
                            <Link href={`/dashboard/evaluations/${evalItem.id}`} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                              Xem
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

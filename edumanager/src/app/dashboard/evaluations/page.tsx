"use client";

import React, { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { db } from "@/lib/firebase/client";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import Link from "next/link";
import { FileText, Plus, Loader2, Clock, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

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
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEvaluations = async () => {
      if (!profile) return;
      try {
        let q = collection(db, "evaluations");
        
        // Nếu là giáo viên, chỉ lấy đánh giá của mình
        if (profile.role === "TEACHER") {
          q = query(collection(db, "evaluations"), where("teacherId", "==", profile.uid));
        }
        
        // Sắp xếp theo ngày tạo mới nhất (Cần tạo index trên Firebase nếu dùng where kết hợp orderBy)
        // Hiện tại tạm thời chỉ getDocs rồi sort bằng JS để tránh lỗi index
        const querySnapshot = await getDocs(q);
        let evalsData: Evaluation[] = [];
        querySnapshot.forEach((doc) => {
          evalsData.push({ id: doc.id, ...doc.data() } as Evaluation);
        });

        // Nếu là TEACHER, lọc bằng code phòng trường hợp where bị lỗi index chưa tạo
        if (profile.role === "TEACHER") {
            evalsData = evalsData.filter(e => (e as any).teacherId === profile.uid);
        }

        // Sort by createdAt descending
        evalsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        setEvaluations(evalsData);
      } catch (error) {
        console.error("Error fetching evaluations:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchEvaluations();
  }, [profile]);

  const canCreate = profile?.role === "ADMIN" || profile?.role === "BGH" || profile?.role === "TTCM";

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PENDING_APPEAL": return <span className="flex items-center px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium"><Clock size={12} className="mr-1"/> Chờ khiếu nại</span>;
      case "APPEALED": return <span className="flex items-center px-2 py-1 bg-orange-100 text-orange-700 rounded-full text-xs font-medium"><AlertTriangle size={12} className="mr-1"/> Đang khiếu nại</span>;
      case "APPROVED": return <span className="flex items-center px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium"><CheckCircle size={12} className="mr-1"/> Đã chốt</span>;
      case "REJECTED": return <span className="flex items-center px-2 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium"><XCircle size={12} className="mr-1"/> Hủy bỏ</span>;
      default: return null;
    }
  };

  return (
    <ProtectedRoute>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">Đánh giá & KPI</h1>
            <p className="text-slate-500">Danh sách các phiếu đánh giá Thưởng/Phạt của giáo viên.</p>
          </div>
          
          {canCreate && (
            <Link 
              href="/dashboard/evaluations/create" 
              className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-all shadow-md hover:shadow-lg flex items-center shrink-0"
            >
              <Plus size={20} className="mr-2" />
              Tạo đánh giá mới
            </Link>
          )}
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          {loading ? (
              <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
            ) : evaluations.length === 0 ? (
              <div className="text-center p-12 text-gray-500 flex flex-col items-center">
                <FileText size={48} className="text-gray-300 mb-4" />
                <p>Chưa có dữ liệu đánh giá nào.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50 border-b border-t text-sm">
                      <th className="p-4 font-semibold text-gray-600">Giáo viên</th>
                      <th className="p-4 font-semibold text-gray-600">Quy định áp dụng</th>
                      <th className="p-4 font-semibold text-gray-600 text-center">Điểm</th>
                      <th className="p-4 font-semibold text-gray-600">Ngày tạo</th>
                      <th className="p-4 font-semibold text-gray-600">Người lập</th>
                      <th className="p-4 font-semibold text-gray-600 text-center">Trạng thái</th>
                      <th className="p-4 font-semibold text-gray-600 text-right">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluations.map((evalItem) => (
                      <tr key={evalItem.id} className="border-b hover:bg-gray-50 transition-colors">
                        <td className="p-4 font-medium text-gray-900">{evalItem.teacherName}</td>
                        <td className="p-4">
                          <span className={`inline-block px-2 py-1 text-xs rounded-md font-medium mb-1 ${evalItem.type === "KUDOS" ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"}`}>
                            {evalItem.type}
                          </span>
                          <p className="text-sm text-gray-700">{evalItem.ruleName}</p>
                        </td>
                        <td className="p-4 text-center">
                          <span className={`font-bold ${evalItem.ruleScore > 0 ? "text-green-600" : "text-red-600"}`}>
                            {evalItem.ruleScore > 0 ? `+${evalItem.ruleScore}` : evalItem.ruleScore}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-gray-600">
                          {format(new Date(evalItem.createdAt), "dd/MM/yyyy HH:mm", { locale: vi })}
                        </td>
                        <td className="p-4 text-sm text-gray-600">{evalItem.createdByName}</td>
                        <td className="p-4">
                          <div className="flex justify-center">
                            {getStatusBadge(evalItem.status)}
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
    </ProtectedRoute>
  );
}

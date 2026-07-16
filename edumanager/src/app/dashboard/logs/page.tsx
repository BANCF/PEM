"use client";

import React, { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { db } from "@/lib/firebase/client";
import { collection, query, orderBy, limit, getDocs } from "firebase/firestore";
import toast from "react-hot-toast";
import { Loader2, Activity, Clock } from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

interface AuditLog {
  id: string;
  userId: string;
  userEmail: string;
  action: string;
  details: string;
  createdAt: string;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const q = query(collection(db, "audit_logs"), orderBy("createdAt", "desc"), limit(100));
        const snap = await getDocs(q);
        const logsData: AuditLog[] = [];
        snap.forEach(doc => {
          logsData.push({ id: doc.id, ...doc.data() } as AuditLog);
        });
        setLogs(logsData);
      } catch (error) {
        console.error("Lỗi lấy logs:", error);
        toast.error("Không thể tải nhật ký. Hãy tạo Index nếu được yêu cầu.");
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, []);

  return (
    <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Nhật ký Hệ thống (Audit Logs)</h1>
          <p className="text-slate-500">Theo dõi các hoạt động gần nhất trong hệ thống.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center bg-slate-50 text-slate-800">
            <Activity className="mr-2 text-blue-600" />
            <h2 className="text-xl font-bold">Lịch sử Hoạt động</h2>
          </div>

          <div className="p-0">
            {loading ? (
              <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-600" /></div>
            ) : logs.length === 0 ? (
              <p className="p-10 text-center text-slate-500">Chưa có hoạt động nào được ghi lại.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
                      <th className="p-4 font-semibold w-48">Thời gian</th>
                      <th className="p-4 font-semibold w-56">Người dùng</th>
                      <th className="p-4 font-semibold w-32">Hành động</th>
                      <th className="p-4 font-semibold">Chi tiết</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 text-sm text-slate-500 flex items-center">
                          <Clock size={14} className="mr-1.5" />
                          {format(new Date(log.createdAt), "dd/MM/yyyy HH:mm", { locale: vi })}
                        </td>
                        <td className="p-4 font-medium text-slate-800 text-sm">
                          {log.userEmail}
                        </td>
                        <td className="p-4">
                          <span className="inline-block px-2 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-md">
                            {log.action}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-slate-600">
                          {log.details}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

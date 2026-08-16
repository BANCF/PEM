"use client";

import React, { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { db } from "@/lib/firebase/client";
import { doc, getDoc, setDoc } from "firebase/firestore";
import toast from "react-hot-toast";
import { Loader2, Settings, ShieldAlert, GraduationCap, BookOpen, FileText, Calendar, Award, ClipboardCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function FeatureTogglesPage() {
  const { actualProfile } = useAuth();
  const [features, setFeatures] = useState<Record<string, boolean>>({
    classes: true,
    grades: true,
    evaluations: true,
    schedule: true,
    certificates: true,
    classhubAttendance: false
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "system_settings", "general");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.features) {
             setFeatures(prev => ({ ...prev, ...data.features }));
          }
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const toggleFeature = async (featureKey: string, currentValue: boolean) => {
    const action = currentValue ? "TẮT" : "BẬT";
    if (!confirm(`Bạn có chắc chắn muốn ${action} tính năng này?`)) return;
    
    setSaving(true);
    try {
      const docRef = doc(db, "system_settings", "general");
      const newFeatures = { ...features, [featureKey]: !currentValue };
      await setDoc(docRef, { features: newFeatures }, { merge: true });
      setFeatures(newFeatures);
      toast.success(`Tính năng đã được ${action.toLowerCase()}.`);
    } catch (error) {
      toast.error("Có lỗi xảy ra khi cập nhật thiết lập.");
    } finally {
      setSaving(false);
    }
  };

  if (actualProfile?.role !== "ADMIN" && actualProfile?.role !== "SUPER_ADMIN") {
    return <div className="p-10 text-center text-red-500 font-bold">Không có quyền truy cập</div>;
  }

  const featureList = [
    { key: "classes", name: "Quản lý Lớp học", icon: GraduationCap, desc: "Tính năng tạo, sửa, xóa và quản lý danh sách lớp học." },
    { key: "grades", name: "Sổ điểm", icon: BookOpen, desc: "Cho phép giáo viên nhập điểm, sửa điểm và xem bảng điểm." },
    { key: "evaluations", name: "Phiếu Đánh giá", icon: FileText, desc: "Đánh giá học sinh hàng tháng và ghi chú của giáo viên." },
    { key: "schedule", name: "Thời khóa biểu", icon: Calendar, desc: "Xem lịch dạy, lịch học và cập nhật thời khóa biểu." },
    { key: "certificates", name: "Giấy Khen & Chứng Nhận", icon: Award, desc: "Cấp phát và in giấy khen cho học sinh." },
    { key: "classhubAttendance", name: "Hồ sơ cá nhân & ClassHub", icon: ClipboardCheck, desc: "Tính năng hồ sơ cá nhân và đồng bộ điểm danh 1-chạm." }
  ];

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Quản lý Tính năng Hệ thống</h1>
          <p className="text-slate-500">Cho phép Admin bật/tắt các module riêng lẻ để bảo trì hoặc tổng kết cuối kỳ.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden max-w-4xl">
          <div className="p-6 border-b border-slate-100 flex items-center bg-slate-900 text-white">
            <Settings className="mr-2 text-blue-400" />
            <h2 className="text-xl font-bold">Feature Toggles</h2>
          </div>

          <div className="p-8">
            {loading ? (
              <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-600 w-8 h-8" /></div>
            ) : (
              <div className="grid gap-6">
                {featureList.map((feature) => {
                  const Icon = feature.icon;
                  const isEnabled = features[feature.key] ?? true;
                  return (
                    <div key={feature.key} className="flex items-center justify-between p-6 bg-slate-50 rounded-xl border border-slate-200 transition-all hover:border-blue-200 hover:shadow-md">
                      <div className="flex items-start">
                        <div className={`p-3 rounded-lg mr-4 ${isEnabled ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-500'}`}>
                           <Icon size={24} />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-slate-800 flex items-center">
                            {feature.name}
                            {!isEnabled && <span className="ml-3 px-2.5 py-0.5 text-xs font-bold bg-amber-100 text-amber-700 rounded-full">Đang bảo trì</span>}
                          </h3>
                          <p className="text-slate-500 text-sm mt-1 max-w-lg">
                            {feature.desc}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleFeature(feature.key, isEnabled)}
                        disabled={saving}
                        className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none ${isEnabled ? "bg-blue-600" : "bg-slate-300"} disabled:opacity-50`}
                      >
                        <span
                          className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${isEnabled ? "translate-x-9" : "translate-x-1"}`}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

"use client";

import React, { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { db } from "@/lib/firebase/client";
import { doc, getDoc, setDoc } from "firebase/firestore";
import toast from "react-hot-toast";
import { Loader2, Settings, ShieldAlert } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function SettingsPage() {
  const { actualProfile } = useAuth();
  const [isFrozen, setIsFrozen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "system_settings", "general");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setIsFrozen(docSnap.data().systemFrozen || false);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const toggleFreeze = async () => {
    if (!confirm(`Bạn có chắc chắn muốn ${isFrozen ? "MỞ KHÓA" : "ĐÓNG BĂNG"} hệ thống?`)) return;
    setSaving(true);
    try {
      const docRef = doc(db, "system_settings", "general");
      await setDoc(docRef, { systemFrozen: !isFrozen }, { merge: true });
      setIsFrozen(!isFrozen);
      toast.success(`Hệ thống đã được ${!isFrozen ? "ĐÓNG BĂNG" : "MỞ KHÓA"}.`);
    } catch (error) {
      toast.error("Có lỗi xảy ra khi cập nhật thiết lập.");
    } finally {
      setSaving(false);
    }
  };

  if (actualProfile?.role !== "SUPER_ADMIN") {
    return <div className="p-10 text-center text-red-500 font-bold">Không có quyền truy cập</div>;
  }

  return (
    <ProtectedRoute allowedRoles={["SUPER_ADMIN"]}>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Cài đặt Hệ thống Tối cao</h1>
          <p className="text-slate-500">Chỉ dành riêng cho Super Admin.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden max-w-2xl">
          <div className="p-6 border-b border-slate-100 flex items-center bg-slate-900 text-white">
            <Settings className="mr-2 text-amber-500" />
            <h2 className="text-xl font-bold">System Configuration</h2>
          </div>

          <div className="p-8">
            {loading ? (
              <div className="flex justify-center p-4"><Loader2 className="animate-spin text-blue-600" /></div>
            ) : (
              <div className="flex items-center justify-between p-6 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <h3 className="text-lg font-bold text-slate-800 flex items-center">
                    <ShieldAlert className="mr-2 text-red-500" size={20} />
                    Chế độ Đóng băng Hệ thống
                  </h3>
                  <p className="text-slate-500 text-sm mt-1 max-w-md">
                    Khi bật chế độ này, toàn bộ Giáo viên, TTCM, TPCM và Admin thường sẽ không thể thao tác bất kỳ tính năng nào. Màn hình của họ sẽ hiển thị "Đang bảo trì". Chỉ Super Admin mới có thể hoạt động bình thường.
                  </p>
                </div>
                <button
                  onClick={toggleFreeze}
                  disabled={saving}
                  className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors focus:outline-none ${isFrozen ? "bg-red-600" : "bg-slate-300"}`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${isFrozen ? "translate-x-9" : "translate-x-1"}`}
                  />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

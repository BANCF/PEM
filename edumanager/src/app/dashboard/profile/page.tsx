"use client";

import React, { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase/client";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import toast from "react-hot-toast";
import { User, Link as LinkIcon, Key, Save, Loader2, Info } from "lucide-react";

export default function ProfilePage() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [classhubUsername, setClasshubUsername] = useState("");
  const [classhubPassword, setClasshubPassword] = useState("");

  useEffect(() => {
    const fetchUserData = async () => {
      if (!profile?.id) return;
      try {
        const docRef = doc(db, "users", profile.id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.classhubUsername) setClasshubUsername(data.classhubUsername);
          if (data.classhubPassword) setClasshubPassword(atob(data.classhubPassword)); // Basic decode for now
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchUserData();
  }, [profile?.id]);

  const handleSaveClassHub = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.id) return;
    
    setSaving(true);
    try {
      const docRef = doc(db, "users", profile.id);
      await updateDoc(docRef, {
        classhubUsername,
        // For MVP, we use base64. In production Phase 2, this will be handled by a secure API.
        classhubPassword: btoa(classhubPassword), 
        classhubLinkedAt: new Date().toISOString()
      });
      toast.success("Đã lưu thông tin liên kết ClassHub!");
    } catch (error) {
      console.error("Error saving ClassHub credentials:", error);
      toast.error("Có lỗi xảy ra khi lưu thiết lập.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Hồ sơ cá nhân</h1>
          <p className="text-slate-500">Quản lý thông tin tài khoản và các kết nối hệ thống ngoài.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Cột 1: Thông tin cơ bản */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-md">
                  <User size={40} className="text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-800">{profile?.fullName || "Giáo viên"}</h2>
                <span className="mt-2 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200">
                  Vai trò: {profile?.role}
                </span>
                <p className="text-sm text-slate-500 mt-4 break-all">{profile?.email}</p>
              </div>
            </div>
          </div>

          {/* Cột 2: Cài đặt Liên kết ClassHub */}
          <div className="md:col-span-2 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-100 rounded-lg">
                    <LinkIcon className="w-5 h-5 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-slate-800">Liên kết Hệ thống ClassHub (idcloud.vn)</h3>
                </div>
              </div>
              
              <div className="p-6">
                <div className="bg-blue-50 text-blue-800 p-4 rounded-xl flex items-start space-x-3 mb-6 text-sm">
                  <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                  <p>
                    <strong>Tính năng Đồng bộ Tự động:</strong> Cung cấp tài khoản ClassHub của bạn tại đây để hệ thống PEM có thể tự động đẩy điểm số và dữ liệu điểm danh trực tiếp lên Sở GD&ĐT mà không cần bạn phải thao tác bằng tay.
                  </p>
                </div>

                <form onSubmit={handleSaveClassHub} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Tên đăng nhập ClassHub (Mã GV)</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-5 w-5 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        value={classhubUsername}
                        onChange={(e) => setClasshubUsername(e.target.value)}
                        className="pl-10 w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
                        placeholder="Ví dụ: gv_nguyenvana"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Mật khẩu ClassHub</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Key className="h-5 w-5 text-slate-400" />
                      </div>
                      <input
                        type="password"
                        value={classhubPassword}
                        onChange={(e) => setClasshubPassword(e.target.value)}
                        className="pl-10 w-full rounded-xl border border-slate-300 px-4 py-2.5 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 transition-all outline-none"
                        placeholder="••••••••"
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-4 flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl font-medium transition-colors disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                      <span>{saving ? "Đang lưu..." : "Lưu Kết Nối"}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

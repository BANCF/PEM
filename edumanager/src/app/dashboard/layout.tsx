"use client";

import React from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { LogOut, Home, FileText, Settings, Users, Menu, X, Bell, Building2, ShieldAlert, GraduationCap } from "lucide-react";
import { auth, db } from "@/lib/firebase/client";
import { signOut } from "firebase/auth";
import toast from "react-hot-toast";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import Notifications from "@/components/Notifications";
import { doc, onSnapshot } from "firebase/firestore";
import { BookOpen } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile, actualProfile, clearImpersonatedUid } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [loadingConfig, setLoadingConfig] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "system_settings", "general"), (snapshot) => {
      if (snapshot.exists()) {
        setIsFrozen(snapshot.data().systemFrozen || false);
      }
      setLoadingConfig(false);
    });
    return () => unsub();
  }, []);

  const handleLogout = async () => {
    try {
      clearImpersonatedUid();
      await signOut(auth);
      toast.success("Đã đăng xuất");
      router.push("/login");
    } catch (error) {
      toast.error("Lỗi khi đăng xuất");
    }
  };

  const isActive = (path: string) => {
    if (path === "/dashboard" && pathname === "/dashboard") return true;
    if (path !== "/dashboard" && pathname.startsWith(path)) return true;
    return false;
  };

  const NavLink = ({ href, icon: Icon, children }: { href: string, icon: any, children: React.ReactNode }) => {
    const active = isActive(href);
    return (
      <Link 
        href={href} 
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center space-x-3 p-3 rounded-xl font-medium transition-all duration-200 ${
          active 
            ? "bg-blue-600 text-white shadow-md shadow-blue-900/20" 
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`}
      >
        <Icon size={20} className={active ? "text-white" : "text-slate-400 group-hover:text-white"} />
        <span>{children}</span>
      </Link>
    );
  };

  if (loadingConfig) return null;

  if (isFrozen && actualProfile?.role !== "SUPER_ADMIN") {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 text-center max-w-md">
           <ShieldAlert className="w-16 h-16 text-red-500 mx-auto mb-4" />
           <h1 className="text-2xl font-bold text-white mb-2">Hệ Thống Đang Bảo Trì</h1>
           <p className="text-slate-400">Hệ thống đang được khóa tạm thời bởi Quản trị viên để thực hiện bảo trì hoặc tổng kết cuối kỳ. Vui lòng quay lại sau.</p>
           <button onClick={handleLogout} className="mt-6 w-full bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 px-4 rounded-lg">Đăng xuất</button>
        </div>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="h-screen bg-slate-50 flex overflow-hidden print:h-auto print:bg-white print:overflow-visible">
        
        {/* Mobile Sidebar Overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar - Premium Dark Navy */}
        <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0F172A] border-r border-slate-800 flex flex-col transition-transform duration-300 lg:static lg:translate-x-0 print:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}>
          {/* Logo Area */}
          <div className="h-20 flex items-center px-6 border-b border-slate-800">
            <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center mr-3 shadow-sm">
              <img src="/logo-pascal-01.png" alt="Logo" className="w-8 h-8 object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight leading-none">PEM</h1>
              <p className="text-[10px] uppercase font-bold text-blue-400 tracking-wider mt-1">Education Manager</p>
            </div>
            <button className="ml-auto lg:hidden text-slate-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
              <X size={24} />
            </button>
          </div>

          {/* Nav Links */}
          <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
            <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Quản lý chung</p>
            <NavLink href="/dashboard" icon={Home}>Tổng quan KPI</NavLink>
            <NavLink href="/dashboard/classes" icon={GraduationCap}>Quản lý Lớp học</NavLink>
            <NavLink href="/dashboard/grades" icon={BookOpen}>Sổ điểm</NavLink>
            <NavLink href="/dashboard/evaluations" icon={FileText}>Phiếu Đánh giá</NavLink>
            
            {(profile?.role === "ADMIN" || profile?.role === "BGH" || profile?.role === "SUPER_ADMIN") && (
              <>
                <div className="pt-6 mb-2">
                  <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Cấu hình Hệ thống</p>
                </div>
                <NavLink href="/dashboard/rules" icon={Settings}>Quy định (Rules)</NavLink>
              </>
            )}
            
            {(profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN") && (
              <div className="pt-4 mt-4 border-t border-slate-800 space-y-2">
                <p className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Admin Tools</p>
                <NavLink href="/dashboard/departments" icon={Building2}>Tổ Bộ Môn</NavLink>
                <NavLink href="/dashboard/users" icon={Users}>Quản lý Nhân sự</NavLink>
                {actualProfile?.role === "SUPER_ADMIN" && (
                  <>
                    <NavLink href="/dashboard/settings" icon={ShieldAlert}>Hệ thống Tối cao</NavLink>
                    <NavLink href="/dashboard/logs" icon={FileText}>Nhật ký Hệ thống</NavLink>
                  </>
                )}
              </div>
            )}
          </div>

          {/* User Profile & Logout */}
          <div className="p-4 border-t border-slate-800 bg-[#0F172A]">
            <div className="flex items-center space-x-3 mb-4 p-2 bg-slate-800/50 rounded-xl">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-lg shrink-0 shadow-inner">
                {profile?.fullName?.charAt(0) || "U"}
              </div>
              <div className="overflow-hidden">
                <p className="text-sm font-bold text-white truncate">{profile?.fullName}</p>
                <div className="flex items-center mt-0.5">
                  <span className="inline-block px-2 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] font-bold rounded uppercase tracking-wider">
                    {profile?.role}
                  </span>
                </div>
              </div>
            </div>
            {actualProfile && profile && actualProfile.id !== profile.id && (
              <button
                onClick={() => clearImpersonatedUid()}
                className="w-full flex items-center justify-center space-x-2 bg-amber-500/20 text-amber-500 hover:bg-amber-500/30 p-2.5 rounded-xl transition-all font-medium text-sm mb-2"
              >
                <span>Thoát giả danh</span>
              </button>
            )}
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center space-x-2 text-slate-400 hover:bg-red-500/10 hover:text-red-400 p-2.5 rounded-xl transition-all font-medium text-sm"
            >
              <LogOut size={18} />
              <span>Đăng xuất hệ thống</span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[#F8FAFC] print:overflow-visible print:bg-white">
          
          {/* Top Header */}
          <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-30 flex items-center justify-between px-6 lg:px-10 print:hidden">
            <div className="flex items-center">
              <button 
                className="mr-4 lg:hidden text-slate-600 hover:text-blue-600 transition"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu size={24} />
              </button>
              <h2 className="text-xl font-bold text-slate-800 hidden sm:block">
                Xin chào, {profile?.fullName?.split(" ").pop()} 👋
              </h2>
            </div>
            
            <div className="flex items-center space-x-4">
              <Notifications />
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-6 lg:p-10 print:p-0 print:overflow-visible">
            <div className="max-w-7xl mx-auto w-full print:max-w-none">
              {children}
            </div>
          </main>
          
        </div>

      </div>
    </ProtectedRoute>
  );
}

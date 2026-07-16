"use client";

import React, { useState } from "react";
import { signInWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Lock, Mail, Loader2 } from "lucide-react";
import { logAuditAction } from "@/lib/firebase/audit";

const ALLOWED_DOMAIN = "@pas.edu.vn"; // Thay đổi domain trường của bạn ở đây nếu cần

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Vui lòng nhập email và mật khẩu.");
      return;
    }

    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Đăng nhập thành công!");
      router.push("/dashboard");
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.code === "auth/invalid-credential" || error.code === "auth/user-not-found" || error.code === "auth/wrong-password") {
        toast.error("Email hoặc mật khẩu không chính xác!");
      } else {
        toast.error("Đã xảy ra lỗi khi đăng nhập.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      // Gợi ý cho form đăng nhập Google chỉ hiển thị email của domain trường
      provider.setCustomParameters({
        hd: ALLOWED_DOMAIN.replace("@", "")
      });

      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // 1. Kiểm tra đuôi email có đúng là của trường không
      if (user.email && !user.email.endsWith(ALLOWED_DOMAIN) && user.email !== "admin@school.com") {
        await signOut(auth); // Ép đăng xuất ngay lập tức
        toast.error(`Vui lòng sử dụng email đuôi ${ALLOWED_DOMAIN} của trường!`);
        return;
      }

      // 2. Kiểm tra xem user này đã có trong database chưa
      const userRef = doc(db, "users", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        // Lần đầu đăng nhập -> Tạo profile với Role mặc định là TEACHER
        await setDoc(userRef, {
          email: user.email,
          fullName: user.displayName || "Giáo viên",
          role: "TEACHER",
          createdAt: new Date().toISOString(),
        });
        toast.success("Tạo tài khoản thành công!");
      } else {
        toast.success("Đăng nhập thành công!");
      }

      await logAuditAction(user.uid, user.email || "", "LOGIN", "Đăng nhập hệ thống (Google)");

      router.push("/dashboard");
    } catch (error: any) {
      console.error("Google login error:", error);
      if (error.code !== "auth/popup-closed-by-user") {
        toast.error("Lỗi đăng nhập Google.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 relative">

      <div className="max-w-4xl w-full bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col md:flex-row">
        
        {/* Left Side: Branding / Info */}
        <div className="w-full md:w-1/2 bg-blue-600 p-10 flex flex-col justify-center items-center text-white relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]"></div>
          <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-blue-500 rounded-full blur-3xl"></div>
          <div className="absolute -top-10 -left-10 w-40 h-40 bg-indigo-500 rounded-full blur-3xl"></div>
          
          <div className="relative z-10 text-center flex flex-col items-center">
            <img src="/logo-pascal-01.png" alt="Pascal Logo" className="w-32 h-auto mb-6 bg-white rounded-xl p-2 shadow-lg" />
            <h1 className="text-4xl font-extrabold tracking-tight mb-4">PEM</h1>
            <p className="text-blue-100 text-lg">Pascal Education Manager</p>
            <p className="text-blue-100 text-md mt-2">Hệ thống quản lý, đánh giá và tính điểm KPI cho giáo viên trường tư thục.</p>
          </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="w-full md:w-1/2 p-10 bg-white flex flex-col justify-center">
          <div className="max-w-sm mx-auto w-full">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-gray-900">Đăng Nhập</h2>
              <p className="text-gray-500 mt-2">Vui lòng đăng nhập vào tài khoản của bạn</p>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center shadow-sm disabled:bg-gray-100 disabled:cursor-not-allowed mb-6"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Đăng nhập bằng Mail Trường (.edu.vn)
            </button>

            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Hoặc tài khoản Admin</span>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Mail size={18} />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                    placeholder="Email của bạn"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Mật khẩu</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                    <Lock size={18} />
                  </div>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-lg transition-colors flex items-center justify-center shadow-md disabled:bg-blue-400 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="animate-spin mr-2" size={20} />
                    Đang đăng nhập...
                  </>
                ) : (
                  "Đăng Nhập Admin"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase/client";
import { collection, getDocs, doc, updateDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, Users, Save, Shield, Edit3, Trash2, Eye } from "lucide-react";

interface UserData {
  id: string;
  uid: string;
  email: string;
  fullName: string;
  role: string;
  department: string;
}

const ROLES = [
  { value: "BGH", label: "Ban Giám Hiệu" },
  { value: "TTCM", label: "Tổ trưởng CM" },
  { value: "TPCM", label: "Tổ phó CM" },
  { value: "TEACHER", label: "Giáo viên" },
  { value: "ADMIN", label: "Admin Hệ thống" }
];

export default function UsersManagementPage() {
  const { actualProfile, setImpersonatedUid } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserData[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      // Fetch users
      const usersSnap = await getDocs(collection(db, "users"));
      let usersData: UserData[] = [];
      usersSnap.forEach(doc => {
        usersData.push({ id: doc.id, ...doc.data() } as UserData);
      });
      
      // Hide SUPER_ADMIN from normal ADMIN
      if (actualProfile?.role !== "SUPER_ADMIN") {
        usersData = usersData.filter(u => u.role !== "SUPER_ADMIN");
      }
      
      setUsers(usersData);

      // Fetch departments
      const depsSnap = await getDocs(collection(db, "departments"));
      const depsData: string[] = ["Chưa phân tổ"];
      depsSnap.forEach(doc => {
        depsData.push(doc.data().name);
      });
      setDepartments(depsData);

    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Lỗi tải dữ liệu nhân sự.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdate = async (userId: string, field: "role" | "department", value: string) => {
    setSavingId(userId);
    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { [field]: value });
      
      // Update local state
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, [field]: value } : u));
      toast.success("Cập nhật thành công!");
    } catch (error) {
      toast.error("Lỗi khi cập nhật.");
      console.error(error);
    } finally {
      setSavingId(null);
    }
  };

  const handleDeleteUser = async (user: UserData) => {
    if (user.email === "admin@school.com") {
      toast.error("Không thể xóa tài khoản Admin hệ thống gốc.");
      return;
    }
    
    if (!confirm(`Bạn có chắc chắn muốn xóa nhân sự ${user.fullName}?\nToàn bộ điểm số KPI và phiếu đánh giá của người này sẽ bị xóa vĩnh viễn và không thể khôi phục!`)) {
      return;
    }

    setDeletingId(user.id);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        let errorMessage = "Delete failed";
        try {
          const data = await res.json();
          errorMessage = data.error || errorMessage;
        } catch (e) {
          const text = await res.text();
          console.error("Non-JSON error response:", text);
          errorMessage = `Server error (${res.status}). Vui lòng kiểm tra lại cấu hình server.`;
        }
        throw new Error(errorMessage);
      }
      
      toast.success("Đã xóa nhân sự và toàn bộ dữ liệu liên quan.");
      setUsers(users.filter(u => u.id !== user.id));
    } catch (error: any) {
      console.error("Lỗi xóa nhân sự:", error);
      toast.error("Xóa thất bại: " + error.message);
    } finally {
      setDeletingId(null);
    }
  };

  const handleImpersonate = (userId: string) => {
    setImpersonatedUid(userId);
    toast.success("Đang đăng nhập giả danh...");
    router.push("/dashboard");
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "SUPER_ADMIN"]}>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Quản lý Nhân sự & Phân quyền</h1>
          <p className="text-slate-500">Chỉ định Tổ bộ môn và phân quyền hạn (Role) cho tài khoản.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800 flex items-center">
              <Users className="mr-2 text-blue-600" />
              Danh sách Tài khoản
            </h2>
          </div>

          {loading ? (
            <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
          ) : users.length === 0 ? (
            <p className="text-slate-500 text-center p-10 bg-slate-50">Chưa có người dùng nào.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
                    <th className="p-4 font-semibold">Nhân sự</th>
                    <th className="p-4 font-semibold w-64">Tổ bộ môn</th>
                    <th className="p-4 font-semibold w-56">Phân Quyền (Role)</th>
                    <th className="p-4 font-semibold w-24 text-center">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors group">
                      <td className="p-4">
                        <p className="font-bold text-slate-800 text-base">{user.fullName}</p>
                        <p className="text-xs text-slate-500 font-medium">{user.email}</p>
                      </td>
                      <td className="p-4">
                        <div className="relative">
                          <select
                            value={user.department || "Chưa phân tổ"}
                            onChange={(e) => handleUpdate(user.id, "department", e.target.value)}
                            disabled={savingId === user.id}
                            className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm font-medium text-slate-700 transition disabled:opacity-50 appearance-none"
                          >
                            {departments.map(dep => (
                              <option key={dep} value={dep}>{dep}</option>
                            ))}
                          </select>
                          <Edit3 className="absolute right-3 top-3 text-slate-400 pointer-events-none" size={14} />
                        </div>
                      </td>
                      <td className="p-4">
                         <div className="relative">
                          <select
                            value={user.role || "TEACHER"}
                            onChange={(e) => handleUpdate(user.id, "role", e.target.value)}
                            disabled={savingId === user.id || user.email === "admin@school.com"} // Không cho tự đổi quyền admin root
                            className={`w-full p-2.5 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold transition disabled:opacity-50 appearance-none ${
                              user.role === "ADMIN" ? "bg-red-50 text-red-700 border-red-200" :
                              user.role === "BGH" ? "bg-purple-50 text-purple-700 border-purple-200" :
                              user.role === "TTCM" ? "bg-orange-50 text-orange-700 border-orange-200" :
                              user.role === "TPCM" ? "bg-amber-50 text-amber-700 border-amber-200" :
                              "bg-blue-50 text-blue-700 border-blue-200"
                            }`}
                          >
                            {ROLES.map(role => (
                              <option key={role.value} value={role.value}>{role.label}</option>
                            ))}
                          </select>
                          <Shield className={`absolute right-3 top-3 pointer-events-none ${user.role === "ADMIN" ? "text-red-400" : "text-slate-400"}`} size={14} />
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          {savingId === user.id ? (
                            <Loader2 className="animate-spin text-blue-600" size={20} />
                          ) : (
                            <span className="text-green-500 bg-green-50 p-2 rounded-lg inline-block opacity-0 group-hover:opacity-100 transition" title="Tự động lưu khi thay đổi"><Save size={18}/></span>
                          )}

                          {actualProfile?.role === "SUPER_ADMIN" && user.role !== "SUPER_ADMIN" && (
                            <button
                              onClick={() => handleImpersonate(user.id)}
                              className="text-amber-500 bg-amber-50 hover:bg-amber-100 p-2 rounded-lg inline-block opacity-0 group-hover:opacity-100 transition"
                              title="Đăng nhập giả danh"
                            >
                              <Eye size={18} />
                            </button>
                          )}

                          {deletingId === user.id ? (
                            <Loader2 className="animate-spin text-red-600" size={20} />
                          ) : (
                            <button 
                              onClick={() => handleDeleteUser(user)}
                              disabled={user.email === "admin@school.com" || deletingId !== null}
                              className="text-red-500 bg-red-50 hover:bg-red-100 p-2 rounded-lg inline-block opacity-0 group-hover:opacity-100 transition disabled:opacity-0"
                              title="Xóa nhân sự"
                            >
                              <Trash2 size={18}/>
                            </button>
                          )}
                        </div>
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

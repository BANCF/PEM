"use client";

import React, { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { db } from "@/lib/firebase/client";
import { collection, getDocs, addDoc, deleteDoc, doc } from "firebase/firestore";
import toast from "react-hot-toast";
import { Plus, Trash2, Loader2, Layers } from "lucide-react";

interface Department {
  id: string;
  name: string;
}

export default function DepartmentsManagementPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newDepartmentName, setNewDepartmentName] = useState("");

  const fetchDepartments = async () => {
    try {
      const snap = await getDocs(collection(db, "departments"));
      const depsData: Department[] = [];
      snap.forEach(doc => {
        depsData.push({ id: doc.id, name: doc.data().name } as Department);
      });
      // Sort by name
      depsData.sort((a, b) => a.name.localeCompare(b.name));
      setDepartments(depsData);
    } catch (error) {
      console.error("Error fetching departments:", error);
      toast.error("Lỗi tải danh sách Tổ bộ môn.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartments();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDepartmentName.trim()) {
      toast.error("Vui lòng nhập tên Tổ bộ môn.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "departments"), {
        name: newDepartmentName.trim()
      });
      toast.success("Thêm Tổ bộ môn thành công!");
      setNewDepartmentName("");
      fetchDepartments();
    } catch (error) {
      console.error("Error adding department:", error);
      toast.error("Lỗi khi thêm Tổ bộ môn.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Bạn có chắc muốn xóa Tổ "${name}"? Lưu ý: Bạn cần phải đổi Tổ cho các giáo viên đang thuộc tổ này sau khi xóa.`)) return;
    
    try {
      await deleteDoc(doc(db, "departments", id));
      toast.success("Xóa thành công!");
      fetchDepartments();
    } catch (error) {
      toast.error("Lỗi khi xóa Tổ bộ môn.");
      console.error(error);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN"]}>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Quản lý Tổ Bộ Môn</h1>
          <p className="text-slate-500">Thêm mới hoặc xóa bỏ các Tổ chuyên môn trong trường.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
            <h2 className="text-xl font-bold mb-6 flex items-center text-slate-800">
              <Plus className="mr-2 text-blue-600" />
              Thêm Tổ mới
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tên Tổ / Phòng ban</label>
                <input
                  type="text"
                  value={newDepartmentName}
                  onChange={(e) => setNewDepartmentName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                  placeholder="VD: Tổ Toán - Tin"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition flex justify-center items-center shadow-md disabled:bg-blue-400"
              >
                {isSubmitting ? <Loader2 className="animate-spin mr-2" size={20} /> : "Thêm Tổ Bộ Môn"}
              </button>
            </form>
          </div>

          {/* List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center">
                <Layers className="mr-2 text-blue-600" />
                <h2 className="text-xl font-bold text-slate-800">Danh sách Tổ Bộ Môn</h2>
              </div>
              
              {loading ? (
                <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
              ) : departments.length === 0 ? (
                <p className="text-slate-500 text-center p-10 bg-slate-50">Chưa có Tổ bộ môn nào được tạo.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50/50 text-xs uppercase tracking-wider text-slate-500 border-b border-slate-100">
                        <th className="p-4 font-semibold">Tên Tổ Bộ Môn</th>
                        <th className="p-4 font-semibold w-24 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {departments.map((dep) => (
                        <tr key={dep.id} className="border-b border-slate-50 hover:bg-blue-50/30 transition-colors">
                          <td className="p-4">
                            <span className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold border border-slate-200 shadow-sm inline-block">
                              {dep.name}
                            </span>
                          </td>
                          <td className="p-4 text-right">
                            <button 
                              onClick={() => handleDelete(dep.id, dep.name)} 
                              className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                              title="Xóa Tổ"
                            >
                              <Trash2 size={18} />
                            </button>
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
      </div>
    </ProtectedRoute>
  );
}

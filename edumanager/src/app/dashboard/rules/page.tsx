"use client";

import React, { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { db } from "@/lib/firebase/client";
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from "firebase/firestore";
import toast from "react-hot-toast";
import { Plus, Trash2, Edit2, Loader2 } from "lucide-react";

interface Rule {
  id: string;
  name: string;
  category: string;
  type: "PENALTY" | "KUDOS";
  score: number;
  description: string;
}

export default function RulesManagementPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    category: "Phần I",
    type: "KUDOS" as "PENALTY" | "KUDOS",
    score: 0,
    description: "",
  });

  const fetchRules = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "rules"));
      const rulesData: Rule[] = [];
      querySnapshot.forEach((doc) => {
        rulesData.push({ id: doc.id, ...doc.data() } as Rule);
      });
      rulesData.sort((a, b) => a.name.localeCompare(b.name));
      setRules(rulesData);
    } catch (error) {
      console.error("Error fetching rules:", error);
      toast.error("Không thể tải danh sách quy định.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.score) {
      toast.error("Vui lòng điền đầy đủ tên và điểm.");
      return;
    }

    setIsSubmitting(true);
    try {
      // Đảm bảo KUDOS là số dương, PENALTY là số âm
      let finalScore = Math.abs(formData.score);
      if (formData.type === "PENALTY") {
        finalScore = -finalScore;
      }

      if (editingId) {
        await updateDoc(doc(db, "rules", editingId), {
          name: formData.name,
          category: formData.category,
          type: formData.type,
          score: finalScore,
          description: formData.description,
        });
        toast.success("Cập nhật quy định thành công!");
        setEditingId(null);
      } else {
        await addDoc(collection(db, "rules"), {
          name: formData.name,
          category: formData.category,
          type: formData.type,
          score: finalScore,
          description: formData.description,
        });
        toast.success("Thêm quy định thành công!");
      }

      setFormData({ name: "", category: "Phần I", type: "KUDOS", score: 0, description: "" });
      fetchRules();
    } catch (error) {
      console.error("Error adding rule:", error);
      toast.error("Lỗi khi thêm quy định.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa quy định này?")) return;
    
    try {
      await deleteDoc(doc(db, "rules", id));
      toast.success("Xóa thành công!");
      fetchRules();
    } catch (error) {
      toast.error("Lỗi khi xóa quy định.");
      console.error(error);
    }
  };

  const handleEdit = (rule: Rule) => {
    setEditingId(rule.id);
    setFormData({
      name: rule.name,
      category: rule.category || "Phần I",
      type: rule.type,
      score: Math.abs(rule.score),
      description: rule.description || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "BGH"]}>
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 mb-2">Quản lý Quy định (Rules)</h1>
          <p className="text-slate-500">Thiết lập các tiêu chí Thưởng/Phạt và số điểm tương ứng.</p>
        </div>
          
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Form */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 h-fit">
            <h2 className="text-xl font-bold mb-6 flex items-center text-slate-800">
              {editingId ? <Edit2 className="mr-2 text-blue-600" /> : <Plus className="mr-2 text-blue-600" />}
              {editingId ? "Cập nhật Quy định" : "Thêm Quy định mới"}
            </h2>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Tên quy định</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                  placeholder="VD: Đi dạy muộn"
                  required
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nhóm (Phần)</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                  >
                    <option value="Phần I">Phần I</option>
                    <option value="Phần II">Phần II</option>
                    <option value="Phần III">Phần III</option>
                    <option value="Phần IV">Phần IV</option>
                    <option value="Phần V">Phần V</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Loại</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value as "PENALTY" | "KUDOS"})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                  >
                    <option value="KUDOS">Thưởng (Kudos)</option>
                    <option value="PENALTY">Phạt (Penalty)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Điểm (+/-)</label>
                  <input
                    type="number"
                    value={formData.score}
                    onChange={(e) => setFormData({...formData, score: Number(e.target.value)})}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm"
                    placeholder="VD: 5"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Mô tả (Tùy chọn)</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm h-24"
                  placeholder="Chi tiết về quy định này..."
                ></textarea>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition flex justify-center items-center shadow-md"
                >
                  {isSubmitting ? <Loader2 className="animate-spin mr-2" size={20} /> : (editingId ? "Cập nhật" : "Lưu Quy định")}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(null);
                      setFormData({ name: "", category: "Phần I", type: "KUDOS", score: 0, description: "" });
                    }}
                    className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 rounded-xl transition"
                  >
                    Hủy
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100">
                <h2 className="text-xl font-bold text-slate-800">Danh sách Quy định</h2>
              </div>
              
              {loading ? (
                <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
              ) : rules.length === 0 ? (
                <p className="text-slate-500 text-center p-10 bg-slate-50">Chưa có quy định nào.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="p-4 font-semibold text-slate-600 text-sm">Tên</th>
                        <th className="p-4 font-semibold text-slate-600 text-sm w-28 text-center">Loại</th>
                        <th className="p-4 font-semibold text-slate-600 text-sm w-24 text-center">Điểm</th>
                        <th className="p-4 font-semibold text-slate-600 text-sm w-24 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const CATEGORIES = ["Phần I", "Phần II", "Phần III", "Phần IV", "Phần V", "Chưa phân loại"];
                        const groupedRules = rules.reduce((acc, rule) => {
                          const cat = rule.category || "Chưa phân loại";
                          if (!acc[cat]) acc[cat] = [];
                          acc[cat].push(rule);
                          return acc;
                        }, {} as Record<string, Rule[]>);

                        return CATEGORIES.map((cat) => {
                          if (!groupedRules[cat] || groupedRules[cat].length === 0) return null;
                          return (
                            <React.Fragment key={cat}>
                              <tr className="bg-slate-100 border-b border-slate-200">
                                <td colSpan={4} className="p-3 font-bold text-slate-700 uppercase tracking-wider text-sm">
                                  {cat}
                                </td>
                              </tr>
                              {groupedRules[cat].map((rule) => (
                                <tr key={rule.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                                  <td className="p-4">
                                    <p className="font-bold text-slate-800">{rule.name}</p>
                                    <p className="text-xs text-slate-500 truncate max-w-xs">{rule.description}</p>
                                  </td>
                                  <td className="p-4 text-center">
                                    <span className={`inline-block px-2.5 py-1 text-xs rounded-lg font-bold border ${
                                      rule.type === "KUDOS" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"
                                    }`}>
                                      {rule.type}
                                    </span>
                                  </td>
                                  <td className={`p-4 text-center font-black text-lg ${rule.score > 0 ? "text-green-500" : "text-red-500"}`}>
                                    {rule.score > 0 ? `+${rule.score}` : rule.score}
                                  </td>
                                  <td className="p-4 text-right">
                                    <div className="flex justify-end space-x-2">
                                      <button onClick={() => handleEdit(rule)} className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors" title="Sửa quy định">
                                        <Edit2 size={18} />
                                      </button>
                                      <button onClick={() => handleDelete(rule.id)} className="text-slate-400 hover:text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors" title="Xóa quy định">
                                        <Trash2 size={18} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </React.Fragment>
                          );
                        });
                      })()}
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

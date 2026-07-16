"use client";

import React, { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { db, storage } from "@/lib/firebase/client";
import { collection, getDocs, query, where, addDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, Upload, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Rule {
  id: string;
  name: string;
  type: "PENALTY" | "KUDOS";
  score: number;
}

interface Teacher {
  id: string;
  uid: string;
  fullName: string;
  email: string;
}

export default function CreateEvaluationPage() {
  const { profile } = useAuth();
  const router = useRouter();
  
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [selectedRuleId, setSelectedRuleId] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch teachers
        const teacherQuery = query(collection(db, "users"), where("role", "==", "TEACHER"));
        const teacherSnap = await getDocs(teacherQuery);
        const teachersList: Teacher[] = [];
        teacherSnap.forEach(doc => teachersList.push({ id: doc.id, uid: doc.id, ...doc.data() } as Teacher));
        
        // Fetch rules
        const rulesSnap = await getDocs(collection(db, "rules"));
        const rulesList: Rule[] = [];
        rulesSnap.forEach(doc => rulesList.push({ id: doc.id, ...doc.data() } as Rule));

        setTeachers(teachersList);
        setRules(rulesList);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Lỗi khi tải dữ liệu.");
      } finally {
        setLoadingData(false);
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeacherId || !selectedRuleId) {
      toast.error("Vui lòng chọn giáo viên và quy định áp dụng.");
      return;
    }
    if (!profile) return;

    setIsSubmitting(true);
    try {
      const selectedTeacher = teachers.find(t => t.id === selectedTeacherId);
      const selectedRule = rules.find(r => r.id === selectedRuleId);

      if (!selectedTeacher || !selectedRule) throw new Error("Invalid selection");

      let evidenceUrl = "";

      // Upload file nếu có
      if (file) {
        const fileRef = ref(storage, `evaluations/${Date.now()}_${file.name}`);
        const uploadResult = await uploadBytes(fileRef, file);
        evidenceUrl = await getDownloadURL(uploadResult.ref);
      }

      // Tính deadline 48h sau
      const createdAt = new Date();
      const deadlineAt = new Date(createdAt.getTime() + 48 * 60 * 60 * 1000);

      // Lưu vào Firestore
      await addDoc(collection(db, "evaluations"), {
        teacherId: selectedTeacher.uid, // Tham chiếu UID
        teacherEmail: selectedTeacher.email, // Lưu thêm email để query dễ dàng
        teacherName: selectedTeacher.fullName,
        ruleId: selectedRule.id,
        ruleName: selectedRule.name,
        ruleScore: selectedRule.score,
        type: selectedRule.type,
        evidenceUrl: evidenceUrl,
        note: note,
        status: "PENDING_APPEAL", // Mặc định chờ khiếu nại
        createdAt: createdAt.toISOString(),
        deadlineAt: deadlineAt.toISOString(),
        createdBy: profile.uid,
        createdByName: profile.fullName
      });

      toast.success("Tạo đánh giá thành công! Hạn chót khiếu nại là 48h tới.");
      router.push("/dashboard/evaluations");

    } catch (error: any) {
      console.error("Submit evaluation error:", error);
      toast.error("Lỗi khi tạo đánh giá: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "BGH", "TTCM"]}>
      <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex items-center">
          <Link href="/dashboard/evaluations" className="text-slate-500 hover:text-blue-600 font-medium transition flex items-center">
            <ArrowLeft size={20} className="mr-1" /> Quay lại danh sách
          </Link>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
          <h1 className="text-2xl font-bold text-slate-800 mb-6">Lập Phiếu Đánh Giá / Tính KPI</h1>

          {loadingData ? (
              <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-600" size={32} /></div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Chọn Giáo viên */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">1. Chọn Giáo viên</label>
                  <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    required
                  >
                    <option value="" disabled>-- Chọn Giáo viên --</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.fullName} ({t.email})</option>
                    ))}
                  </select>
                </div>

                {/* Chọn Quy định */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">2. Quy định áp dụng (Thưởng / Phạt)</label>
                  <select
                    value={selectedRuleId}
                    onChange={(e) => setSelectedRuleId(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition"
                    required
                  >
                    <option value="" disabled>-- Chọn Quy định --</option>
                    {rules.map(r => (
                      <option key={r.id} value={r.id}>
                        {r.type === "KUDOS" ? "📈 Thưởng: " : "📉 Phạt: "} 
                        {r.name} (Điểm: {r.score > 0 ? `+${r.score}` : r.score})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tải lên minh chứng */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">3. Minh chứng (Hình ảnh/Tài liệu - Tùy chọn nhưng khuyến khích)</label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100 transition relative">
                    <input 
                      type="file" 
                      onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      accept="image/*,.pdf,.doc,.docx"
                    />
                    <Upload className="text-gray-400 mb-2" size={32} />
                    {file ? (
                      <p className="text-blue-600 font-medium text-center">{file.name}</p>
                    ) : (
                      <div className="text-center">
                        <p className="text-gray-600 font-medium">Nhấn vào đây để tải lên</p>
                        <p className="text-xs text-gray-400 mt-1">Hỗ trợ JPG, PNG, PDF (Max 5MB)</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ghi chú thêm */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">4. Ghi chú diễn giải (Bắt buộc)</label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition min-h-[120px]"
                    placeholder="Mô tả chi tiết sự việc..."
                    required
                  ></textarea>
                </div>

                {/* Submit */}
                <div className="pt-4 border-t">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center shadow-md disabled:bg-blue-400 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="animate-spin mr-2" size={24} />
                        Đang tạo phiếu đánh giá...
                      </>
                    ) : (
                      "Chốt phiếu đánh giá (Gửi ngay)"
                    )}
                  </button>
                  <p className="text-center text-xs text-red-500 mt-3 font-medium">
                    * Sau khi gửi, giáo viên sẽ có đúng 48 giờ để khiếu nại phiếu này.
                  </p>
                </div>
              </form>
            )}
        </div>
      </div>
    </ProtectedRoute>
  );
}

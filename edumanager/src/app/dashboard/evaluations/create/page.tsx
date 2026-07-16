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
  department: string;
  role: string;
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
        if (!profile) return;
        
        // Fetch teachers based on role
        let teacherQuery;
        if (profile.role === "ADMIN" || profile.role === "BGH") {
          teacherQuery = query(collection(db, "users"), where("role", "in", ["TEACHER", "TTCM", "TPCM"]));
        } else if (profile.role === "TTCM" || profile.role === "TPCM") {
          teacherQuery = query(
            collection(db, "users"), 
            where("role", "==", "TEACHER"),
            where("department", "==", profile.department)
          );
        } else {
          // Fallback cho TEACHER - chỉ được thấy giáo viên cùng tổ
          teacherQuery = query(
            collection(db, "users"), 
            where("role", "in", ["TEACHER", "TTCM", "TPCM"]),
            where("department", "==", profile.department)
          );
        }
        
        const teacherSnap = await getDocs(teacherQuery);
        const teachersList: Teacher[] = [];
        teacherSnap.forEach(doc => teachersList.push({ id: doc.id, uid: doc.id, ...doc.data() } as Teacher));
        
        // Fetch rules
        const rulesSnap = await getDocs(collection(db, "rules"));
        let rulesList: Rule[] = [];
        rulesSnap.forEach(doc => rulesList.push({ id: doc.id, ...doc.data() } as Rule));

        if (profile.role === "TEACHER") {
          rulesList = [
            { id: "PEER_KUDOS_1", name: "Đánh giá Đồng cấp (+1đ)", type: "KUDOS", score: 1 },
            { id: "PEER_KUDOS_2", name: "Đánh giá Đồng cấp (+2đ)", type: "KUDOS", score: 2 },
            { id: "PEER_KUDOS_3", name: "Đánh giá Đồng cấp (+3đ)", type: "KUDOS", score: 3 },
            { id: "PEER_KUDOS_4", name: "Đánh giá Đồng cấp (+4đ)", type: "KUDOS", score: 4 },
            { id: "PEER_KUDOS_5", name: "Đánh giá Đồng cấp (+5đ)", type: "KUDOS", score: 5 },
          ];
        }

        setTeachers(teachersList);
        setRules(rulesList);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Lỗi khi tải dữ liệu.");
      } finally {
        setLoadingData(false);
      }
    };
    if (profile) {
      fetchData();
    }
  }, [profile]);

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

      if (profile.role === "TEACHER") {
        if (selectedTeacher.uid === profile.id) {
          toast.error("Bạn không thể tự tặng điểm cho chính mình.");
          setIsSubmitting(false);
          return;
        }

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const givenKudosQuery = query(
          collection(db, "evaluations"),
          where("createdBy", "==", profile.id),
          where("createdAt", ">=", startOfMonth.toISOString())
        );
        const givenSnap = await getDocs(givenKudosQuery);
        let totalGiven = 0;
        givenSnap.forEach(doc => {
          totalGiven += doc.data().ruleScore || 0;
        });

        if (totalGiven + selectedRule.score > 5) {
          toast.error(`Bạn chỉ còn có thể tặng ${5 - totalGiven} điểm Kudos trong tháng này (Tối đa 5đ/tháng).`);
          setIsSubmitting(false);
          return;
        }
      }

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
        teacherDepartment: selectedTeacher.department || "Chưa phân tổ",
        ruleId: selectedRule.id,
        ruleName: selectedRule.name,
        ruleScore: selectedRule.score,
        type: selectedRule.type,
        evidenceUrl: evidenceUrl,
        note: note,
        status: profile.role === "TEACHER" ? "APPROVED" : "PENDING_APPEAL", // Peer Kudos được duyệt ngay
        createdAt: createdAt.toISOString(),
        deadlineAt: deadlineAt.toISOString(),
        createdBy: profile.id,
        createdByName: profile.fullName
      });

      // Tạo thông báo in-app
      await addDoc(collection(db, "notifications"), {
        userId: selectedTeacher.uid,
        title: selectedRule.type === "KUDOS" ? "🎉 Bạn nhận được điểm thưởng mới" : "⚠️ Bạn có 1 biên bản trừ điểm mới",
        message: `Đánh giá: ${selectedRule.name} (${selectedRule.score > 0 ? '+' : ''}${selectedRule.score} điểm) từ ${profile.fullName}.`,
        read: false,
        link: "/dashboard/evaluations",
        createdAt: new Date().toISOString()
      });

      toast.success("Tạo đánh giá thành công! Hạn chót khiếu nại là 48h tới.");

      // Gửi email thông báo
      const targetTeacher = teachers.find(t => t.id === selectedTeacherId);
      if (targetTeacher) {
        try {
          await fetch('/api/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: targetTeacher.email,
              subject: `[PEM] Thông báo điểm KPI mới: ${selectedRule.name}`,
              html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                  <h2 style="color: #2563eb;">Thông báo Biến động KPI</h2>
                  <p>Xin chào <strong>${targetTeacher.fullName}</strong>,</p>
                  <p>Bạn vừa nhận được một phiếu đánh giá mới từ <strong>${profile.fullName}</strong>.</p>
                  <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid ${selectedRule.type === 'KUDOS' ? '#16a34a' : '#dc2626'}">
                    <p><strong>Nội dung:</strong> ${selectedRule.name}</p>
                    <p><strong>Loại:</strong> ${selectedRule.type === 'KUDOS' ? '<span style="color: #16a34a; font-weight: bold;">THƯỞNG</span>' : '<span style="color: #dc2626; font-weight: bold;">PHẠT</span>'}</p>
                    <p><strong>Điểm:</strong> <strong style="color: ${selectedRule.type === 'KUDOS' ? '#16a34a' : '#dc2626'}">${selectedRule.type === 'KUDOS' ? '+' : ''}${selectedRule.score} điểm</strong></p>
                    <p><strong>Ghi chú:</strong> ${note || 'Không có'}</p>
                  </div>
                  <p>Vui lòng đăng nhập vào hệ thống PEM để xem chi tiết. Nếu là phiếu PHẠT, bạn có 48 giờ để khiếu nại.</p>
                </div>
              `
            })
          });
        } catch (e) {
          console.warn("Lỗi khi gửi email:", e);
        }
      }

      router.push("/dashboard/evaluations");

    } catch (error: any) {
      console.error("Submit evaluation error:", error);
      toast.error("Lỗi khi tạo đánh giá: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "BGH", "TTCM", "TPCM"]}>
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
                    <option value="" disabled>-- Chọn người nhận đánh giá --</option>
                    {teachers.map(t => (
                      <option key={t.id} value={t.id}>{t.fullName} ({t.email}) - {t.role}</option>
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

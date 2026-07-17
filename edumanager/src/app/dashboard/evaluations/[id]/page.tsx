"use client";

import React, { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { db, storage } from "@/lib/firebase/client";
import { doc, getDoc, collection, query, where, getDocs, addDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { useAuth } from "@/contexts/AuthContext";
import { useParams, useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, ArrowLeft, Upload, CheckCircle, XCircle, AlertTriangle, FileText, Clock } from "lucide-react";
import Link from "next/link";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

export default function EvaluationDetailPage() {
  const { profile, actualProfile } = useAuth();
  const params = useParams();
  const router = useRouter();
  const evalId = params.id as string;

  const [evaluation, setEvaluation] = useState<any>(null);
  const [appeal, setAppeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Form states for Appeal
  const [reason, setReason] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchData = async () => {
    try {
      const docRef = doc(db, "evaluations", evalId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const evalData = { id: docSnap.id, ...docSnap.data() } as any;
        setEvaluation(evalData);

        // Nếu trạng thái là APPEALED hoặc cao hơn, thử tìm khiếu nại
        if (evalData.status !== "PENDING_APPEAL") {
          const q = query(collection(db, "appeals"), where("evaluationId", "==", evalId));
          const querySnapshot = await getDocs(q);
          if (!querySnapshot.empty) {
            setAppeal({ id: querySnapshot.docs[0].id, ...querySnapshot.docs[0].data() });
          }
        }
      } else {
        toast.error("Không tìm thấy phiếu đánh giá!");
        router.push("/dashboard/evaluations");
      }
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi tải chi tiết đánh giá.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchData();
    }
  }, [profile, evalId]);

  const handleAppealSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("Vui lòng nhập lý do khiếu nại.");
      return;
    }

    setIsSubmitting(true);
    try {
      let evidenceUrl = "";
      if (file) {
        const fileRef = ref(storage, `appeals/${Date.now()}_${file.name}`);
        const uploadResult = await uploadBytes(fileRef, file);
        evidenceUrl = await getDownloadURL(uploadResult.ref);
      }

      // 1. Tạo document Appeal
      await addDoc(collection(db, "appeals"), {
        evaluationId: evalId,
        reason,
        evidenceUrl,
        createdAt: new Date().toISOString()
      });

      // 2. Cập nhật status của Evaluation thành APPEALED
      await updateDoc(doc(db, "evaluations", evalId), {
        status: "APPEALED"
      });

      // 3. Gửi thông báo cho người lập phiếu
      if (evaluation.createdBy) {
        await addDoc(collection(db, "notifications"), {
          userId: evaluation.createdBy,
          title: "🚨 Khiếu nại mới từ Giáo viên",
          message: `Giáo viên ${evaluation.teacherName} vừa gửi khiếu nại về phiếu đánh giá: ${evaluation.ruleName}.`,
          read: false,
          link: `/dashboard/evaluations/${evalId}`,
          createdAt: new Date().toISOString()
        });

        // Tìm email của người lập phiếu để gửi email
        try {
          const creatorDoc = await getDoc(doc(db, "users", evaluation.createdBy));
          if (creatorDoc.exists()) {
            const creatorEmail = creatorDoc.data().email;
            if (creatorEmail) {
              await fetch('/api/emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  to: creatorEmail,
                  subject: `[PEM] Khiếu nại mới từ ${evaluation.teacherName}`,
                  html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                      <h2 style="color: #ea580c;">Thông báo Khiếu nại</h2>
                      <p>Xin chào <strong>${evaluation.createdByName}</strong>,</p>
                      <p>Giáo viên <strong>${evaluation.teacherName}</strong> vừa gửi khiếu nại về phiếu đánh giá mà bạn đã lập.</p>
                      <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid #ea580c;">
                        <p><strong>Quy định:</strong> ${evaluation.ruleName}</p>
                        <p><strong>Lý do khiếu nại:</strong> ${reason}</p>
                      </div>
                      <p>Vui lòng đăng nhập vào hệ thống PEM để xem chi tiết và xử lý (Hủy phạt / Giữ nguyên).</p>
                    </div>
                  `
                })
              });
            }
          }
        } catch (e) {
          console.warn("Lỗi gửi email cho người lập phiếu:", e);
        }
      }

      toast.success("Đã gửi khiếu nại thành công! Chờ BGH/TTCM giải quyết.");
      fetchData();
    } catch (error: any) {
      console.error("Lỗi khiếu nại:", error);
      toast.error("Gửi khiếu nại thất bại: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAcceptEvaluation = async () => {
    if (!confirm("Bạn chắc chắn đồng ý với đánh giá này? Phiếu sẽ được chốt ngay lập tức.")) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "evaluations", evalId), {
        status: "APPROVED"
      });
      toast.success("Đã chốt phiếu đánh giá thành công.");
      fetchData();
    } catch (error: any) {
      console.error("Lỗi đồng ý:", error);
      toast.error("Lỗi khi xử lý.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolveAppeal = async (decision: "APPROVE_EVAL" | "REJECT_EVAL") => {
    // APPROVE_EVAL: Bác bỏ khiếu nại -> Phiếu đánh giá được CHỐT (APPROVED)
    // REJECT_EVAL: Chấp nhận khiếu nại -> Phiếu đánh giá bị HỦY BỎ (REJECTED)
    const newStatus = decision === "APPROVE_EVAL" ? "APPROVED" : "REJECTED";
    
    if (!confirm(`Bạn chắc chắn muốn ${decision === "APPROVE_EVAL" ? "GIỮ NGUYÊN" : "HỦY BỎ"} phiếu đánh giá này?`)) return;

    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "evaluations", evalId), {
        status: newStatus
      });
      toast.success("Đã xử lý khiếu nại thành công.");

      // Tạo thông báo in-app
      if (evaluation) {
        await addDoc(collection(db, "notifications"), {
          userId: evaluation.teacherId,
          title: "🔔 Kết quả Khiếu nại KPI",
          message: `Phiếu đánh giá ${evaluation.ruleName} đã được ${newStatus === 'APPROVED' ? 'GIỮ NGUYÊN (Bác bỏ khiếu nại)' : 'HỦY BỎ (Chấp nhận khiếu nại)'}.`,
          read: false,
          link: `/dashboard/evaluations/${evalId}`,
          createdAt: new Date().toISOString()
        });
      }

      // Gửi email thông báo kết quả
      if (evaluation && evaluation.teacherEmail) {
        try {
          await fetch('/api/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              to: evaluation.teacherEmail,
              subject: `[PEM] Kết quả Khiếu nại KPI`,
              html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
                  <h2 style="color: #2563eb;">Kết quả Xử lý Khiếu nại</h2>
                  <p>Xin chào <strong>${evaluation.teacherName}</strong>,</p>
                  <p>Ban giám hiệu đã xem xét khiếu nại của bạn về phiếu đánh giá: <strong>${evaluation.ruleName}</strong>.</p>
                  <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 15px 0; border-left: 4px solid ${newStatus === 'APPROVED' ? '#dc2626' : '#16a34a'}">
                    <p><strong>Kết quả:</strong> ${newStatus === 'APPROVED' ? '<span style="color: #dc2626; font-weight: bold;">BÁC BỎ KHIẾU NẠI (GIỮ NGUYÊN ĐÁNH GIÁ)</span>' : '<span style="color: #16a34a; font-weight: bold;">CHẤP NHẬN KHIẾU NẠI (HỦY ĐÁNH GIÁ)</span>'}</p>
                  </div>
                  <p>Vui lòng đăng nhập vào hệ thống PEM để kiểm tra KPI hiện tại của bạn.</p>
                </div>
              `
            })
          });
        } catch (e) {
          console.warn("Lỗi gửi email:", e);
        }
      }

      fetchData();
    } catch (error: any) {
      console.error("Lỗi xử lý:", error);
      toast.error("Xử lý thất bại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSilentDelete = async () => {
    if (!confirm("BÀN TAY VÔ HÌNH: Bạn chắc chắn muốn xóa vĩnh viễn phiếu này không để lại dấu vết?")) return;
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, "evaluations", evalId));
      toast.success("Đã xóa phiếu không để lại dấu vết.");
      router.push("/dashboard/evaluations");
    } catch (error) {
      toast.error("Lỗi xóa phiếu");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSilentReset = async () => {
    if (!confirm("BÀN TAY VÔ HÌNH: Bạn chắc chắn muốn reset điểm phạt/thưởng của phiếu này về 0?")) return;
    setIsSubmitting(true);
    try {
      await updateDoc(doc(db, "evaluations", evalId), {
        ruleScore: 0
      });
      toast.success("Đã reset điểm về 0 không để lại dấu vết.");
      fetchData();
    } catch (error) {
      toast.error("Lỗi reset điểm");
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>;
  if (!evaluation) return null;

  const isTeacher = profile?.role === "TEACHER";
  let canResolve = false;
  if (profile?.role === "ADMIN" || profile?.role === "BGH") {
    canResolve = true;
  } else if (profile?.role === "TTCM" || profile?.role === "TPCM") {
    canResolve = evaluation.teacherDepartment === profile.department && evaluation.teacherId !== profile.id;
  }
  // Kiểm tra quá hạn khiếu nại (48h)
  const isOverdue = new Date() > new Date(evaluation.deadlineAt);

  return (
    <ProtectedRoute>
      <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Link href="/dashboard/evaluations" className="text-slate-500 hover:text-blue-600 font-medium transition flex items-center">
          <ArrowLeft size={20} className="mr-1" /> Quay lại danh sách
        </Link>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h1 className="text-2xl font-bold text-slate-800">Chi tiết Phiếu đánh giá</h1>
            <span className={`px-4 py-1.5 rounded-full text-sm font-bold shadow-sm ${
              evaluation.status === "PENDING_APPEAL" ? "bg-yellow-100 text-yellow-700" :
              evaluation.status === "APPEALED" ? "bg-orange-100 text-orange-700" :
              evaluation.status === "APPROVED" ? "bg-green-100 text-green-700" :
              "bg-gray-100 text-gray-700"
            }`}>
              {evaluation.status === "PENDING_APPEAL" ? "ĐANG CHỜ KHIẾU NẠI (48H)" :
               evaluation.status === "APPEALED" ? "ĐANG KHIẾU NẠI" :
               evaluation.status === "APPROVED" ? "ĐÃ CHỐT" : "ĐÃ HỦY BỎ"}
            </span>
          </div>

          <div className="p-8 space-y-6">
            {/* Thông tin phiếu */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-100">
              <div>
                <p className="text-sm text-slate-500 font-medium mb-1">Giáo viên nhận đánh giá</p>
                <p className="font-bold text-lg text-slate-800">{evaluation.teacherName}</p>
                <p className="text-sm text-slate-600">{evaluation.teacherEmail}</p>
              </div>
              <div>
                <p className="text-sm text-slate-500 font-medium mb-1">Người lập phiếu</p>
                <p className="font-bold text-lg text-slate-800">{evaluation.createdByName}</p>
                <p className="text-sm text-slate-600">{format(new Date(evaluation.createdAt), "dd/MM/yyyy HH:mm", { locale: vi })}</p>
              </div>
              <div className="md:col-span-2 pt-4 border-t border-slate-200">
                <p className="text-sm text-slate-500 font-medium mb-2">Nội dung Quy định</p>
                <div className="flex flex-col space-y-4">
                  <div className="flex-1 space-y-4">
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">{evaluation.ruleName}</h2>
                    <p className="text-sm text-slate-500 mt-1">
                      Phân loại: <span className="font-semibold">{evaluation.type === "PENALTY" ? "Phạt điểm" : "Tặng điểm"}</span>
                    </p>
                  </div>
                  <div>
                    <div className="text-3xl font-black text-slate-800 flex items-center">
                      <span className={evaluation.type === "PENALTY" ? "text-red-600" : "text-green-600"}>
                        {evaluation.type === "PENALTY" ? evaluation.ruleScore : `+${evaluation.ruleScore}`}
                      </span>
                      <span className="text-lg font-medium text-slate-500 ml-2">điểm</span>
                    </div>
                  </div>
                </div>

                {/* Super Admin Silent Moderation Controls */}
                {actualProfile?.role === "SUPER_ADMIN" && (
                  <div className="bg-slate-900 rounded-xl p-4 mt-4 shadow-inner border border-slate-700">
                    <h3 className="text-slate-300 font-semibold mb-3 flex items-center text-sm uppercase tracking-wide">
                      <AlertTriangle size={16} className="mr-2 text-amber-500" />
                      Quyền lực Tối thượng
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={handleSilentReset}
                        disabled={isSubmitting || evaluation.ruleScore === 0}
                        className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 px-3 rounded-lg border border-slate-600 transition-colors text-sm disabled:opacity-50"
                      >
                        Reset điểm về 0
                      </button>
                      <button
                        onClick={handleSilentDelete}
                        disabled={isSubmitting}
                        className="flex-1 bg-red-900/50 hover:bg-red-800 text-red-100 font-medium py-2 px-3 rounded-lg border border-red-800 transition-colors text-sm disabled:opacity-50"
                      >
                        Xóa Vĩnh viễn (Bốc hơi)
                      </button>
                    </div>
                  </div>
                )}
              </div>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-slate-500 font-medium mb-1">Ghi chú diễn giải</p>
                <p className="text-slate-700 bg-white p-4 rounded-lg border border-slate-200 whitespace-pre-wrap">{evaluation.note}</p>
              </div>
              {evaluation.evidenceUrl && (
                <div className="md:col-span-2">
                  <a href={evaluation.evidenceUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center font-medium">
                    <FileText size={18} className="mr-1" /> Xem tệp minh chứng đính kèm
                  </a>
                </div>
              )}
            </div>

            {/* Vùng Phản hồi của Giáo viên (Dành cho Giáo viên khi PENDING_APPEAL) */}
            {isTeacher && evaluation.status === "PENDING_APPEAL" && !isOverdue && (
              <div className="border-2 border-orange-200 bg-orange-50/50 p-6 rounded-xl mt-8">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-orange-800 flex items-center">
                    <AlertTriangle className="mr-2" />
                    Bạn có muốn khiếu nại phiếu đánh giá này không?
                  </h3>
                  <button
                    onClick={handleAcceptEvaluation}
                    disabled={isSubmitting}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-lg transition-colors flex items-center shadow-md disabled:opacity-50"
                  >
                    <CheckCircle className="mr-2" size={18} />
                    Đồng ý đánh giá
                  </button>
                </div>
                <p className="text-orange-700 text-sm mb-4">
                  Hạn chót khiếu nại: <strong>{format(new Date(evaluation.deadlineAt), "dd/MM/yyyy HH:mm", { locale: vi })}</strong>
                </p>
                <form onSubmit={handleAppealSubmit} className="space-y-4">
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    className="w-full p-3 border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                    placeholder="Nhập lý do khiếu nại chi tiết..."
                    required
                    rows={3}
                  />
                  <div>
                    <label className="block text-sm font-medium text-orange-800 mb-2">Tải lên minh chứng (Tùy chọn)</label>
                    <input 
                      type="file" 
                      onChange={(e) => setFile(e.target.files ? e.target.files[0] : null)}
                      className="text-sm text-orange-700"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-6 rounded-lg transition-colors flex items-center shadow-md disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin mr-2" size={20} /> : "Gửi khiếu nại"}
                  </button>
                </form>
              </div>
            )}

            {isTeacher && evaluation.status === "PENDING_APPEAL" && isOverdue && (
              <div className="p-4 bg-gray-100 rounded-lg text-gray-600 font-medium text-center">
                Đã hết hạn khiếu nại (Quá 48 giờ). Phiếu này sắp được hệ thống tự động chốt.
              </div>
            )}

            {/* Vùng Xem Khiếu nại (Khi trạng thái là APPEALED hoặc đã xử lý) */}
            {appeal && (
              <div className="border border-slate-200 bg-white p-6 rounded-xl mt-8 shadow-sm">
                <h3 className="text-lg font-bold text-slate-800 mb-4 pb-3 border-b border-slate-100">Thông tin Khiếu nại của Giáo viên</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-slate-500 font-medium mb-1">Thời gian gửi</p>
                    <p className="font-medium text-slate-800">{format(new Date(appeal.createdAt), "dd/MM/yyyy HH:mm", { locale: vi })}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-500 font-medium mb-1">Lý do khiếu nại</p>
                    <p className="text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-100 whitespace-pre-wrap">{appeal.reason}</p>
                  </div>
                  {appeal.evidenceUrl && (
                    <a href={appeal.evidenceUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center font-medium">
                      <FileText size={18} className="mr-1" /> Xem tệp minh chứng khiếu nại
                    </a>
                  )}
                </div>

                {/* Nút Xử lý cho BGH / TTCM */}
                {canResolve && evaluation.status === "APPEALED" && (
                  <div className="mt-6 pt-6 border-t border-slate-100 flex gap-4">
                    <button
                      onClick={() => handleResolveAppeal("REJECT_EVAL")}
                      disabled={isSubmitting}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center shadow-sm disabled:opacity-50"
                    >
                      <CheckCircle className="mr-2" size={20} />
                      Đồng ý khiếu nại (Hủy phạt)
                    </button>
                    <button
                      onClick={() => handleResolveAppeal("APPROVE_EVAL")}
                      disabled={isSubmitting}
                      className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex items-center justify-center shadow-sm disabled:opacity-50"
                    >
                      <XCircle className="mr-2" size={20} />
                      Bác bỏ khiếu nại (Giữ phạt)
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

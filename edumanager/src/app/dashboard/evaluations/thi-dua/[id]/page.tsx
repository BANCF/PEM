"use client";

import React, { useState, useEffect, use } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  THI_DUA_CRITERIA_GROUPS, 
  TOTAL_MAX_SCORE, 
  CriteriaGroup, 
  CriteriaItem 
} from "@/lib/constants/thiDuaCriteria";
import { 
  teacherThiDuaService, 
  TeacherThiDuaEvaluation, 
  CriteriaScoreValue 
} from "@/lib/services/teacherThiDua.service";
import { 
  ArrowLeft, 
  Save, 
  Send, 
  CheckCircle2, 
  Printer, 
  Award, 
  FileCheck, 
  AlertCircle,
  Loader2
} from "lucide-react";
import toast from "react-hot-toast";
import { sendNotification } from "@/lib/services/notification.service";

export default function ThiDuaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { profile } = useAuth();
  const router = useRouter();

  const isNew = id === "new";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [month, setMonth] = useState(`${new Date().getMonth() + 1}/${new Date().getFullYear()}`);
  const [teacherName, setTeacherName] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("Giáo viên");
  const [status, setStatus] = useState<TeacherThiDuaEvaluation["status"]>("DRAFT");

  const [scores, setScores] = useState<Record<string, CriteriaScoreValue>>({});
  const [ranking, setRanking] = useState<string>("Loại A");
  const [selfNote, setSelfNote] = useState("");
  const [ttcmNote, setTtcmNote] = useState("");
  const [bghNote, setBghNote] = useState("");

  useEffect(() => {
    const initData = async () => {
      if (!profile) return;

      if (isNew) {
        setTeacherName(profile.fullName);
        setDepartment(profile.department || "Tổ Chuyên Môn");
        
        // Initialize default max scores
        const initialScores: Record<string, CriteriaScoreValue> = {};
        THI_DUA_CRITERIA_GROUPS.forEach(g => {
          g.items.forEach(item => {
            initialScores[item.id] = {
              self: item.options[0]?.score ?? item.maxScore,
              ttcm: item.options[0]?.score ?? item.maxScore,
              bgh: item.options[0]?.score ?? item.maxScore,
            };
          });
        });
        setScores(initialScores);
        setLoading(false);
      } else {
        try {
          const evalData = await teacherThiDuaService.getEvaluationById(id);
          if (evalData) {
            setTeacherName(evalData.teacherName);
            setDepartment(evalData.department || "");
            setPosition(evalData.position || "Giáo viên");
            setMonth(evalData.month);
            setStatus(evalData.status);
            setRanking(evalData.ranking || "Loại A");
            setSelfNote(evalData.selfNote || "");
            setTtcmNote(evalData.ttcmNote || "");
            setBghNote(evalData.bghNote || "");

            // Merge existing scores with full criteria defaults
            const mergedScores: Record<string, CriteriaScoreValue> = {};
            THI_DUA_CRITERIA_GROUPS.forEach(g => {
              g.items.forEach(item => {
                const existing = evalData.scores?.[item.id];
                mergedScores[item.id] = {
                  self: existing?.self ?? item.options[0]?.score ?? item.maxScore,
                  ttcm: existing?.ttcm ?? item.options[0]?.score ?? item.maxScore,
                  bgh: existing?.bgh ?? item.options[0]?.score ?? item.maxScore,
                };
              });
            });
            setScores(mergedScores);
          } else {
            toast.error("Không tìm thấy phiếu đánh giá");
            router.push("/dashboard/evaluations");
          }
        } catch (e) {
          console.error(e);
          toast.error("Lỗi khi tải phiếu đánh giá");
        } finally {
          setLoading(false);
        }
      }
    };

    initData();
  }, [id, profile, isNew, router]);

  // Role checks
  const isTeacher = profile?.role === "TEACHER";
  const isTTCM = profile?.role === "TTCM" || profile?.role === "TPCM";
  const isBGHOrAdmin = profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN" || profile?.role === "BGH";

  // Editable rules based on status & role
  const canEditSelf = isTeacher && (status === "DRAFT" || status === "SUBMITTED_GV");
  const canEditTTCM = (isTTCM || isBGHOrAdmin) && (status === "SUBMITTED_GV" || status === "REVIEWED_TTCM");
  const canEditBGH = isBGHOrAdmin;

  // Calculate totals
  const totalSelf = Object.values(scores).reduce((acc, curr) => acc + (curr.self || 0), 0);
  const totalTtcm = Object.values(scores).reduce((acc, curr) => acc + (curr.ttcm || 0), 0);
  const totalBgh = Object.values(scores).reduce((acc, curr) => acc + (curr.bgh || 0), 0);

  const handleScoreChange = (criteriaId: string, field: "self" | "ttcm" | "bgh", value: number) => {
    setScores(prev => ({
      ...prev,
      [criteriaId]: {
        ...prev[criteriaId],
        [field]: value
      }
    }));
  };

  const handleSave = async (targetStatus: TeacherThiDuaEvaluation["status"]) => {
    if (!profile) return;
    setSaving(true);

    try {
      const year = parseInt(month.split("/")[1] || `${new Date().getFullYear()}`);
      
      const payload: Partial<TeacherThiDuaEvaluation> = {
        ...(isNew ? {} : { id }),
        teacherId: profile.id,
        teacherName: teacherName || profile.fullName,
        department,
        position,
        month,
        year,
        periodType: "MONTH",
        status: targetStatus,
        scores,
        totalSelfScore: totalSelf,
        totalTtcmScore: totalTtcm,
        totalBghScore: totalBgh,
        ranking,
        selfNote,
        ttcmNote,
        bghNote,
      };

      if (targetStatus === "SUBMITTED_GV") {
        payload.submittedGvAt = new Date().toISOString();
      } else if (targetStatus === "REVIEWED_TTCM") {
        payload.reviewedTtcmAt = new Date().toISOString();
        payload.reviewedTtcmBy = profile.fullName;
      } else if (targetStatus === "APPROVED_BGH") {
        payload.approvedBghAt = new Date().toISOString();
        payload.approvedBghBy = profile.fullName;
      }

      const savedId = await teacherThiDuaService.saveEvaluation(payload);

      // Gửi thông báo Push ngầm trực tiếp về điện thoại cho các bên
      if (targetStatus === "APPROVED_BGH" && payload.teacherId) {
        sendNotification({
          userId: payload.teacherId,
          title: "🏆 BGH đã phê duyệt phiếu thi đua",
          message: `BGH đã duyệt chốt điểm thi đua tháng ${month} cho bạn (Xếp loại: ${ranking}).`,
          link: `/dashboard/evaluations/thi-dua/${savedId}`
        });
      } else if (targetStatus === "REVIEWED_TTCM" && payload.teacherId) {
        sendNotification({
          userId: payload.teacherId,
          title: "📝 TTCM đã đánh giá phiếu thi đua",
          message: `TTCM ${profile.fullName} đã hoàn thành đánh giá lại phiếu thi đua tháng ${month} của bạn.`,
          link: `/dashboard/evaluations/thi-dua/${savedId}`
        });
      }

      toast.success(
        targetStatus === "APPROVED_BGH" ? "BGH đã duyệt chốt phiếu thi đua thành công!" :
        targetStatus === "REVIEWED_TTCM" ? "TTCM đã duyệt phiếu thành công!" :
        targetStatus === "SUBMITTED_GV" ? "Đã gửi bản tự đánh giá cho TTCM!" :
        "Đã lưu nháp thành công!"
      );

      if (isNew) {
        router.push(`/dashboard/evaluations/thi-dua/${savedId}`);
      } else {
        setStatus(targetStatus);
      }
    } catch (e) {
      console.error(e);
      toast.error("Đã xảy ra lỗi khi lưu phiếu đánh giá");
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case "DRAFT":
        return <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-semibold">Nháp</span>;
      case "SUBMITTED_GV":
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full text-xs font-semibold">Chờ TTCM Duyệt</span>;
      case "REVIEWED_TTCM":
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1 rounded-full text-xs font-semibold">Chờ BGH Phê Duyệt</span>;
      case "APPROVED_BGH":
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1 rounded-full text-xs font-semibold">Đã Chốt & Duyệt</span>;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="flex justify-center items-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Header Navigation */}
        <div className="flex items-center justify-between bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <Link 
              href="/dashboard/evaluations"
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl transition-colors"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold text-slate-800">
                  {isNew ? "Tạo Phiếu Đánh Giá Thi Đua" : `Phiếu Đánh Giá Thi Đua - ${teacherName}`}
                </h1>
                {getStatusBadge(status)}
              </div>
              <p className="text-slate-500 text-sm mt-1">Trường Tiểu học & THCS Pascal • Bộ đánh giá theo tháng (Tối đa 210 điểm)</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!isNew && (
              <a
                href={`/dashboard/print/teacher-evaluation/${id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-xl font-medium text-sm transition-colors"
              >
                <Printer size={18} />
                <span>Xem Bản In (A4/PDF)</span>
              </a>
            )}
          </div>
        </div>

        {/* General Info Card */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Họ và Tên GV</label>
            <input 
              type="text"
              value={teacherName}
              onChange={e => setTeacherName(e.target.value)}
              disabled={!isNew && !isBGHOrAdmin}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Tổ công tác</label>
            <input 
              type="text"
              value={department}
              onChange={e => setDepartment(e.target.value)}
              disabled={!isNew && !isBGHOrAdmin}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
              placeholder="VD: Tổ Tiếng Anh / Tổ Toán"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Tháng Đánh Giá</label>
            <input 
              type="text"
              value={month}
              onChange={e => setMonth(e.target.value)}
              disabled={!isNew && !isBGHOrAdmin}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800 font-medium focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
              placeholder="MM/YYYY (VD: 09/2026)"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Xếp Loại Final (BGH)</label>
            <select
              value={ranking}
              onChange={e => setRanking(e.target.value)}
              disabled={!canEditBGH}
              className="w-full px-3 py-2 border border-slate-200 rounded-xl text-slate-800 font-bold bg-amber-50 text-amber-900 border-amber-200 focus:ring-2 focus:ring-blue-500 disabled:opacity-80"
            >
              <option value="Loại A">Loại A (Xuất sắc)</option>
              <option value="Loại B">Loại B (Tốt)</option>
              <option value="Loại C">Loại C (Khá)</option>
              <option value="Loại D">Loại D (Cần cố gắng)</option>
            </select>
          </div>
        </div>

        {/* Total Score Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-blue-50/70 border border-blue-200 p-5 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-blue-600 uppercase tracking-wider">Cá nhân tự chấm</p>
              <h3 className="text-3xl font-black text-blue-900 mt-1">{totalSelf} <span className="text-sm font-normal text-blue-600">/ 210</span></h3>
            </div>
            <Award className="w-10 h-10 text-blue-400 opacity-80" />
          </div>

          <div className="bg-amber-50/70 border border-amber-200 p-5 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-amber-600 uppercase tracking-wider">TTCM / TPCM đánh giá</p>
              <h3 className="text-3xl font-black text-amber-900 mt-1">{totalTtcm} <span className="text-sm font-normal text-amber-600">/ 210</span></h3>
            </div>
            <Award className="w-10 h-10 text-amber-400 opacity-80" />
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200 p-5 rounded-2xl flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Ban Giám Hiệu chốt</p>
              <h3 className="text-3xl font-black text-emerald-900 mt-1">{totalBgh} <span className="text-sm font-normal text-emerald-600">/ 210</span></h3>
            </div>
            <Award className="w-10 h-10 text-emerald-400 opacity-80" />
          </div>
        </div>

        {/* Detailed Evaluation Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
          <div className="p-4 bg-slate-800 text-white font-bold flex justify-between items-center font-sans">
            <span>BẢNG CHI TIẾT CÁC TIÊU CHUẨN THI ĐUA (4 NHÓM tiêu chí)</span>
            <span className="text-xs font-normal text-slate-300">Tổng điểm tối đa: 210 điểm</span>
          </div>

          {/* Desktop View (hidden on mobile) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 border-b text-xs font-bold text-slate-700 uppercase">
                  <th className="p-4 w-1/2">Nội dung các tiêu chuẩn, tiêu chí</th>
                  <th className="p-4 text-center w-24">Điểm TĐ</th>
                  <th className="p-4 text-center w-36 bg-blue-50/50 text-blue-800">Cá nhân tự chấm</th>
                  <th className="p-4 text-center w-36 bg-amber-50/50 text-amber-800">TTCM đánh giá</th>
                  <th className="p-4 text-center w-36 bg-emerald-50/50 text-emerald-800">BGH đánh giá</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {THI_DUA_CRITERIA_GROUPS.map(group => (
                  <React.Fragment key={group.id}>
                    {/* Header Group Row */}
                    <tr className="bg-slate-200/70 font-bold text-slate-900">
                      <td colSpan={2} className="p-3.5 text-slate-800 uppercase">{group.title}</td>
                      <td className="p-3.5 text-center bg-blue-100/50 text-blue-900 font-extrabold">{group.maxScore}đ</td>
                      <td className="p-3.5 text-center bg-amber-100/50 text-amber-900 font-extrabold">{group.maxScore}đ</td>
                      <td className="p-3.5 text-center bg-emerald-100/50 text-emerald-900 font-extrabold">{group.maxScore}đ</td>
                    </tr>

                    {/* Criteria Item Rows */}
                    {group.items.map(item => {
                      const itemScore = scores[item.id] || { self: item.maxScore, ttcm: item.maxScore, bgh: item.maxScore };

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4">
                            <p className="font-semibold text-slate-800 mb-1">{item.title}</p>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {item.options.map(opt => (
                                <span 
                                  key={opt.label}
                                  className={`text-xs px-2 py-0.5 rounded border ${
                                    itemScore.self === opt.score
                                      ? "bg-blue-100 text-blue-800 border-blue-300 font-semibold"
                                      : "bg-slate-50 text-slate-500 border-slate-200"
                                  }`}
                                >
                                  {opt.label} ({opt.score}đ)
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="p-4 text-center font-bold text-slate-600">{item.maxScore}</td>

                          {/* Self Score Select */}
                          <td className="p-3 text-center bg-blue-50/30">
                            <select
                              value={itemScore.self}
                              onChange={e => handleScoreChange(item.id, "self", parseInt(e.target.value))}
                              disabled={!canEditSelf && !isNew}
                              className="w-full text-center py-1.5 px-2 border border-blue-300 rounded-lg font-bold text-blue-900 bg-white focus:ring-2 focus:ring-blue-500 disabled:bg-slate-100 disabled:text-slate-700"
                            >
                              {item.options.map(opt => (
                                <option key={opt.score} value={opt.score}>{opt.score} điểm</option>
                              ))}
                            </select>
                          </td>

                          {/* TTCM Score Select */}
                          <td className="p-3 text-center bg-amber-50/30">
                            <select
                              value={itemScore.ttcm}
                              onChange={e => handleScoreChange(item.id, "ttcm", parseInt(e.target.value))}
                              disabled={!canEditTTCM}
                              className="w-full text-center py-1.5 px-2 border border-amber-300 rounded-lg font-bold text-amber-900 bg-white focus:ring-2 focus:ring-amber-500 disabled:bg-slate-100 disabled:text-slate-700"
                            >
                              {item.options.map(opt => (
                                <option key={opt.score} value={opt.score}>{opt.score} điểm</option>
                              ))}
                            </select>
                          </td>

                          {/* BGH Score Select */}
                          <td className="p-3 text-center bg-emerald-50/30">
                            <select
                              value={itemScore.bgh}
                              onChange={e => handleScoreChange(item.id, "bgh", parseInt(e.target.value))}
                              disabled={!canEditBGH}
                              className="w-full text-center py-1.5 px-2 border border-emerald-300 rounded-lg font-bold text-emerald-900 bg-white focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-700"
                            >
                              {item.options.map(opt => (
                                <option key={opt.score} value={opt.score}>{opt.score} điểm</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View (visible only on mobile screens < md) */}
          <div className="block md:hidden divide-y divide-slate-200 p-4 space-y-6 font-sans">
            {THI_DUA_CRITERIA_GROUPS.map(group => (
              <div key={group.id} className="pt-4 first:pt-0 space-y-4">
                <div className="bg-slate-100 p-3 rounded-xl font-bold text-slate-800 text-sm uppercase flex justify-between items-center">
                  <span>{group.title}</span>
                  <span className="bg-blue-600 text-white text-xs px-2.5 py-0.5 rounded-full font-bold">{group.maxScore}đ</span>
                </div>

                <div className="space-y-4">
                  {group.items.map(item => {
                    const itemScore = scores[item.id] || { self: item.maxScore, ttcm: item.maxScore, bgh: item.maxScore };

                    return (
                      <div key={item.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                        <div className="flex justify-between items-start gap-2">
                          <p className="font-bold text-slate-800 text-sm">{item.title}</p>
                          <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-semibold shrink-0">
                            TĐ: {item.maxScore}đ
                          </span>
                        </div>

                        {/* Options list as selectable full-width buttons */}
                        <div className="space-y-2 pt-1">
                          <label className="block text-[11px] font-bold text-slate-500 uppercase">Chọn mức đánh giá tự chấm:</label>
                          {item.options.map(opt => {
                            const isSelected = itemScore.self === opt.score;
                            return (
                              <button
                                key={opt.label}
                                type="button"
                                disabled={!canEditSelf && !isNew}
                                onClick={() => handleScoreChange(item.id, "self", opt.score)}
                                className={`w-full text-left p-3 rounded-xl border text-xs transition flex justify-between items-center ${
                                  isSelected 
                                    ? "bg-blue-50 border-blue-500 text-blue-900 font-bold ring-2 ring-blue-500/20" 
                                    : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                                }`}
                              >
                                <span className="pr-2 leading-relaxed">{opt.label}</span>
                                <span className={`px-2.5 py-1 rounded-lg font-extrabold text-xs shrink-0 ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                                  {opt.score}đ
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {/* TTCM & BGH Inputs for mobile */}
                        {(canEditTTCM || canEditBGH || !canEditSelf) && (
                          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200 text-xs">
                            <div className="bg-amber-50/70 p-2.5 rounded-xl border border-amber-200">
                              <span className="block font-bold text-amber-900 mb-1">TTCM chấm:</span>
                              <select
                                value={itemScore.ttcm}
                                onChange={e => handleScoreChange(item.id, "ttcm", parseInt(e.target.value))}
                                disabled={!canEditTTCM}
                                className="w-full text-center py-1.5 px-2 border border-amber-300 rounded-lg font-bold text-amber-900 bg-white disabled:bg-slate-100"
                              >
                                {item.options.map(opt => (
                                  <option key={opt.score} value={opt.score}>{opt.score}đ</option>
                                ))}
                              </select>
                            </div>

                            <div className="bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-200">
                              <span className="block font-bold text-emerald-900 mb-1">BGH chốt:</span>
                              <select
                                value={itemScore.bgh}
                                onChange={e => handleScoreChange(item.id, "bgh", parseInt(e.target.value))}
                                disabled={!canEditBGH}
                                className="w-full text-center py-1.5 px-2 border border-emerald-300 rounded-lg font-bold text-emerald-900 bg-white disabled:bg-slate-100"
                              >
                                {item.options.map(opt => (
                                  <option key={opt.score} value={opt.score}>{opt.score}đ</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Notes & Approval Actions */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 space-y-6">
          <h3 className="font-bold text-slate-800 text-lg border-b pb-3">Ý Kiến Nhận Xét & Phê Duyệt</h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-bold text-blue-700 uppercase mb-2">Ý kiến của Người tự đánh giá</label>
              <textarea 
                rows={3}
                value={selfNote}
                onChange={e => setSelfNote(e.target.value)}
                disabled={!canEditSelf && !isNew}
                placeholder="Nhập ghi chú hoặc tự nhận xét..."
                className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-amber-700 uppercase mb-2">Nhận xét của Tổ trưởng chuyên môn</label>
              <textarea 
                rows={3}
                value={ttcmNote}
                onChange={e => setTtcmNote(e.target.value)}
                disabled={!canEditTTCM}
                placeholder="Nhận xét của TTCM/TPCM..."
                className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-amber-500 disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-700 uppercase mb-2">Nhận xét của Ban Giám Hiệu</label>
              <textarea 
                rows={3}
                value={bghNote}
                onChange={e => setBghNote(e.target.value)}
                disabled={!canEditBGH}
                placeholder="Đánh giá & chỉ đạo của BGH..."
                className="w-full p-3 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-50"
              />
            </div>
          </div>

          {/* Workflow Buttons */}
          <div className="flex flex-wrap items-center justify-end gap-4 pt-4 border-t border-slate-100">
            {/* Draft button */}
            {(canEditSelf || isNew) && (
              <button
                type="button"
                onClick={() => handleSave("DRAFT")}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium transition-all disabled:opacity-50"
              >
                <Save size={18} />
                <span>Lưu Nháp</span>
              </button>
            )}

            {/* GV Submit button */}
            {(canEditSelf || isNew) && (
              <button
                type="button"
                onClick={() => handleSave("SUBMITTED_GV")}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all shadow-md shadow-blue-500/20 disabled:opacity-50"
              >
                <Send size={18} />
                <span>Gửi Tự Đánh Giá (Cho TTCM)</span>
              </button>
            )}

            {/* TTCM Approve button */}
            {canEditTTCM && (
              <button
                type="button"
                onClick={() => handleSave("REVIEWED_TTCM")}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-medium transition-all shadow-md shadow-amber-500/20 disabled:opacity-50"
              >
                <FileCheck size={18} />
                <span>TTCM Duyệt & Gửi BGH</span>
              </button>
            )}

            {/* BGH Approve button */}
            {canEditBGH && (
              <button
                type="button"
                onClick={() => handleSave("APPROVED_BGH")}
                disabled={saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50"
              >
                <CheckCircle2 size={18} />
                <span>BGH Chốt & Phê Duyệt</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

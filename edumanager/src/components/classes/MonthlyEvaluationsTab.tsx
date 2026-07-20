"use client";

import React, { useState, useEffect } from "react";
import { StudentData } from "@/lib/services/student.service";
import { ClassData } from "@/lib/services/class.service";
import { ClassAssignmentData } from "@/lib/services/assignment.service";
import { MonthlyEvaluationData, monthlyEvaluationService } from "@/lib/services/monthly-evaluation.service";
import { Loader2, Save, Printer } from "lucide-react";
import toast from "react-hot-toast";

interface Props {
  classData: ClassData;
  students: StudentData[];
  assignments: ClassAssignmentData[];
  profile: any;
}

export default function MonthlyEvaluationsTab({ classData, students, assignments, profile }: Props) {
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [evaluations, setEvaluations] = useState<Record<string, MonthlyEvaluationData>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Check roles
  const isAdminOrBGH = profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN" || profile?.role === "BGH";
  
  // Find assignment for current user in this class
  const userAssignments = assignments.filter(a => a.teacherId === profile?.id);
  const isGVCN = userAssignments.some(a => a.role === "GVCN" || a.role === "PCN");
  
  const teachesMath = userAssignments.some(a => a.subject === "Toán");
  const teachesLit = userAssignments.some(a => a.subject === "Ngữ văn" || a.subject === "Văn");
  const teachesEng = userAssignments.some(a => a.subject === "Tiếng Anh" || a.subject === "Anh");

  const canViewAll = isAdminOrBGH || isGVCN;
  
  const showMath = canViewAll || teachesMath;
  const showLit = canViewAll || teachesLit;
  const showEng = canViewAll || teachesEng;

  const canEditMath = isAdminOrBGH || teachesMath || isGVCN;
  const canEditLit = isAdminOrBGH || teachesLit || isGVCN;
  const canEditEng = isAdminOrBGH || teachesEng || isGVCN;

  const fetchEvaluations = async () => {
    setLoading(true);
    try {
      const data = await monthlyEvaluationService.getEvaluationsByClassAndMonth(
        classData.id!,
        classData.academicYear,
        month
      );
      
      const evalMap: Record<string, MonthlyEvaluationData> = {};
      data.forEach(d => {
        evalMap[d.studentId] = d;
      });

      // Initialize empty for students who don't have evaluation yet
      students.forEach(student => {
        if (!evalMap[student.id!]) {
          evalMap[student.id!] = {
            classId: classData.id!,
            studentId: student.id!,
            academicYear: classData.academicYear,
            month: month,
            mathScore: null,
            mathComment: "",
            literatureScore: null,
            literatureComment: "",
            englishScore: null,
            englishComment: "",
          };
        }
      });
      
      setEvaluations(evalMap);
    } catch (error) {
      console.error(error);
      toast.error("Lỗi tải dữ liệu đánh giá tháng.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvaluations();
  }, [month, classData.id, students.length]); // Refresh when month changes

  const handleUpdate = (studentId: string, field: keyof MonthlyEvaluationData, value: string | number | null) => {
    setEvaluations(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const dataToSave = Object.values(evaluations);
      await monthlyEvaluationService.saveEvaluationsBatch(dataToSave);
      toast.success("Lưu đánh giá thành công!");
      fetchEvaluations();
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi lưu đánh giá.");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    const url = `/dashboard/print/monthly-evaluation?classId=${classData.id}&month=${month}`;
    window.open(url, '_blank');
  };

  if (!showMath && !showLit && !showEng && !canViewAll) {
    return (
      <div className="p-8 text-center text-slate-500">
        Bạn không được phân công giảng dạy 3 môn Toán, Văn, Anh ở lớp này nên không thể xem Đánh giá tháng.
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
        <div className="flex items-center gap-2">
          <label className="font-semibold text-slate-700">Tháng đánh giá:</label>
          <select 
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="p-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            Lưu đánh giá
          </button>
          
          {canViewAll && (
            <button
              onClick={handlePrint}
              disabled={loading}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              <Printer size={18} />
              Xuất PDF / In phiếu
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="animate-spin text-blue-500 w-8 h-8" />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="p-3 w-12 text-center border-r border-slate-700">STT</th>
                <th className="p-3 border-r border-slate-700">Họ và tên</th>
                {showMath && <th className="p-3 text-center border-r border-slate-700 min-w-[200px]" colSpan={2}>Toán</th>}
                {showLit && <th className="p-3 text-center border-r border-slate-700 min-w-[200px]" colSpan={2}>Văn</th>}
                {showEng && <th className="p-3 text-center border-r border-slate-700 min-w-[200px]" colSpan={2}>Anh</th>}
              </tr>
              <tr className="bg-slate-700 text-slate-300 text-xs font-semibold">
                <th className="p-2 text-center border-r border-slate-600"></th>
                <th className="p-2 border-r border-slate-600"></th>
                
                {showMath && (
                  <>
                    <th className="p-2 text-center border-r border-slate-600 w-16">Điểm</th>
                    <th className="p-2 text-center border-r border-slate-600">Nhận xét</th>
                  </>
                )}
                {showLit && (
                  <>
                    <th className="p-2 text-center border-r border-slate-600 w-16">Điểm</th>
                    <th className="p-2 text-center border-r border-slate-600">Nhận xét</th>
                  </>
                )}
                {showEng && (
                  <>
                    <th className="p-2 text-center border-r border-slate-600 w-16">Điểm</th>
                    <th className="p-2 text-center border-r border-slate-600">Nhận xét</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {students.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-slate-500">Lớp chưa có học sinh nào.</td>
                </tr>
              ) : (
                students.map((student, index) => {
                  const ev = evaluations[student.id!];
                  if (!ev) return null;

                  return (
                    <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-center text-slate-500 border-r border-slate-100">{index + 1}</td>
                      <td className="p-3 border-r border-slate-100 font-medium text-slate-800">
                        {student.fullName}
                      </td>
                      
                      {/* TOÁN */}
                      {showMath && (
                        <>
                          <td className="p-2 text-center border-r border-slate-100 bg-blue-50/20">
                            <input
                              type="number"
                              min="0" max="10" step="0.1"
                              disabled={!canEditMath}
                              value={ev.mathScore ?? ""}
                              onChange={(e) => handleUpdate(student.id!, "mathScore", e.target.value ? parseFloat(e.target.value) : null)}
                              className="w-full text-center p-1.5 border border-slate-200 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 font-semibold"
                            />
                          </td>
                          <td className="p-2 border-r border-slate-100 bg-blue-50/20">
                            <input
                              type="text"
                              disabled={!canEditMath}
                              value={ev.mathComment}
                              onChange={(e) => handleUpdate(student.id!, "mathComment", e.target.value)}
                              placeholder="Nhận xét Toán..."
                              className="w-full p-1.5 border border-slate-200 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                            />
                          </td>
                        </>
                      )}

                      {/* VĂN */}
                      {showLit && (
                        <>
                          <td className="p-2 text-center border-r border-slate-100 bg-orange-50/20">
                            <input
                              type="number"
                              min="0" max="10" step="0.1"
                              disabled={!canEditLit}
                              value={ev.literatureScore ?? ""}
                              onChange={(e) => handleUpdate(student.id!, "literatureScore", e.target.value ? parseFloat(e.target.value) : null)}
                              className="w-full text-center p-1.5 border border-slate-200 rounded text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 font-semibold"
                            />
                          </td>
                          <td className="p-2 border-r border-slate-100 bg-orange-50/20">
                            <input
                              type="text"
                              disabled={!canEditLit}
                              value={ev.literatureComment}
                              onChange={(e) => handleUpdate(student.id!, "literatureComment", e.target.value)}
                              placeholder="Nhận xét Văn..."
                              className="w-full p-1.5 border border-slate-200 rounded text-sm focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                            />
                          </td>
                        </>
                      )}

                      {/* ANH */}
                      {showEng && (
                        <>
                          <td className="p-2 text-center border-r border-slate-100 bg-emerald-50/20">
                            <input
                              type="number"
                              min="0" max="10" step="0.1"
                              disabled={!canEditEng}
                              value={ev.englishScore ?? ""}
                              onChange={(e) => handleUpdate(student.id!, "englishScore", e.target.value ? parseFloat(e.target.value) : null)}
                              className="w-full text-center p-1.5 border border-slate-200 rounded text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none disabled:bg-slate-100 disabled:text-slate-500 font-semibold"
                            />
                          </td>
                          <td className="p-2 border-r border-slate-100 bg-emerald-50/20">
                            <input
                              type="text"
                              disabled={!canEditEng}
                              value={ev.englishComment}
                              onChange={(e) => handleUpdate(student.id!, "englishComment", e.target.value)}
                              placeholder="Nhận xét Anh..."
                              className="w-full p-1.5 border border-slate-200 rounded text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                            />
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

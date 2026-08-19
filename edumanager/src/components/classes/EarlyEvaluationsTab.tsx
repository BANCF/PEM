"use client";

import React, { useState, useEffect, useRef } from "react";
import { StudentData } from "@/lib/services/student.service";
import { ClassData } from "@/lib/services/class.service";
import { ClassAssignmentData } from "@/lib/services/assignment.service";
import { EarlyEvaluationData, earlyEvaluationService } from "@/lib/services/early-evaluation.service";
import { Loader2, Save, Printer, Download, Upload } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

interface Props {
  classData: ClassData;
  students: StudentData[];
  assignments: ClassAssignmentData[];
  profile: any;
}

export default function EarlyEvaluationsTab({ classData, students, assignments, profile }: Props) {
  const [evaluations, setEvaluations] = useState<Record<string, EarlyEvaluationData>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check roles
  const isAdminOrBGH = profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN" || profile?.role === "BGH";
  
  // Find assignment for current user in this class
  const userAssignments = assignments.filter(a => a.teacherId === profile?.id);
  const isGVCN = userAssignments.some(a => a.role === "GVCN" || a.role === "PCN");
  
  const teachesMath = userAssignments.some(a => a.subject?.toLowerCase() === "toán");
  const teachesLit = userAssignments.some(a => a.subject?.toLowerCase() === "ngữ văn" || a.subject?.toLowerCase() === "văn");
  const teachesEng = userAssignments.some(a => a.subject?.toLowerCase() === "tiếng anh" || a.subject?.toLowerCase() === "anh");

  const canViewAll = isAdminOrBGH || isGVCN;
  
  const showMath = canViewAll || teachesMath;
  const showLit = canViewAll || teachesLit;
  const showEng = canViewAll || teachesEng;

  const canEditMath = isAdminOrBGH || teachesMath || isGVCN;
  const canEditLit = isAdminOrBGH || teachesLit || isGVCN;
  const canEditEng = isAdminOrBGH || teachesEng || isGVCN;
  const canEditBehavior = isAdminOrBGH || isGVCN;

  const fetchEvaluations = async () => {
    setLoading(true);
    try {
      const data = await earlyEvaluationService.getEvaluationsByClass(
        classData.id!,
        classData.academicYear
      );
      
      const evalMap: Record<string, EarlyEvaluationData> = {};
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
            mathScore: null,
            mathComment: "",
            literatureScore: null,
            literatureComment: "",
            englishScore: null,
            englishComment: "",
            behavior: "",
            activity: "",
            learning: "",
            improvement: ""
          };
        }
      });
      
      setEvaluations(evalMap);
    } catch (error) {
      console.error(error);
      toast.error("Lỗi tải dữ liệu nhận xét đầu năm.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvaluations();
  }, [classData.id, students.length]);

  const handleUpdate = (studentId: string, field: keyof EarlyEvaluationData, value: string | number | null) => {
    setEvaluations(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [field]: value
      }
    }));
  };

  const handleSaveAll = async () => {
    setSaving(true);
    try {
      const list = Object.values(evaluations);
      await earlyEvaluationService.saveEvaluationsBatch(list);
      toast.success("Đã lưu dữ liệu thành công!");
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi lưu dữ liệu.");
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.open(`/dashboard/print/early-evaluation?classId=${classData.id}`, '_blank');
  };

  const handleExportExcelTemplate = () => {
    const wsData = [
      ["STT", "Họ và tên", "Môn Toán (Điểm)", "Nhận xét Toán", "Môn Văn (Điểm)", "Nhận xét Văn", "Môn Anh (Điểm)", "Nhận xét Anh", "Đạo đức, tác phong", "Tham gia HĐ, TN", "Về học tập", "Cần khắc phục"]
    ];

    students.forEach((student, index) => {
      const ev = evaluations[student.id!] || {};
      wsData.push([
        String(index + 1),
        student.fullName,
        ev.mathScore?.toString() || "",
        ev.mathComment || "",
        ev.literatureScore?.toString() || "",
        ev.literatureComment || "",
        ev.englishScore?.toString() || "",
        ev.englishComment || "",
        ev.behavior || "",
        ev.activity || "",
        ev.learning || "",
        ev.improvement || ""
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "NhanXetDauNam");
    XLSX.writeFile(wb, `NhanXetDauNam_${classData.name}.xlsx`);
  };

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

        if (data.length <= 1) {
          toast.error("File Excel không có dữ liệu!");
          return;
        }

        const newEvals = { ...evaluations };
        let importCount = 0;

        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length < 2) continue;
          
          const studentName = String(row[1] || "").trim().toLowerCase();
          const student = students.find(s => s.fullName.trim().toLowerCase() === studentName);
          
          if (student) {
            const sid = student.id!;
            const ev = newEvals[sid] || {};
            
            // Only update fields they have permission to edit
            if (canEditMath) {
              const mScore = parseFloat(String(row[2] || "").replace(',', '.'));
              ev.mathScore = !isNaN(mScore) ? mScore : null;
              ev.mathComment = String(row[3] || "");
            }
            if (canEditLit) {
              const lScore = parseFloat(String(row[4] || "").replace(',', '.'));
              ev.literatureScore = !isNaN(lScore) ? lScore : null;
              ev.literatureComment = String(row[5] || "");
            }
            if (canEditEng) {
              const eScore = parseFloat(String(row[6] || "").replace(',', '.'));
              ev.englishScore = !isNaN(eScore) ? eScore : null;
              ev.englishComment = String(row[7] || "");
            }
            if (canEditBehavior) {
              ev.behavior = String(row[8] || "");
              ev.activity = String(row[9] || "");
              ev.learning = String(row[10] || "");
              ev.improvement = String(row[11] || "");
            }
            
            newEvals[sid] = ev as EarlyEvaluationData;
            importCount++;
          }
        }

        setEvaluations(newEvals);
        toast.success(`Đã import dữ liệu cho ${importCount} học sinh. Vui lòng bấm Lưu!`);
      } catch (error) {
        console.error(error);
        toast.error("Lỗi khi đọc file Excel.");
      }
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsBinaryString(file);
  };

  if (loading) {
    return <div className="p-10 flex justify-center"><Loader2 className="animate-spin text-blue-500 w-8 h-8" /></div>;
  }

  return (
    <div className="space-y-4 relative">
      <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm sticky top-0 z-20">
        <h3 className="font-bold text-lg text-slate-800">Bảng nhập liệu: Nhận xét đầu năm học</h3>
        <div className="flex gap-3">
          <button 
            onClick={handleExportExcelTemplate}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium transition"
          >
            <Download size={18} />
            <span className="hidden sm:inline">Xuất Excel</span>
          </button>
          
          <div className="relative">
            <input 
              type="file" 
              accept=".xlsx, .xls" 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleImportExcel}
              ref={fileInputRef}
            />
            <button className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium transition pointer-events-none">
              <Upload size={18} />
              <span className="hidden sm:inline">Nhập Excel</span>
            </button>
          </div>

          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg font-medium transition"
          >
            <Printer size={18} />
            <span className="hidden sm:inline">In Phiếu</span>
          </button>

          <button 
            onClick={handleSaveAll}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold transition disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Lưu Dữ Liệu
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
        <table className="w-full text-sm text-left whitespace-nowrap">
          <thead className="bg-slate-50 text-slate-600 font-medium uppercase text-xs sticky top-0 z-10 border-b border-slate-200">
            <tr>
              <th className="p-4 border-r w-12 text-center sticky left-0 bg-slate-50 z-20">STT</th>
              <th className="p-4 border-r w-48 sticky left-12 bg-slate-50 z-20">Họ và tên</th>
              
              {showMath && <th className="p-4 border-r min-w-[200px]" colSpan={2}>Toán</th>}
              {showLit && <th className="p-4 border-r min-w-[200px]" colSpan={2}>Văn</th>}
              {showEng && <th className="p-4 border-r min-w-[200px]" colSpan={2}>Tiếng Anh</th>}
              
              <th className="p-4 border-r min-w-[250px]">Đạo đức, tác phong</th>
              <th className="p-4 border-r min-w-[250px]">Tham gia HĐ, trách nhiệm</th>
              <th className="p-4 border-r min-w-[250px]">Về học tập</th>
              <th className="p-4 min-w-[250px]">Cần khắc phục</th>
            </tr>
            <tr className="bg-slate-50 text-[11px]">
              <th className="p-2 border-r border-b text-center sticky left-0 bg-slate-50 z-20"></th>
              <th className="p-2 border-r border-b sticky left-12 bg-slate-50 z-20"></th>
              
              {showMath && <><th className="p-2 border-r border-b w-16 text-center">Điểm</th><th className="p-2 border-r border-b">Nhận xét</th></>}
              {showLit && <><th className="p-2 border-r border-b w-16 text-center">Điểm</th><th className="p-2 border-r border-b">Nhận xét</th></>}
              {showEng && <><th className="p-2 border-r border-b w-16 text-center">Điểm</th><th className="p-2 border-r border-b">Nhận xét</th></>}
              
              <th className="p-2 border-r border-b text-slate-400 italic">Nhận xét của GVCN</th>
              <th className="p-2 border-r border-b text-slate-400 italic">Nhận xét của GVCN</th>
              <th className="p-2 border-r border-b text-slate-400 italic">Nhận xét của GVCN</th>
              <th className="p-2 border-b text-slate-400 italic">Nhận xét của GVCN</th>
            </tr>
          </thead>
          <tbody>
            {students.map((student, index) => {
              const ev = evaluations[student.id!] || {};
              return (
                <tr key={student.id} className="border-b border-slate-100 hover:bg-slate-50 group">
                  <td className="p-3 border-r text-center text-slate-500 font-medium sticky left-0 bg-white group-hover:bg-slate-50 z-10">{index + 1}</td>
                  <td className="p-3 border-r font-bold text-slate-800 sticky left-12 bg-white group-hover:bg-slate-50 z-10 truncate max-w-[200px]">
                    {student.fullName}
                  </td>
                  
                  {showMath && (
                    <>
                      <td className="p-2 border-r">
                        <input
                          type="number"
                          step="0.1"
                          disabled={!canEditMath}
                          value={ev.mathScore ?? ""}
                          onChange={(e) => handleUpdate(student.id!, 'mathScore', e.target.value ? parseFloat(e.target.value) : null)}
                          className="w-16 p-2 bg-transparent border-b border-transparent focus:border-blue-500 outline-none text-center font-semibold disabled:opacity-50"
                        />
                      </td>
                      <td className="p-2 border-r">
                         <input
                          type="text"
                          disabled={!canEditMath}
                          value={ev.mathComment || ""}
                          onChange={(e) => handleUpdate(student.id!, 'mathComment', e.target.value)}
                          className="w-full min-w-[200px] p-2 bg-transparent border-b border-transparent focus:border-blue-500 outline-none disabled:opacity-50"
                          placeholder={canEditMath ? "Nhập nhận xét..." : "-"}
                        />
                      </td>
                    </>
                  )}

                  {showLit && (
                    <>
                      <td className="p-2 border-r">
                        <input
                          type="number"
                          step="0.1"
                          disabled={!canEditLit}
                          value={ev.literatureScore ?? ""}
                          onChange={(e) => handleUpdate(student.id!, 'literatureScore', e.target.value ? parseFloat(e.target.value) : null)}
                          className="w-16 p-2 bg-transparent border-b border-transparent focus:border-blue-500 outline-none text-center font-semibold disabled:opacity-50"
                        />
                      </td>
                      <td className="p-2 border-r">
                         <input
                          type="text"
                          disabled={!canEditLit}
                          value={ev.literatureComment || ""}
                          onChange={(e) => handleUpdate(student.id!, 'literatureComment', e.target.value)}
                          className="w-full min-w-[200px] p-2 bg-transparent border-b border-transparent focus:border-blue-500 outline-none disabled:opacity-50"
                          placeholder={canEditLit ? "Nhập nhận xét..." : "-"}
                        />
                      </td>
                    </>
                  )}

                  {showEng && (
                    <>
                      <td className="p-2 border-r">
                        <input
                          type="number"
                          step="0.1"
                          disabled={!canEditEng}
                          value={ev.englishScore ?? ""}
                          onChange={(e) => handleUpdate(student.id!, 'englishScore', e.target.value ? parseFloat(e.target.value) : null)}
                          className="w-16 p-2 bg-transparent border-b border-transparent focus:border-blue-500 outline-none text-center font-semibold disabled:opacity-50"
                        />
                      </td>
                      <td className="p-2 border-r">
                         <input
                          type="text"
                          disabled={!canEditEng}
                          value={ev.englishComment || ""}
                          onChange={(e) => handleUpdate(student.id!, 'englishComment', e.target.value)}
                          className="w-full min-w-[200px] p-2 bg-transparent border-b border-transparent focus:border-blue-500 outline-none disabled:opacity-50"
                          placeholder={canEditEng ? "Nhập nhận xét..." : "-"}
                        />
                      </td>
                    </>
                  )}

                  {/* GVCN Comments */}
                  <td className="p-2 border-r">
                     <textarea
                      disabled={!canEditBehavior}
                      value={ev.behavior || ""}
                      onChange={(e) => handleUpdate(student.id!, 'behavior', e.target.value)}
                      className="w-full min-w-[250px] p-2 bg-transparent border border-transparent focus:border-blue-500 focus:bg-blue-50/20 outline-none disabled:opacity-50 resize-y rounded text-sm"
                      rows={2}
                      placeholder={canEditBehavior ? "Nhận xét..." : "-"}
                    />
                  </td>
                  <td className="p-2 border-r">
                     <textarea
                      disabled={!canEditBehavior}
                      value={ev.activity || ""}
                      onChange={(e) => handleUpdate(student.id!, 'activity', e.target.value)}
                      className="w-full min-w-[250px] p-2 bg-transparent border border-transparent focus:border-blue-500 focus:bg-blue-50/20 outline-none disabled:opacity-50 resize-y rounded text-sm"
                      rows={2}
                      placeholder={canEditBehavior ? "Nhận xét..." : "-"}
                    />
                  </td>
                  <td className="p-2 border-r">
                     <textarea
                      disabled={!canEditBehavior}
                      value={ev.learning || ""}
                      onChange={(e) => handleUpdate(student.id!, 'learning', e.target.value)}
                      className="w-full min-w-[250px] p-2 bg-transparent border border-transparent focus:border-blue-500 focus:bg-blue-50/20 outline-none disabled:opacity-50 resize-y rounded text-sm"
                      rows={2}
                      placeholder={canEditBehavior ? "Nhận xét..." : "-"}
                    />
                  </td>
                  <td className="p-2">
                     <textarea
                      disabled={!canEditBehavior}
                      value={ev.improvement || ""}
                      onChange={(e) => handleUpdate(student.id!, 'improvement', e.target.value)}
                      className="w-full min-w-[250px] p-2 bg-transparent border border-transparent focus:border-blue-500 focus:bg-blue-50/20 outline-none disabled:opacity-50 resize-y rounded text-sm"
                      rows={2}
                      placeholder={canEditBehavior ? "Nhận xét..." : "-"}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

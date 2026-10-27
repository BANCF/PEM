"use client";

import React, { useState, useEffect, useRef } from "react";
import { StudentData } from "@/lib/services/student.service";
import { ClassData } from "@/lib/services/class.service";
import { ClassAssignmentData } from "@/lib/services/assignment.service";
import {
  MidtermEvaluationData,
  midtermEvaluationService,
  MIDTERM_SUBJECTS,
  MidtermSubjectConfig,
  SubjectScore,
} from "@/lib/services/midterm-evaluation.service";
import { gradeService } from "@/lib/services/grade.service";
import { Loader2, Save, Printer, Download, Upload, RefreshCw, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import * as XLSX from "xlsx";
import toast from "react-hot-toast";

interface Props {
  classData: ClassData;
  students: StudentData[];
  assignments: ClassAssignmentData[];
  profile: any;
  defaultSubject?: string;
}

export default function MidtermEvaluationsTab({
  classData,
  students,
  assignments,
  profile,
  defaultSubject,
}: Props) {
  const [semester, setSemester] = useState<number>(1);
  const [evaluations, setEvaluations] = useState<Record<string, MidtermEvaluationData>>({});
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check roles
  const isAdminOrBGH =
    profile?.role === "ADMIN" ||
    profile?.role === "SUPER_ADMIN" ||
    profile?.role === "BGH";

  // Find assignments for current user in this class
  const userAssignments = assignments.filter((a) => a.teacherId === profile?.id);
  const isGVCN = userAssignments.some((a) => a.role === "GVCN" || a.role === "PCN");
  const canViewAll = isAdminOrBGH || isGVCN;

  // Find all subjects this teacher is assigned to teach
  const taughtSubjectIds = userAssignments
    .filter((a) => a.role === "GVBM" && a.subject)
    .map((a) => midtermEvaluationService.findSubjectConfig(a.subject!)?.id)
    .filter(Boolean) as string[];

  // Initialize selected subject tab
  useEffect(() => {
    if (defaultSubject) {
      const cfg = midtermEvaluationService.findSubjectConfig(defaultSubject);
      if (cfg) {
        setSelectedSubjectId(cfg.id);
        return;
      }
    }
    if (!canViewAll && taughtSubjectIds.length > 0) {
      setSelectedSubjectId(taughtSubjectIds[0]);
    } else {
      setSelectedSubjectId("all");
    }
  }, [defaultSubject, canViewAll, taughtSubjectIds.join(",")]);

  // Check if current user can edit a specific subject
  const canEditSubject = (subjectId: string) => {
    if (isAdminOrBGH || isGVCN) return true;
    return taughtSubjectIds.includes(subjectId);
  };

  // Check if current user can edit general comments (GVCN or Admin/BGH)
  const canEditGeneralComment = isAdminOrBGH || isGVCN;

  const fetchEvaluations = async () => {
    setLoading(true);
    try {
      const data = await midtermEvaluationService.getEvaluationsByClassAndSemester(
        classData.id!,
        classData.academicYear,
        semester
      );

      const evalMap: Record<string, MidtermEvaluationData> = {};
      data.forEach((d) => {
        evalMap[d.studentId] = d;
      });

      // Initialize empty structure for students who don't have evaluation yet
      students.forEach((student) => {
        if (!evalMap[student.id!]) {
          const defaultSubjects: Record<string, SubjectScore> = {};
          MIDTERM_SUBJECTS.forEach((subj) => {
            defaultSubjects[subj.id] = {
              tx1: null,
              tx2: null,
              gk: null,
              evaluation: subj.isEvaluationOnly ? "Đạt" : "",
              comment: "",
            };
          });

          evalMap[student.id!] = {
            classId: classData.id!,
            studentId: student.id!,
            academicYear: classData.academicYear,
            semester: semester,
            generalComment: "",
            subjects: defaultSubjects,
          };
        } else {
          // Ensure all 9 subjects exist in the record
          MIDTERM_SUBJECTS.forEach((subj) => {
            if (!evalMap[student.id!].subjects[subj.id]) {
              evalMap[student.id!].subjects[subj.id] = {
                tx1: null,
                tx2: null,
                gk: null,
                evaluation: subj.isEvaluationOnly ? "Đạt" : "",
                comment: "",
              };
            }
          });
        }
      });

      setEvaluations(evalMap);
    } catch (error) {
      console.error("Error fetching midterm evaluations:", error);
      toast.error("Lỗi tải dữ liệu phiếu điểm giữa kỳ.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvaluations();
  }, [semester, classData.id, students.length]);

  // Update subject score field
  const handleScoreChange = (
    studentId: string,
    subjectId: string,
    field: keyof SubjectScore,
    value: any
  ) => {
    setEvaluations((prev) => {
      const studentEval = prev[studentId] || {
        classId: classData.id!,
        studentId: studentId,
        academicYear: classData.academicYear,
        semester: semester,
        generalComment: "",
        subjects: {},
      };

      const subjScore = studentEval.subjects[subjectId] || {};

      return {
        ...prev,
        [studentId]: {
          ...studentEval,
          subjects: {
            ...studentEval.subjects,
            [subjectId]: {
              ...subjScore,
              [field]: value,
            },
          },
        },
      };
    });
  };

  // Update general comment
  const handleGeneralCommentChange = (studentId: string, comment: string) => {
    setEvaluations((prev) => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        generalComment: comment,
      },
    }));
  };

  // Save evaluations
  const handleSave = async () => {
    setSaving(true);
    try {
      const dataToSave = Object.values(evaluations);
      await midtermEvaluationService.saveEvaluationsBatch(dataToSave);
      toast.success("Lưu phiếu điểm GHKI thành công!");
      fetchEvaluations();
    } catch (error) {
      console.error("Error saving midterm evaluations:", error);
      toast.error("Lỗi khi lưu phiếu điểm giữa kỳ.");
    } finally {
      setSaving(false);
    }
  };

  // Smart Sync from Gradebook (Sổ điểm điện tử)
  const handleSyncFromGrades = async () => {
    setSyncing(true);
    try {
      const allGrades = await gradeService.getAllGradesForClass(classData.id!, classData.academicYear);
      const semGrades = allGrades.filter((g) => g.semester === semester);

      if (semGrades.length === 0) {
        toast.error("Chưa tìm thấy dữ liệu điểm nào trong Sổ điểm của học kỳ này.");
        return;
      }

      let updatedCount = 0;
      const newEvaluations = { ...evaluations };

      semGrades.forEach((g) => {
        const studentId = g.studentId;
        if (!studentId || !newEvaluations[studentId]) return;

        const subjConfig = midtermEvaluationService.findSubjectConfig(g.subject);
        if (!subjConfig) return;

        // If user is a GVBM, only sync their subject
        if (!canViewAll && !taughtSubjectIds.includes(subjConfig.id)) return;

        const existing = newEvaluations[studentId].subjects[subjConfig.id] || {};

        if (subjConfig.isEvaluationOnly) {
          // For evaluation-only subject
          const evalVal = (g.tx1 !== null && g.tx1 !== undefined) || (g.gk !== null && g.gk !== undefined) ? "Đạt" : "Đạt";
          newEvaluations[studentId].subjects[subjConfig.id] = {
            ...existing,
            evaluation: evalVal,
            comment: g.comment || existing.comment || "",
          };
        } else {
          newEvaluations[studentId].subjects[subjConfig.id] = {
            ...existing,
            tx1: g.tx1 ?? existing.tx1 ?? null,
            tx2: g.tx2 ?? existing.tx2 ?? null,
            gk: g.gk ?? existing.gk ?? null,
            comment: g.comment || existing.comment || "",
          };
        }
        updatedCount++;
      });

      setEvaluations(newEvaluations);
      toast.success(
        `Đã đồng bộ ${updatedCount} lượt điểm từ Sổ điểm! Bấm "Lưu đánh giá" để xác nhận lưu trữ.`,
        { duration: 5000 }
      );
    } catch (error) {
      console.error("Error syncing from grades:", error);
      toast.error("Lỗi khi đồng bộ từ Sổ điểm.");
    } finally {
      setSyncing(false);
    }
  };

  // Print/Export PDF
  const handlePrint = async () => {
    setSaving(true);
    try {
      const dataToSave = Object.values(evaluations);
      await midtermEvaluationService.saveEvaluationsBatch(dataToSave);
      toast.success("Đã tự động lưu trước khi mở trang in!");

      const url = `/dashboard/print/midterm-evaluation?classId=${classData.id}&semester=${semester}`;
      window.open(url, "_blank");
    } catch (error) {
      console.error(error);
      toast.error("Lỗi khi lưu trước khi in.");
    } finally {
      setSaving(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (selectedSubjectId !== "all") {
      // Export single subject
      const subjConfig = MIDTERM_SUBJECTS.find((s) => s.id === selectedSubjectId);
      if (!subjConfig) return;

      const dataToExport = students.map((std, idx) => {
        const ev = evaluations[std.id!] || {};
        const sc = ev.subjects?.[selectedSubjectId] || {};

        const row: any = {
          "STT": idx + 1,
          "Mã HS (Không sửa)": std.id,
          "Họ và tên": std.fullName,
        };

        if (subjConfig.isEvaluationOnly) {
          row["Đánh giá"] = sc.evaluation || "Đạt";
        } else {
          row["Điểm hệ số 1 (cột 1)"] = sc.tx1 ?? "";
          row["Điểm hệ số 1 (cột 2)"] = sc.tx2 ?? "";
          row["Điểm khảo sát GHKI"] = sc.gk ?? "";
        }
        row["Nhận xét môn học"] = sc.comment || "";
        return row;
      });

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, subjConfig.name);
      XLSX.writeFile(wb, `PhieuDiem_${classData.name}_${subjConfig.name}_HK${semester}.xlsx`);
    } else {
      // Export all subjects overview
      const dataToExport = students.map((std, idx) => {
        const ev = evaluations[std.id!] || {};
        const row: any = {
          "STT": idx + 1,
          "Mã HS (Không sửa)": std.id,
          "Họ và tên": std.fullName,
          "Nhận xét chung (GVCN)": ev.generalComment || "",
        };

        MIDTERM_SUBJECTS.forEach((subj) => {
          const sc = ev.subjects?.[subj.id] || {};
          if (subj.isEvaluationOnly) {
            row[`${subj.name} (ĐG)`] = sc.evaluation || "Đạt";
          } else {
            row[`${subj.name} HS1-1`] = sc.tx1 ?? "";
            row[`${subj.name} HS1-2`] = sc.tx2 ?? "";
            row[`${subj.name} GK`] = sc.gk ?? "";
          }
          if (subj.hasComment) {
            row[`Nhận xét ${subj.name}`] = sc.comment || "";
          }
        });

        return row;
      });

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "TongHopGHKI");
      XLSX.writeFile(wb, `PhieuDiemTongHop_${classData.name}_HK${semester}.xlsx`);
    }
  };

  // Import from Excel
  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws);

        let updateCount = 0;
        const newEvaluations = { ...evaluations };

        data.forEach((row) => {
          const studentId = row["Mã HS (Không sửa)"] || row["ID (Không sửa)"];
          if (!studentId || !newEvaluations[studentId]) return;

          let updated = false;

          if (selectedSubjectId !== "all") {
            const subjConfig = MIDTERM_SUBJECTS.find((s) => s.id === selectedSubjectId);
            if (subjConfig && canEditSubject(subjConfig.id)) {
              const sc = newEvaluations[studentId].subjects[subjConfig.id] || {};

              if (subjConfig.isEvaluationOnly && "Đánh giá" in row) {
                sc.evaluation = row["Đánh giá"] || "Đạt";
                updated = true;
              } else {
                if ("Điểm hệ số 1 (cột 1)" in row) {
                  sc.tx1 = row["Điểm hệ số 1 (cột 1)"] !== "" ? Number(row["Điểm hệ số 1 (cột 1)"]) : null;
                  updated = true;
                }
                if ("Điểm hệ số 1 (cột 2)" in row) {
                  sc.tx2 = row["Điểm hệ số 1 (cột 2)"] !== "" ? Number(row["Điểm hệ số 1 (cột 2)"]) : null;
                  updated = true;
                }
                if ("Điểm khảo sát GHKI" in row) {
                  sc.gk = row["Điểm khảo sát GHKI"] !== "" ? Number(row["Điểm khảo sát GHKI"]) : null;
                  updated = true;
                }
              }

              if ("Nhận xét môn học" in row) {
                sc.comment = row["Nhận xét môn học"] || "";
                updated = true;
              }

              newEvaluations[studentId].subjects[subjConfig.id] = sc;
            }
          } else {
            // Import all
            if (canEditGeneralComment && "Nhận xét chung (GVCN)" in row) {
              newEvaluations[studentId].generalComment = row["Nhận xét chung (GVCN)"] || "";
              updated = true;
            }

            MIDTERM_SUBJECTS.forEach((subj) => {
              if (!canEditSubject(subj.id)) return;
              const sc = newEvaluations[studentId].subjects[subj.id] || {};

              if (subj.isEvaluationOnly) {
                if (`${subj.name} (ĐG)` in row) {
                  sc.evaluation = row[`${subj.name} (ĐG)`] || "Đạt";
                  updated = true;
                }
              } else {
                if (`${subj.name} HS1-1` in row) {
                  sc.tx1 = row[`${subj.name} HS1-1`] !== "" ? Number(row[`${subj.name} HS1-1`]) : null;
                  updated = true;
                }
                if (`${subj.name} HS1-2` in row) {
                  sc.tx2 = row[`${subj.name} HS1-2`] !== "" ? Number(row[`${subj.name} HS1-2`]) : null;
                  updated = true;
                }
                if (`${subj.name} GK` in row) {
                  sc.gk = row[`${subj.name} GK`] !== "" ? Number(row[`${subj.name} GK`]) : null;
                  updated = true;
                }
              }

              if (subj.hasComment && `Nhận xét ${subj.name}` in row) {
                sc.comment = row[`Nhận xét ${subj.name}`] || "";
                updated = true;
              }

              newEvaluations[studentId].subjects[subj.id] = sc;
            });
          }

          if (updated) updateCount++;
        });

        setEvaluations(newEvaluations);
        toast.success(`Đã trích xuất dữ liệu cho ${updateCount} học sinh. Bấm "Lưu đánh giá" để hoàn tất!`);
      } catch (err) {
        console.error(err);
        toast.error("Lỗi khi đọc file Excel. Vui lòng kiểm tra đúng định dạng mẫu.");
      }

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const currentSubjectConfig = MIDTERM_SUBJECTS.find((s) => s.id === selectedSubjectId);

  return (
    <div className="space-y-6">
      {/* Top Controls Card */}
      <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-bold text-slate-700 text-sm">Kỳ đánh giá:</span>
            <div className="bg-slate-100 p-1 rounded-xl flex">
              <button
                onClick={() => setSemester(1)}
                className={`px-3 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                  semester === 1
                    ? "bg-white shadow-sm text-blue-600"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Giữa Học Kỳ I (GHKI)
              </button>
              <button
                onClick={() => setSemester(2)}
                className={`px-3 py-1.5 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                  semester === 2
                    ? "bg-white shadow-sm text-blue-600"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Giữa Học Kỳ II (GHKII)
              </button>
            </div>

            <div className="h-5 w-px bg-slate-200 hidden sm:block"></div>

            <button
              onClick={handleSyncFromGrades}
              disabled={syncing}
              className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl font-bold text-xs sm:text-sm transition-colors disabled:opacity-50"
              title="Lấy điểm TX1, TX2, GK từ Sổ điểm sang phiếu báo điểm"
            >
              <RefreshCw size={15} className={syncing ? "animate-spin" : ""} />
              <span>Đồng bộ từ Sổ Điểm</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 px-3 py-1.5 rounded-xl font-bold text-xs sm:text-sm transition-colors"
            >
              <Download size={15} />
              <span>Xuất Excel</span>
            </button>

            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls"
                onChange={handleImportExcel}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <button className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-xl font-bold text-xs sm:text-sm transition-colors">
                <Upload size={15} />
                <span>Nhập Excel</span>
              </button>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-4 py-1.5 rounded-xl font-bold text-xs sm:text-sm transition-colors shadow-sm disabled:opacity-50"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              <span>Lưu đánh giá</span>
            </button>

            {canViewAll && (
              <button
                onClick={handlePrint}
                disabled={saving}
                className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-xl font-bold text-xs sm:text-sm transition-colors shadow-sm disabled:opacity-50"
                title="In hoặc xuất PDF phiếu báo điểm cho tất cả học sinh"
              >
                <Printer size={15} />
                <span>In Phiếu GHKI (PDF)</span>
              </button>
            )}
          </div>
        </div>

        {/* Subject Navigation Pills */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-thin">
            {canViewAll && (
              <button
                onClick={() => setSelectedSubjectId("all")}
                className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                  selectedSubjectId === "all"
                    ? "bg-slate-900 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                ✨ Tổng quan cả lớp (GVCN)
              </button>
            )}

            {MIDTERM_SUBJECTS.map((subj) => {
              const isTaught = taughtSubjectIds.includes(subj.id);
              const isSelected = selectedSubjectId === subj.id;

              return (
                <button
                  key={subj.id}
                  onClick={() => setSelectedSubjectId(subj.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-blue-600 text-white shadow-sm"
                      : isTaught
                      ? "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {isTaught && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                  <span>{subj.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex justify-center items-center py-24 bg-white rounded-2xl border border-slate-200">
          <Loader2 className="animate-spin text-blue-600 w-8 h-8 mr-3" />
          <span className="text-slate-600 font-medium">Đang tải dữ liệu phiếu điểm giữa kỳ...</span>
        </div>
      ) : selectedSubjectId === "all" ? (
        /* GVCN Overview Table */
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="font-bold text-slate-800 text-base">
                Bảng Tổng Hợp Phiếu Báo Điểm Giữa Học Kỳ {semester}
              </h3>
              <p className="text-xs text-slate-500">
                Lớp {classData.name} • GVCN điền nhận xét chung và theo dõi tiến độ nhập điểm của các GVBM.
              </p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 bg-blue-100 text-blue-800 rounded-full">
              Tổng số: {students.length} học sinh
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm min-w-[1100px]">
              <thead>
                <tr className="bg-slate-800 text-white text-xs font-bold uppercase tracking-wider">
                  <th className="p-3 w-12 text-center border-r border-slate-700">STT</th>
                  <th className="p-3 w-52 border-r border-slate-700">Họ và tên học sinh</th>
                  <th className="p-3 min-w-[280px] border-r border-slate-700">
                    Nhận xét chung (GVCN)
                  </th>
                  {MIDTERM_SUBJECTS.map((subj) => (
                    <th
                      key={subj.id}
                      className="p-3 text-center border-r border-slate-700 w-24 text-[11px]"
                    >
                      {subj.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student, idx) => {
                  const ev = evaluations[student.id!] || {};
                  return (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-center text-slate-400 font-medium border-r border-slate-100">
                        {idx + 1}
                      </td>
                      <td className="p-3 border-r border-slate-100 font-bold text-slate-800">
                        {student.fullName}
                      </td>
                      <td className="p-2 border-r border-slate-100">
                        <textarea
                          rows={2}
                          disabled={!canEditGeneralComment}
                          value={ev.generalComment || ""}
                          onChange={(e) => handleGeneralCommentChange(student.id!, e.target.value)}
                          placeholder={
                            canEditGeneralComment
                              ? "Nhập nhận xét chung về nề nếp, chuyên cần..."
                              : "Chưa có nhận xét"
                          }
                          className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500 resize-none"
                        />
                      </td>

                      {MIDTERM_SUBJECTS.map((subj) => {
                        const sc = ev.subjects?.[subj.id];
                        const hasScore = subj.isEvaluationOnly
                          ? !!sc?.evaluation
                          : sc?.gk !== null && sc?.gk !== undefined;

                        return (
                          <td
                            key={subj.id}
                            className="p-2 text-center border-r border-slate-100 align-middle"
                          >
                            {subj.isEvaluationOnly ? (
                              <span
                                className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold ${
                                  sc?.evaluation === "Chưa đạt"
                                    ? "bg-red-100 text-red-700"
                                    : "bg-emerald-100 text-emerald-700"
                                }`}
                              >
                                {sc?.evaluation || "Đạt"}
                              </span>
                            ) : hasScore ? (
                              <div className="font-bold text-blue-700 text-xs">
                                <div>{sc?.gk}</div>
                                <div className="text-[10px] text-slate-400 font-normal">
                                  ({sc?.tx1 ?? "-"} • {sc?.tx2 ?? "-"})
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-300 font-bold">-</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Subject-specific Input Table (for GVBM or GVCN) */
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
                <h3 className="font-bold text-slate-800 text-lg">
                  Môn: {currentSubjectConfig?.name}
                </h3>
                {canEditSubject(selectedSubjectId) ? (
                  <span className="text-xs bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 size={12} /> Có quyền nhập liệu
                  </span>
                ) : (
                  <span className="text-xs bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <AlertCircle size={12} /> Chế độ chỉ xem
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Nhập điểm hệ số 1, điểm khảo sát giữa kỳ và nhận xét chuyên môn môn học.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm min-w-[850px]">
              <thead>
                <tr className="bg-slate-800 text-white text-xs font-bold uppercase tracking-wider">
                  <th className="p-3 w-12 text-center border-r border-slate-700">STT</th>
                  <th className="p-3 w-56 border-r border-slate-700">Họ và tên học sinh</th>
                  {currentSubjectConfig?.isEvaluationOnly ? (
                    <th className="p-3 text-center border-r border-slate-700 w-44">
                      Kết quả đánh giá
                    </th>
                  ) : (
                    <>
                      <th className="p-3 text-center border-r border-slate-700 w-28">
                        Điểm HS1 (Lần 1)
                      </th>
                      <th className="p-3 text-center border-r border-slate-700 w-28">
                        Điểm HS1 (Lần 2)
                      </th>
                      <th className="p-3 text-center border-r border-slate-700 w-32 bg-blue-900 text-blue-100">
                        Khảo sát GHKI
                      </th>
                    </>
                  )}
                  <th className="p-3 border-r border-slate-700 min-w-[280px]">
                    Nhận xét của Giáo viên bộ môn
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student, idx) => {
                  const ev = evaluations[student.id!] || {};
                  const sc = ev.subjects?.[selectedSubjectId] || {};
                  const isEditable = canEditSubject(selectedSubjectId);

                  return (
                    <tr key={student.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 text-center text-slate-400 font-medium border-r border-slate-100">
                        {idx + 1}
                      </td>
                      <td className="p-3 border-r border-slate-100 font-bold text-slate-800">
                        {student.fullName}
                      </td>

                      {currentSubjectConfig?.isEvaluationOnly ? (
                        <td className="p-2 border-r border-slate-100 text-center">
                          <select
                            disabled={!isEditable}
                            value={sc.evaluation || "Đạt"}
                            onChange={(e) =>
                              handleScoreChange(
                                student.id!,
                                selectedSubjectId,
                                "evaluation",
                                e.target.value
                              )
                            }
                            className="p-2 text-sm font-bold border border-slate-200 rounded-lg bg-white outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                          >
                            <option value="Đạt">Đạt</option>
                            <option value="Chưa đạt">Chưa đạt</option>
                          </select>
                        </td>
                      ) : (
                        <>
                          <td className="p-2 border-r border-slate-100 text-center">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="10"
                              disabled={!isEditable}
                              value={sc.tx1 !== null && sc.tx1 !== undefined ? sc.tx1 : ""}
                              onChange={(e) =>
                                handleScoreChange(
                                  student.id!,
                                  selectedSubjectId,
                                  "tx1",
                                  e.target.value !== "" ? parseFloat(e.target.value) : null
                                )
                              }
                              placeholder="-"
                              className="w-20 text-center p-2 border border-slate-200 rounded-lg outline-none font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                            />
                          </td>
                          <td className="p-2 border-r border-slate-100 text-center">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="10"
                              disabled={!isEditable}
                              value={sc.tx2 !== null && sc.tx2 !== undefined ? sc.tx2 : ""}
                              onChange={(e) =>
                                handleScoreChange(
                                  student.id!,
                                  selectedSubjectId,
                                  "tx2",
                                  e.target.value !== "" ? parseFloat(e.target.value) : null
                                )
                              }
                              placeholder="-"
                              className="w-20 text-center p-2 border border-slate-200 rounded-lg outline-none font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                            />
                          </td>
                          <td className="p-2 border-r border-slate-100 text-center bg-blue-50/30">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="10"
                              disabled={!isEditable}
                              value={sc.gk !== null && sc.gk !== undefined ? sc.gk : ""}
                              onChange={(e) =>
                                handleScoreChange(
                                  student.id!,
                                  selectedSubjectId,
                                  "gk",
                                  e.target.value !== "" ? parseFloat(e.target.value) : null
                                )
                              }
                              placeholder="-"
                              className="w-20 text-center p-2 border border-blue-300 bg-blue-50/50 rounded-lg outline-none font-bold text-blue-700 focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                            />
                          </td>
                        </>
                      )}

                      <td className="p-2 border-r border-slate-100">
                        <textarea
                          rows={2}
                          disabled={!isEditable}
                          value={sc.comment || ""}
                          onChange={(e) =>
                            handleScoreChange(
                              student.id!,
                              selectedSubjectId,
                              "comment",
                              e.target.value
                            )
                          }
                          placeholder={
                            isEditable
                              ? "Nhập nhận xét về kết quả, sự tiến bộ môn " + currentSubjectConfig?.name + "..."
                              : "Chưa có nhận xét"
                          }
                          className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500 resize-none"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

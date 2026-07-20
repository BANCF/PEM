"use client";

import React, { useState, useEffect, use } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { studentService, StudentData } from "@/lib/services/student.service";
import { classService, ClassData } from "@/lib/services/class.service";
import { gradeService, GradeData } from "@/lib/services/grade.service";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Users, FileSpreadsheet, X } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";

export default function HomeroomGradeSummaryPage({ params }: { params: Promise<{ classId: string }> }) {
  const resolvedParams = use(params);
  const classId = resolvedParams.classId;
  const searchParams = useSearchParams();
  const router = useRouter();

  const academicYear = searchParams.get("academicYear") || "";

  const [classData, setClassData] = useState<ClassData | null>(null);
  const [students, setStudents] = useState<StudentData[]>([]);
  // Store all grades: studentId -> subject -> semester (1|2) -> GradeData
  const [grades, setGrades] = useState<Record<string, Record<string, Record<number, GradeData>>>>({});
  const [subjects, setSubjects] = useState<string[]>([]);
  
  // 1: HK1, 2: HK2, 3: Cả năm
  const [viewMode, setViewMode] = useState<number>(1);
  const [loading, setLoading] = useState(true);

  const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);

  useEffect(() => {
    if (!academicYear) {
      toast.error("Thiếu thông tin năm học.");
      router.push("/dashboard/grades");
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const cls = await classService.getClassById(classId);
        if (!cls) throw new Error("Không tìm thấy lớp.");
        setClassData(cls);

        const stds = await studentService.getStudentsByClassId(classId);
        setStudents(stds);

        const allGrades = await gradeService.getAllGradesForClass(classId, academicYear);
        
        const gradeMap: Record<string, Record<string, Record<number, GradeData>>> = {};
        const subjectSet = new Set<string>();

        stds.forEach(std => {
          gradeMap[std.id!] = {};
        });

        allGrades.forEach(g => {
          if (!g.studentId) return;
          if (!gradeMap[g.studentId]) {
            gradeMap[g.studentId] = {};
          }
          if (!gradeMap[g.studentId][g.subject]) {
            gradeMap[g.studentId][g.subject] = {};
          }
          gradeMap[g.studentId][g.subject][g.semester] = g;
          subjectSet.add(g.subject);
        });

        setGrades(gradeMap);
        setSubjects(Array.from(subjectSet).sort());
      } catch (error: any) {
        toast.error(error.message || "Lỗi tải dữ liệu");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [classId, academicYear]);

  const getSubjectAverage = (studentId: string, subject: string, mode: number) => {
    const subjGrades = grades[studentId]?.[subject];
    if (!subjGrades) return null;

    if (mode === 1) return subjGrades[1]?.average ?? null;
    if (mode === 2) return subjGrades[2]?.average ?? null;
    
    // Mode 3: Cả năm
    const hk1 = subjGrades[1]?.average;
    const hk2 = subjGrades[2]?.average;
    if (hk1 != null && hk2 != null) {
      return Math.round(((hk1 + hk2 * 2) / 3) * 10) / 10;
    }
    return null;
  };

  const getOverallAverage = (studentId: string, mode: number) => {
    let total = 0;
    let count = 0;
    subjects.forEach(subj => {
      const avg = getSubjectAverage(studentId, subj, mode);
      if (avg != null) {
        total += avg;
        count++;
      }
    });

    if (count === 0) return null;
    return Math.round((total / count) * 10) / 10;
  };

  const exportExcel = () => {
    const wsData: any[][] = [];
    
    // Header 1
    wsData.push(["UBND PHƯỜNG NGHĨA ĐÔ"]);
    wsData.push(["TRƯỜNG TH - THCS PASCAL"]);
    wsData.push([`BẢNG TỔNG HỢP ĐIỂM LỚP ${classData?.name}`]);
    wsData.push([`Năm học: ${academicYear} - Kế quả: ${viewMode === 1 ? 'Học kỳ 1' : viewMode === 2 ? 'Học kỳ 2' : 'Cả năm'}`]);
    wsData.push([]);
    
    // Bảng
    const headers = ["STT", "Mã định danh", "Họ và tên", ...subjects, "ĐTB Các Môn"];
    wsData.push(headers);

    students.forEach((std, index) => {
      const row = [
        index + 1,
        std.studentCode || "",
        std.fullName
      ];

      subjects.forEach(subj => {
        const avg = getSubjectAverage(std.id!, subj, viewMode);
        row.push(avg ?? "");
      });

      const overall = getOverallAverage(std.id!, viewMode);
      row.push(overall ?? "");
      
      wsData.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Auto width
    ws['!cols'] = [
      { wch: 5 }, { wch: 15 }, { wch: 25 },
      ...subjects.map(() => ({ wch: 10 })),
      { wch: 12 }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tong Hop Diem");
    XLSX.writeFile(wb, `Tong_Hop_Diem_${classData?.name}_${viewMode === 1 ? 'HK1' : viewMode === 2 ? 'HK2' : 'CaNam'}.xlsx`);
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen"><Loader2 className="animate-spin text-blue-500 w-10 h-10" /></div>;
  }

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "SUPER_ADMIN", "BGH", "TEACHER", "TTCM", "TPCM"]}>
      <div className="p-4 lg:p-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <Link href="/dashboard/grades" className="p-2 bg-slate-200 hover:bg-slate-300 rounded-full transition-colors text-slate-600">
                <ArrowLeft size={18} />
              </Link>
              <h1 className="text-2xl lg:text-3xl font-bold text-slate-800 flex items-center gap-2">
                <Users className="text-blue-500" />
                Tổng hợp điểm Lớp {classData?.name}
              </h1>
            </div>
            <p className="text-slate-500 ml-12">Năm học: {academicYear} (Dành cho GVCN)</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-100 p-1 rounded-lg flex mr-2">
              <button
                onClick={() => setViewMode(1)}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${viewMode === 1 ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
              >
                Học kỳ 1
              </button>
              <button
                onClick={() => setViewMode(2)}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${viewMode === 2 ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
              >
                Học kỳ 2
              </button>
              <button
                onClick={() => setViewMode(3)}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${viewMode === 3 ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
              >
                Cả năm
              </button>
            </div>
            
            <button
              onClick={exportExcel}
              className="flex items-center gap-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-4 py-2 rounded-lg font-bold transition-colors"
            >
              <FileSpreadsheet size={18} />
              <span className="hidden sm:inline">Xuất Excel</span>
            </button>
          </div>
        </div>

        <div className="bg-blue-50 text-blue-800 p-4 rounded-xl mb-6 text-sm">
          Nhấn vào từng học sinh trong danh sách để xem chi tiết điểm thành phần (TX, GK, CK) và <strong>Nhận xét</strong> của các Giáo viên bộ môn.
        </div>

        {/* Grade Grid */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap min-w-[800px]">
              <thead>
                <tr className="bg-slate-800 text-white text-sm font-semibold">
                  <th className="p-3 w-12 text-center border-r border-slate-700">STT</th>
                  <th className="p-3 border-r border-slate-700">Mã HS / Họ và tên</th>
                  {subjects.map(subj => (
                    <th key={subj} className="p-3 text-center border-r border-slate-700 w-24">
                      {subj}
                    </th>
                  ))}
                  <th className="p-3 text-center w-28 bg-slate-900 text-amber-400">ĐTB Các Môn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={subjects.length + 3} className="p-8 text-center text-slate-500">Lớp chưa có học sinh nào.</td>
                  </tr>
                ) : (
                  students.map((student, index) => {
                    const overallAvg = getOverallAverage(student.id!, viewMode);
                    return (
                      <tr 
                        key={student.id} 
                        onClick={() => setSelectedStudent(student)}
                        className="hover:bg-blue-50 transition-colors cursor-pointer group"
                      >
                        <td className="p-3 text-center text-slate-500 border-r border-slate-100 group-hover:bg-blue-100/50">{index + 1}</td>
                        <td className="p-3 border-r border-slate-100 group-hover:bg-blue-100/50">
                          <p className="font-bold text-slate-800 text-sm">{student.fullName}</p>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{student.studentCode}</p>
                        </td>
                        
                        {subjects.map(subj => {
                          const avg = getSubjectAverage(student.id!, subj, viewMode);
                          return (
                            <td key={subj} className="p-3 text-center border-r border-slate-100">
                              <span className={`font-bold ${avg == null ? 'text-slate-300' : 'text-slate-700'}`}>
                                {avg ?? "-"}
                              </span>
                            </td>
                          );
                        })}

                        {/* Overall Average */}
                        <td className="p-3 text-center bg-slate-50 group-hover:bg-blue-100 transition-colors">
                          <span className={`inline-block px-3 py-1 rounded font-black text-sm ${
                            overallAvg == null ? "text-slate-400" :
                            overallAvg >= 8.0 ? "text-blue-700" :
                            overallAvg >= 6.5 ? "text-emerald-700" :
                            overallAvg >= 5.0 ? "text-amber-700" :
                            "text-red-700"
                          }`}>
                            {overallAvg ?? "-"}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Chi tiết Học Sinh */}
        {selectedStudent && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
              <div className="flex justify-between items-center p-5 border-b border-slate-100">
                <div>
                  <h3 className="text-xl font-bold text-slate-800">{selectedStudent.fullName}</h3>
                  <p className="text-sm text-slate-500">Mã: {selectedStudent.studentCode}</p>
                </div>
                <button 
                  onClick={() => setSelectedStudent(null)}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="overflow-y-auto p-5">
                <div className="space-y-4">
                  {subjects.map(subj => {
                    const subjGrades = grades[selectedStudent.id!]?.[subj];
                    if (!subjGrades) return null;
                    
                    // Lấy học kỳ hiện tại đang view, nếu là "Cả năm" thì lấy HK2 làm base hiển thị chi tiết (hoặc cả 2)
                    const gHK1 = subjGrades[1];
                    const gHK2 = subjGrades[2];
                    const activeG = viewMode === 1 ? gHK1 : gHK2;

                    return (
                      <div key={subj} className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="bg-slate-50 p-3 border-b border-slate-200 flex justify-between items-center">
                          <h4 className="font-bold text-slate-800">{subj}</h4>
                          <div className="flex gap-4 text-sm font-semibold">
                            <span className="text-slate-600">HK1: {gHK1?.average ?? "-"}</span>
                            <span className="text-slate-600">HK2: {gHK2?.average ?? "-"}</span>
                            <span className="text-blue-700">Cả năm: {getSubjectAverage(selectedStudent.id!, subj, 3) ?? "-"}</span>
                          </div>
                        </div>
                        <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div className="md:col-span-2 space-y-2">
                            <div className="grid grid-cols-4 gap-2 text-center">
                              <div className="bg-slate-50 p-2 rounded border border-slate-100">
                                <p className="text-xs text-slate-500 mb-1">Thường xuyên</p>
                                <p className="font-bold">{[activeG?.tx1, activeG?.tx2, activeG?.tx3, activeG?.tx4].filter(x => x != null).join(" • ") || "-"}</p>
                              </div>
                              <div className="bg-amber-50 p-2 rounded border border-amber-100">
                                <p className="text-xs text-amber-600 mb-1">Giữa kỳ</p>
                                <p className="font-bold">{activeG?.gk ?? "-"}</p>
                              </div>
                              <div className="bg-emerald-50 p-2 rounded border border-emerald-100">
                                <p className="text-xs text-emerald-600 mb-1">Cuối kỳ</p>
                                <p className="font-bold">{activeG?.ck ?? "-"}</p>
                              </div>
                              <div className="bg-blue-50 p-2 rounded border border-blue-100">
                                <p className="text-xs text-blue-600 mb-1">ĐTB ({viewMode === 1 ? 'HK1' : 'HK2'})</p>
                                <p className="font-bold text-lg">{activeG?.average ?? "-"}</p>
                              </div>
                            </div>
                          </div>
                          
                          <div className="md:col-span-1">
                            <p className="text-xs font-bold text-slate-500 mb-2 uppercase">Nhận xét của giáo viên (HK{viewMode === 1 ? 1 : 2})</p>
                            <div className="bg-yellow-50/50 p-3 rounded-lg border border-yellow-100 text-sm min-h-[4.5rem]">
                              {activeG?.comment ? (
                                <span className="text-slate-700 italic">"{activeG.comment}"</span>
                              ) : (
                                <span className="text-slate-400 italic">Chưa có nhận xét.</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {subjects.length === 0 && (
                    <div className="text-center py-8 text-slate-500">
                      Chưa có điểm thành phần nào được nhập.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </ProtectedRoute>
  );
}

"use client";

import React, { useState, useEffect, use } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { studentService, StudentData } from "@/lib/services/student.service";
import { classService, ClassData } from "@/lib/services/class.service";
import { gradeService, GradeData } from "@/lib/services/grade.service";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Save, Upload, Calculator } from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import Link from "next/link";

export default function GradeInputPage({ params }: { params: Promise<{ classId: string }> }) {
  const resolvedParams = use(params);
  const classId = resolvedParams.classId;
  const searchParams = useSearchParams();
  const router = useRouter();

  const subject = searchParams.get("subject") || "";
  const academicYear = searchParams.get("academicYear") || "";

  const [classData, setClassData] = useState<ClassData | null>(null);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [grades, setGrades] = useState<Record<string, GradeData>>({});
  const [semester, setSemester] = useState<number>(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!subject || !academicYear) {
      toast.error("Thiếu thông tin môn học hoặc năm học.");
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

        await loadGrades(classId, subject, academicYear, semester, stds);
      } catch (error: any) {
        toast.error(error.message || "Lỗi tải dữ liệu");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [classId, subject, academicYear, semester]);

  const loadGrades = async (cid: string, subj: string, ay: string, sem: number, stds: StudentData[]) => {
    const existingGrades = await gradeService.getGrades(cid, subj, ay, sem);
    const gradeMap: Record<string, GradeData> = {};
    
    // Initialize map with existing or default grades
    stds.forEach(std => {
      const existing = existingGrades.find(g => g.studentId === std.id);
      if (existing) {
        gradeMap[std.id!] = existing;
      } else {
        gradeMap[std.id!] = {
          studentId: std.id!,
          classId: cid,
          subject: subj,
          academicYear: ay,
          semester: sem,
          tx1: null, tx2: null, tx3: null, tx4: null, gk: null, ck: null, average: null
        };
      }
    });
    setGrades(gradeMap);
  };

  const handleGradeChange = (studentId: string, field: keyof GradeData, value: string) => {
    let numVal: number | null = null;
    if (value.trim() !== "") {
      numVal = parseFloat(value);
      if (isNaN(numVal) || numVal < 0 || numVal > 10) return; // Prevent invalid
    }

    setGrades(prev => {
      const updated = { ...prev[studentId], [field]: numVal };
      updated.average = computeAverage(updated);
      return { ...prev, [studentId]: updated };
    });
  };

  const computeAverage = (g: GradeData): number | null => {
    const tx = [g.tx1, g.tx2, g.tx3, g.tx4].filter(val => val !== null && val !== undefined) as number[];
    if (tx.length === 0 && g.gk == null && g.ck == null) return null;

    let total = tx.reduce((a, b) => a + b, 0);
    let divisor = tx.length;

    if (g.gk != null) {
      total += g.gk * 2;
      divisor += 2;
    }
    if (g.ck != null) {
      total += g.ck * 3;
      divisor += 3;
    }

    if (divisor === 0) return null;
    return Math.round((total / divisor) * 10) / 10;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const gradesToSave = Object.values(grades);
      await gradeService.saveGradesBatch(gradesToSave);
      toast.success("Đã lưu bảng điểm thành công!");
      // Reload grades to get DB generated IDs if new
      await loadGrades(classId, subject, academicYear, semester, students);
    } catch (error) {
      toast.error("Lỗi khi lưu bảng điểm");
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

        let updatedCount = 0;
        const newGrades = { ...grades };

        // Start scanning from row 6 (index 5) or find where STT is
        let startRow = 6; 
        for (let i = 0; i < 15; i++) {
          if (data[i] && data[i][0] === "STT") {
            startRow = i + 1;
            break;
          }
        }

        for (let i = startRow; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length < 3) continue;

          const studentCode = row[1]?.toString().trim();
          const fullName = row[2]?.toString().trim();

          // Find student in our db
          const std = students.find(s => 
            (studentCode && s.studentCode === studentCode) || 
            (fullName && s.fullName.toLowerCase() === fullName.toLowerCase())
          );

          if (std) {
            const sid = std.id!;
            const parseVal = (val: any) => {
              if (val === undefined || val === null || val === "") return null;
              const n = parseFloat(val);
              return isNaN(n) ? null : n;
            };

            newGrades[sid] = {
              ...newGrades[sid],
              tx1: parseVal(row[5]),
              tx2: parseVal(row[6]),
              tx3: parseVal(row[7]),
              tx4: parseVal(row[8]),
              gk: parseVal(row[10]), // Dựa theo cấu trúc cột 10 là GK
              ck: parseVal(row[11]), // Cột 11 là CK
            };
            newGrades[sid].average = computeAverage(newGrades[sid]);
            updatedCount++;
          }
        }

        setGrades(newGrades);
        toast.success(`Đã trích xuất và cập nhật điểm cho ${updatedCount} học sinh! Nhấn "Lưu điểm" để hoàn tất.`);
      } catch (err) {
        console.error(err);
        toast.error("File Excel không hợp lệ hoặc không đúng định dạng.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ""; // reset input
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
              <h1 className="text-2xl lg:text-3xl font-bold text-slate-800">
                Sổ điểm môn {subject}
              </h1>
            </div>
            <p className="text-slate-500 ml-12">Lớp {classData?.name} • Năm học: {academicYear}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="bg-slate-100 p-1 rounded-lg flex mr-2">
              <button
                onClick={() => setSemester(1)}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${semester === 1 ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
              >
                Học kỳ 1
              </button>
              <button
                onClick={() => setSemester(2)}
                className={`px-4 py-2 text-sm font-semibold rounded-md transition-all ${semester === 2 ? "bg-white shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"}`}
              >
                Học kỳ 2
              </button>
            </div>

            <div className="relative">
              <input
                type="file"
                accept=".xlsx, .xls"
                onChange={handleExcelImport}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                title="Nhập từ file Excel"
              />
              <button className="flex items-center gap-2 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 px-4 py-2 rounded-lg font-bold transition-colors">
                <Upload size={18} />
                <span>Nhập Excel</span>
              </button>
            </div>

            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-bold transition-colors disabled:bg-blue-400"
            >
              {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              <span>Lưu điểm</span>
            </button>
          </div>
        </div>

        {/* Info Alert */}
        <div className="bg-blue-50 border border-blue-100 text-blue-800 p-4 rounded-xl mb-6 flex items-start gap-3">
          <Calculator className="mt-0.5 shrink-0" size={20} />
          <div className="text-sm">
            <strong>Thông tư 22/2021/TT-BGDĐT:</strong> Điểm trung bình môn học kỳ (ĐTBmhk) được tự động tính theo công thức: 
            <br />
            <code>[Tổng các điểm TX + (Điểm GK × 2) + (Điểm CK × 3)] / (Số lượng điểm TX + 5)</code>
            <br/>
            Bạn có thể nhập tối đa 4 cột ĐĐGtx. Hệ thống sẽ tự loại bỏ các ô trống khi tính toán.
          </div>
        </div>

        {/* Grade Grid */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap min-w-[800px]">
              <thead>
                <tr className="bg-slate-800 text-white text-sm font-semibold">
                  <th className="p-3 w-12 text-center border-r border-slate-700">STT</th>
                  <th className="p-3 border-r border-slate-700">Mã HS / Họ và tên</th>
                  <th className="p-3 text-center border-r border-slate-700" colSpan={4}>ĐĐG Thường xuyên (TX)</th>
                  <th className="p-3 text-center border-r border-slate-700 w-20">Giữa kỳ (GK)</th>
                  <th className="p-3 text-center border-r border-slate-700 w-20">Cuối kỳ (CK)</th>
                  <th className="p-3 text-center w-24 bg-slate-900">ĐTBmhk</th>
                </tr>
                <tr className="bg-slate-700 text-slate-300 text-xs font-semibold">
                  <th className="p-2 text-center border-r border-slate-600"></th>
                  <th className="p-2 border-r border-slate-600"></th>
                  <th className="p-2 text-center border-r border-slate-600 w-16">TX 1</th>
                  <th className="p-2 text-center border-r border-slate-600 w-16">TX 2</th>
                  <th className="p-2 text-center border-r border-slate-600 w-16">TX 3</th>
                  <th className="p-2 text-center border-r border-slate-600 w-16">TX 4</th>
                  <th className="p-2 text-center border-r border-slate-600">Hệ số 2</th>
                  <th className="p-2 text-center border-r border-slate-600">Hệ số 3</th>
                  <th className="p-2 text-center bg-slate-800">Tự động</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500">Lớp chưa có học sinh nào.</td>
                  </tr>
                ) : (
                  students.map((student, index) => {
                    const g = grades[student.id!] || {};
                    return (
                      <tr key={student.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 text-center text-slate-500 border-r border-slate-100">{index + 1}</td>
                        <td className="p-3 border-r border-slate-100">
                          <p className="font-bold text-slate-800 text-sm">{student.fullName}</p>
                          <p className="text-xs text-slate-400 font-mono mt-0.5">{student.studentCode}</p>
                        </td>
                        
                        {/* TX */}
                        {["tx1", "tx2", "tx3", "tx4"].map((field) => (
                          <td key={field} className="p-2 text-center border-r border-slate-100">
                            <input
                              type="number"
                              min="0" max="10" step="0.1"
                              value={g[field as keyof GradeData] ?? ""}
                              onChange={(e) => handleGradeChange(student.id!, field as keyof GradeData, e.target.value)}
                              className="w-full text-center p-1.5 border border-slate-200 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
                            />
                          </td>
                        ))}

                        {/* GK */}
                        <td className="p-2 text-center border-r border-slate-100 bg-amber-50/30">
                          <input
                            type="number"
                            min="0" max="10" step="0.1"
                            value={g.gk ?? ""}
                            onChange={(e) => handleGradeChange(student.id!, "gk", e.target.value)}
                            className="w-full text-center p-1.5 border border-amber-200 rounded text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none bg-amber-50/50"
                          />
                        </td>

                        {/* CK */}
                        <td className="p-2 text-center border-r border-slate-100 bg-emerald-50/30">
                          <input
                            type="number"
                            min="0" max="10" step="0.1"
                            value={g.ck ?? ""}
                            onChange={(e) => handleGradeChange(student.id!, "ck", e.target.value)}
                            className="w-full text-center p-1.5 border border-emerald-200 rounded text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none bg-emerald-50/50"
                          />
                        </td>

                        {/* Average */}
                        <td className="p-3 text-center bg-slate-50">
                          <span className={`inline-block px-3 py-1 rounded font-bold text-sm ${
                            g.average == null ? "text-slate-400" :
                            g.average >= 8.0 ? "text-blue-700 bg-blue-100" :
                            g.average >= 6.5 ? "text-emerald-700 bg-emerald-100" :
                            g.average >= 5.0 ? "text-amber-700 bg-amber-100" :
                            "text-red-700 bg-red-100"
                          }`}>
                            {g.average ?? "-"}
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

      </div>
    </ProtectedRoute>
  );
}

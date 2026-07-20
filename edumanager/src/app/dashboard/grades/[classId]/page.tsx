"use client";

import React, { useState, useEffect, use } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { studentService, StudentData } from "@/lib/services/student.service";
import { classService, ClassData } from "@/lib/services/class.service";
import { gradeService, GradeData } from "@/lib/services/grade.service";
import { useAuth } from "@/contexts/AuthContext";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2, ArrowLeft, Save, Upload, Download, Calculator } from "lucide-react";
import toast from "react-hot-toast";
import * as XLSX from "xlsx";
import Link from "next/link";

export default function GradeInputPage({ params }: { params: Promise<{ classId: string }> }) {
  const resolvedParams = use(params);
  const classId = resolvedParams.classId;
  const searchParams = useSearchParams();
  const router = useRouter();
  const { profile } = useAuth();

  const subject = searchParams.get("subject") || "";
  const academicYear = searchParams.get("academicYear") || "";

  const [classData, setClassData] = useState<ClassData | null>(null);
  const [students, setStudents] = useState<StudentData[]>([]);
  // Store grades for both semesters: studentId -> semester (1 | 2) -> GradeData
  const [grades, setGrades] = useState<Record<string, Record<number, GradeData>>>({});
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

        await loadGrades(classId, subject, academicYear, stds);
      } catch (error: any) {
        toast.error(error.message || "Lỗi tải dữ liệu");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [classId, subject, academicYear]);

  const loadGrades = async (cid: string, subj: string, ay: string, stds: StudentData[]) => {
    const allGrades = await gradeService.getAllSemesterGrades(cid, subj, ay);
    const gradeMap: Record<string, Record<number, GradeData>> = {};
    
    stds.forEach(std => {
      gradeMap[std.id!] = {
        1: { studentId: std.id!, classId: cid, subject: subj, academicYear: ay, semester: 1, tx1: null, tx2: null, tx3: null, tx4: null, gk: null, ck: null, average: null, comment: "" },
        2: { studentId: std.id!, classId: cid, subject: subj, academicYear: ay, semester: 2, tx1: null, tx2: null, tx3: null, tx4: null, gk: null, ck: null, average: null, comment: "" }
      };
    });

    allGrades.forEach(g => {
      if (gradeMap[g.studentId]) {
        gradeMap[g.studentId][g.semester] = g;
      }
    });

    setGrades(gradeMap);
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

  const handleGradeChange = (studentId: string, field: keyof GradeData, value: string) => {
    let numVal: number | null = null;
    if (value.trim() !== "") {
      numVal = parseFloat(value);
      if (isNaN(numVal) || numVal < 0 || numVal > 10) return; // Prevent invalid
    }

    setGrades(prev => {
      const updated = { ...prev[studentId][semester], [field]: numVal };
      updated.average = computeAverage(updated);
      return { 
        ...prev, 
        [studentId]: {
          ...prev[studentId],
          [semester]: updated
        } 
      };
    });
  };

  const handleCommentChange = (studentId: string, value: string) => {
    setGrades(prev => {
      const updated = { ...prev[studentId][semester], comment: value };
      return { 
        ...prev, 
        [studentId]: {
          ...prev[studentId],
          [semester]: updated
        } 
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Chỉ lưu điểm của học kỳ đang chọn (hoặc lưu cả 2, nhưng để tối ưu thì lưu học kỳ hiện tại)
      const gradesToSave = Object.values(grades).map(g => g[semester]);
      await gradeService.saveGradesBatch(gradesToSave);
      toast.success("Đã lưu bảng điểm thành công!");
      await loadGrades(classId, subject, academicYear, students);
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

            const updatedG = {
              ...newGrades[sid][semester],
              tx1: parseVal(row[5]),
              tx2: parseVal(row[6]),
              tx3: parseVal(row[7]),
              tx4: parseVal(row[8]),
              gk: parseVal(row[10]),
              ck: parseVal(row[11]),
            };
            updatedG.average = computeAverage(updatedG);
            
            newGrades[sid] = {
              ...newGrades[sid],
              [semester]: updatedG
            };
            updatedCount++;
          }
        }

        setGrades(newGrades);
        toast.success(`Đã trích xuất điểm cho ${updatedCount} học sinh! Nhấn "Lưu điểm" để hoàn tất.`);
      } catch (err) {
        console.error(err);
        toast.error("File Excel không hợp lệ.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ""; 
  };

  const handleDownloadTemplate = () => {
    const wsData: (string | number)[][] = [
      ["UBND  PHƯỜNG NGHĨA ĐÔ"],
      ["TRƯỜNG TH - THCS PASCAL"],
      ["BẢNG ĐIỂM HỌC KỲ"],
      [`Năm học: ${academicYear} - Học kỳ: ${semester === 1 ? 'I' : 'II'}`],
      [`Môn học: ${subject} - GV: ${profile?.fullName || ''}`],
      [],
      ["STT", "Mã định danh Bộ GD&ĐT", "Họ và tên", "Ngày sinh", "Giới tính", "ĐĐGtx", "", "", "", "ĐĐGgk", "ĐĐGck", "ĐTBmhk1", "ĐTBmhk2", "ĐTBmcn"]
    ];

    students.forEach((std, index) => {
      const row = [
        index + 1,
        std.studentCode || "",
        std.fullName,
        std.dob || "",
        "", // Giới tính
        "", "", "", "", // TX
        "", // GK
        "", // CK
        "", // HK1
        "", // HK2
        ""  // CN
      ];
      wsData.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Merge cells cho ĐĐGtx (Row 6, Col 5 to 8)
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r: 6, c: 5 }, e: { r: 6, c: 8 } });
    
    // Tùy chỉnh độ rộng cột
    ws['!cols'] = [
      { wch: 5 },  // STT
      { wch: 18 }, // Mã
      { wch: 25 }, // Tên
      { wch: 12 }, // Ngày sinh
      { wch: 10 }, // Giới tính
      { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, // TX
      { wch: 8 },  // GK
      { wch: 8 },  // CK
      { wch: 10 }, // HK1
      { wch: 10 }, // HK2
      { wch: 10 }  // CN
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Mau_Nhap_Diem`);
    XLSX.writeFile(wb, `Mau_Nhap_Diem_${classData?.name}_${subject}_HK${semester}.xlsx`);
  };

  const handleExportExcel = () => {
    const wsData: (string | number)[][] = [
      ["UBND  PHƯỜNG NGHĨA ĐÔ"],
      ["TRƯỜNG TH - THCS PASCAL"],
      ["BẢNG ĐIỂM HỌC KỲ"],
      [`Năm học: ${academicYear} - Học kỳ: ${semester === 1 ? 'I' : 'II'}`],
      [`Môn học: ${subject} - GV: ${profile?.fullName || ''}`],
      [],
      ["STT", "Mã định danh Bộ GD&ĐT", "Họ và tên", "Ngày sinh", "Giới tính", "ĐĐGtx", "", "", "", "ĐĐGgk", "ĐĐGck", "ĐTBmhk1", "ĐTBmhk2", "ĐTBmcn"]
    ];

    students.forEach((std, index) => {
      const hk1 = grades[std.id!]?.[1];
      const hk2 = grades[std.id!]?.[2];
      const currentSemGrade = grades[std.id!]?.[semester];
      
      let avgHK1 = hk1?.average ?? null;
      let avgHK2 = hk2?.average ?? null;
      let avgCN = null;
      
      if (avgHK1 !== null && avgHK2 !== null) {
        avgCN = Math.round(((avgHK1 + avgHK2 * 2) / 3) * 10) / 10;
      } else if (avgHK1 !== null && avgHK2 === null && semester === 1) {
        avgCN = null; // Chưa có đtb cả năm
      }

      const row = [
        index + 1,
        std.studentCode || "",
        std.fullName,
        std.dob || "",
        "", // Giới tính không có trong model student hiện tại
        currentSemGrade?.tx1 ?? "",
        currentSemGrade?.tx2 ?? "",
        currentSemGrade?.tx3 ?? "",
        currentSemGrade?.tx4 ?? "",
        currentSemGrade?.gk ?? "",
        currentSemGrade?.ck ?? "",
        avgHK1 ?? "",
        avgHK2 ?? "",
        avgCN ?? ""
      ];
      wsData.push(row);
    });

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    
    // Merge cells cho ĐĐGtx (Row 6, Col 5 to 8)
    if (!ws['!merges']) ws['!merges'] = [];
    ws['!merges'].push({ s: { r: 6, c: 5 }, e: { r: 6, c: 8 } });
    
    // Tùy chỉnh độ rộng cột
    ws['!cols'] = [
      { wch: 5 },  // STT
      { wch: 18 }, // Mã
      { wch: 25 }, // Tên
      { wch: 12 }, // Ngày sinh
      { wch: 10 }, // Giới tính
      { wch: 6 }, { wch: 6 }, { wch: 6 }, { wch: 6 }, // TX
      { wch: 8 },  // GK
      { wch: 8 },  // CK
      { wch: 10 }, // HK1
      { wch: 10 }, // HK2
      { wch: 10 }  // CN
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Lớp ${classData?.name} ${subject}`);
    XLSX.writeFile(wb, `Bang_Diem_${classData?.name}_${subject}_HK${semester}.xlsx`);
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
            
            <button
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300 px-4 py-2 rounded-lg font-bold transition-colors"
              title="Tải mẫu nhập điểm (trống)"
            >
              <Download size={18} />
              <span className="hidden sm:inline">Tải Mẫu Nhập Điểm</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 px-4 py-2 rounded-lg font-bold transition-colors"
              title="Xuất điểm hiện tại ra Excel"
            >
              <Download size={18} />
              <span className="hidden sm:inline">Xuất Điểm</span>
            </button>

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
                <span className="hidden sm:inline">Nhập Excel</span>
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
        <div className="bg-blue-50 border border-blue-100 text-blue-800 p-4 rounded-xl mb-6 flex flex-col md:flex-row items-start gap-3">
          <Calculator className="mt-0.5 shrink-0" size={20} />
          <div className="text-sm">
            <strong>Thông tư 22/2021/TT-BGDĐT:</strong> 
            <br />• <code>ĐTBmhk = [Tổng ĐĐGtx + (ĐĐGgk × 2) + (ĐĐGck × 3)] / (Số lượng ĐĐGtx + 5)</code>
            <br />• <code>ĐTBm cả năm = (ĐTBmhk1 + ĐTBmhk2 × 2) / 3</code>
          </div>
        </div>

        {/* Grade Grid */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse whitespace-nowrap min-w-[1000px]">
              <thead>
                <tr className="bg-slate-800 text-white text-sm font-semibold">
                  <th className="p-3 w-12 text-center border-r border-slate-700">STT</th>
                  <th className="p-3 border-r border-slate-700">Mã HS / Họ và tên</th>
                  <th className="p-3 text-center border-r border-slate-700" colSpan={4}>ĐĐG Thường xuyên (TX)</th>
                  <th className="p-3 text-center border-r border-slate-700 w-20">Giữa kỳ (GK)</th>
                  <th className="p-3 text-center border-r border-slate-700 w-20">Cuối kỳ (CK)</th>
                  <th className="p-3 text-center border-r border-slate-700 w-20">HK 1</th>
                  <th className="p-3 text-center border-r border-slate-700 w-20">HK 2</th>
                  <th className="p-3 text-center border-r border-slate-700 w-24 bg-slate-900">Cả năm</th>
                  <th className="p-3 text-center min-w-[200px] bg-slate-900">Nhận xét của GVBM</th>
                </tr>
                <tr className="bg-slate-700 text-slate-300 text-xs font-semibold">
                  <th className="p-2 text-center border-r border-slate-600"></th>
                  <th className="p-2 border-r border-slate-600">
                    <span className="text-[10px] uppercase opacity-75">Học kỳ đang nhập: {semester}</span>
                  </th>
                  <th className="p-2 text-center border-r border-slate-600 w-16">TX 1</th>
                  <th className="p-2 text-center border-r border-slate-600 w-16">TX 2</th>
                  <th className="p-2 text-center border-r border-slate-600 w-16">TX 3</th>
                  <th className="p-2 text-center border-r border-slate-600 w-16">TX 4</th>
                  <th className="p-2 text-center border-r border-slate-600">Hệ số 2</th>
                  <th className="p-2 text-center border-r border-slate-600">Hệ số 3</th>
                  <th className="p-2 text-center border-r border-slate-600">ĐTBmhk1</th>
                  <th className="p-2 text-center border-r border-slate-600">ĐTBmhk2</th>
                  <th className="p-2 text-center border-r border-slate-600 bg-slate-800">ĐTBmcn</th>
                  <th className="p-2 text-center bg-slate-800 font-normal italic">Hiển thị cho GVCN & PHHS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-8 text-center text-slate-500">Lớp chưa có học sinh nào.</td>
                  </tr>
                ) : (
                  students.map((student, index) => {
                    const studentGrades = grades[student.id!];
                    if (!studentGrades) return null;
                    
                    const g = studentGrades[semester];
                    const hk1Avg = studentGrades[1]?.average;
                    const hk2Avg = studentGrades[2]?.average;
                    
                    let cnAvg = null;
                    if (hk1Avg != null && hk2Avg != null) {
                      cnAvg = Math.round(((hk1Avg + hk2Avg * 2) / 3) * 10) / 10;
                    }

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
                              className="w-full text-center p-1.5 border border-slate-200 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none font-bold text-slate-900 bg-white"
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
                            className="w-full text-center p-1.5 border border-amber-200 rounded text-sm focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none font-bold text-slate-900 bg-white"
                          />
                        </td>

                        {/* CK */}
                        <td className="p-2 text-center border-r border-slate-100 bg-emerald-50/30">
                          <input
                            type="number"
                            min="0" max="10" step="0.1"
                            value={g.ck ?? ""}
                            onChange={(e) => handleGradeChange(student.id!, "ck", e.target.value)}
                            className="w-full text-center p-1.5 border border-emerald-200 rounded text-sm focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-bold text-slate-900 bg-white"
                          />
                        </td>

                        {/* HK1 */}
                        <td className="p-3 text-center border-r border-slate-100">
                          <span className={`inline-block font-bold text-sm ${hk1Avg == null ? "text-slate-300" : "text-slate-700"}`}>
                            {hk1Avg ?? "-"}
                          </span>
                        </td>
                        
                        {/* HK2 */}
                        <td className="p-3 text-center border-r border-slate-100">
                          <span className={`inline-block font-bold text-sm ${hk2Avg == null ? "text-slate-300" : "text-slate-700"}`}>
                            {hk2Avg ?? "-"}
                          </span>
                        </td>

                        {/* Cả năm */}
                        <td className="p-3 text-center border-r border-slate-100 bg-blue-50/50">
                          <span className={`inline-block px-3 py-1 rounded font-bold text-sm ${
                            cnAvg == null ? "text-slate-400" :
                            cnAvg >= 8.0 ? "text-blue-700 bg-blue-100" :
                            cnAvg >= 6.5 ? "text-emerald-700 bg-emerald-100" :
                            cnAvg >= 5.0 ? "text-amber-700 bg-amber-100" :
                            "text-red-700 bg-red-100"
                          }`}>
                            {cnAvg ?? "-"}
                          </span>
                        </td>
                        
                        {/* Comment */}
                        <td className="p-2 text-center bg-slate-50/50">
                          <input
                            type="text"
                            placeholder="Nhập đánh giá, nhận xét..."
                            value={g.comment ?? ""}
                            onChange={(e) => handleCommentChange(student.id!, e.target.value)}
                            className="w-full p-1.5 border border-slate-200 rounded text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none text-slate-800 placeholder-slate-400"
                          />
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

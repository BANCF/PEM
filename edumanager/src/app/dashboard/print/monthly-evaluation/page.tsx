"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { classService, ClassData } from "@/lib/services/class.service";
import { studentService, StudentData } from "@/lib/services/student.service";
import { assignmentService, ClassAssignmentData } from "@/lib/services/assignment.service";
import { monthlyEvaluationService, MonthlyEvaluationData } from "@/lib/services/monthly-evaluation.service";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Loader2 } from "lucide-react";

// Format: First Last Middle -> Last Middle First
// Example: Bằng Phạm Văn -> Phạm Văn Bằng
function formatVietnameseName(fullName: string) {
  const parts = fullName.trim().split(" ");
  if (parts.length > 1) {
    const firstName = parts.shift();
    return parts.join(" ") + " " + firstName;
  }
  return fullName;
}

export default function PrintMonthlyEvaluation() {
  const searchParams = useSearchParams();
  const classId = searchParams.get("classId");
  const month = parseInt(searchParams.get("month") || "1");

  const [classData, setClassData] = useState<ClassData | null>(null);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [evaluations, setEvaluations] = useState<Record<string, MonthlyEvaluationData>>({});
  const [teacherName, setTeacherName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // Statistics
  const [classAverages, setClassAverages] = useState({ math: 0, lit: 0, eng: 0 });
  const [rankings, setRankings] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!classId) return;

    const fetchData = async () => {
      try {
        const cls = await classService.getClassById(classId);
        if (!cls) return;
        setClassData(cls);

        const stds = await studentService.getStudentsByClassId(classId);
        setStudents(stds);

        const evals = await monthlyEvaluationService.getEvaluationsByClassAndMonth(
          classId,
          cls.academicYear,
          month
        );
        const evalMap: Record<string, MonthlyEvaluationData> = {};
        evals.forEach(e => { evalMap[e.studentId] = e; });
        setEvaluations(evalMap);

        // Calculate averages
        let mTotal = 0, mCount = 0;
        let lTotal = 0, lCount = 0;
        let eTotal = 0, eCount = 0;

        const studentTotals: { id: string, total: number }[] = [];

        stds.forEach(s => {
          const e = evalMap[s.id!];
          if (e) {
            let sTotal = 0;
            if (e.mathScore != null) { mTotal += e.mathScore; mCount++; sTotal += e.mathScore; }
            if (e.literatureScore != null) { lTotal += e.literatureScore; lCount++; sTotal += e.literatureScore; }
            if (e.englishScore != null) { eTotal += e.englishScore; eCount++; sTotal += e.englishScore; }
            studentTotals.push({ id: s.id!, total: sTotal });
          } else {
            studentTotals.push({ id: s.id!, total: 0 });
          }
        });

        setClassAverages({
          math: mCount > 0 ? Number((mTotal / mCount).toFixed(1)) : 0,
          lit: lCount > 0 ? Number((lTotal / lCount).toFixed(1)) : 0,
          eng: eCount > 0 ? Number((eTotal / eCount).toFixed(1)) : 0,
        });

        // Rank students
        studentTotals.sort((a, b) => b.total - a.total);
        const rankMap: Record<string, number> = {};
        let currentRank = 1;
        for (let i = 0; i < studentTotals.length; i++) {
          if (i > 0 && studentTotals[i].total < studentTotals[i - 1].total) {
            currentRank = i + 1;
          }
          rankMap[studentTotals[i].id] = currentRank;
        }
        setRankings(rankMap);

        // Find GVCN
        const assignments = await assignmentService.getAssignmentsByClassId(classId);
        const gvcnAssign = assignments.find(a => a.role === "GVCN" || a.role === "PCN");
        if (gvcnAssign) {
          const tDoc = await getDoc(doc(db, "users", gvcnAssign.teacherId));
          if (tDoc.exists()) {
            setTeacherName(tDoc.data().fullName || "");
          }
        }

        setLoading(false);

        // Auto print after rendering
        setTimeout(() => {
          window.print();
        }, 1000);

      } catch (error) {
        console.error("Error fetching data for print", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [classId, month]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50">
        <Loader2 className="animate-spin text-blue-500 w-12 h-12" />
        <span className="ml-3 text-lg font-medium text-slate-600">Đang chuẩn bị trang in...</span>
      </div>
    );
  }

  if (!classData || students.length === 0) {
    return <div className="p-10 text-center">Không tìm thấy dữ liệu.</div>;
  }

  return (
    <div className="bg-slate-200 min-h-screen py-10 print:bg-white print:py-0 flex flex-col items-center">
      
      {/* Hide controls when printing */}
      <div className="mb-4 print:hidden flex gap-4">
        <button 
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-blue-700 transition"
        >
          In tài liệu (hoặc lưu PDF)
        </button>
        <button 
          onClick={() => window.close()}
          className="bg-slate-100 text-slate-700 px-6 py-2 rounded-lg font-bold shadow-sm hover:bg-slate-200 border border-slate-300 transition"
        >
          Đóng tab
        </button>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @page { size: A4 portrait; margin: 0; }
        @media print {
          body { -webkit-print-color-adjust: exact; }
          .page-break { page-break-after: always; }
          /* Reset root styles that might cause unwanted margins */
          html, body { background: white; margin: 0; padding: 0; }
        }
      `}} />

      <div className="w-[210mm] shadow-2xl print:shadow-none bg-white">
        {students.map((student, index) => {
          const ev = evaluations[student.id!] || {};
          const rank = rankings[student.id!] || students.length;
          const isLast = index === students.length - 1;

          return (
            <div 
              key={student.id} 
              className={`w-[210mm] h-[297mm] p-[20mm] bg-white relative box-border ${!isLast ? 'page-break' : ''}`}
            >
              
              {/* HEADER TABLE */}
              <table className="w-full border-collapse mb-10">
                <tbody>
                  <tr>
                    <td className="w-1/2 text-center align-top pt-2">
                      <p className="font-bold text-[15px] uppercase leading-relaxed">UBND QUẬN BẮC TỪ LIÊM</p>
                      <p className="font-bold text-[16px] uppercase text-red-600 underline underline-offset-4 decoration-2">TRƯỜNG TH - THCS PASCAL</p>
                    </td>
                    <td className="w-1/2 text-center align-top">
                      <p className="font-bold text-[15px] uppercase leading-relaxed">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                      <p className="font-bold text-[16px] underline underline-offset-4 decoration-2">Độc lập - Tự do - Hạnh phúc</p>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* TITLE */}
              <div className="text-center mb-10">
                <h1 className="text-2xl font-bold uppercase text-slate-900 mb-2">KẾT QUẢ HỌC TẬP THÁNG {month}</h1>
                <h2 className="text-lg font-bold text-slate-800">NĂM HỌC {classData.academicYear}</h2>
              </div>

              {/* STUDENT INFO */}
              <div className="mb-8 text-[16px] leading-loose">
                <div className="flex">
                  <span className="w-32 font-bold">Họ và tên học sinh:</span>
                  <span className="font-semibold ml-2 uppercase text-blue-900">{formatVietnameseName(student.fullName)}</span>
                  <span className="ml-auto w-16 font-bold">Lớp:</span>
                  <span className="font-semibold text-blue-900 w-24">{classData.name}</span>
                </div>
                
                <div className="flex mt-2">
                  <span className="w-32 font-bold">Xếp hạng:</span>
                  <span className="font-bold text-red-600 ml-2">{rank} / {students.length}</span>
                </div>

                <div className="mt-6 border border-slate-300 p-4 rounded-lg bg-slate-50">
                  <p className="font-bold text-slate-800 mb-3 uppercase text-sm border-b border-slate-200 pb-2">Điểm trung bình các môn lớp {classData.name}</p>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <span className="font-semibold">Môn Toán:</span> 
                      <span className="ml-2 font-bold text-blue-700">{classAverages.math}</span>
                    </div>
                    <div>
                      <span className="font-semibold">Môn Văn:</span> 
                      <span className="ml-2 font-bold text-orange-700">{classAverages.lit}</span>
                    </div>
                    <div>
                      <span className="font-semibold">Môn Anh:</span> 
                      <span className="ml-2 font-bold text-emerald-700">{classAverages.eng}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SCORES TABLE */}
              <table className="w-full border-collapse border border-black mb-12">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-black p-3 text-center w-32 font-bold text-[16px]">Môn</th>
                    <th className="border border-black p-3 text-center w-24 font-bold text-[16px]">Điểm</th>
                    <th className="border border-black p-3 text-center font-bold text-[16px]">Nhận xét</th>
                  </tr>
                </thead>
                <tbody className="text-[16px]">
                  <tr>
                    <td className="border border-black p-3 font-semibold text-center h-16 align-middle">Toán</td>
                    <td className="border border-black p-3 text-center font-bold text-lg">{ev.mathScore ?? ""}</td>
                    <td className="border border-black p-3 italic align-middle">{ev.mathComment || ""}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-3 font-semibold text-center h-16 align-middle">Văn</td>
                    <td className="border border-black p-3 text-center font-bold text-lg">{ev.literatureScore ?? ""}</td>
                    <td className="border border-black p-3 italic align-middle">{ev.literatureComment || ""}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-3 font-semibold text-center h-16 align-middle">Anh</td>
                    <td className="border border-black p-3 text-center font-bold text-lg">{ev.englishScore ?? ""}</td>
                    <td className="border border-black p-3 italic align-middle">{ev.englishComment || ""}</td>
                  </tr>
                </tbody>
              </table>

              {/* SIGNATURE */}
              <div className="flex justify-end pr-10 mt-20">
                <div className="text-center">
                  <p className="italic text-[15px] mb-2">Hà Nội, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}</p>
                  <p className="font-bold text-[16px] mb-24">Giáo viên chủ nhiệm</p>
                  <p className="font-bold text-[16px] uppercase">{teacherName}</p>
                </div>
              </div>
              
              {/* Footer text */}
              <div className="absolute bottom-10 left-0 right-0 text-center">
                <p className="text-sm text-slate-400 italic">Phiếu đánh giá kết quả học tập tháng {month}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

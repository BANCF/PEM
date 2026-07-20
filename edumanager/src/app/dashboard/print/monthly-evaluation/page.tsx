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
  if (!fullName) return "";
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
            // Apply name formatting to teacher!
            setTeacherName(formatVietnameseName(tDoc.data().fullName || ""));
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

      <div className="w-[210mm] shadow-2xl print:shadow-none bg-white text-black font-serif">
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
              <div className="flex mb-10">
                <div className="w-1/2"></div>
                <div className="w-1/2 text-center">
                  <p className="font-bold text-[16px] uppercase">{"TRƯỜNG TIỂU HỌC - TRUNG HỌC CƠ SỞ PASCAL".normalize('NFC')}</p>
                  <p className="font-bold text-[15px] uppercase">{"PASCAL PRIMARY AND SECONDARY SCHOOL".normalize('NFC')}</p>
                </div>
              </div>

              {/* TITLE */}
              <div className="text-center mb-10">
                <h1 className="text-2xl font-bold uppercase mb-2">{"KẾT QUẢ HỌC TẬP THÁNG ".normalize('NFC')}{month}</h1>
                <h2 className="text-lg font-bold">{"NĂM HỌC ".normalize('NFC')}{classData.academicYear}</h2>
              </div>

              {/* STUDENT INFO */}
              <div className="mb-8 text-[16px] leading-loose">
                <div className="flex">
                  <span className="w-40 font-bold whitespace-nowrap">{"Họ và tên học sinh:".normalize('NFC')}</span>
                  <span className="font-bold ml-2 uppercase flex-1">{student.fullName.normalize('NFC')}</span>
                  <span className="ml-auto w-16 font-bold">{"Lớp:".normalize('NFC')}</span>
                  <span className="font-bold w-24">{classData.name.normalize('NFC')}</span>
                </div>
                
                <div className="flex mt-2">
                  <span className="w-40 font-bold whitespace-nowrap">{"Xếp hạng:".normalize('NFC')}</span>
                  <span className="font-bold ml-2">{rank} / {students.length}</span>
                </div>

                <div className="mt-4">
                  <p className="mb-2">{"Điểm trung bình các môn lớp ".normalize('NFC')}{classData.name.normalize('NFC')}</p>
                  <div className="flex gap-16">
                    <div>
                      <span className="">{"Môn Toán:".normalize('NFC')}</span> 
                      <span className="ml-2 font-bold">{classAverages.math}</span>
                    </div>
                    <div>
                      <span className="">{"Môn Văn:".normalize('NFC')}</span> 
                      <span className="ml-2 font-bold">{classAverages.lit}</span>
                    </div>
                    <div>
                      <span className="">{"Môn Anh:".normalize('NFC')}</span> 
                      <span className="ml-2 font-bold">{classAverages.eng}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SCORES TABLE */}
              <table className="w-full border-collapse border border-black mb-12">
                <thead>
                  <tr>
                    <th className="border border-black p-3 text-center w-32 font-bold text-[16px]">{"Môn".normalize('NFC')}</th>
                    <th className="border border-black p-3 text-center w-24 font-bold text-[16px]">{"Điểm".normalize('NFC')}</th>
                    <th className="border border-black p-3 text-center font-bold text-[16px]">{"Nhận xét".normalize('NFC')}</th>
                  </tr>
                </thead>
                <tbody className="text-[16px]">
                  <tr>
                    <td className="border border-black p-3 font-bold text-center h-16 align-middle">{"Toán".normalize('NFC')}</td>
                    <td className="border border-black p-3 text-center font-bold text-lg">{ev.mathScore ?? ""}</td>
                    <td className="border border-black p-3 align-middle">{(ev.mathComment || "").normalize('NFC')}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-3 font-bold text-center h-16 align-middle">{"Văn".normalize('NFC')}</td>
                    <td className="border border-black p-3 text-center font-bold text-lg">{ev.literatureScore ?? ""}</td>
                    <td className="border border-black p-3 align-middle">{(ev.literatureComment || "").normalize('NFC')}</td>
                  </tr>
                  <tr>
                    <td className="border border-black p-3 font-bold text-center h-16 align-middle">{"Anh".normalize('NFC')}</td>
                    <td className="border border-black p-3 text-center font-bold text-lg">{ev.englishScore ?? ""}</td>
                    <td className="border border-black p-3 align-middle">{(ev.englishComment || "").normalize('NFC')}</td>
                  </tr>
                </tbody>
              </table>

              {/* SIGNATURE */}
              <div className="flex justify-end pr-10 mt-20">
                <div className="text-center">
                  <p className="italic text-[15px] mb-2">{"Hà Nội, ngày ".normalize('NFC')}{new Date().getDate()}{" tháng ".normalize('NFC')}{new Date().getMonth() + 1}{" năm ".normalize('NFC')}{new Date().getFullYear()}</p>
                  <p className="font-bold text-[16px] mb-24">{"Giáo viên chủ nhiệm".normalize('NFC')}</p>
                  <p className="font-bold text-[16px] uppercase">{teacherName.normalize('NFC')}</p>
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

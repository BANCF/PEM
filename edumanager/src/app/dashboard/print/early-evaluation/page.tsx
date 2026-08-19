"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { StudentData, studentService } from "@/lib/services/student.service";
import { ClassData, classService } from "@/lib/services/class.service";
import { EarlyEvaluationData, earlyEvaluationService } from "@/lib/services/early-evaluation.service";
import { assignmentService } from "@/lib/services/assignment.service";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Loader2 } from "lucide-react";
function PrintEarlyEvaluationContent() {
  const searchParams = useSearchParams();
  const classId = searchParams.get("classId");

  const [classData, setClassData] = useState<ClassData | null>(null);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [evaluations, setEvaluations] = useState<Record<string, EarlyEvaluationData>>({});
  const [teacherName, setTeacherName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!classId) return;

    const fetchData = async () => {
      try {
        const cls = await classService.getClassById(classId);
        if (!cls) return;
        setClassData(cls);

        const stds = await studentService.getStudentsByClassId(classId);
        setStudents(stds);

        const evals = await earlyEvaluationService.getEvaluationsByClass(
          classId,
          cls.academicYear
        );
        const evalMap: Record<string, EarlyEvaluationData> = {};
        evals.forEach(e => { evalMap[e.studentId] = e; });
        setEvaluations(evalMap);

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
        
        setTimeout(() => {
          window.print();
        }, 1000);
      } catch (error) {
        console.error("Error fetching print data:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [classId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="text-gray-600 font-medium">Đang chuẩn bị dữ liệu in...</p>
      </div>
    );
  }

  if (!classData || students.length === 0) {
    return <div className="p-8 text-center text-red-500">Không có dữ liệu để in.</div>;
  }

  return (
    <div className="bg-gray-100 min-h-screen p-4 print:p-0 print:bg-transparent flex flex-col items-center hide-scrollbar">
      <style dangerouslySetInnerHTML={{__html: `
        @import url('https://fonts.googleapis.com/css2?family=Tinos:ital,wght@0,400;0,700;1,400;1,700&display=swap');
        @page { size: A4 portrait; margin: 0; }
        @media print {
          body { -webkit-print-color-adjust: exact; }
          .page-break { page-break-after: always; break-after: page; }
          html, body { background: white; margin: 0; padding: 0; }
        }
        .font-tinos {
          font-family: 'Tinos', 'Times New Roman', serif;
        }
      `}} />
      {/* Nút In trên màn hình */}
      <div className="mb-6 flex gap-4 print:hidden sticky top-4 z-50 bg-white p-4 rounded-xl shadow-lg border border-slate-200">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold transition-all shadow-sm"
        >
          <i className="fa fa-print"></i>
          In Tất Cả
        </button>
        <button
          onClick={() => window.close()}
          className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium transition-colors"
        >
          Đóng
        </button>
      </div>

      {/* Pages Container */}
      <div className="w-[210mm] shadow-2xl print:shadow-none bg-white text-black font-tinos print:mx-0 mx-auto flex flex-col gap-0 print:gap-0">
        {students.map((student, index) => {
          const ev = evaluations[student.id!] || {};
          const isLast = index === students.length - 1;

          return (
            <div 
              key={student.id} 
              className={`w-[210mm] h-[297mm] px-[20mm] pt-[5mm] pb-[10mm] bg-white relative box-border flex flex-col ${!isLast ? 'page-break' : ''}`}
            >
              
              {/* HEADER TABLE */}
              <div className="flex items-center justify-center gap-4 mb-4 pb-2 border-b border-black">
                <img src="/logo-pascal-01.png" alt="Pascal Logo" className="w-16 h-auto object-contain shrink-0" />
                <div className="text-left">
                  <p className="font-bold text-[17px] uppercase text-[#a01d23] leading-snug">TRƯỜNG TIỂU HỌC - TRUNG HỌC CƠ SỞ PASCAL</p>
                  <p className="font-bold text-[17px] uppercase text-[#1d1d1b] leading-snug mt-0.5">PASCAL PRIMARY AND SECONDARY SCHOOL</p>
                </div>
              </div>

              {/* TITLE */}
              <div className="text-center mb-6">
                <h1 className="text-[21px] font-bold uppercase mb-1">PHIẾU BÁO ĐIỂM KHẢO SÁT CHẤT LƯỢNG ĐẦU NĂM</h1>
                <h2 className="text-[17px] font-bold uppercase">NĂM HỌC {classData.academicYear}</h2>
              </div>

              {/* STUDENT INFO */}
              <div className="flex justify-between text-[16px] mb-4 font-bold">
                <div>
                  Họ và tên học sinh:
                  <span className="ml-4 uppercase font-bold">{student.fullName}</span>
                </div>
                <div className="mr-8">
                  Lớp:
                  <span className="ml-4">{classData.name}</span>
                </div>
              </div>

              {/* SCORES TABLE WITH WATERMARK */}
              <div className="relative mb-4 text-[16px]">
                {/* Watermark */}
                <div className="absolute inset-0 flex justify-center items-center pointer-events-none opacity-[0.1] z-0">
                  <img src="/logo-pascal-01.png" alt="Watermark" className="w-[280px] h-auto" />
                </div>
                
                <div className="font-bold mb-3 z-10 relative">1. Kết quả học tập và rèn luyện</div>
                <table className="w-full border-collapse border border-black relative z-10 bg-transparent">
                  <thead>
                    <tr>
                      <th className="border border-black p-2 text-center w-28 font-bold text-[16px] h-[35px]">Môn</th>
                      <th className="border border-black p-2 text-center w-24 font-bold text-[16px]">Điểm</th>
                      <th className="border border-black p-2 text-center font-bold text-[16px]">Nhận xét</th>
                    </tr>
                  </thead>
                  <tbody className="text-[15px]">
                    <tr>
                      <td className="border border-black p-2 px-3 text-center align-middle">Toán</td>
                      <td className="border border-black p-2 text-center font-bold text-lg">{ev.mathScore ?? ""}</td>
                      <td className="border border-black p-2 px-3 align-middle leading-snug whitespace-pre-wrap">{ev.mathComment || ""}</td>
                    </tr>
                    <tr>
                      <td className="border border-black p-2 px-3 text-center align-middle">Văn</td>
                      <td className="border border-black p-2 text-center font-bold text-lg">{ev.literatureScore ?? ""}</td>
                      <td className="border border-black p-2 px-3 align-middle leading-snug whitespace-pre-wrap">{ev.literatureComment || ""}</td>
                    </tr>
                    <tr>
                      <td className="border border-black p-2 px-3 text-center align-middle">Anh</td>
                      <td className="border border-black p-2 text-center font-bold text-lg">{ev.englishScore ?? ""}</td>
                      <td className="border border-black p-2 px-3 align-middle leading-snug whitespace-pre-wrap">{ev.englishComment || ""}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* GVCN COMMENTS */}
              <div className="text-[16px] leading-[1.5] flex-1 z-10 relative">
                <div className="font-bold mb-2">2. Nhận xét của GVCN:</div>
                <div className="space-y-3">
                  <div>
                    <span className="font-medium">+ Về đạo đức, tác phong: </span>
                    <span className="whitespace-pre-wrap break-words">{ev.behavior || ""}</span>
                  </div>
                  <div>
                    <span className="font-medium">+ Ý thức tham gia hoạt động, tinh thần trách nhiệm: </span>
                    <span className="whitespace-pre-wrap break-words">{ev.activity || ""}</span>
                  </div>
                  <div>
                    <span className="font-medium">+ Về học tập: </span>
                    <span className="whitespace-pre-wrap break-words">{ev.learning || ""}</span>
                  </div>
                  <div>
                    <span className="font-medium">+ Cần khắc phục: </span>
                    <span className="whitespace-pre-wrap break-words">{ev.improvement || ""}</span>
                  </div>
                </div>
              </div>

              {/* SIGNATURE */}
              <div className="mt-4 flex justify-end pr-10 z-10 relative">
                <div className="text-center">
                  <p className="italic text-[15px] mb-1">Hà Nội, ngày ... tháng ... năm {new Date().getFullYear()}</p>
                  <p className="font-bold text-[15px] mb-14">Giáo viên chủ nhiệm</p>
                  <p className="font-bold text-[15px] uppercase">{teacherName}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PrintEarlyEvaluationPage() {
  return (
    <Suspense fallback={
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500 mb-4" />
        <p className="text-gray-600 font-medium">Đang tải...</p>
      </div>
    }>
      <PrintEarlyEvaluationContent />
    </Suspense>
  );
}

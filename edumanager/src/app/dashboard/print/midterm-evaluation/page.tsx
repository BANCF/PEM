"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { classService, ClassData } from "@/lib/services/class.service";
import { studentService, StudentData } from "@/lib/services/student.service";
import { assignmentService } from "@/lib/services/assignment.service";
import {
  midtermEvaluationService,
  MidtermEvaluationData,
  MIDTERM_SUBJECTS,
} from "@/lib/services/midterm-evaluation.service";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Loader2 } from "lucide-react";

export default function PrintMidtermEvaluation() {
  const searchParams = useSearchParams();
  const classId = searchParams.get("classId");
  const semester = parseInt(searchParams.get("semester") || "1");

  const [classData, setClassData] = useState<ClassData | null>(null);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [evaluations, setEvaluations] = useState<Record<string, MidtermEvaluationData>>({});
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

        const evals = await midtermEvaluationService.getEvaluationsByClassAndSemester(
          classId,
          cls.academicYear,
          semester
        );
        const evalMap: Record<string, MidtermEvaluationData> = {};
        evals.forEach((e) => {
          evalMap[e.studentId] = e;
        });
        setEvaluations(evalMap);

        // Find GVCN
        const assignments = await assignmentService.getAssignmentsByClassId(classId);
        const gvcnAssign = assignments.find((a) => a.role === "GVCN" || a.role === "PCN");
        if (gvcnAssign) {
          const tDoc = await getDoc(doc(db, "users", gvcnAssign.teacherId));
          if (tDoc.exists()) {
            setTeacherName(tDoc.data().fullName || "");
          }
        }

        setLoading(false);

        // Auto trigger print after render
        setTimeout(() => {
          window.print();
        }, 1000);
      } catch (error) {
        console.error("Error fetching data for midterm print:", error);
        setLoading(false);
      }
    };

    fetchData();
  }, [classId, semester]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50">
        <Loader2 className="animate-spin text-blue-500 w-12 h-12" />
        <span className="ml-3 text-lg font-medium text-slate-600">
          Đang chuẩn bị trang in phiếu báo điểm GHKI...
        </span>
      </div>
    );
  }

  if (!classData || students.length === 0) {
    return <div className="p-10 text-center">Không tìm thấy dữ liệu học sinh hoặc lớp học.</div>;
  }

  const romanSemester = semester === 1 ? "I" : "II";

  return (
    <div className="bg-slate-200 min-h-screen py-10 print:bg-white print:py-0 print:block flex flex-col items-center">
      {/* Print Controls (Hidden on print) */}
      <div className="mb-4 print:hidden flex gap-4">
        <button
          onClick={() => window.print()}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg font-bold shadow-md hover:bg-blue-700 transition"
        >
          In tài liệu (hoặc Lưu PDF)
        </button>
        <button
          onClick={() => window.close()}
          className="bg-slate-100 text-slate-700 px-6 py-2 rounded-lg font-bold shadow-sm hover:bg-slate-200 border border-slate-300 transition"
        >
          Đóng tab
        </button>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Tinos:ital,wght@0,400;0,700;1,400;1,700&display=swap');
        @page { size: A4 portrait; margin: 0; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page-break { page-break-after: always; break-after: page; }
          html, body { background: white; margin: 0; padding: 0; }
        }
        .font-tinos {
          font-family: 'Tinos', 'Times New Roman', serif;
        }
      `,
        }}
      />

      <div className="w-[210mm] shadow-2xl print:shadow-none bg-white text-black font-tinos print:mx-0 mx-auto">
        {students.map((student, index) => {
          const ev = evaluations[student.id!] || {};
          const isLast = index === students.length - 1;

          return (
            <div
              key={student.id}
              className={`w-[210mm] h-[297mm] px-[20mm] pt-[12mm] pb-[16mm] bg-white relative box-border flex flex-col justify-between ${
                !isLast ? "page-break" : ""
              }`}
            >
              <div>
                {/* HEADER: LOGO VÀ TÊN TRƯỜNG CHÍNH GIỮA */}
                <div className="flex items-center justify-center gap-4 border-b border-black pb-3 mb-2">
                  <img
                    src="/logo-pascal-01.png"
                    alt="Pascal Logo"
                    className="w-16 h-auto object-contain shrink-0"
                  />
                  <div className="text-left">
                    <p className="font-bold text-[17px] uppercase text-[#a01d23] leading-snug">
                      TRƯỜNG TIỂU HỌC – TRUNG HỌC CƠ SỞ PASCAL
                    </p>
                    <p className="font-bold text-[16px] uppercase text-[#1d1d1b] leading-snug mt-0.5">
                      PASCAL PRIMARY AND SECONDARY SCHOOL
                    </p>
                  </div>
                </div>

                {/* NGÀY THÁNG NĂM TÁCH RIÊNG DÒNG KHÁC */}
                <div className="text-right italic text-[14px] text-slate-800 mb-2">
                  Hà Nội, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}
                </div>

                {/* TITLE */}
                <div className="text-center my-3">
                  <h1 className="text-[21px] font-bold uppercase tracking-wide">
                    PHIẾU BÁO ĐIỂM GIỮA HỌC KÌ {romanSemester}
                  </h1>
                  <h2 className="text-[17px] font-bold uppercase mt-0.5">
                    NĂM HỌC {classData.academicYear}
                  </h2>
                </div>

                {/* STUDENT INFO */}
                <div className="flex justify-between text-[16px] font-bold mb-3 px-1">
                  <div>
                    <span>Họ và tên học sinh: </span>
                    <span className="uppercase text-[17px] text-blue-900 ml-1">
                      {student.fullName}
                    </span>
                  </div>
                  <div className="mr-6">
                    <span>Lớp: </span>
                    <span className="ml-1">{classData.name}</span>
                  </div>
                </div>

                {/* SECTION 1: KẾT QUẢ HỌC TẬP */}
                <div className="mb-4">
                  <p className="font-bold text-[16px] mb-1.5">1. Kết quả học tập:</p>

                  <div className="relative">
                    {/* Watermark in background */}
                    <div className="absolute inset-0 flex justify-center items-center pointer-events-none opacity-[0.07] z-0">
                      <img src="/logo-pascal-01.png" alt="Watermark" className="w-[260px] h-auto" />
                    </div>

                    <table className="w-full border-collapse border border-black relative z-10 bg-transparent text-[15px]">
                      <thead>
                        <tr className="bg-slate-50/70">
                          <th className="border border-black p-1.5 text-center w-12 font-bold">STT</th>
                          <th className="border border-black p-1.5 text-left pl-3 font-bold w-52">Môn</th>
                          <th className="border border-black p-1.5 text-center w-28 font-bold">Điểm hệ số 1</th>
                          <th className="border border-black p-1.5 text-center w-28 font-bold">Điểm hệ số 1</th>
                          <th className="border border-black p-1.5 text-center w-36 font-bold">Điểm khảo sát GHKI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {MIDTERM_SUBJECTS.map((subj, sIdx) => {
                          const sc = ev.subjects?.[subj.id] || {};

                          if (subj.isEvaluationOnly) {
                            const evalText = sc.evaluation || "Đạt";
                            return (
                              <tr key={subj.id} className="h-[27px]">
                                <td className="border border-black text-center p-1 font-medium">{sIdx + 1}</td>
                                <td className="border border-black p-1 pl-3 font-medium">{subj.name}</td>
                                <td className="border border-black text-center p-1 font-semibold" colSpan={3}>
                                  {evalText}
                                </td>
                              </tr>
                            );
                          }

                          return (
                            <tr key={subj.id} className="h-[27px]">
                              <td className="border border-black text-center p-1 font-medium">{sIdx + 1}</td>
                              <td className="border border-black p-1 pl-3 font-medium">{subj.name}</td>
                              <td className="border border-black text-center p-1 font-bold">
                                {sc.tx1 !== null && sc.tx1 !== undefined ? sc.tx1 : ""}
                              </td>
                              <td className="border border-black text-center p-1 font-bold">
                                {sc.tx2 !== null && sc.tx2 !== undefined ? sc.tx2 : ""}
                              </td>
                              <td className="border border-black text-center p-1 font-bold text-[16px]">
                                {sc.gk !== null && sc.gk !== undefined ? sc.gk : ""}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* SECTION 2: NHẬN XÉT CỦA GVCN / GVBM */}
                <div className="text-[15px] space-y-2 mt-3">
                  <p className="font-bold text-[16px]">2. Nhận xét của GVCN/GVBM:</p>

                  <div className="pl-2 space-y-2 text-justify leading-relaxed">
                    <div>
                      <span className="font-bold">• Nhận xét chung: </span>
                      <span>
                        {ev.generalComment || "Học sinh chấp hành tốt nội quy nề nếp của lớp, có ý thức rèn luyện và xây dựng bài."}
                      </span>
                    </div>

                    <div>
                      <span className="font-bold">• Nhận xét môn Toán: </span>
                      <span>
                        {ev.subjects?.toan?.comment || "Nắm chắc kiến thức trọng tâm, tích cực tham gia các hoạt động học tập."}
                      </span>
                    </div>

                    <div>
                      <span className="font-bold">• Nhận xét môn Ngữ Văn: </span>
                      <span>
                        {ev.subjects?.van?.comment || "Có ý thức học tập tốt, viết bài lưu loát và hoàn thành đầy đủ bài tập."}
                      </span>
                    </div>

                    <div>
                      <span className="font-bold">• Nhận xét môn Tiếng Anh: </span>
                      <span>
                        {ev.subjects?.anh?.comment || "Tích cực giao tiếp, phát âm chuẩn, hoàn thành tốt nhiệm vụ được giao."}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* FOOTER SIGNATURE */}
              <div className="flex justify-end pr-10 mb-2">
                <div className="text-center">
                  <p className="font-bold text-[16px] uppercase mb-16">GIÁO VIÊN CHỦ NHIỆM</p>
                  <p className="font-bold text-[16px] uppercase tracking-wide">{teacherName}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

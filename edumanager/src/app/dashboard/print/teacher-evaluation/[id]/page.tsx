"use client";

import React, { useState, useEffect, use } from "react";
import { 
  teacherThiDuaService, 
  TeacherThiDuaEvaluation 
} from "@/lib/services/teacherThiDua.service";
import { THI_DUA_CRITERIA_GROUPS } from "@/lib/constants/thiDuaCriteria";
import { Printer, Loader2 } from "lucide-react";

export default function PrintTeacherEvaluationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<TeacherThiDuaEvaluation | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await teacherThiDuaService.getEvaluationById(id);
        setData(res);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    );
  }

  if (!data) {
    return <div className="p-8 text-center text-slate-500">Không tìm thấy dữ liệu phiếu đánh giá.</div>;
  }

  return (
    <div className="bg-slate-100 min-h-screen p-6 print:p-0 print:bg-white text-slate-900" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
      {/* Floating Action Bar */}
      <div className="max-w-4xl mx-auto mb-6 flex justify-end print:hidden">
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-sans font-medium transition shadow-md"
        >
          <Printer size={18} />
          <span>In Phiếu / Lưu PDF</span>
        </button>
      </div>

      {/* A4 Paper Container */}
      <div className="max-w-4xl mx-auto bg-white p-10 print:p-0 border print:border-none shadow-lg print:shadow-none text-sm" style={{ fontFamily: "'Times New Roman', Times, serif" }}>
        {/* Header with Logo */}
        <div className="flex items-center justify-center gap-4 mb-6 pb-4 border-b border-black">
          <img src="/logo-pascal-01.png" alt="Pascal Logo" className="w-16 h-auto object-contain shrink-0" />
          <div className="text-left">
            <h3 className="font-bold text-[17px] uppercase text-[#a01d23] leading-snug">
              TRƯỜNG TIỂU HỌC - TRUNG HỌC CƠ SỞ PASCAL
            </h3>
            <p className="font-bold text-[17px] uppercase text-[#1d1d1b] leading-snug mt-0.5">
              PASCAL PRIMARY AND SECONDARY SCHOOL
            </p>
          </div>
        </div>

        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="font-bold text-xl uppercase">BẢN ĐÁNH GIÁ THI ĐUA THÁNG {data.month}</h1>
          <p className="italic text-xs text-slate-600 mt-1">Năm học {data.year || "2025 - 2026"}</p>
        </div>

        {/* Teacher Metadata */}
        <div className="space-y-1.5 mb-6 text-sm border-b pb-4">
          <div className="flex justify-between">
            <p><strong>Họ và tên:</strong> {data.teacherName}</p>
            <p><strong>Chức vụ:</strong> {data.position || "Giáo viên"}</p>
          </div>
          <div className="flex justify-between">
            <p><strong>Tổ công tác:</strong> {data.department || "Tổ Chuyên Môn"}</p>
            <p><strong>Kỳ đánh giá:</strong> Tháng {data.month}</p>
          </div>
        </div>

        {/* Main Criteria Table */}
        <table className="w-full border-collapse border border-black text-xs text-left mb-6">
          <thead>
            <tr className="bg-slate-100 text-center font-bold">
              <th className="border border-black p-2 w-1/2" rowSpan={2}>Nội dung các tiêu chuẩn, tiêu chí</th>
              <th className="border border-black p-2 w-12" rowSpan={2}>Điểm TĐ</th>
              <th className="border border-black p-2" colSpan={3}>Kết quả đánh giá</th>
            </tr>
            <tr className="bg-slate-100 text-center font-bold">
              <th className="border border-black p-1.5 w-24">Cá nhân tự chấm</th>
              <th className="border border-black p-1.5 w-24">TTCM đánh giá</th>
              <th className="border border-black p-1.5 w-24">BGH đánh giá</th>
            </tr>
          </thead>
          <tbody>
            {THI_DUA_CRITERIA_GROUPS.map(group => (
              <React.Fragment key={group.id}>
                {/* Group Title Row */}
                <tr className="bg-slate-50 font-bold uppercase">
                  <td className="border border-black p-2">{group.title}</td>
                  <td className="border border-black p-2 text-center font-bold">{group.maxScore}</td>
                  <td className="border border-black p-2 text-center"></td>
                  <td className="border border-black p-2 text-center"></td>
                  <td className="border border-black p-2 text-center"></td>
                </tr>

                {/* Criteria Rows */}
                {group.items.map(item => {
                  const itemScore = data.scores?.[item.id] || { self: item.maxScore, ttcm: item.maxScore, bgh: item.maxScore };

                  return (
                    <tr key={item.id}>
                      <td className="border border-black p-2">
                        <p className="font-semibold">{item.title}</p>
                      </td>
                      <td className="border border-black p-2 text-center font-semibold">{item.maxScore}</td>
                      <td className="border border-black p-2 text-center font-bold">{itemScore.self}</td>
                      <td className="border border-black p-2 text-center font-bold text-amber-900">{itemScore.ttcm}</td>
                      <td className="border border-black p-2 text-center font-bold text-emerald-900">{itemScore.bgh}</td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}

            {/* Total Row */}
            <tr className="font-bold text-sm bg-slate-100">
              <td className="border border-black p-2 text-right uppercase font-bold">TỔNG ĐIỂM</td>
              <td className="border border-black p-2 text-center font-bold">210</td>
              <td className="border border-black p-2 text-center font-black text-blue-900">{data.totalSelfScore}</td>
              <td className="border border-black p-2 text-center font-black text-amber-900">{data.totalTtcmScore}</td>
              <td className="border border-black p-2 text-center font-black text-emerald-900">{data.totalBghScore}</td>
            </tr>
          </tbody>
        </table>

        {/* BGH Final Summary Box */}
        <div className="border border-black p-4 mb-8 space-y-2 bg-slate-50/50">
          <div className="flex justify-between font-bold text-sm">
            <span>ĐÁNH GIÁ CỦA BAN GIÁM HIỆU:</span>
            <span>Xếp loại: <u className="uppercase">{data.ranking || "Loại A"}</u></span>
          </div>
          <p className="text-xs italic">
            <strong>Tổng điểm BGH chốt:</strong> {data.totalBghScore} / 210 điểm
          </p>
          {data.bghNote && (
            <p className="text-xs">
              <strong>Ghi chú/Chỉ đạo của BGH:</strong> {data.bghNote}
            </p>
          )}
        </div>

        {/* 3 Signature Blocks */}
        <div className="grid grid-cols-3 text-center gap-4 pt-4 text-xs font-semibold">
          <div>
            <p className="font-bold uppercase">BAN GIÁM HIỆU</p>
            <p className="italic text-[11px] font-normal text-slate-500 mb-14">(Ký và ghi rõ họ tên)</p>
            <p className="font-bold">{data.approvedBghBy || "................................"}</p>
          </div>

          <div>
            <p className="font-bold uppercase">TỔ TRƯỞNG CHUYÊN MÔN</p>
            <p className="italic text-[11px] font-normal text-slate-500 mb-14">(Ký và ghi rõ họ tên)</p>
            <p className="font-bold">{data.reviewedTtcmBy || "................................"}</p>
          </div>

          <div>
            <p className="font-bold uppercase">NGƯỜI TỰ ĐÁNH GIÁ</p>
            <p className="italic text-[11px] font-normal text-slate-500 mb-14">(Ký và ghi rõ họ tên)</p>
            <p className="font-bold">{data.teacherName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import { CertificateTemplate } from "@/types/certificate";
import { getTemplates } from "@/lib/firebase/certificates";
import { Award, Printer, Sliders, Sparkles, CheckCircle2, ArrowRight, Layers, ShieldCheck } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

export default function CertificatesOverviewPage() {
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const data = await getTemplates();
      setTemplates(data);
    } catch (error) {
      toast.error("Không thể tải danh sách phôi mẫu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-8">
      {/* Hero Banner */}
      <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-8 md:p-10 rounded-3xl border border-slate-800 shadow-2xl">
        <div className="absolute -right-10 -bottom-10 opacity-10 pointer-events-none">
          <Award className="w-96 h-96 text-white" />
        </div>

        <div className="relative z-10 max-w-3xl space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-amber-500/20 text-amber-300 rounded-full text-xs font-bold border border-amber-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Hệ thống Quản lý Khen thưởng & Chứng nhận Thi đua</span>
          </div>

          <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight">
            Số Hóa Quy Trình <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500">Cấp Phát Giấy Khen</span> Sư Phạm
          </h1>

          <p className="text-slate-300 text-base md:text-lg leading-relaxed">
            Tích hợp sẵn 9 phôi chứng nhận chuẩn mực cùng font chữ thư pháp <strong>UTM Viceroy JF</strong>. Hỗ trợ gán danh hiệu riêng cho từng học sinh, tự động co dãn kích cỡ chữ và xuất file PDF chuẩn vector 300 DPI để in ấn siêu nét chỉ với 1 cú nhấp chuột.
          </p>

          <div className="pt-2 flex flex-wrap gap-4">
            <Link
              href="/dashboard/certificates/generate"
              className="px-6 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-2xl shadow-xl shadow-emerald-600/30 transition flex items-center space-x-3 text-base group"
            >
              <Printer className="w-5 h-5" />
              <span>Cấp Phát Giấy Khen Cho Lớp</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
            </Link>
          </div>
        </div>
      </div>

      {/* Main Module Card */}
      <div className="grid grid-cols-1 gap-6">
        <Link
          href="/dashboard/certificates/generate"
          className="group bg-white dark:bg-slate-900 p-8 rounded-3xl border-2 border-slate-200 dark:border-slate-800 hover:border-emerald-500/50 dark:hover:border-emerald-500/50 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
        >
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition duration-300">
              <Printer className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition">
                Lập & Tải PDF Giấy Khen Theo Lớp
              </h2>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 leading-relaxed">
                Giáo viên chọn lớp học, tại mỗi danh sách học sinh có thể chọn các danh hiệu khác nhau (HS Giỏi, HS Xuất sắc, Hoa Chăm Ngoan, Vượt trội môn...). Hệ thống tự tạo 1 file PDF tổng hợp duy nhất cho cả lớp.
              </p>
            </div>
          </div>
          
          <div className="pt-6 mt-6 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
            <span className="flex items-center">
              <ShieldCheck className="w-4 h-4 mr-1.5" />
              Thuật toán co dãn chữ & canh giữa
            </span>
            <span className="flex items-center group-hover:translate-x-1 transition">
              Vào trình tạo <ArrowRight className="w-4 h-4 ml-1" />
            </span>
          </div>
        </Link>
      </div>

      {/* Grid preview of 9 default templates */}
      <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center">
              <Award className="w-5 h-5 mr-2 text-amber-500" />
              <span>Ngân Hàng 9 Mẫu Phôi Chứng Nhận Tiêu Chuẩn</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Toàn bộ phôi đã được nạp sẵn vào hệ thống với tỷ lệ chuẩn in ấn A4 Ngang
            </p>
          </div>

          <Link
            href="/dashboard/certificates/templates"
            className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center self-start sm:self-auto"
          >
            <span>Xem & chỉnh tọa độ chi tiết</span>
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {templates.map((tmpl) => (
              <div
                key={tmpl.id}
                className="group relative bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-2xl border border-slate-200 dark:border-slate-700/60 hover:shadow-lg transition-all"
              >
                <div className="w-full aspect-[1.414] rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 mb-2.5 shadow-inner">
                  <img
                    src={tmpl.bgUrl}
                    alt={tmpl.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                  />
                </div>
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                    {tmpl.name}
                  </span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 ml-1" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

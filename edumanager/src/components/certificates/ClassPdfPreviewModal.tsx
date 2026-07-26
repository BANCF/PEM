"use client";

import React, { useState, useEffect } from "react";
import { CertificateTemplate, StudentAwardSelection } from "@/types/certificate";
import { generateClassPreviewPdfBlobUrl } from "@/lib/utils/certificatePdfGenerator";
import { X, Loader2, Layers, Sparkles } from "lucide-react";
import toast from "react-hot-toast";

interface ClassPdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: CertificateTemplate[];
  selections: StudentAwardSelection[];
  className: string;
  issueDate?: string;
  printMode?: "full_color" | "text_only";
}

export default function ClassPdfPreviewModal({
  isOpen,
  onClose,
  templates,
  selections,
  className,
  issueDate,
  printMode = "full_color"
}: ClassPdfPreviewModalProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && templates.length > 0 && selections.length > 0) {
      renderPdf();
    } else {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }
    }
  }, [isOpen, templates, selections]);

  const renderPdf = async () => {
    const awardedCount = selections.filter(s => s.templateId && s.templateId !== "none").length;
    if (awardedCount === 0) {
      toast.error("Vui lòng chọn giải thưởng cho ít nhất 1 học sinh để xem trước.");
      onClose();
      return;
    }

    setLoading(true);
    try {
      const url = await generateClassPreviewPdfBlobUrl(
        templates,
        selections,
        className,
        issueDate || new Date().toISOString(),
        printMode
      );
      setPdfUrl(url);
    } catch (error) {
      console.error("Error generating class preview PDF:", error);
      toast.error("Lỗi khi xem trước trọn bộ lớp PDF");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const awardedCount = selections.filter(s => s.templateId && s.templateId !== "none").length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 sm:p-6 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-6xl h-[92vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg shadow-blue-500/20 text-white">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Xem Trước Trọn Bộ Lớp: {className}</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
                  {awardedCount} Tờ Giấy Khen
                </span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Hiển thị toàn bộ bản in thực tế theo danh sách khen thưởng đã chọn
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/60 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: PDF Iframe Viewer */}
        <div className="flex-1 bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center space-y-3 text-slate-300">
              <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
              <span className="text-sm font-medium">Đang tạo bản xem trước cho {awardedCount} giấy khen...</span>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={`${pdfUrl}#toolbar=1&navpanes=1`}
              className="w-full h-full rounded-xl border border-slate-800 bg-white shadow-xl"
              title="Class PDF Preview"
            />
          ) : (
            <span className="text-slate-500 text-sm">Không thể xem trước giấy khen.</span>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center space-x-1.5 text-amber-400 font-medium">
            <Sparkles className="w-4 h-4" />
            <span>Bạn có thể cuộn (scroll) hoặc dùng thanh điều hướng trong khung xem trước để kiểm tra từng học sinh!</span>
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition"
          >
            Đóng cửa sổ
          </button>
        </div>

      </div>
    </div>
  );
}

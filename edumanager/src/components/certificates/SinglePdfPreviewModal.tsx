"use client";

import React, { useState, useEffect } from "react";
import { CertificateTemplate, StudentAwardSelection } from "@/types/certificate";
import { generateSingleCertificateBlobUrl } from "@/lib/utils/certificatePdfGenerator";
import { X, Loader2, Download, Eye, Sparkles } from "lucide-react";
import toast from "react-hot-toast";

interface SinglePdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  template: CertificateTemplate | null;
  selection: StudentAwardSelection | null;
  className: string;
  issueDate?: string;
  printMode?: "full_color" | "text_only";
}

export default function SinglePdfPreviewModal({
  isOpen,
  onClose,
  template,
  selection,
  className,
  issueDate,
  printMode = "full_color"
}: SinglePdfPreviewModalProps) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && template && selection) {
      renderPdf();
    } else {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
        setPdfUrl(null);
      }
    }
  }, [isOpen, template, selection]);

  const renderPdf = async () => {
    if (!template || !selection) return;
    setLoading(true);
    try {
      const url = await generateSingleCertificateBlobUrl({
        template,
        selection,
        className,
        issueDate: issueDate || new Date().toISOString(),
        printMode
      });
      setPdfUrl(url);
    } catch (error) {
      console.error("Error generating preview PDF:", error);
      toast.error("Lỗi khi xem trước giấy khen PDF");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 sm:p-6 animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/30">
              <Eye className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base flex items-center gap-2">
                <span>Xem Trước Giấy Khen Thực Tế (PDF)</span>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-mono">
                  100% Giống Khi In
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Học sinh: <strong className="text-white">{selection?.studentName}</strong> | Mẫu phôi: <strong className="text-emerald-400">{template?.name}</strong>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: PDF Iframe Viewer */}
        <div className="flex-1 bg-slate-950 flex items-center justify-center p-4 relative overflow-hidden">
          {loading ? (
            <div className="flex flex-col items-center space-y-3 text-slate-300">
              <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
              <span className="text-sm font-medium">Đang tạo bản xem trước PDF...</span>
            </div>
          ) : pdfUrl ? (
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0`}
              className="w-full h-full rounded-xl border border-slate-800 bg-white shadow-xl"
              title="PDF Preview"
            />
          ) : (
            <span className="text-slate-500 text-sm">Không thể xem trước giấy khen.</span>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span>💡 Đây là trang PDF thật được xuất trực tiếp từ bộ vẽ pdf-lib.</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition"
          >
            Đóng
          </button>
        </div>

      </div>
    </div>
  );
}

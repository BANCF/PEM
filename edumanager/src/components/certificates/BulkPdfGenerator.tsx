"use client";

import React, { useState } from "react";
import { CertificateTemplate, StudentAwardSelection } from "@/types/certificate";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { Download, Printer, Loader2, Sparkles, AlertCircle, FileCheck } from "lucide-react";
import toast from "react-hot-toast";

interface BulkPdfGeneratorProps {
  templates: CertificateTemplate[];
  selections: StudentAwardSelection[];
  className: string;
}

export default function BulkPdfGenerator({
  templates,
  selections,
  className
}: BulkPdfGeneratorProps) {
  const [generating, setGenerating] = useState(false);
  const [printMode, setPrintMode] = useState<"full_color" | "text_only">("full_color");
  const [progress, setProgress] = useState("");

  const validSelections = selections.filter(s => s.templateId && s.templateId !== "none");

  // Helper to convert hex (#B22222) to pdf-lib rgb(r, g, b)
  const hexToPdfRgb = (hex: string) => {
    const cleanHex = hex.replace("#", "");
    const bigint = parseInt(cleanHex, 16);
    const r = ((bigint >> 16) & 255) / 255;
    const g = ((bigint >> 8) & 255) / 255;
    const b = (bigint & 255) / 255;
    return rgb(r, g, b);
  };

  const generateAndDownloadPdf = async () => {
    if (validSelections.length === 0) {
      toast.error("Vui lòng chọn giải thưởng cho ít nhất 1 học sinh trước khi tải!");
      return;
    }

    setGenerating(true);
    setProgress("Đang khởi tạo bộ máy tạo PDF...");

    try {
      const pdfDoc = await PDFDocument.create();
      pdfDoc.registerFontkit(fontkit);

      // 1. Load calligraphy font UTM ViceroyJF
      setProgress("Đang tải phông chữ thư pháp UTM Viceroy JF...");
      const fontResponse = await fetch("/certi/UTM ViceroyJF.ttf");
      if (!fontResponse.ok) throw new Error("Không thể tải file font UTM ViceroyJF.ttf");
      const fontBytes = await fontResponse.arrayBuffer();
      const customFont = await pdfDoc.embedFont(fontBytes, { subset: false });

      // 2. Cache loaded template backgrounds to avoid redundant network requests
      const bgImageCache: { [url: string]: any } = {};

      for (let i = 0; i < validSelections.length; i++) {
        const selection = validSelections[i];
        setProgress(`Đang tạo trang ${i + 1}/${validSelections.length}: ${selection.studentName}...`);

        const template = templates.find(t => t.id === selection.templateId);
        if (!template) continue;

        const page = pdfDoc.addPage([template.width, template.height]);

        // Draw template background image if in Full Color mode
        if (printMode === "full_color") {
          if (!bgImageCache[template.bgUrl]) {
            const imgRes = await fetch(template.bgUrl);
            const imgBytes = await imgRes.arrayBuffer();
            let bgImage;
            try {
              bgImage = await pdfDoc.embedPng(imgBytes);
            } catch {
              bgImage = await pdfDoc.embedJpg(imgBytes);
            }
            bgImageCache[template.bgUrl] = bgImage;
          }
          const cachedImg = bgImageCache[template.bgUrl];
          page.drawImage(cachedImg, {
            x: 0,
            y: 0,
            width: template.width,
            height: template.height
          });
        }

        // 3. Render dynamic text fields with Auto-fitting typography
        for (const field of template.fields) {
          let textContent = "";
          if (field.id === "student_name") textContent = selection.customStudentName || selection.studentName;
          else if (field.id === "class_name") textContent = selection.customClassName || selection.className;
          else if (field.id === "award_title") textContent = selection.customAwardTitle || selection.customNote || "";
          else continue;

          if (!textContent) continue;

          // Apply manual per-student scale (%)
          const scaleFactor = (selection.customFontSizeScale || 100) / 100;
          let fontSize = field.fontSize * scaleFactor;

          // Dynamic Auto-fitting: Check text width against maxWidth
          let textWidth = customFont.widthOfTextAtSize(textContent, fontSize);
          if (field.maxWidth && textWidth > field.maxWidth) {
            // Scale font size down proportionally so it fits inside maxWidth
            fontSize = fontSize * (field.maxWidth / textWidth);
            textWidth = customFont.widthOfTextAtSize(textContent, fontSize);
          }

          // Calculate X coordinate based on alignment anchor (field.x is the center/anchor point)
          let x = field.x;
          if (field.textAlign === "center") {
            x = field.x - (textWidth / 2); // Centered around configured field.x
          } else if (field.textAlign === "right") {
            x = field.x - textWidth;
          }

          // Calculate Y coordinate in pdf-lib (bottom-up coordinates)
          // Subtract slight baseline offset for script font
          const y = template.height - field.y - (fontSize * 0.28);

          const color = hexToPdfRgb(field.color || "#000000");

          page.drawText(textContent, {
            x,
            y,
            size: fontSize,
            font: customFont,
            color
          });
        }
      }

      // 4. Save and trigger download
      setProgress("Đang đóng gói file PDF...");
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes) as unknown as BlobPart], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const cleanClassName = className.replace(/[^a-zA-Z0-9]/g, "_") || "Lop";
      link.download = `Giay_Khen_Lop_${cleanClassName}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(`Đã tải về file PDF chứa ${validSelections.length} giấy khen!`);
    } catch (error: any) {
      console.error("Error generating bulk certificates PDF:", error);
      toast.error(`Lỗi tạo file PDF: ${error?.message || "Vui lòng kiểm tra lại tải ảnh phôi"}`);
    } finally {
      setGenerating(false);
      setProgress("");
    }
  };

  return (
    <div className="bg-slate-900 p-5 rounded-2xl border border-slate-800 text-white shadow-xl space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
            <Printer className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base flex items-center">
              <span>Trình Tạo & Xuất PDF Giấy Khen Hàng Loạt</span>
              <span className="ml-2 bg-green-500/20 text-green-300 text-[11px] px-2 py-0.5 rounded-full font-bold">
                {validSelections.length} em được khen thưởng
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Sử dụng thuật toán tự động co dãn chữ & canh tâm tuyệt đối với phông UTM Viceroy JF
            </p>
          </div>
        </div>

        {/* Mode switcher */}
        <div className="flex items-center space-x-2 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
          <button
            onClick={() => setPrintMode("full_color")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              printMode === "full_color"
                ? "bg-blue-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>In màu toàn bộ (Phôi + Chữ)</span>
          </button>
          <button
            onClick={() => setPrintMode("text_only")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center space-x-1.5 ${
              printMode === "text_only"
                ? "bg-amber-600 text-white shadow"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Chỉ in chữ (In đè phôi cứng)</span>
          </button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
        <div className="text-xs text-slate-400 space-y-1">
          <p className="flex items-center text-slate-300 font-medium">
            💡 Chế độ đang chọn: {printMode === "full_color" ? "In trọn gói cả phôi màu và chữ lên giấy trắng" : "Ẩn hình ảnh phôi, chỉ in phần chữ văn bản đè lên tờ giấy khen cứng mua sẵn"}
          </p>
          <p>Tệp PDF tải về định dạng A4 ngang, định dạng độ phân giải chuẩn in ấn vector.</p>
        </div>

        <button
          onClick={generateAndDownloadPdf}
          disabled={generating || validSelections.length === 0}
          className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-600/30 transition flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed min-w-[240px]"
        >
          {generating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">{progress || "Đang xử lý..."}</span>
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              <span className="text-sm">Tải PDF Giấy Khen ({validSelections.length} em)</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

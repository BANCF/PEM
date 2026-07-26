"use client";

import React, { useState, useRef, useEffect } from "react";
import { CertificateTemplate, CertificateField } from "@/types/certificate";
import { ZoomIn, ZoomOut, RotateCcw, Move, Eye, EyeOff } from "lucide-react";

interface TemplatePreviewCanvasProps {
  template: CertificateTemplate;
  onFieldChange: (updatedField: CertificateField) => void;
  sampleStudentName?: string;
  sampleClassName?: string;
  readOnly?: boolean;
}

export default function TemplatePreviewCanvas({
  template,
  onFieldChange,
  sampleStudentName = "Nguyễn Hoàng Thảo Mai Phương Anh",
  sampleClassName = "Lớp 6G01",
  readOnly = false
}: TemplatePreviewCanvasProps) {
  const [zoom, setZoom] = useState(0.8);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>("student_name");
  const [showGuides, setShowGuides] = useState(true);
  const [draggingFieldId, setDraggingFieldId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Load custom font in browser for preview
  useEffect(() => {
    const font = new FontFace("UTM ViceroyJF", "url('/certi/UTM ViceroyJF.ttf')");
    font.load().then((loadedFont) => {
      document.fonts.add(loadedFont);
    }).catch((err) => {
      console.warn("Could not load UTM ViceroyJF font for canvas preview:", err);
    });
  }, []);

  const handleMouseDown = (e: React.MouseEvent, field: CertificateField) => {
    if (readOnly) return;
    e.stopPropagation();
    setSelectedFieldId(field.id);
    setDraggingFieldId(field.id);

    // Calculate offset from center of text element
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left - rect.width / 2,
      y: e.clientY - rect.top - rect.height / 2
    });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingFieldId || readOnly || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const relativeX = (e.clientX - containerRect.left) / zoom;
    const relativeY = (e.clientY - containerRect.top) / zoom;

    // Clamp coordinates inside template bounds
    const clampedX = Math.max(50, Math.min(template.width - 50, relativeX));
    const clampedY = Math.max(30, Math.min(template.height - 30, relativeY));

    const field = template.fields.find(f => f.id === draggingFieldId);
    if (field) {
      onFieldChange({
        ...field,
        x: Math.round(clampedX),
        y: Math.round(clampedY)
      });
    }
  };

  const handleMouseUp = () => {
    setDraggingFieldId(null);
  };

  const getPreviewText = (fieldId: string) => {
    if (fieldId === "student_name") return sampleStudentName;
    if (fieldId === "class_name") return sampleClassName;
    return "Văn bản mẫu";
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* Canvas Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 bg-slate-800/80 border-b border-slate-700/60 text-slate-300">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2.5 py-1 rounded-lg border border-blue-500/20">
            Xem trước Phôi & Tọa độ
          </span>
          {!readOnly && (
            <span className="text-xs text-slate-400 flex items-center">
              <Move className="w-3.5 h-3.5 mr-1 text-slate-500 inline" />
              Kéo thả chuột trên chữ để di chuyển tọa độ X, Y
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowGuides(!showGuides)}
            className={`p-1.5 rounded-lg text-xs flex items-center space-x-1 transition-all ${
              showGuides ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-400 hover:text-white"
            }`}
            title="Hiện/Ẩn đường gióng tâm"
          >
            {showGuides ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">Trục gióng</span>
          </button>

          <div className="h-4 w-px bg-slate-700 mx-1" />

          <button
            onClick={() => setZoom(Math.max(0.4, zoom - 0.1))}
            className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 hover:text-white transition-all"
            title="Thu nhỏ"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="text-xs font-mono w-12 text-center text-slate-300">{Math.round(zoom * 100)}%</span>
          <button
            onClick={() => setZoom(Math.min(1.5, zoom + 0.1))}
            className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 hover:text-white transition-all"
            title="Phóng to"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setZoom(0.8)}
            className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 hover:text-white transition-all"
            title="Mặc định"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Canvas Workspace */}
      <div 
        className="flex-1 overflow-auto p-6 flex items-center justify-center bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px]"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          ref={containerRef}
          className="relative shadow-2xl transition-all duration-75 select-none bg-white origin-center rounded-sm"
          style={{
            width: `${template.width}px`,
            height: `${template.height}px`,
            transform: `scale(${zoom})`,
            backgroundImage: `url('${template.bgUrl}')`,
            backgroundSize: "100% 100%",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat"
          }}
        >
          {/* Top Horizontal Ruler Bar (Thước đo X ngang) */}
          <div className="absolute -top-8 left-0 right-0 h-7 bg-slate-900/90 border-b border-blue-500/40 flex items-end pointer-events-none select-none z-20 overflow-visible rounded-t">
            {[0, 100, 200, 300, 400, 500, 600, 700, 800].map((tick) => (
              <div
                key={tick}
                className="absolute bottom-0 flex flex-col items-center -translate-x-1/2"
                style={{ left: `${(tick / template.width) * 100}%` }}
              >
                <span className="text-[9px] font-mono font-bold text-blue-300 mb-0.5">{tick}pt</span>
                <div className="w-px h-2.5 bg-blue-400/80" />
              </div>
            ))}
          </div>

          {/* Active Field Red Vertical Guideline & X Marker (Đường dóng màu đỏ) */}
          {selectedFieldId && (
            <div
              className="absolute top-0 bottom-0 border-l-2 border-red-500 pointer-events-none z-30 flex flex-col items-center"
              style={{ left: `${template.fields.find(f => f.id === selectedFieldId)?.x || 0}px` }}
            >
              <div className="bg-red-600 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shadow-lg -mt-8 -translate-x-1/2 whitespace-nowrap z-40 border border-red-300 flex items-center space-x-1">
                <span>📍</span>
                <span>{template.fields.find(f => f.id === selectedFieldId)?.label}: X = {template.fields.find(f => f.id === selectedFieldId)?.x}pt</span>
              </div>
            </div>
          )}

          {/* Center Vertical Guide Line */}
          {showGuides && (
            <div 
              className="absolute top-0 bottom-0 border-l border-dashed border-blue-500/40 pointer-events-none z-10 flex flex-col items-center justify-center"
              style={{ left: `${template.width / 2}px` }}
            >
              <span className="bg-blue-600/80 text-white text-[9px] font-mono px-1.5 py-0.5 rounded shadow -translate-x-1/2 -mt-48">
                Tâm (421pt)
              </span>
            </div>
          )}

          {/* Render Editable Text Fields */}
          {template.fields.map((field) => {
            const isSelected = selectedFieldId === field.id;
            const textContent = getPreviewText(field.id);
            
            // Auto-scaling visual approximation in HTML preview (tương đương thuật toán co dãn trong pdf-lib)
            let displayFontSize = field.fontSize;
            const estimatedCharWidth = field.fontFamily === "UTM ViceroyJF" ? field.fontSize * 0.45 : field.fontSize * 0.55;
            const estimatedTextWidth = textContent.length * estimatedCharWidth;
            if (field.maxWidth && estimatedTextWidth > field.maxWidth) {
              displayFontSize = Math.max(14, field.fontSize * (field.maxWidth / estimatedTextWidth));
            }

            return (
              <div
                key={field.id}
                onMouseDown={(e) => handleMouseDown(e, field)}
                className={`absolute cursor-move transition-shadow duration-150 flex flex-col justify-center ${
                  field.textAlign === "left" ? "items-start" : field.textAlign === "right" ? "items-end" : "items-center"
                } ${
                  isSelected && !readOnly 
                    ? "ring-2 ring-blue-500 bg-blue-500/10 rounded px-3 py-1 shadow-lg z-20" 
                    : "hover:ring-1 hover:ring-slate-400/50 rounded px-2 py-0.5 z-10"
                }`}
                style={{
                  left: `${field.x}px`,
                  top: `${field.y}px`,
                  transform: field.textAlign === "left" 
                    ? "translate(0%, -50%)" 
                    : field.textAlign === "right" 
                    ? "translate(-100%, -50%)" 
                    : "translate(-50%, -50%)",
                  width: field.maxWidth ? `${field.maxWidth}px` : "auto",
                  maxWidth: `${template.width - 60}px`
                }}
              >
                {/* Bounding box guide when selected */}
                {isSelected && showGuides && !readOnly && (
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-mono px-2 py-0.5 rounded shadow whitespace-nowrap flex items-center space-x-1">
                    <span>{field.label}: X={field.x}, Y={field.y}</span>
                    <span className="text-blue-200">| MaxW: {field.maxWidth}pt</span>
                  </div>
                )}

                <span
                  style={{
                    fontFamily: field.fontFamily === "UTM ViceroyJF" ? "'UTM ViceroyJF', cursive, serif" : field.fontFamily,
                    fontSize: `${displayFontSize}px`,
                    color: field.color || "#000000",
                    textAlign: field.textAlign || "center",
                    lineHeight: 1.1,
                    textShadow: "0 1px 2px rgba(255,255,255,0.8)"
                  }}
                  className="w-full whitespace-nowrap overflow-visible px-1"
                >
                  {textContent}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Canvas Footer Bar */}
      <div className="px-4 py-2.5 bg-slate-800 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center space-x-4">
          <span>Kích thước phôi: <strong className="text-slate-200">{Math.round(template.width)} x {Math.round(template.height)} pt</strong> (A4 Ngang)</span>
          <span>Đang chọn: <strong className="text-blue-400">{template.fields.find(f => f.id === selectedFieldId)?.label || "Chưa chọn"}</strong></span>
        </div>
        <div className="text-slate-400 font-medium">
          Mẹo: Giữ và kéo chữ để đặt đúng vị trí hoa văn
        </div>
      </div>
    </div>
  );
}

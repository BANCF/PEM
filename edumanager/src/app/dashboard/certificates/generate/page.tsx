"use client";

import React, { useState, useEffect } from "react";
import { CertificateTemplate, StudentAwardSelection, CertificatePreset } from "@/types/certificate";
import { getTemplates, getPresets } from "@/lib/firebase/certificates";
import { classService, ClassData } from "@/lib/services/class.service";
import { studentService, StudentData } from "@/lib/services/student.service";
import BulkPdfGenerator from "@/components/certificates/BulkPdfGenerator";
import SinglePdfPreviewModal from "@/components/certificates/SinglePdfPreviewModal";
import ClassPdfPreviewModal from "@/components/certificates/ClassPdfPreviewModal";
import { Award, Users, Filter, Sparkles, CheckSquare, XSquare, Search, ArrowLeft, Sliders, Layers, Eye, Wrench, Check } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

export default function GenerateCertificatesPage() {
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [presets, setPresets] = useState<CertificatePreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("");
  const [selections, setSelections] = useState<StudentAwardSelection[]>([]);
  
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<CertificateTemplate | null>(null);
  const [previewSelection, setPreviewSelection] = useState<StudentAwardSelection | null>(null);

  // Class Preview Modal State
  const [classPreviewModalOpen, setClassPreviewModalOpen] = useState(false);

  // Manual Student Edit State
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [customNameInput, setCustomNameInput] = useState("");
  const [customClassInput, setCustomClassInput] = useState("");
  const [customNoteInput, setCustomNoteInput] = useState("");

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoadingClasses(true);
    try {
      const [clsList, tmplList, presetList] = await Promise.all([
        classService.getAllClasses(),
        getTemplates(),
        getPresets()
      ]);
      setClasses(clsList);
      setPresets(presetList);
      
      if (presetList.length > 0) {
        const activePreset = presetList.find(p => p.isActive) || presetList[0];
        setSelectedPresetId(activePreset.id);
        if (activePreset.templates && activePreset.templates.length > 0) {
          setTemplates(activePreset.templates);
        } else {
          setTemplates(tmplList);
        }
      } else {
        setTemplates(tmplList);
      }

      if (clsList.length > 0) {
        handleSelectClass(clsList[0]);
      }
    } catch (error) {
      toast.error("Lỗi khi tải danh sách lớp và phôi");
    } finally {
      setLoadingClasses(false);
    }
  };

  const handlePresetChange = (presetId: string) => {
    setSelectedPresetId(presetId);
    const target = presets.find(p => p.id === presetId);
    if (target && target.templates) {
      setTemplates(target.templates);
      toast.success(`Đã áp dụng bộ phôi: "${target.name}" cho việc tạo PDF`);
    }
  };

  const handleSelectClass = async (cls: ClassData) => {
    setSelectedClass(cls);
    setLoadingStudents(true);
    try {
      if (!cls.id) return;
      const stdList = await studentService.getStudentsByClassId(cls.id);
      setStudents(stdList);

      // Initialize default selections (no award selected initially)
      const initialSelections: StudentAwardSelection[] = stdList.map((std) => ({
        studentId: std.id || Math.random().toString(),
        studentName: std.fullName,
        classId: cls.id!,
        className: cls.name,
        templateId: "none",
        customFontSizeScale: 100
      }));
      setSelections(initialSelections);
    } catch (error) {
      toast.error("Lỗi khi tải danh sách học sinh");
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleUpdateSelection = (studentId: string, templateId: string) => {
    setSelections((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, templateId } : s))
    );
  };

  const handleUpdateScale = (studentId: string, scale: number) => {
    setSelections((prev) =>
      prev.map((s) => (s.studentId === studentId ? { ...s, customFontSizeScale: scale } : s))
    );
  };

  const handleQuickAssignAll = (templateId: string) => {
    setSelections((prev) =>
      prev.map((s) => ({ ...s, templateId }))
    );
    const tmplName = templates.find(t => t.id === templateId)?.name || "Không khen thưởng";
    toast.success(`Đã gán nhanh "${tmplName}" cho toàn bộ danh sách!`);
  };

  const handlePreviewStudent = (stdId: string) => {
    const sel = selections.find(s => s.studentId === stdId);
    if (!sel || sel.templateId === "none") {
      toast.error("Vui lòng chọn Mẫu Giấy Khen cho học sinh này trước khi xem trước");
      return;
    }
    const tmpl = templates.find(t => t.id === sel.templateId);
    if (!tmpl) return;
    setPreviewSelection(sel);
    setPreviewTemplate(tmpl);
    setPreviewModalOpen(true);
  };

  const handleOpenEditStudent = (stdId: string) => {
    const sel = selections.find(s => s.studentId === stdId);
    if (!sel) return;
    setEditingStudentId(stdId);
    setCustomNameInput(sel.customStudentName || sel.studentName);
    setCustomClassInput(sel.customClassName || sel.className);
    setCustomNoteInput(sel.customAwardTitle || sel.customNote || "");
  };

  const handleSaveEditStudent = () => {
    if (!editingStudentId) return;
    setSelections(prev => prev.map(s => {
      if (s.studentId === editingStudentId) {
        return {
          ...s,
          customStudentName: customNameInput.trim() || undefined,
          customClassName: customClassInput.trim() || undefined,
          customAwardTitle: customNoteInput.trim() || undefined
        };
      }
      return s;
    }));
    setEditingStudentId(null);
    toast.success("Đã lưu thông tin chỉnh sửa thủ công cho học sinh!");
  };

  const filteredStudents = students.filter((std) =>
    std.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (std.studentCode && std.studentCode.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const awardedCount = selections.filter((s) => s.templateId && s.templateId !== "none").length;

  if (loadingClasses) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      <SinglePdfPreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        template={previewTemplate}
        selection={previewSelection}
        className={selectedClass?.name || "Lớp"}
      />
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg shadow-emerald-500/20">
            <Users className="w-8 h-8 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-black tracking-tight">Cấp Phát & In Giấy Khen Theo Lớp</h1>
              <span className="bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-0.5 rounded-full font-bold border border-emerald-500/30">
                Tự Động Điền Tên
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Chọn danh hiệu riêng cho từng học sinh, hệ thống tự động co dãn chữ & tạo file PDF in ấn
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Preset Selection Dropdown */}
          <div className="flex items-center space-x-2 bg-slate-800/90 px-3.5 py-2 rounded-xl border border-slate-700 shadow-inner">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-slate-300">Bộ phôi dùng:</span>
            <select
              value={selectedPresetId}
              onChange={(e) => handlePresetChange(e.target.value)}
              className="bg-slate-900 text-emerald-400 font-extrabold text-xs px-3 py-1 rounded-lg border border-slate-600 focus:outline-none cursor-pointer"
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id} className="bg-slate-900 text-white font-bold">
                  🏆 {p.name} {p.isDefault ? "(Mặc định)" : ""}
                </option>
              ))}
            </select>
          </div>

          <Link
            href="/dashboard/certificates"
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-medium transition flex items-center space-x-2 border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại</span>
          </Link>
          <Link
            href="/dashboard/certificates/templates"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition flex items-center space-x-2 shadow-lg shadow-indigo-600/20"
          >
            <Sliders className="w-4 h-4" />
            <span>Cấu Hình Tọa Độ Mẫu</span>
          </Link>
        </div>
      </div>

      {/* Class Selector Tabs */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-400 mr-2 flex items-center">
          <Filter className="w-3.5 h-3.5 mr-1 text-blue-500" />
          Chọn Lớp ({classes.length}):
        </span>
        {classes.map((cls) => {
          const isSelected = selectedClass?.id === cls.id;
          return (
            <button
              key={cls.id}
              onClick={() => handleSelectClass(cls)}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                isSelected
                  ? "bg-blue-600 text-white shadow-md shadow-blue-500/25"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {cls.name}
            </button>
          );
        })}
      </div>

      {/* Main Generator Section */}
      {selectedClass && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column: Student List & Per-Student Award Selector (8 Cols) */}
          <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
            
            {/* Toolbar */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-800 dark:text-white">
                  Danh Sách Học Sinh: <strong className="text-blue-600 dark:text-blue-400">{selectedClass.name}</strong>
                </span>
                <span className="text-xs bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full font-mono text-slate-600 dark:text-slate-300">
                  {students.length} học sinh
                </span>
              </div>

              {/* Search box */}
              <div className="relative min-w-[240px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm tên hoặc mã HS..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Quick Assign Buttons Bar */}
            <div className="px-4 py-3 bg-blue-50/50 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/30 flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-blue-800 dark:text-blue-300 mr-1 flex items-center">
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                Gán nhanh cả lớp:
              </span>
              <button
                onClick={() => handleQuickAssignAll("hsg")}
                className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-lg shadow-sm transition flex items-center space-x-1"
              >
                <span>Học sinh Giỏi</span>
              </button>
              <button
                onClick={() => handleQuickAssignAll("hsxs")}
                className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-lg shadow-sm transition flex items-center space-x-1"
              >
                <span>Học sinh Xuất sắc</span>
              </button>
              <button
                onClick={() => handleQuickAssignAll("hstb")}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-sm transition flex items-center space-x-1"
              >
                <span>HS Tiêu biểu</span>
              </button>
              <button
                onClick={() => handleQuickAssignAll("hoa_chamngoan")}
                className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white font-semibold rounded-lg shadow-sm transition flex items-center space-x-1"
              >
                <span>Hoa Chăm Ngoan</span>
              </button>
              <button
                onClick={() => handleQuickAssignAll("none")}
                className="px-2.5 py-1 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-lg transition ml-auto flex items-center space-x-1"
              >
                <XSquare className="w-3.5 h-3.5" />
                <span>Bỏ chọn tất cả</span>
              </button>
            </div>

            {/* Table of Students */}
            <div className="overflow-x-auto max-h-[620px] overflow-y-auto">
              {loadingStudents ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-sm">
                  Không tìm thấy học sinh nào.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                    <tr>
                      <th className="p-3 w-12 text-center">STT</th>
                      <th className="p-3">Họ và tên học sinh</th>
                      <th className="p-3 w-64">Chọn Danh Hiệu / Mẫu Giấy Khen</th>
                      <th className="p-3 w-24 text-center" title="Tỷ lệ co dãn thủ công">Cỡ chữ (%)</th>
                      <th className="p-3 w-24 text-center">Sửa tay</th>
                      <th className="p-3 w-28 text-center">Xem trước</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm font-medium text-slate-700 dark:text-slate-200">
                    {filteredStudents.map((std, idx) => {
                      const sel = selections.find((s) => s.studentId === std.id);
                      const currentTmplId = sel?.templateId || "none";
                      const isAwarded = currentTmplId !== "none";

                      return (
                        <tr
                          key={std.id}
                          className={`hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition ${
                            isAwarded ? "bg-amber-50/30 dark:bg-amber-950/10 font-semibold" : ""
                          }`}
                        >
                          <td className="p-3 text-center text-xs font-mono text-slate-400">{idx + 1}</td>
                          <td className="p-3">
                            <div className="flex flex-col">
                              <span className={isAwarded ? "text-blue-600 dark:text-blue-400 text-base" : ""}>
                                {std.fullName}
                              </span>
                              {std.studentCode && (
                                <span className="text-[10px] text-slate-400 font-mono">MS: {std.studentCode}</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3">
                            <select
                              value={currentTmplId}
                              onChange={(e) => handleUpdateSelection(std.id!, e.target.value)}
                              className={`w-full px-3 py-1.5 text-xs font-bold rounded-xl border transition cursor-pointer ${
                                isAwarded
                                  ? "bg-blue-600 text-white border-blue-500 shadow-sm"
                                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                              }`}
                            >
                              <option value="none">-- Không khen thưởng --</option>
                              {templates.map((tmpl) => (
                                <option key={tmpl.id} value={tmpl.id} className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-medium">
                                  🏆 {tmpl.name} {tmpl.isCustomized ? "(★ Đã tùy chỉnh)" : ""}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3 text-center">
                            <input
                              type="number"
                              min="50"
                              max="150"
                              step="5"
                              value={sel?.customFontSizeScale || 100}
                              onChange={(e) => handleUpdateScale(std.id!, Number(e.target.value))}
                              disabled={!isAwarded}
                              className="w-16 px-1.5 py-1 text-xs font-mono text-center bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg disabled:opacity-30 disabled:bg-slate-100"
                              title="Tỷ lệ kích thước chữ (Mặc định 100%)"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleOpenEditStudent(std.id!)}
                              disabled={!isAwarded}
                              className={`p-1.5 rounded-lg border transition mx-auto flex items-center justify-center ${
                                sel?.customStudentName || sel?.customClassName || sel?.customAwardTitle
                                  ? "bg-amber-500/20 text-amber-400 border-amber-500/40 shadow-sm"
                                  : "bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 disabled:opacity-30"
                              }`}
                              title={
                                sel?.customStudentName || sel?.customClassName || sel?.customAwardTitle
                                  ? "Đã có thông tin chỉnh sửa thủ công"
                                  : "Chỉnh sửa thủ công Tên / Lớp / Lời khen"
                              }
                            >
                              <Wrench className="w-3.5 h-3.5" />
                            </button>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handlePreviewStudent(std.id!)}
                              disabled={!isAwarded}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:hover:bg-emerald-600 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center justify-center space-x-1 mx-auto"
                              title="Xem trước file PDF thực tế của học sinh này"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">Xem PDF</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            
          </div>

          {/* Right Column: Sticky PDF Export & Summary Card (4 Cols) */}
          <div className="lg:col-span-4 space-y-6 sticky top-6">
            <button
              onClick={() => {
                const awardedCount = selections.filter(s => s.templateId && s.templateId !== "none").length;
                if (awardedCount === 0) {
                  toast.error("Vui lòng chọn giải thưởng cho ít nhất 1 học sinh để xem trước.");
                  return;
                }
                setClassPreviewModalOpen(true);
              }}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-2xl shadow-lg shadow-purple-500/20 transition flex items-center justify-center space-x-2 border border-purple-500/30"
            >
              <Layers className="w-5 h-5" />
              <span>Xem Trước Trọn Bộ Lớp (PDF)</span>
            </button>

            <BulkPdfGenerator
              templates={templates}
              selections={selections}
              className={selectedClass.name}
            />

            {/* Summary Statistics Card */}
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
              <h4 className="font-bold text-sm text-slate-800 dark:text-white flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-2">
                <span>Thống Kê Danh Hiệu ({selectedClass.name})</span>
                <span className="text-xs bg-blue-500/10 text-blue-500 font-mono px-2 py-0.5 rounded">
                  {awardedCount}/{students.length} em
                </span>
              </h4>

              <div className="space-y-2 max-h-[300px] overflow-y-auto text-xs">
                {templates.map((tmpl) => {
                  const count = selections.filter((s) => s.templateId === tmpl.id).length;
                  if (count === 0) return null;
                  return (
                    <div key={tmpl.id} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                      <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center">
                        <span className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                        {tmpl.name}
                      </span>
                      <span className="font-bold text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded-lg">
                        {count} em
                      </span>
                    </div>
                  );
                })}

                {awardedCount === 0 && (
                  <p className="text-slate-400 text-center py-6 italic">
                    Chưa có học sinh nào được chọn giải thưởng.
                  </p>
                )}
              </div>
            </div>
          </div>

        </div>
      )}

      <SinglePdfPreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        template={previewTemplate}
        selection={previewSelection}
        className={selectedClass?.name || ""}
      />

      <ClassPdfPreviewModal
        isOpen={classPreviewModalOpen}
        onClose={() => setClassPreviewModalOpen(false)}
        templates={templates}
        selections={selections}
        className={selectedClass?.name || ""}
      />

      {/* Manual Student Edit Modal */}
      {editingStudentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h3 className="text-base font-bold text-white flex items-center space-x-2 border-b border-slate-800 pb-3">
              <Wrench className="w-5 h-5 text-amber-400" />
              <span>Chỉnh Sửa Thủ Công Giấy Khen</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-bold mb-1">Ghi đè Tên học sinh (Ví dụ: Em Nguyễn Văn A):</label>
                <input
                  type="text"
                  value={customNameInput}
                  onChange={(e) => setCustomNameInput(e.target.value)}
                  placeholder="Để trống sẽ dùng tên mặc định..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Ghi đè Tên lớp trên giấy khen:</label>
                <input
                  type="text"
                  value={customClassInput}
                  onChange={(e) => setCustomClassInput(e.target.value)}
                  placeholder="Để trống sẽ dùng lớp mặc định..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-slate-400 font-bold mb-1">Danh hiệu / Lời khen tùy chỉnh:</label>
                <input
                  type="text"
                  value={customNoteInput}
                  onChange={(e) => setCustomNoteInput(e.target.value)}
                  placeholder="Nhập lời khen riêng cho em này (nếu có)..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white font-medium focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setEditingStudentId(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl transition text-xs"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveEditStudent}
                className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/20 transition text-xs flex items-center space-x-1"
              >
                <Check className="w-4 h-4" />
                <span>Lưu thay đổi</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


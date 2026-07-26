"use client";

import React, { useState, useEffect, useRef } from "react";
import { CertificateTemplate, CertificateField, CertificatePreset } from "@/types/certificate";
import { getTemplates, saveTemplate, resetToDefaultTemplates, getPresets, savePreset, updatePreset, deletePreset, renamePreset } from "@/lib/firebase/certificates";
import TemplatePreviewCanvas from "@/components/certificates/TemplatePreviewCanvas";
import { Award, Save, RefreshCw, Layers, CheckCircle2, AlertCircle, Sparkles, ArrowLeft, Zap, Copy, FolderPlus, Edit2, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function CertificateTemplatesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<CertificateTemplate[]>([]);
  const [presets, setPresets] = useState<CertificatePreset[]>([]);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("mau_v1");
  const [selectedTemplate, setSelectedTemplate] = useState<CertificateTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [sampleName, setSampleName] = useState("Nguyễn Hoàng Thảo Mai Phương Anh");
  const [sampleClass, setSampleClass] = useState("Lớp 6G01");
  const selectedTemplateRef = useRef<CertificateTemplate | null>(null);

  useEffect(() => {
    selectedTemplateRef.current = selectedTemplate;
  }, [selectedTemplate]);

  const syncToActivePreset = async (currentTemplates: CertificateTemplate[]) => {
    if (!selectedPresetId || selectedPresetId === "default_system") return;
    const targetPreset = presets.find(p => p.id === selectedPresetId);
    if (targetPreset) {
      await updatePreset(selectedPresetId, targetPreset.name, currentTemplates).catch(console.error);
      setPresets(prev => prev.map(p => p.id === selectedPresetId ? { ...p, templates: currentTemplates } : p));
    }
  };

  const handleSaveAsPreset = async () => {
    const defaultName = presets.length > 0 ? `Mẫu_v${presets.length + 1}` : "Mẫu_v1";
    const name = prompt("Nhập tên cho bộ phôi mẫu này (Ví dụ: Mẫu_v1, Bộ Phôi PAS 2026):", defaultName);
    if (!name || !name.trim()) return;

    setSaving(true);
    try {
      const newPreset = await savePreset(name.trim(), templates);
      setPresets(prev => [newPreset, ...prev.filter(p => p.id !== newPreset.id)]);
      setSelectedPresetId(newPreset.id);
      toast.success(`🎉 Đã lưu bộ phôi "${newPreset.name}" thành công! Giáo viên có thể chọn bộ này khi tạo PDF.`);
    } catch (error) {
      toast.error("Lỗi khi lưu bộ mẫu phôi");
    } finally {
      setSaving(false);
    }
  };

  const handlePresetSelect = (presetId: string) => {
    setSelectedPresetId(presetId);
    const targetPreset = presets.find(p => p.id === presetId);
    if (targetPreset && targetPreset.templates) {
      setTemplates(targetPreset.templates);
      if (targetPreset.templates.length > 0) {
        setSelectedTemplate(targetPreset.templates[0]);
      }
      toast.success(`Đã chuyển sang bộ phôi: ${targetPreset.name}`);
    }
  };

  const handleRenamePreset = async () => {
    if (selectedPresetId === "default_system") {
      toast.error("Không thể đổi tên bộ phôi mặc định của hệ thống.");
      return;
    }
    const currentPreset = presets.find(p => p.id === selectedPresetId);
    if (!currentPreset) return;
    const newName = prompt("Nhập tên mới cho bộ phôi này:", currentPreset.name);
    if (!newName || !newName.trim() || newName.trim() === currentPreset.name) return;

    try {
      await renamePreset(selectedPresetId, newName.trim());
      setPresets(prev => prev.map(p => p.id === selectedPresetId ? { ...p, name: newName.trim() } : p));
      toast.success(`Đã đổi tên bộ phôi thành "${newName.trim()}"`);
    } catch (error) {
      toast.error("Lỗi khi đổi tên bộ phôi");
    }
  };

  const handleDeletePreset = async () => {
    if (selectedPresetId === "default_system") {
      toast.error("Không thể xóa bộ phôi cấu hình mặc định của hệ thống.");
      return;
    }
    const currentPreset = presets.find(p => p.id === selectedPresetId);
    if (!currentPreset) return;
    if (!confirm(`Bạn có chắc muốn XÓA vĩnh viễn bộ phôi "${currentPreset.name}" không? Hành động này không thể hoàn tác!`)) {
      return;
    }

    try {
      await deletePreset(selectedPresetId);
      const remaining = presets.filter(p => p.id !== selectedPresetId);
      setPresets(remaining);
      const nextPreset = remaining.find(p => p.isActive) || remaining[0];
      if (nextPreset) {
        setSelectedPresetId(nextPreset.id);
        if (nextPreset.templates && nextPreset.templates.length > 0) {
          setTemplates(nextPreset.templates);
          setSelectedTemplate(nextPreset.templates[0]);
        }
      }
      toast.success(`Đã xóa bộ phôi "${currentPreset.name}"`);
    } catch (error: any) {
      toast.error(error.message || "Lỗi khi xóa bộ phôi");
    }
  };

  const handleSyncToSimilar = async () => {
    if (!selectedTemplate) return;
    const isHorizontalCert = selectedTemplate.id !== "hoa_chamngoan" && selectedTemplate.id !== "hoa_diemtot";
    const groupName = isHorizontalCert ? "7 mẫu Giấy Khen ngang" : "2 mẫu Hoa Khen thưởng";

    if (!confirm(`Bạn có chắc muốn áp dụng toàn bộ tọa độ (X, Y) và cỡ chữ của mẫu "${selectedTemplate.name}" cho ${groupName} không?\n\n(Lưu ý: Màu sắc riêng của từng mẫu như chữ Đỏ / chữ Xanh sẽ vẫn được giữ nguyên không thay đổi)`)) {
      return;
    }

    setSyncing(true);
    try {
      const updatedTemplates = templates.map(t => {
        const tIsHorizontal = t.id !== "hoa_chamngoan" && t.id !== "hoa_diemtot";
        if (isHorizontalCert && !tIsHorizontal) return t;
        if (!isHorizontalCert && tIsHorizontal) return t;

        const newFields = t.fields.map(field => {
          const sourceField = selectedTemplate.fields.find(f => f.id === field.id);
          if (!sourceField) return field;
          return {
            ...field,
            x: sourceField.x,
            y: sourceField.y,
            fontSize: sourceField.fontSize,
            fontFamily: sourceField.fontFamily,
            textAlign: sourceField.textAlign,
            maxWidth: sourceField.maxWidth,
            color: field.color
          };
        });

        return {
          ...t,
          fields: newFields
        };
      });

      const targetTemplates = updatedTemplates.filter(t => {
        const tIsHorizontal = t.id !== "hoa_chamngoan" && t.id !== "hoa_diemtot";
        return isHorizontalCert ? tIsHorizontal : !tIsHorizontal;
      });

      await Promise.all(targetTemplates.map(t => saveTemplate(t)));

      await syncToActivePreset(updatedTemplates);
      setTemplates(updatedTemplates);
      toast.success(`🎉 Đã đồng bộ tọa độ thành công cho ${targetTemplates.length} mẫu!`);
    } catch (error) {
      console.error("Error syncing templates:", error);
      toast.error("Lỗi khi đồng bộ tọa độ các mẫu");
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const handleGoBack = () => {
    router.push("/dashboard/certificates");
  };

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const [data, presetList] = await Promise.all([
        getTemplates(),
        getPresets()
      ]);
      setTemplates(data);
      setPresets(presetList);
      if (presetList.length > 0) {
        setSelectedPresetId(presetList[0].id);
      }
      if (data.length > 0 && !selectedTemplate) {
        setSelectedTemplate(data[0]);
      } else if (selectedTemplate) {
        const updated = data.find(t => t.id === selectedTemplate.id);
        if (updated) setSelectedTemplate(updated);
      }
    } catch (error) {
      toast.error("Không thể tải danh sách mẫu phôi");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (tmpl: CertificateTemplate) => {
    setSelectedTemplate(tmpl);
  };

  const handleFieldChange = (updatedField: CertificateField) => {
    if (!selectedTemplate) return;
    const updatedFields = selectedTemplate.fields.map(f => 
      f.id === updatedField.id ? updatedField : f
    );
    const updatedTemplate = {
      ...selectedTemplate,
      isCustomized: true,
      fields: updatedFields
    };
    setSelectedTemplate(updatedTemplate);
    // Cập nhật ngay vào danh sách tổng trong bộ nhớ để chuyển qua lại không mất
    setTemplates(prev => prev.map(t => t.id === updatedTemplate.id ? updatedTemplate : t));
  };

  const handleSave = async () => {
    if (!selectedTemplate) return;
    setSaving(true);
    try {
      const tmplToSave = { ...selectedTemplate, isCustomized: true };
      await saveTemplate(tmplToSave);
      const newTemplates = templates.map(t => t.id === tmplToSave.id ? tmplToSave : t);
      setTemplates(newTemplates);
      setSelectedTemplate(tmplToSave);
      await syncToActivePreset(newTemplates);
      toast.success(`🎉 Đã lưu cấu hình phôi "${selectedTemplate.name}" thành công!`);
    } catch (error) {
      toast.error("Lỗi khi lưu cấu hình mẫu phôi");
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm("Bạn có chắc muốn khôi phục toàn bộ 9 mẫu phôi về tọa độ chuẩn ban đầu không?")) return;
    setResetting(true);
    try {
      const defaults = await resetToDefaultTemplates();
      setTemplates(defaults);
      if (defaults.length > 0) setSelectedTemplate(defaults[0]);
      await syncToActivePreset(defaults);
      toast.success("Đã khôi phục 9 phôi mẫu mặc định thành công!");
    } catch (error) {
      toast.error("Lỗi khi khôi phục mẫu mặc định");
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-gradient-to-br from-amber-500 to-red-600 rounded-xl shadow-lg shadow-amber-500/20">
            <Award className="w-8 h-8 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-2xl font-black tracking-tight">Ngân Hàng Mẫu Phôi Giấy Khen</h1>
              <span className="bg-amber-500/20 text-amber-300 text-xs px-2.5 py-0.5 rounded-full font-bold border border-amber-500/30">
                9 Phôi Sư Phạm
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1">
              Cấu hình vị trí tọa độ (X, Y) và phông chữ thư pháp cho từng mẫu chứng nhận thi đua
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-2 rounded-xl border border-slate-700">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-xs font-bold text-slate-300">Bộ phôi:</span>
            <select
              value={selectedPresetId}
              onChange={(e) => handlePresetSelect(e.target.value)}
              className="bg-slate-900 text-white font-bold text-xs px-2.5 py-1 rounded-lg border border-slate-600 focus:outline-none cursor-pointer"
            >
              {presets.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.isActive ? "(Đang chọn)" : ""}
                </option>
              ))}
            </select>
            {selectedPresetId !== "default_system" && (
              <>
                <button
                  onClick={handleRenamePreset}
                  className="p-1.5 hover:bg-slate-700 text-slate-400 hover:text-amber-400 rounded-lg transition"
                  title="Đổi tên bộ phôi này"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleDeletePreset}
                  className="p-1.5 hover:bg-red-950/60 text-slate-400 hover:text-red-400 rounded-lg transition"
                  title="Xóa bộ phôi này"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>

          <button
            onClick={handleSaveAsPreset}
            disabled={saving}
            className="px-4 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center space-x-2 border border-amber-500/30 text-xs sm:text-sm"
            title="Lưu toàn bộ 9 phôi thành một Bộ Mẫu riêng (Ví dụ: Mẫu_v1)"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Lưu thành Bộ Mẫu (Mẫu_v1)</span>
          </button>

          <button
            onClick={handleGoBack}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-medium transition flex items-center space-x-2 border border-slate-700"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại</span>
          </button>

          <button
            onClick={handleResetDefaults}
            disabled={resetting}
            className="px-3.5 py-2.5 bg-slate-800 hover:bg-red-950/60 text-slate-300 hover:text-red-300 rounded-xl text-sm font-medium transition flex items-center space-x-2 border border-slate-700 hover:border-red-800/50"
            title="Khôi phục tọa độ chuẩn cho 9 mẫu"
          >
            <RefreshCw className={`w-4 h-4 ${resetting ? "animate-spin" : ""}`} />
            <span>Khôi phục Mặc định</span>
          </button>

          <button
            onClick={handleSyncToSimilar}
            disabled={syncing || !selectedTemplate}
            className="px-3.5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition flex items-center space-x-2 disabled:opacity-50 border border-emerald-500/30"
            title="Đồng bộ tọa độ này cho các mẫu cùng loại"
          >
            <Copy className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            <span className="hidden xl:inline">Đồng bộ cho mẫu cùng loại</span>
          </button>

          <button
            onClick={handleSave}
            disabled={saving || !selectedTemplate}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-blue-500/25 transition flex items-center space-x-2 disabled:opacity-50"
          >
            <Save className={`w-4 h-4 ${saving ? "animate-spin" : ""}`} />
            <span>{saving ? "Đang lưu..." : "Lưu cấu hình phôi"}</span>
          </button>
        </div>
      </div>

      {/* Main Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Column: Template List Selector (4 Cols) */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-4 flex items-center">
              <Layers className="w-4 h-4 mr-2 text-blue-500" />
              Chọn Mẫu Phôi ({templates.length})
            </h2>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3 max-h-[620px] overflow-y-auto pr-1">
              {templates.map((tmpl) => {
                const isSelected = selectedTemplate?.id === tmpl.id;
                return (
                  <button
                    key={tmpl.id}
                    onClick={() => handleSelectTemplate(tmpl)}
                    className={`group relative flex flex-col items-center p-2 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? "border-blue-600 bg-blue-50/50 dark:bg-blue-950/30 shadow-md shadow-blue-500/10"
                        : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40"
                    }`}
                  >
                    <div className="w-full aspect-[1.414] rounded-lg overflow-hidden bg-slate-200 dark:bg-slate-800 relative mb-2">
                      <img
                        src={tmpl.bgUrl}
                        alt={tmpl.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                      />
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 bg-blue-600 text-white p-1 rounded-full shadow-md">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </div>
                      )}
                      {tmpl.isCustomized && (
                        <div className="absolute top-1.5 left-1.5 bg-emerald-600 text-white px-1.5 py-0.5 rounded text-[9px] font-bold shadow-md flex items-center space-x-0.5" title="Cấu hình phôi đã được chỉnh sửa theo ý bạn">
                          <span>★ Đã sửa</span>
                        </div>
                      )}
                    </div>
                    <span className={`text-xs font-bold truncate w-full text-center ${
                      isSelected ? "text-blue-600 dark:text-blue-400" : "text-slate-700 dark:text-slate-300"
                    }`}>
                      {tmpl.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Coordinate Editing Form for Selected Template */}
          {selectedTemplate && (
            <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 dark:text-white">
                  <span>Thông số Tọa độ: {selectedTemplate.name}</span>
                </h3>
                <span className="text-xs font-mono text-slate-400">UTM ViceroyJF</span>
              </div>

              {/* Test Input texts */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-800/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Tên thử nghiệm</label>
                  <input
                    type="text"
                    value={sampleName}
                    onChange={(e) => setSampleName(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                    placeholder="Nhập tên test..."
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">Lớp thử nghiệm</label>
                  <input
                    type="text"
                    value={sampleClass}
                    onChange={(e) => setSampleClass(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white"
                    placeholder="Lớp..."
                  />
                </div>
              </div>

              {/* Fields List */}
              <div className="space-y-4">
                {selectedTemplate.fields.map((field) => (
                  <div 
                    key={field.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/70 dark:bg-slate-800/40 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide flex items-center">
                        <Sparkles className="w-3.5 h-3.5 mr-1" />
                        {field.label} ({field.id})
                      </span>
                      <div className="flex items-center space-x-1">
                        <span className="text-[10px] text-slate-400 font-mono">Màu:</span>
                        <input
                          type="color"
                          value={field.color}
                          onChange={(e) => handleFieldChange({ ...field, color: e.target.value })}
                          className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                          title="Chọn màu chữ"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5 font-mono">Tọa độ X (pt)</label>
                        <input
                          type="number"
                          value={field.x}
                          onChange={(e) => handleFieldChange({ ...field, x: Number(e.target.value) })}
                          className="w-full px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5 font-mono">Tọa độ Y (pt)</label>
                        <input
                          type="number"
                          value={field.y}
                          onChange={(e) => handleFieldChange({ ...field, y: Number(e.target.value) })}
                          className="w-full px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white text-center"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 mb-0.5 font-mono">Cỡ chữ (pt)</label>
                        <input
                          type="number"
                          value={field.fontSize}
                          onChange={(e) => handleFieldChange({ ...field, fontSize: Number(e.target.value) })}
                          className="w-full px-2 py-1 text-xs font-mono bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg text-slate-800 dark:text-white text-center"
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-[10px] text-slate-500 mb-0.5 font-mono">
                        <span>Giới hạn Max Width (Trước co dãn)</span>
                        <span className="font-bold text-blue-500">{field.maxWidth} pt</span>
                      </div>
                      <input
                        type="range"
                        min="300"
                        max="750"
                        step="10"
                        value={field.maxWidth}
                        onChange={(e) => handleFieldChange({ ...field, maxWidth: Number(e.target.value) })}
                        className="w-full accent-blue-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                      />
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}
        </div>

        {/* Right Column: Live Interactive Canvas (8 Cols) */}
        <div className="lg:col-span-8 h-[740px]">
          {selectedTemplate ? (
            <TemplatePreviewCanvas
              template={selectedTemplate}
              onFieldChange={handleFieldChange}
              sampleStudentName={sampleName}
              sampleClassName={sampleClass}
            />
          ) : (
            <div className="h-full flex flex-col items-center justify-center bg-slate-900 rounded-2xl border border-slate-800 text-slate-500">
              <AlertCircle className="w-12 h-12 mb-3 text-slate-600" />
              <p>Vui lòng chọn một mẫu phôi ở cột bên trái để thiết lập tọa độ.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

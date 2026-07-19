import React, { useState, useEffect } from "react";
import { ClassData, classService } from "@/lib/services/class.service";
import toast from "react-hot-toast";

interface ClassModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialData?: ClassData | null;
}

export default function ClassModal({ isOpen, onClose, onSuccess, initialData }: ClassModalProps) {
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("10");
  const [academicYear, setAcademicYear] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name);
      setGrade(initialData.grade);
      setAcademicYear(initialData.academicYear);
    } else {
      setName("");
      setGrade("6");
      
      // Auto-set academic year based on current month
      const today = new Date();
      const currentYear = today.getFullYear();
      const yearStr = today.getMonth() > 5 ? `${currentYear}-${currentYear + 1}` : `${currentYear - 1}-${currentYear}`;
      setAcademicYear(yearStr);
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim() || !academicYear.trim()) {
      toast.error("Vui lòng nhập đầy đủ thông tin");
      return;
    }

    setLoading(true);
    try {
      const data = {
        name: name.trim(),
        grade,
        academicYear: academicYear.trim(),
      };

      if (initialData?.id) {
        await classService.updateClass(initialData.id, data);
        toast.success("Cập nhật lớp thành công!");
      } else {
        await classService.createClass(data);
        toast.success("Tạo lớp thành công!");
      }
      onSuccess();
    } catch (error: any) {
      console.error("Error saving class:", error);
      toast.error("Đã có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg w-full max-w-md p-6">
        <h2 className="text-xl font-semibold mb-4">
          {initialData ? "Sửa thông tin Lớp" : "Thêm Lớp học mới"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tên lớp</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="VD: 10A1"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Khối</label>
            <select
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="6">Khối 6</option>
              <option value="7">Khối 7</option>
              <option value="8">Khối 8</option>
              <option value="9">Khối 9</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Năm học</label>
            <input
              type="text"
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              placeholder="VD: 2026-2027"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md flex items-center disabled:opacity-50"
            >
              {loading ? (
                <span className="inline-block animate-spin mr-2">⟳</span>
              ) : null}
              {initialData ? "Lưu thay đổi" : "Tạo Lớp"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

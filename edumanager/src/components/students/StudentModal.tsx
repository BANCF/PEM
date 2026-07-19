import React, { useState, useEffect } from "react";
import { StudentData, studentService } from "@/lib/services/student.service";
import toast from "react-hot-toast";

interface StudentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  classId: string;
  initialData?: StudentData | null;
}

export default function StudentModal({ isOpen, onClose, onSuccess, classId, initialData }: StudentModalProps) {
  const [fullName, setFullName] = useState("");
  const [studentCode, setStudentCode] = useState("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFullName(initialData.fullName);
      setStudentCode(initialData.studentCode);
      setDob(initialData.dob || "");
    } else {
      setFullName("");
      setStudentCode("");
      setDob("");
    }
  }, [initialData, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!fullName.trim() || !studentCode.trim()) {
      toast.error("Vui lòng nhập Tên và Mã học sinh");
      return;
    }

    setLoading(true);
    try {
      const data = {
        fullName: fullName.trim(),
        studentCode: studentCode.trim(),
        classId,
        dob: dob.trim(),
      };

      if (initialData?.id) {
        await studentService.updateStudent(initialData.id, data);
        toast.success("Cập nhật học sinh thành công!");
      } else {
        await studentService.createStudent(data);
        toast.success("Thêm học sinh thành công!");
      }
      onSuccess();
    } catch (error: any) {
      console.error("Error saving student:", error);
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
          {initialData ? "Sửa thông tin Học sinh" : "Thêm Học sinh mới"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Họ và tên <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="VD: Nguyễn Văn A"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mã học sinh <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={studentCode}
              onChange={(e) => setStudentCode(e.target.value)}
              placeholder="VD: HS26001"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ngày sinh</label>
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              {initialData ? "Lưu thay đổi" : "Thêm Học sinh"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

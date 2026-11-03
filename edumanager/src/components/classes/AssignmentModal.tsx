import React, { useState, useEffect } from "react";
import { ClassAssignmentData, assignmentService, TeacherRole } from "@/lib/services/assignment.service";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import toast from "react-hot-toast";

interface UserData {
  id: string;
  fullName: string;
  role: string;
}

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  classId: string;
  academicYear: string;
  initialData?: ClassAssignmentData | null;
}

const DEFAULT_SUBJECTS = [
  "Toán", "Ngữ Văn", "Tiếng Anh", "Vật Lý", "Hóa Học", 
  "Sinh Học", "Lịch Sử", "Địa Lý", "GDCD", "Tin Học", 
  "Công Nghệ", "Thể Dục", "GDQP", "Nghệ Thuật", "Mĩ thuật", "Âm nhạc"
];

export default function AssignmentModal({
  isOpen,
  onClose,
  onSuccess,
  classId,
  academicYear,
  initialData,
}: AssignmentModalProps) {
  const [teachers, setTeachers] = useState<UserData[]>([]);
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [role, setRole] = useState<TeacherRole>("GVBM");
  const [subject, setSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);

  // Compute available subjects list, including custom subject from initialData if present
  const availableSubjects = React.useMemo(() => {
    if (initialData?.subject && !DEFAULT_SUBJECTS.includes(initialData.subject)) {
      return [...DEFAULT_SUBJECTS, initialData.subject];
    }
    return DEFAULT_SUBJECTS;
  }, [initialData]);

  useEffect(() => {
    if (isOpen) {
      fetchTeachers();
      if (initialData) {
        setSelectedTeacherId(initialData.teacherId || "");
        setRole(initialData.role || "GVBM");
        setSubject(initialData.subject || "");
      } else {
        setSelectedTeacherId("");
        setRole("GVBM");
        setSubject("");
      }
    }
  }, [isOpen, initialData]);

  const fetchTeachers = async () => {
    setFetching(true);
    try {
      const q = query(collection(db, "users"), orderBy("fullName", "asc"));
      const snapshot = await getDocs(q);
      const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserData));
      
      const validRoles = ["TEACHER", "TTCM", "TPCM", "BGH", "ADMIN", "SUPER_ADMIN"];
      setTeachers(allUsers.filter(u => validRoles.includes(u.role)));
    } catch (error) {
      console.error("Error fetching teachers:", error);
      toast.error("Không thể tải danh sách giáo viên");
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedTeacherId) {
      toast.error("Vui lòng chọn giáo viên");
      return;
    }

    if (role === "GVBM" && !subject) {
      toast.error("Vui lòng chọn môn học cho Giáo viên bộ môn");
      return;
    }

    setLoading(true);
    try {
      const data: Omit<ClassAssignmentData, "id" | "createdAt"> = {
        classId,
        teacherId: selectedTeacherId,
        role,
        academicYear,
      };

      if (role === "GVBM") {
        data.subject = subject;
      }

      if (initialData?.id) {
        // Update existing assignment
        await assignmentService.updateAssignment(initialData.id, data);
        toast.success("Cập nhật phân công thành công!");
      } else {
        // Create new assignment
        await assignmentService.createAssignment(data);
        toast.success("Phân công thành công!");
      }

      onSuccess();
    } catch (error: any) {
      console.error("Error saving assignment:", error);
      toast.error("Đã có lỗi xảy ra");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-xs">
      <div className="bg-white rounded-xl w-full max-w-md p-6 shadow-2xl border border-gray-100">
        <h2 className="text-xl font-bold text-gray-800 mb-4">
          {initialData ? "Chỉnh sửa / Đổi Giáo viên" : "Phân công Giáo viên"}
        </h2>

        {fetching ? (
          <div className="text-center py-4 text-gray-500">Đang tải danh sách giáo viên...</div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Giáo viên <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                required
              >
                <option value="">-- Chọn Giáo viên --</option>
                {teachers.map(t => (
                  <option key={t.id} value={t.id}>{t.fullName} ({t.role})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Vai trò <span className="text-red-500">*</span>
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as TeacherRole)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="GVBM">Giáo viên Bộ môn (GVBM)</option>
                <option value="GVCN">Giáo viên Chủ nhiệm (GVCN)</option>
                <option value="PCN">Phó Chủ nhiệm (PCN)</option>
              </select>
            </div>

            {role === "GVBM" && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Môn giảng dạy <span className="text-red-500">*</span>
                </label>
                <select
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  required={role === "GVBM"}
                >
                  <option value="">-- Chọn Môn học --</option>
                  {availableSubjects.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}

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
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md flex items-center disabled:opacity-50 shadow-sm"
              >
                {loading ? (
                  <span className="inline-block animate-spin mr-2">⟳</span>
                ) : null}
                {initialData ? "Cập nhật Phân công" : "Lưu Phân công"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { ClassData, classService } from "@/lib/services/class.service";
import ClassModal from "@/components/classes/ClassModal";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, Plus, Edit3, Trash2, Users, Eye } from "lucide-react";

export default function ClassesManagementPage() {
  const { profile } = useAuth();
  const router = useRouter();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<ClassData | null>(null);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      const data = await classService.getAllClasses();
      setClasses(data);
    } catch (error) {
      console.error("Error fetching classes:", error);
      toast.error("Lỗi tải danh sách lớp học.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, []);

  const handleOpenModal = (classItem: ClassData | null = null) => {
    setSelectedClass(classItem);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setSelectedClass(null);
    setIsModalOpen(false);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa lớp ${name}? Toàn bộ danh sách học sinh và phân công của lớp sẽ bị ảnh hưởng!`)) {
      return;
    }
    
    try {
      await classService.deleteClass(id);
      toast.success("Đã xóa lớp học");
      fetchClasses();
    } catch (error) {
      console.error("Error deleting class:", error);
      toast.error("Lỗi khi xóa lớp");
    }
  };

  const isAdminOrBGH = profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN" || profile?.role === "BGH";

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "SUPER_ADMIN", "BGH", "TEACHER", "TTCM", "TPCM"]}>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Quản lý Lớp học</h1>
            <p className="text-gray-500 mt-1">Quản lý danh sách lớp, học sinh và phân công chuyên môn</p>
          </div>
          
          {isAdminOrBGH && (
            <button
              onClick={() => handleOpenModal()}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
            >
              <Plus size={20} />
              <span>Thêm Lớp học</span>
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="p-4 font-semibold text-gray-600">Tên Lớp</th>
                    <th className="p-4 font-semibold text-gray-600">Khối</th>
                    <th className="p-4 font-semibold text-gray-600">Năm học</th>
                    <th className="p-4 font-semibold text-gray-600 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {classes.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-500">
                        Chưa có lớp học nào. {isAdminOrBGH && "Vui lòng thêm lớp học mới."}
                      </td>
                    </tr>
                  ) : (
                    classes.map((cls) => (
                      <tr key={cls.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          <div className="font-medium text-gray-800">{cls.name}</div>
                        </td>
                        <td className="p-4 text-gray-600">Khối {cls.grade}</td>
                        <td className="p-4 text-gray-600">{cls.academicYear}</td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => router.push(`/dashboard/classes/${cls.id}`)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Chi tiết lớp (Học sinh & Phân công)"
                            >
                              <Users size={18} />
                            </button>
                            
                            {isAdminOrBGH && (
                              <>
                                <button
                                  onClick={() => handleOpenModal(cls)}
                                  className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                  title="Sửa thông tin"
                                >
                                  <Edit3 size={18} />
                                </button>
                                <button
                                  onClick={() => cls.id && handleDelete(cls.id, cls.name)}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  title="Xóa lớp"
                                >
                                  <Trash2 size={18} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <ClassModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSuccess={() => {
          handleCloseModal();
          fetchClasses();
        }}
        initialData={selectedClass}
      />
    </ProtectedRoute>
  );
}

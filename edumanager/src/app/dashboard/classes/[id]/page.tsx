"use client";

import React, { useState, useEffect, use } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { ClassData, classService } from "@/lib/services/class.service";
import { StudentData, studentService } from "@/lib/services/student.service";
import { ClassAssignmentData, assignmentService } from "@/lib/services/assignment.service";
import StudentModal from "@/components/students/StudentModal";
import AssignmentModal from "@/components/classes/AssignmentModal";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, ArrowLeft, Plus, Trash2, UserPlus, FileSpreadsheet } from "lucide-react";

export default function ClassDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const classId = resolvedParams.id;
  const { profile } = useAuth();
  const router = useRouter();

  const [classData, setClassData] = useState<ClassData | null>(null);
  const [students, setStudents] = useState<StudentData[]>([]);
  const [assignments, setAssignments] = useState<ClassAssignmentData[]>([]);
  
  // Ánh xạ teacherId sang tên giáo viên
  const [teacherNames, setTeacherNames] = useState<Record<string, string>>({});
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"students" | "assignments">("students");
  
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentData | null>(null);

  const isAdminOrBGH = profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN" || profile?.role === "BGH";

  const fetchAllData = async () => {
    try {
      setLoading(true);
      
      // 1. Fetch Class Info
      const cls = await classService.getClassById(classId);
      if (!cls) {
        toast.error("Không tìm thấy lớp học");
        router.push("/dashboard/classes");
        return;
      }
      setClassData(cls);

      // 2. Fetch Students
      const stds = await studentService.getStudentsByClassId(classId);
      setStudents(stds);

      // 3. Fetch Assignments
      const assigns = await assignmentService.getAssignmentsByClassId(classId);
      setAssignments(assigns);

      // 4. Resolve Teacher Names for assignments
      const names: Record<string, string> = {};
      for (const assign of assigns) {
        if (!names[assign.teacherId]) {
          const tDoc = await getDoc(doc(db, "users", assign.teacherId));
          if (tDoc.exists()) {
            names[assign.teacherId] = tDoc.data().fullName || "Không xác định";
          } else {
            names[assign.teacherId] = "Không xác định";
          }
        }
      }
      setTeacherNames(names);

    } catch (error) {
      console.error("Error fetching class details:", error);
      toast.error("Lỗi tải chi tiết lớp học.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [classId]);

  const handleDeleteStudent = async (id: string, name: string) => {
    if (!confirm(`Xóa học sinh ${name}?`)) return;
    try {
      await studentService.deleteStudent(id);
      toast.success("Đã xóa học sinh");
      fetchAllData();
    } catch (error) {
      toast.error("Lỗi khi xóa");
    }
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm(`Xóa phân công giáo viên này?`)) return;
    try {
      await assignmentService.deleteAssignment(id);
      toast.success("Đã xóa phân công");
      fetchAllData();
    } catch (error) {
      toast.error("Lỗi khi xóa");
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!classData) return null;

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "SUPER_ADMIN", "BGH", "TEACHER", "TTCM", "TPCM"]}>
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button 
            onClick={() => router.push("/dashboard/classes")}
            className="p-2 bg-gray-100 hover:bg-gray-200 rounded-full transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Lớp {classData.name}</h1>
            <p className="text-gray-500 mt-1">Khối {classData.grade} • Năm học: {classData.academicYear} • Sĩ số: {students.length}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            onClick={() => setActiveTab("students")}
            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "students" 
                ? "border-blue-600 text-blue-600" 
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Danh sách Học sinh
          </button>
          <button
            onClick={() => setActiveTab("assignments")}
            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "assignments" 
                ? "border-blue-600 text-blue-600" 
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Phân công Giảng dạy
          </button>
        </div>

        {/* Content: Học sinh */}
        {activeTab === "students" && (
          <div>
            {isAdminOrBGH && (
              <div className="flex gap-3 mb-4 justify-end">
                <button
                  onClick={() => toast.info("Tính năng Import Excel đang phát triển!")}
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <FileSpreadsheet size={18} />
                  <span>Import Excel</span>
                </button>
                <button
                  onClick={() => {
                    setEditingStudent(null);
                    setIsStudentModalOpen(true);
                  }}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <UserPlus size={18} />
                  <span>Thêm Học sinh</span>
                </button>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="p-4 font-semibold text-gray-600 w-16 text-center">STT</th>
                    <th className="p-4 font-semibold text-gray-600">Mã Học sinh</th>
                    <th className="p-4 font-semibold text-gray-600">Họ và Tên</th>
                    <th className="p-4 font-semibold text-gray-600">Ngày sinh</th>
                    {isAdminOrBGH && <th className="p-4 font-semibold text-gray-600 text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {students.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-500">
                        Lớp chưa có học sinh nào.
                      </td>
                    </tr>
                  ) : (
                    students.map((student, index) => (
                      <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4 text-center text-gray-500">{index + 1}</td>
                        <td className="p-4 font-mono text-gray-600">{student.studentCode}</td>
                        <td className="p-4 font-medium text-gray-800">{student.fullName}</td>
                        <td className="p-4 text-gray-600">{student.dob || "-"}</td>
                        {isAdminOrBGH && (
                          <td className="p-4 text-right">
                            <button
                              onClick={() => student.id && handleDeleteStudent(student.id, student.fullName)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Content: Phân công */}
        {activeTab === "assignments" && (
          <div>
            {isAdminOrBGH && (
              <div className="flex mb-4 justify-end">
                <button
                  onClick={() => setIsAssignmentModalOpen(true)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  <Plus size={18} />
                  <span>Thêm Phân công</span>
                </button>
              </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="p-4 font-semibold text-gray-600">Giáo viên</th>
                    <th className="p-4 font-semibold text-gray-600">Vai trò</th>
                    <th className="p-4 font-semibold text-gray-600">Môn học</th>
                    {isAdminOrBGH && <th className="p-4 font-semibold text-gray-600 text-right">Thao tác</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {assignments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-gray-500">
                        Chưa có phân công giáo viên nào cho lớp này.
                      </td>
                    </tr>
                  ) : (
                    assignments.map((assign) => (
                      <tr key={assign.id} className="hover:bg-gray-50 transition-colors">
                        <td className="p-4">
                          <div className="font-medium text-gray-800">
                            {teacherNames[assign.teacherId] || "Đang tải..."}
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`inline-block px-2 py-1 text-xs font-semibold rounded-full ${
                            assign.role === "GVCN" ? "bg-purple-100 text-purple-700" :
                            assign.role === "PCN" ? "bg-orange-100 text-orange-700" :
                            "bg-blue-100 text-blue-700"
                          }`}>
                            {assign.role}
                          </span>
                        </td>
                        <td className="p-4 text-gray-600 font-medium">
                          {assign.subject || "-"}
                        </td>
                        {isAdminOrBGH && (
                          <td className="p-4 text-right">
                            <button
                              onClick={() => assign.id && handleDeleteAssignment(assign.id)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <Trash2 size={18} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <StudentModal
        isOpen={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        onSuccess={() => {
          setIsStudentModalOpen(false);
          fetchAllData();
        }}
        classId={classId}
        initialData={editingStudent}
      />

      <AssignmentModal
        isOpen={isAssignmentModalOpen}
        onClose={() => setIsAssignmentModalOpen(false)}
        onSuccess={() => {
          setIsAssignmentModalOpen(false);
          fetchAllData();
        }}
        classId={classId}
        academicYear={classData.academicYear}
      />
    </ProtectedRoute>
  );
}

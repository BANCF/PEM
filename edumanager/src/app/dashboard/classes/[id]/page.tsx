"use client";

import React, { useState, useEffect, use } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { ClassData, classService } from "@/lib/services/class.service";
import { StudentData, studentService } from "@/lib/services/student.service";
import { ClassAssignmentData, assignmentService } from "@/lib/services/assignment.service";
import StudentModal from "@/components/students/StudentModal";
import AssignmentModal from "@/components/classes/AssignmentModal";
import MonthlyEvaluationsTab from "@/components/classes/MonthlyEvaluationsTab";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { Loader2, ArrowLeft, Plus, Trash2, UserPlus, Download, Upload } from "lucide-react";
import * as XLSX from "xlsx";

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
  const [activeTab, setActiveTab] = useState<"students" | "assignments" | "evaluations">("students");
  
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isAssignmentModalOpen, setIsAssignmentModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<StudentData | null>(null);

  const isAdminOrBGH = profile?.role === "ADMIN" || profile?.role === "SUPER_ADMIN" || profile?.role === "BGH";
  const isGVCN = assignments.some(a => a.teacherId === profile?.id && (a.role === "GVCN" || a.role === "PCN"));
  const canManageStudents = isAdminOrBGH || isGVCN;

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

  const handleDownloadTemplate = () => {
    const wsData: string[][] = [
      ["STT", "Mã định danh", "Họ và Tên", "Ngày sinh"],
      ["1", "HS001", "Nguyễn Văn A", "01/01/2012"],
      ["2", "HS002", "Trần Thị B", "15/05/2012"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 25 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "DanhSachHocSinh");
    XLSX.writeFile(wb, `Mau_Danh_Sach_Hoc_Sinh_Lop_${classData?.name}.xlsx`);
  };

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

        let addedCount = 0;
        let updatedCount = 0;

        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          if (!row || row.length < 3) continue;

          const studentCode = row[1]?.toString().trim();
          const fullName = row[2]?.toString().trim();
          const dob = row[3]?.toString().trim() || "";

          if (!studentCode || !fullName) continue;

          const existingStudent = students.find(s => s.studentCode === studentCode);
          if (existingStudent) {
            await studentService.updateStudent(existingStudent.id!, { fullName, dob });
            updatedCount++;
          } else {
            await studentService.createStudent({
              classId,
              studentCode,
              fullName,
              dob,
            });
            addedCount++;
          }
        }
        toast.success(`Đã thêm mới ${addedCount}, cập nhật ${updatedCount} học sinh!`);
        fetchAllData();
      } catch (err) {
        console.error(err);
        toast.error("File Excel không hợp lệ.");
        setLoading(false);
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = ""; 
  };

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
          <button
            onClick={() => setActiveTab("evaluations")}
            className={`px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
              activeTab === "evaluations" 
                ? "border-blue-600 text-blue-600" 
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Đánh giá hằng tháng
          </button>
        </div>

        {/* Content: Học sinh */}
        {activeTab === "students" && (
          <div>
            {canManageStudents && (
              <div className="flex gap-3 mb-4 justify-end">
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium transition-colors border border-slate-300"
                >
                  <Download size={18} />
                  <span className="hidden sm:inline">Tải file mẫu</span>
                </button>
                <div className="relative">
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleExcelImport}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    title="Nhập danh sách từ Excel"
                  />
                  <button className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors">
                    <Upload size={18} />
                    <span className="hidden sm:inline">Import Excel</span>
                  </button>
                </div>
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
                    {canManageStudents && <th className="p-4 font-semibold text-gray-600 text-right">Thao tác</th>}
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
                        {canManageStudents && (
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

        {/* Content: Đánh giá hằng tháng */}
        {activeTab === "evaluations" && (
          <MonthlyEvaluationsTab
            classData={classData}
            students={students}
            assignments={assignments}
            profile={profile}
          />
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

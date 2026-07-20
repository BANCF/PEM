"use client";

import React, { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase/client";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Loader2, BookOpen, ChevronRight } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";

interface AssignmentWithClass {
  id: string;
  classId: string;
  className: string;
  subject: string;
  academicYear: string;
}

export default function GradesIndexPage() {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentWithClass[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAssignments = async () => {
      try {
        if (!profile) return;

        // Fetch all classes for mapping
        const classSnap = await getDocs(collection(db, "classes"));
        const classMap: Record<string, string> = {};
        classSnap.forEach(doc => {
          classMap[doc.id] = doc.data().name;
        });

        let q;
        if (profile.role === "ADMIN" || profile.role === "BGH" || profile.role === "SUPER_ADMIN") {
          // Admins can see all subject assignments
          q = query(collection(db, "class_assignments"), where("role", "==", "GVBM"));
        } else {
          // Teacher sees only their subject assignments
          q = query(
            collection(db, "class_assignments"), 
            where("teacherId", "==", profile.id),
            where("role", "==", "GVBM")
          );
        }

        const snapshot = await getDocs(q);
        const data: AssignmentWithClass[] = [];
        snapshot.forEach(doc => {
          const assignData = doc.data();
          if (assignData.subject) {
            data.push({
              id: doc.id,
              classId: assignData.classId,
              className: classMap[assignData.classId] || "Không xác định",
              subject: assignData.subject,
              academicYear: assignData.academicYear || "2023-2024",
            });
          }
        });

        // Sort by className then subject
        data.sort((a, b) => {
          if (a.className !== b.className) return a.className.localeCompare(b.className);
          return a.subject.localeCompare(b.subject);
        });

        setAssignments(data);
      } catch (error) {
        console.error("Error fetching assignments:", error);
        toast.error("Lỗi khi tải danh sách phân công.");
      } finally {
        setLoading(false);
      }
    };

    fetchAssignments();
  }, [profile]);

  return (
    <ProtectedRoute allowedRoles={["ADMIN", "SUPER_ADMIN", "BGH", "TEACHER", "TTCM", "TPCM"]}>
      <div className="p-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800">Sổ Điểm (Gradebook)</h1>
          <p className="text-slate-500 mt-1">Chọn lớp và môn học để tiến hành nhập điểm</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : assignments.length === 0 ? (
          <div className="bg-white p-10 rounded-2xl shadow-sm border border-slate-100 text-center">
            <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-700 mb-2">Chưa có phân công giảng dạy</h3>
            <p className="text-slate-500">Bạn chưa được phân công làm Giáo viên bộ môn (GVBM) cho lớp nào. Vui lòng liên hệ Quản trị viên.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {assignments.map(assign => (
              <Link 
                href={`/dashboard/grades/${assign.classId}?subject=${encodeURIComponent(assign.subject)}&academicYear=${encodeURIComponent(assign.academicYear)}`} 
                key={assign.id}
                className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-blue-300 transition-all group flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1 rounded-full border border-blue-100">
                      Năm học: {assign.academicYear}
                    </span>
                    <BookOpen className="text-slate-400 group-hover:text-blue-500 transition-colors" size={20} />
                  </div>
                  <h2 className="text-2xl font-black text-slate-800 mb-1 group-hover:text-blue-600 transition-colors">
                    Lớp {assign.className}
                  </h2>
                  <p className="text-slate-500 font-medium">Môn: {assign.subject}</p>
                </div>
                
                <div className="mt-6 flex items-center text-blue-600 font-semibold text-sm">
                  <span>Nhập điểm</span>
                  <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

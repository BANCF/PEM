"use client";

import React, { useState, useEffect } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase/client";
import { collection, getDocs, query, where } from "firebase/firestore";
import { Loader2, BookOpen, ChevronRight, Users } from "lucide-react";
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
  const [homeroomAssignments, setHomeroomAssignments] = useState<AssignmentWithClass[]>([]);
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
          // Admins can see all assignments
          q = query(collection(db, "class_assignments"));
        } else {
          // Teacher sees only their assignments
          q = query(
            collection(db, "class_assignments"), 
            where("teacherId", "==", profile.id)
          );
        }

        const snapshot = await getDocs(q);
        const gvbm: AssignmentWithClass[] = [];
        const gvcn: AssignmentWithClass[] = [];
        
        // Dùng Map để deduplicate cho admin vì admin lấy toàn bộ GVCN của trường (nhiều bản ghi có thể trùng classId nếu đổi GVCN)
        const gvcnMap = new Map<string, AssignmentWithClass>();

        snapshot.forEach(doc => {
          const assignData = doc.data();
          const mappedData = {
            id: doc.id,
            classId: assignData.classId,
            className: classMap[assignData.classId] || "Không xác định",
            subject: assignData.subject || "",
            academicYear: assignData.academicYear || "2023-2024",
          };

          if (assignData.role === "GVBM" && assignData.subject) {
            gvbm.push(mappedData);
          } else if (assignData.role === "GVCN") {
            if (!gvcnMap.has(assignData.classId)) {
              gvcnMap.set(assignData.classId, mappedData);
              gvcn.push(mappedData);
            }
          }
        });

        // Sort by className then subject
        gvbm.sort((a, b) => {
          if (a.className !== b.className) return a.className.localeCompare(b.className);
          return a.subject.localeCompare(b.subject);
        });
        
        gvcn.sort((a, b) => a.className.localeCompare(b.className));

        setAssignments(gvbm);
        setHomeroomAssignments(gvcn);
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
      <div className="p-4 lg:p-6 max-w-7xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-800">Sổ Điểm (Gradebook)</h1>
          <p className="text-slate-500 mt-1">Quản lý và tổng hợp điểm số học sinh</p>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        ) : (
          <div className="space-y-10">
            {/* Lớp Chủ nhiệm */}
            {(homeroomAssignments.length > 0 || profile?.role === "ADMIN" || profile?.role === "BGH" || profile?.role === "SUPER_ADMIN") && (
              <div>
                <h2 className="text-xl font-bold text-slate-700 mb-4 border-b pb-2 flex items-center gap-2">
                  <Users className="text-blue-500" size={24} />
                  Lớp Chủ Nhiệm (Tổng hợp điểm)
                </h2>
                {homeroomAssignments.length === 0 ? (
                  <p className="text-slate-500 italic">Không có lớp chủ nhiệm nào.</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {homeroomAssignments.map(assign => (
                      <Link 
                        href={`/dashboard/grades/summary/${assign.classId}?academicYear=${encodeURIComponent(assign.academicYear)}`} 
                        key={assign.id}
                        className="bg-gradient-to-br from-blue-50 to-indigo-50 p-6 rounded-2xl shadow-sm border border-blue-100 hover:shadow-md hover:border-blue-300 transition-all group flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <span className="bg-white text-blue-700 text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                              Năm học: {assign.academicYear}
                            </span>
                            <Users className="text-blue-400 group-hover:text-blue-600 transition-colors" size={20} />
                          </div>
                          <h2 className="text-2xl font-black text-slate-800 mb-1 group-hover:text-blue-700 transition-colors">
                            Lớp {assign.className}
                          </h2>
                          <p className="text-blue-600 font-medium">Giáo viên chủ nhiệm</p>
                        </div>
                        
                        <div className="mt-6 flex items-center text-blue-700 font-semibold text-sm bg-white/60 p-2 rounded-lg justify-center group-hover:bg-white transition-colors">
                          <span>Xem Tổng Hợp Điểm</span>
                          <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Lớp Bộ môn */}
            <div>
              <h2 className="text-xl font-bold text-slate-700 mb-4 border-b pb-2 flex items-center gap-2">
                <BookOpen className="text-emerald-500" size={24} />
                Lớp Giảng Dạy (Nhập điểm môn)
              </h2>
              {assignments.length === 0 ? (
                <div className="bg-white p-10 rounded-2xl shadow-sm border border-slate-100 text-center">
                  <BookOpen className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-xl font-bold text-slate-700 mb-2">Chưa có phân công giảng dạy</h3>
                  <p className="text-slate-500">Bạn chưa được phân công làm Giáo viên bộ môn (GVBM) cho lớp nào.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {assignments.map(assign => (
                    <Link 
                      href={`/dashboard/grades/${assign.classId}?subject=${encodeURIComponent(assign.subject)}&academicYear=${encodeURIComponent(assign.academicYear)}`} 
                      key={assign.id}
                      className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md hover:border-emerald-300 transition-all group flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-3 py-1 rounded-full border border-emerald-100">
                            Năm học: {assign.academicYear}
                          </span>
                          <BookOpen className="text-slate-400 group-hover:text-emerald-500 transition-colors" size={20} />
                        </div>
                        <h2 className="text-2xl font-black text-slate-800 mb-1 group-hover:text-emerald-600 transition-colors">
                          Lớp {assign.className}
                        </h2>
                        <p className="text-slate-500 font-medium">Môn: {assign.subject}</p>
                      </div>
                      
                      <div className="mt-6 flex items-center text-emerald-600 font-semibold text-sm">
                        <span>Nhập điểm</span>
                        <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}

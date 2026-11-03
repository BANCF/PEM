import React, { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { classService, ClassData } from "@/lib/services/class.service";
import { assignmentService, ClassAssignmentData } from "@/lib/services/assignment.service";
import {
  parseAssignmentsFromExcel,
  matchTeacher,
  AssignmentParseResult,
  UserCandidate,
  TeacherMatch,
  ParsedAssignmentItem,
} from "@/lib/services/assignmentScheduleParser";
import toast from "react-hot-toast";
import {
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  X,
  Users,
  School,
  ArrowRight,
  HelpCircle,
  RefreshCw,
  Search,
} from "lucide-react";

interface SyncScheduleAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultAcademicYear?: string;
  initialFile?: File | null;
}

const LOCAL_STORAGE_ALIAS_KEY = "pem_custom_teacher_aliases";

export default function SyncScheduleAssignmentModal({
  isOpen,
  onClose,
  onSuccess,
  defaultAcademicYear,
  initialFile,
}: SyncScheduleAssignmentModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [academicYear, setAcademicYear] = useState<string>("2026-2027");
  const [loading, setLoading] = useState<boolean>(false);
  const [parsing, setParsing] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Parsed data
  const [parseResult, setParseResult] = useState<AssignmentParseResult | null>(null);

  // Firestore existing data
  const [systemClasses, setSystemClasses] = useState<ClassData[]>([]);
  const [systemUsers, setSystemUsers] = useState<UserCandidate[]>([]);

  // Teacher mappings: rawTeacherName -> matched userId
  const [teacherMappings, setTeacherMappings] = useState<Record<string, string>>({});
  const [customAliases, setCustomAliases] = useState<Record<string, string>>({});

  // Class selections
  const [selectedClasses, setSelectedClasses] = useState<Record<string, boolean>>({});
  const [autoCreateMissingClasses, setAutoCreateMissingClasses] = useState<boolean>(true);

  // Active view tab
  const [activeTab, setActiveTab] = useState<"teachers" | "classes">("teachers");
  const [previewClassName, setPreviewClassName] = useState<string>("");
  const [teacherSearch, setTeacherSearch] = useState<string>("");

  // Load custom aliases from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(LOCAL_STORAGE_ALIAS_KEY);
      if (saved) {
        setCustomAliases(JSON.parse(saved));
      }
    } catch (e) {
      console.warn("Could not load custom aliases from localStorage", e);
    }
  }, []);

  // Initialize academic year
  useEffect(() => {
    if (defaultAcademicYear) {
      setAcademicYear(defaultAcademicYear);
    } else {
      const today = new Date();
      const curYear = today.getFullYear();
      const ay = today.getMonth() > 5 ? `${curYear}-${curYear + 1}` : `${curYear - 1}-${curYear}`;
      setAcademicYear(ay);
    }
  }, [defaultAcademicYear]);

  // Fetch classes and users when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch classes
        const cls = await classService.getAllClasses();
        setSystemClasses(cls);

        // Fetch users (Teachers, BGH, TTCM, TPCM)
        const userSnap = await getDocs(query(collection(db, "users"), orderBy("fullName", "asc")));
        const validRoles = ["TEACHER", "TTCM", "TPCM", "BGH", "ADMIN", "SUPER_ADMIN"];
        const usersList: UserCandidate[] = userSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as UserCandidate))
          .filter((u) => u.fullName && (!u.role || validRoles.includes(u.role)));
        setSystemUsers(usersList);
      } catch (err) {
        console.error("Error loading system data:", err);
        toast.error("Không thể tải danh sách lớp học hoặc giáo viên.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen]);

  // If initialFile is passed, process it automatically
  useEffect(() => {
    if (isOpen && initialFile && systemUsers.length > 0) {
      setFile(initialFile);
      processExcelFile(initialFile);
    }
  }, [isOpen, initialFile, systemUsers.length]);

  const processExcelFile = async (inputFile: File) => {
    setParsing(true);
    try {
      const buffer = await inputFile.arrayBuffer();
      const result = parseAssignmentsFromExcel(buffer);
      setParseResult(result);

      // Auto match all unique teachers
      const initialMappings: Record<string, string> = {};
      result.uniqueTeachers.forEach((raw) => {
        const match = matchTeacher(raw, systemUsers, customAliases);
        if (match.matchedUser) {
          initialMappings[raw] = match.matchedUser.id;
        }
      });
      setTeacherMappings(initialMappings);

      // Select all classes by default (excluding special non-class groups)
      const classMap: Record<string, boolean> = {};
      const specialGroups = ["IMSO", "BDK6", "BD K7", "BDK8", "HSG K9", "DP2"];
      result.classes.forEach((c) => {
        classMap[c] = !specialGroups.includes(c);
      });
      setSelectedClasses(classMap);

      if (result.classes.length > 0) {
        setPreviewClassName(result.classes.find((c) => !specialGroups.includes(c)) || result.classes[0]);
      }

      toast.success(
        `Đã đọc thành công sheet "${result.sheetName}": tìm thấy ${result.classes.length} lớp, ${result.assignments.length} phân công!`
      );
    } catch (err: any) {
      console.error("Parse Excel error:", err);
      toast.error(err.message || "Lỗi khi xử lý file Excel");
      setParseResult(null);
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      processExcelFile(selected);
    }
  };

  const handleTeacherMappingChange = (rawTeacher: string, userId: string) => {
    setTeacherMappings((prev) => ({ ...prev, [rawTeacher]: userId }));

    // Also remember as custom alias
    const chosenUser = systemUsers.find((u) => u.id === userId);
    if (chosenUser) {
      const updatedAliases = { ...customAliases, [rawTeacher]: chosenUser.fullName };
      setCustomAliases(updatedAliases);
      try {
        localStorage.setItem(LOCAL_STORAGE_ALIAS_KEY, JSON.stringify(updatedAliases));
      } catch (e) {
        console.warn("Could not save alias to localStorage", e);
      }
    }
  };

  // Compute matched stats
  const teacherStats = useMemo(() => {
    if (!parseResult) return { total: 0, matched: 0, unmatched: 0 };
    const total = parseResult.uniqueTeachers.length;
    let matched = 0;
    parseResult.uniqueTeachers.forEach((t) => {
      if (teacherMappings[t]) matched++;
    });
    return { total, matched, unmatched: total - matched };
  }, [parseResult, teacherMappings]);

  // Compute class stats
  const classStats = useMemo(() => {
    if (!parseResult) return { total: 0, existing: 0, missing: 0 };
    const total = Object.keys(selectedClasses).filter((c) => selectedClasses[c]).length;
    const existingNameSet = new Set(systemClasses.map((c) => c.name.toLowerCase().trim()));
    let existing = 0;
    Object.keys(selectedClasses)
      .filter((c) => selectedClasses[c])
      .forEach((c) => {
        if (existingNameSet.has(c.toLowerCase().trim())) {
          existing++;
        }
      });
    return { total, existing, missing: total - existing };
  }, [parseResult, selectedClasses, systemClasses]);

  // Assignments for current preview class
  const previewAssignments = useMemo(() => {
    if (!parseResult || !previewClassName) return [];
    return parseResult.assignments.filter((a) => a.className === previewClassName);
  }, [parseResult, previewClassName]);

  // Perform synchronization
  const handleExecuteSync = async () => {
    if (!parseResult) return;

    const chosenClassNames = Object.keys(selectedClasses).filter((c) => selectedClasses[c]);
    if (chosenClassNames.length === 0) {
      toast.error("Vui lòng chọn ít nhất 1 lớp học để đồng bộ.");
      return;
    }

    if (teacherStats.unmatched > 0) {
      const confirmContinue = window.confirm(
        `Vẫn còn ${teacherStats.unmatched} giáo viên chưa được ánh xạ vào tài khoản hệ thống. Những phân công của giáo viên này sẽ bị bỏ qua. Bạn có chắc muốn tiếp tục?`
      );
      if (!confirmContinue) return;
    }

    setSubmitting(true);
    const toastId = toast.loading("Đang đồng bộ phân công giảng dạy...");

    try {
      // 1. Resolve classes: map class names to class IDs
      const classNameToIdMap: Record<string, string> = {};
      const existingNameMap: Record<string, ClassData> = {};
      systemClasses.forEach((c) => {
        existingNameMap[c.name.toLowerCase().trim()] = c;
      });

      // Auto-create missing classes if checked
      const classesToCreate: string[] = [];
      chosenClassNames.forEach((cName) => {
        const norm = cName.toLowerCase().trim();
        if (existingNameMap[norm]) {
          classNameToIdMap[cName] = existingNameMap[norm].id!;
        } else if (autoCreateMissingClasses) {
          classesToCreate.push(cName);
        }
      });

      if (classesToCreate.length > 0) {
        toast.loading(`Đang tự động tạo ${classesToCreate.length} lớp học mới...`, { id: toastId });
        for (const cName of classesToCreate) {
          // Infer grade from class name: e.g. "6A" -> "6", "1G01" -> "1", "10A" -> "10"
          const gradeMatch = cName.match(/^\d+/);
          const grade = gradeMatch ? gradeMatch[0] : "Khác";

          const newId = await classService.createClass({
            name: cName,
            grade,
            academicYear,
          });
          classNameToIdMap[cName] = newId;
        }
      }

      // 2. Build assignment list for batch insert
      const newAssignments: Omit<ClassAssignmentData, "id" | "createdAt">[] = [];
      let skippedCount = 0;

      parseResult.assignments.forEach((item) => {
        if (!selectedClasses[item.className]) return;

        const classId = classNameToIdMap[item.className];
        if (!classId) {
          skippedCount++;
          return;
        }

        const teacherId = teacherMappings[item.rawTeacher];
        if (!teacherId) {
          skippedCount++;
          return;
        }

        newAssignments.push({
          classId,
          teacherId,
          role: item.role,
          subject: item.role === "GVBM" ? (item.subject || item.rawSubject) : undefined,
          academicYear,
        });
      });

      if (newAssignments.length === 0) {
        toast.error("Không có phân công nào hợp lệ để đồng bộ.", { id: toastId });
        setSubmitting(false);
        return;
      }

      toast.loading(`Đang lưu ${newAssignments.length} phân công vào hệ thống...`, { id: toastId });

      // 3. Batch commit to Firestore
      const targetClassIds = Array.from(new Set(newAssignments.map((a) => a.classId)));
      const syncResult = await assignmentService.batchSyncAssignments(
        academicYear,
        newAssignments,
        targetClassIds
      );

      toast.success(
        `Đồng bộ thành công! Đã tạo ${syncResult.created} phân công cho ${targetClassIds.length} lớp học (xóa ${syncResult.deleted} bản ghi cũ).`,
        { id: toastId, duration: 6000 }
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Execute sync error:", err);
      toast.error(err.message || "Lỗi khi đồng bộ phân công.", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl border border-gray-100 flex flex-col max-h-[90vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-emerald-50 via-teal-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md shadow-emerald-200">
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">
                Đồng bộ Phân công Giảng dạy từ Thời khóa biểu
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Tự động bóc tách sheet <b>P.công giảng dạy</b> để gán GVBM và GVCN cho tất cả các lớp
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={submitting}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: File & Academic Year Input */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                File Excel Thời khóa biểu (.xlsx) <span className="text-red-500">*</span>
              </label>
              <div className="relative border-2 border-dashed border-emerald-300 hover:border-emerald-500 rounded-xl p-4 bg-emerald-50/30 text-center transition-colors">
                <input
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  disabled={parsing || submitting}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="flex flex-col items-center justify-center gap-1.5">
                  <Upload size={24} className="text-emerald-600" />
                  <p className="text-sm font-medium text-gray-700">
                    {file ? file.name : "Kéo thả hoặc bấm vào đây để chọn file TKB"}
                  </p>
                  <p className="text-xs text-gray-400">
                    Hỗ trợ các file TKB chứa sheet <b>P.công giảng dạy</b>
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Năm học áp dụng <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                placeholder="2026-2027"
                disabled={submitting}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none text-sm font-medium"
              />
              <p className="text-xs text-gray-500 mt-2">
                Phân công sẽ được áp dụng cho năm học này.
              </p>
            </div>
          </div>

          {/* Loading States */}
          {parsing && (
            <div className="flex items-center justify-center py-10 gap-3 text-emerald-600 font-medium">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Đang phân tích sheet P.công giảng dạy...</span>
            </div>
          )}

          {/* Section 2: Summary Stats Cards */}
          {parseResult && !parsing && (
            <div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-emerald-700 font-medium uppercase tracking-wider">
                      Lớp học trích xuất
                    </p>
                    <p className="text-2xl font-bold text-emerald-900 mt-1">
                      {classStats.total} <span className="text-sm font-normal text-gray-500">lớp</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {classStats.existing} đã có • {classStats.missing} lớp mới
                    </p>
                  </div>
                  <School className="text-emerald-500" size={32} />
                </div>

                <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-blue-700 font-medium uppercase tracking-wider">
                      Giáo viên nhận diện
                    </p>
                    <p className="text-2xl font-bold text-blue-900 mt-1">
                      {teacherStats.matched} / {teacherStats.total}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {teacherStats.unmatched === 0 ? (
                        <span className="text-emerald-600 font-medium">✓ 100% đã khớp</span>
                      ) : (
                        <span className="text-amber-600 font-medium">
                          ⚠️ {teacherStats.unmatched} GV cần khớp
                        </span>
                      )}
                    </p>
                  </div>
                  <Users className="text-blue-500" size={32} />
                </div>

                <div className="bg-purple-50/60 border border-purple-100 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="text-xs text-purple-700 font-medium uppercase tracking-wider">
                      Tổng số phân công
                    </p>
                    <p className="text-2xl font-bold text-purple-900 mt-1">
                      {parseResult.assignments.length}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">Bao gồm cả GVCN & GVBM</p>
                  </div>
                  <FileSpreadsheet className="text-purple-500" size={32} />
                </div>
              </div>

              {/* Tabs for Preview & Mapping */}
              <div className="mt-6">
                <div className="flex border-b border-gray-200 gap-4">
                  <button
                    type="button"
                    onClick={() => setActiveTab("teachers")}
                    className={`pb-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
                      activeTab === "teachers"
                        ? "border-emerald-600 text-emerald-700"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <span>1. Ánh xạ Giáo viên</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        teacherStats.unmatched === 0
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {teacherStats.matched}/{teacherStats.total}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab("classes")}
                    className={`pb-3 text-sm font-semibold transition-colors border-b-2 flex items-center gap-2 ${
                      activeTab === "classes"
                        ? "border-emerald-600 text-emerald-700"
                        : "border-transparent text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <span>2. Xem trước theo Lớp học</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {classStats.total} lớp
                    </span>
                  </button>
                </div>

                {/* Tab 1: Teacher Mapping */}
                {activeTab === "teachers" && (
                  <div className="pt-4 space-y-3">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <p className="text-xs text-gray-500">
                        Hệ thống đã tự động so khớp tên viết tắt từ sheet TKB với danh sách tài khoản
                        giáo viên. Bạn có thể chọn lại nếu chưa chính xác.
                      </p>
                      <div className="relative w-64">
                        <Search
                          size={15}
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                        />
                        <input
                          type="text"
                          value={teacherSearch}
                          onChange={(e) => setTeacherSearch(e.target.value)}
                          placeholder="Tìm tên giáo viên..."
                          className="w-full pl-9 pr-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        />
                      </div>
                    </div>

                    <div className="border border-gray-200 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-gray-50 sticky top-0 border-b border-gray-200 z-10">
                          <tr>
                            <th className="p-3 font-semibold text-gray-600 w-12 text-center">STT</th>
                            <th className="p-3 font-semibold text-gray-600 w-1/3">
                              Tên trong Sheet TKB
                            </th>
                            <th className="p-3 font-semibold text-gray-600 w-24 text-center">
                              Trạng thái
                            </th>
                            <th className="p-3 font-semibold text-gray-600">
                              Tài khoản Giáo viên trong Hệ thống
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {parseResult.uniqueTeachers
                            .filter((t) =>
                              t.toLowerCase().includes(teacherSearch.toLowerCase())
                            )
                            .map((rawTeacher, idx) => {
                              const matchedUserId = teacherMappings[rawTeacher] || "";
                              const matchedUser = systemUsers.find(
                                (u) => u.id === matchedUserId
                              );

                              return (
                                <tr key={rawTeacher} className="hover:bg-gray-50">
                                  <td className="p-3 text-center text-gray-400 font-mono">
                                    {idx + 1}
                                  </td>
                                  <td className="p-3 font-bold text-gray-800">
                                    {rawTeacher}
                                  </td>
                                  <td className="p-3 text-center">
                                    {matchedUser ? (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                        <CheckCircle2 size={12} /> Khớp
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                        <AlertCircle size={12} /> Chưa khớp
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-3">
                                    <select
                                      value={matchedUserId}
                                      onChange={(e) =>
                                        handleTeacherMappingChange(
                                          rawTeacher,
                                          e.target.value
                                        )
                                      }
                                      className={`w-full max-w-md px-3 py-1.5 border rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none ${
                                        matchedUser
                                          ? "border-gray-200 text-gray-800"
                                          : "border-amber-400 bg-amber-50/30 text-amber-900 font-medium"
                                      }`}
                                    >
                                      <option value="">-- Bỏ qua hoặc chọn giáo viên --</option>
                                      {systemUsers.map((u) => (
                                        <option key={u.id} value={u.id}>
                                          {u.fullName} ({u.email || u.role})
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Tab 2: Class Preview */}
                {activeTab === "classes" && (
                  <div className="pt-4 space-y-4">
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={
                              Object.values(selectedClasses).length > 0 &&
                              Object.values(selectedClasses).every((v) => v)
                            }
                            onChange={(e) => {
                              const checked = e.target.checked;
                              const updated: Record<string, boolean> = {};
                              parseResult.classes.forEach((c) => {
                                updated[c] = checked;
                              });
                              setSelectedClasses(updated);
                            }}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>Chọn tất cả {parseResult.classes.length} lớp</span>
                        </label>

                        <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={autoCreateMissingClasses}
                            onChange={(e) => setAutoCreateMissingClasses(e.target.checked)}
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <span>Tự động tạo các lớp chưa có trên hệ thống ({classStats.missing} lớp)</span>
                        </label>
                      </div>

                      {/* Class selector for detailed view */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Xem chi tiết lớp:</span>
                        <select
                          value={previewClassName}
                          onChange={(e) => setPreviewClassName(e.target.value)}
                          className="px-3 py-1 border border-gray-300 rounded-lg text-xs font-bold text-gray-800 focus:ring-emerald-500 focus:outline-none"
                        >
                          {parseResult.classes.map((c) => (
                            <option key={c} value={c}>
                              Lớp {c}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Preview Table for selected class */}
                    <div className="border border-gray-200 rounded-xl overflow-hidden">
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-gray-800">
                            Chi tiết phân công: Lớp {previewClassName}
                          </span>
                          <span className="text-xs text-gray-500">
                            ({previewAssignments.length} phân công)
                          </span>
                        </div>
                        {/* Check if homeroom teacher is found */}
                        {(() => {
                          const gvcn = previewAssignments.find((a) => a.role === "GVCN");
                          if (gvcn) {
                            const u = systemUsers.find(
                              (user) => user.id === teacherMappings[gvcn.rawTeacher]
                            );
                            return (
                              <span className="text-xs px-2.5 py-1 bg-purple-50 text-purple-700 border border-purple-200 rounded-full font-semibold">
                                GVCN: {u ? u.fullName : gvcn.rawTeacher}
                              </span>
                            );
                          }
                          return null;
                        })()}
                      </div>

                      <div className="max-h-64 overflow-y-auto">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead className="bg-gray-50/50 sticky top-0 border-b border-gray-100">
                            <tr>
                              <th className="p-2.5 font-semibold text-gray-600">Vai trò</th>
                              <th className="p-2.5 font-semibold text-gray-600">Môn học</th>
                              <th className="p-2.5 font-semibold text-gray-600">Tên trong TKB</th>
                              <th className="p-2.5 font-semibold text-gray-600">Giáo viên sẽ gán</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {previewAssignments.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="p-6 text-center text-gray-400">
                                  Không có dữ liệu phân công cho lớp này trong TKB.
                                </td>
                              </tr>
                            ) : (
                              previewAssignments.map((assign, aIdx) => {
                                const matchedU = systemUsers.find(
                                  (u) => u.id === teacherMappings[assign.rawTeacher]
                                );

                                return (
                                  <tr key={aIdx} className="hover:bg-gray-50">
                                    <td className="p-2.5">
                                      <span
                                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                          assign.role === "GVCN"
                                            ? "bg-purple-100 text-purple-700"
                                            : "bg-blue-100 text-blue-700"
                                        }`}
                                      >
                                        {assign.role}
                                      </span>
                                    </td>
                                    <td className="p-2.5 font-medium text-gray-800">
                                      {assign.role === "GVCN" ? "Chủ nhiệm" : (assign.subject || assign.rawSubject)}
                                    </td>
                                    <td className="p-2.5 text-gray-500 font-mono">
                                      {assign.rawTeacher}
                                    </td>
                                    <td className="p-2.5">
                                      {matchedU ? (
                                        <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                          <CheckCircle2 size={13} className="text-emerald-500" />
                                          {matchedU.fullName}
                                        </span>
                                      ) : (
                                        <span className="text-amber-600 font-medium">
                                          (Chưa ánh xạ tài khoản)
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 rounded-xl transition-colors disabled:opacity-50"
          >
            Đóng
          </button>

          <button
            type="button"
            onClick={handleExecuteSync}
            disabled={!parseResult || submitting || parsing}
            className="px-6 py-2.5 text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-all shadow-md shadow-emerald-200 hover:shadow-lg hover:shadow-emerald-300 flex items-center gap-2 disabled:opacity-50 disabled:shadow-none"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Đang đồng bộ...</span>
              </>
            ) : (
              <>
                <RefreshCw size={16} />
                <span>
                  Xác nhận Áp dụng Phân công ({classStats.total} Lớp)
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


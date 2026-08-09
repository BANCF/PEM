import React, { useState, useMemo } from 'react';
import { FullScheduleData, ScheduleClassInfo } from '@/lib/services/schedule.service';
import { X, ArrowRightLeft, UserCheck, AlertCircle } from 'lucide-react';

interface SwapSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  day: string;
  period: string;
  cellData: ScheduleClassInfo;
  schedule: FullScheduleData;
  teacherName: string;
}

export default function SwapSearchModal({
  isOpen,
  onClose,
  day,
  period,
  cellData,
  schedule,
  teacherName
}: SwapSearchModalProps) {
  const [activeTab, setActiveTab] = useState<'swap' | 'substitute'>('swap');

  // Compute candidates
  const { swapCandidates, substituteCandidates } = useMemo(() => {
    if (!isOpen || !schedule || !teacherName || !cellData) {
      return { swapCandidates: [], substituteCandidates: [] };
    }

    const subs: { teacher: string }[] = [];
    const swaps: { teacher: string; theirDay: string; theirPeriod: string; theirSubject: string }[] = [];

    const isTeacherFree = (tName: string, d: string, p: string) => {
      const dayData = schedule.teachers[tName]?.[d] || [];
      const cell = dayData.find(item => item.period.toString() === p.toString());
      return !cell || !cell.className || cell.className.trim() === '';
    };

    const days = ["2", "3", "4", "5", "6"];

    Object.keys(schedule.teachers).forEach(tName => {
      if (tName === teacherName) return; // Skip self

      // Check if this teacher is free on the target day/period
      const isFreeOnTarget = isTeacherFree(tName, day, period);

      if (isFreeOnTarget) {
        subs.push({ teacher: tName });

        // Check for swap opportunities (must be same class)
        days.forEach(d => {
          const dayData = schedule.teachers[tName]?.[d] || [];
          dayData.forEach(item => {
            if (item.className === cellData.className) {
              // This teacher teaches the same class on day `d`, period `item.period`.
              // Is current teacher (Teacher A) free on that day and period?
              if (isTeacherFree(teacherName, d, item.period.toString())) {
                swaps.push({
                  teacher: tName,
                  theirDay: d,
                  theirPeriod: item.period.toString(),
                  theirSubject: item.subject
                });
              }
            }
          });
        });
      }
    });

    return { swapCandidates: swaps, substituteCandidates: subs };
  }, [isOpen, schedule, teacherName, cellData, day, period]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Tra cứu Đổi tiết / Dạy thay</h2>
            <p className="text-sm text-slate-500 mt-1">
              Bạn đang tìm người thay cho: <strong className="text-blue-700">Thứ {day} - Tiết {period} (Lớp {cellData.className} - Môn {cellData.subject})</strong>
            </p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full text-slate-500 transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex border-b border-slate-200">
          <button
            onClick={() => setActiveTab('swap')}
            className={`flex-1 py-3 font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'swap' ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <ArrowRightLeft size={16} />
            Đổi tiết cùng lớp ({swapCandidates.length})
          </button>
          <button
            onClick={() => setActiveTab('substitute')}
            className={`flex-1 py-3 font-semibold text-sm flex items-center justify-center gap-2 transition-colors ${
              activeTab === 'substitute' ? 'text-emerald-600 border-b-2 border-emerald-600 bg-emerald-50/50' : 'text-slate-500 hover:bg-slate-50'
            }`}
          >
            <UserCheck size={16} />
            Người rảnh dạy thay ({substituteCandidates.length})
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 bg-slate-50/50">
          {activeTab === 'swap' && (
            <div className="space-y-4">
              <div className="bg-blue-50 text-blue-800 p-3 rounded-lg flex gap-3 text-sm border border-blue-100">
                <AlertCircle className="shrink-0" size={18} />
                <p>Hệ thống chỉ gợi ý những giáo viên <strong>đang rảnh vào Thứ {day} Tiết {period}</strong> VÀ <strong>có dạy lớp {cellData.className}</strong> vào một thời điểm khác mà <strong>bạn cũng đang rảnh</strong>.</p>
              </div>

              {swapCandidates.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <p>Không tìm thấy giáo viên nào phù hợp để đổi chéo môn ở lớp {cellData.className}.</p>
                </div>
              ) : (
                <div className="grid gap-3">
                  {swapCandidates.map((candidate, idx) => (
                    <div key={idx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-slate-800">{candidate.teacher}</h4>
                        <div className="text-sm text-slate-600 mt-1 flex items-center gap-2">
                          <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700">Dạy {candidate.theirSubject}</span>
                          vào
                          <strong className="text-blue-700">Thứ {candidate.theirDay} - Tiết {candidate.theirPeriod}</strong>
                        </div>
                      </div>
                      <div className="bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-lg border border-emerald-100 text-center">
                        Có thể đổi chéo<br/>vì bạn rảnh lúc này
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'substitute' && (
            <div className="space-y-4">
              <div className="bg-emerald-50 text-emerald-800 p-3 rounded-lg flex gap-3 text-sm border border-emerald-100">
                <AlertCircle className="shrink-0" size={18} />
                <p>Danh sách tất cả giáo viên <strong>không có lịch dạy</strong> vào Thứ {day} Tiết {period}. Bạn có thể nhờ họ dạy thay hoặc giữ lớp.</p>
              </div>

              {substituteCandidates.length === 0 ? (
                <div className="text-center py-10 text-slate-400">
                  <p>Không có giáo viên nào rảnh vào thời điểm này.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {substituteCandidates.map((candidate, idx) => (
                    <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-sm">
                        {candidate.teacher.charAt(0)}
                      </div>
                      <span className="font-medium text-slate-700">{candidate.teacher}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

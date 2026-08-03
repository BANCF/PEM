import { useState, useEffect, useRef } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useAuth } from "@/contexts/AuthContext";
import toast from "react-hot-toast";

export const useClassAlarm = () => {
  const { profile } = useAuth();
  const [schedule, setSchedule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const alertedClasses = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!profile?.id) return;

    const fetchSchedule = async () => {
      try {
        const docRef = doc(db, "schedules", "current");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.teachers && data.teachers[profile.id]) {
            setSchedule(data.teachers[profile.id]);
          }
        }
      } catch (error) {
        console.error("Lỗi lấy thời khóa biểu cho chuông báo:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSchedule();
  }, [profile?.id]);

  useEffect(() => {
    if (!schedule) return;

    const checkAlarms = () => {
      const now = new Date();
      // Target time is 5 minutes from now
      const targetTime = new Date(now.getTime() + 5 * 60000);
      const targetHours = targetTime.getHours().toString().padStart(2, '0');
      const targetMinutes = targetTime.getMinutes().toString().padStart(2, '0');
      const targetTimeString = `${targetHours}:${targetMinutes}`;

      let vnDay = now.getDay();
      const scheduleDay = vnDay === 0 ? "8" : (vnDay + 1).toString();

      const todayClasses = schedule[scheduleDay] || [];

      for (const cls of todayClasses) {
        if (!cls.time) continue;
        const startTimeStr = cls.time.split('-')[0].trim();

        // Unique ID for this class session today
        const classSessionId = `${scheduleDay}-${cls.className}-${cls.period}-${startTimeStr}`;

        if (startTimeStr === targetTimeString && !alertedClasses.current.has(classSessionId)) {
          alertedClasses.current.add(classSessionId);
          triggerAlarm(cls);
        }
      }
    };

    const triggerAlarm = (cls: any) => {
      // Play sound
      const audio = new Audio("/sounds/notification.wav");
      audio.play().catch(e => console.log("Audio play blocked by browser policy"));

      // Show toast
      toast.custom((t) => (
        <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
          <div className="flex-1 w-0 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0 pt-0.5">
                <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-xl">🔔</span>
                </div>
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-bold text-gray-900">
                  Sắp đến tiết {cls.subject}!
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Còn 5 phút nữa là bắt đầu tiết {cls.period} ở lớp {cls.className}. Mời thầy/cô chuẩn bị vào lớp.
                </p>
              </div>
            </div>
          </div>
          <div className="flex border-l border-gray-200">
            <button
              onClick={() => toast.dismiss(t.id)}
              className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none"
            >
              Đóng
            </button>
          </div>
        </div>
      ), { duration: 10000 });
    };

    // Check every 30 seconds
    const intervalId = setInterval(checkAlarms, 30000);
    // Initial check
    checkAlarms();

    return () => clearInterval(intervalId);
  }, [schedule]);

  return { loading };
};

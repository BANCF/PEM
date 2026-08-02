"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase/client";
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, limit } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, Check, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

import { getMessaging, getToken } from "firebase/messaging";
import { app } from "@/lib/firebase/client";
import { arrayUnion } from "firebase/firestore";

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export default function Notifications() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Hàm phát âm thanh chuông báo (Chime Sound) trên điện thoại và máy tính
  const playNotificationSound = () => {
    try {
      if (typeof window === "undefined") return;
      const audio = new Audio("/sounds/notification.wav");
      audio.volume = 0.8;
      audio.play().catch(() => {
        // Fallback Web Audio API nếu trình duyệt chặn autoplay trước khi tương tác
        try {
          const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
          if (!AudioCtx) return;
          const ctx = new AudioCtx();
          const now = ctx.currentTime;
          const osc1 = ctx.createOscillator();
          const gain1 = ctx.createGain();
          osc1.type = "sine";
          osc1.frequency.setValueAtTime(880, now);
          gain1.gain.setValueAtTime(0.4, now);
          gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
          osc1.connect(gain1);
          gain1.connect(ctx.destination);
          osc1.start(now);
          osc1.stop(now + 0.3);

          const osc2 = ctx.createOscillator();
          const gain2 = ctx.createGain();
          osc2.type = "sine";
          osc2.frequency.setValueAtTime(1320, now + 0.15);
          gain2.gain.setValueAtTime(0.5, now + 0.15);
          gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
          osc2.connect(gain2);
          gain2.connect(ctx.destination);
          osc2.start(now + 0.15);
          osc2.stop(now + 0.6);
        } catch (e) {
          console.error("Web Audio fallback error:", e);
        }
      });
    } catch (e) {
      console.error("Audio play error:", e);
    }
  };

  // Đăng ký Service Worker khi ứng dụng khởi chạy
  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("Service Worker registered:", reg.scope))
        .catch((err) => console.error("Service Worker registration failed:", err));
    }
  }, []);

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", profile.id),
      orderBy("createdAt", "desc"),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifs: Notification[] = [];
      let unread = 0;

      snapshot.forEach((doc) => {
        const data = doc.data() as Omit<Notification, "id">;
        notifs.push({ id: doc.id, ...data });
        if (!data.read) {
          unread++;
        }
      });

      setNotifications(notifs);
      
      // Phát thông báo Toast + Chuông Báo + Bắn thông báo Push Service Worker khi có tin mới
      setUnreadCount((prevCount) => {
        if (unread > prevCount && prevCount !== -1) {
          const newestUnread = notifs.find(n => !n.read);
          if (newestUnread) {
            // 1. Phát âm thanh chuông báo
            playNotificationSound();

            // 2. In-app Toast
            toast.custom((t) => (
              <div
                className={`${
                  t.visible ? 'animate-enter' : 'animate-leave'
                } max-w-md w-full bg-white shadow-lg rounded-xl pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
              >
                <div className="flex-1 w-0 p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 pt-0.5">
                      <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Bell className="h-6 w-6 text-blue-600" />
                      </div>
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-bold text-gray-900">
                        {newestUnread.title}
                      </p>
                      <p className="mt-1 text-sm text-gray-500">
                        {newestUnread.message}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex border-l border-gray-200">
                  <button
                    onClick={() => toast.dismiss(t.id)}
                    className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-indigo-600 hover:text-indigo-500 focus:outline-none"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            ));

            // 3. Native Service Worker Push Notification (Chạy ngầm kể cả khi đóng App)
            if (typeof window !== "undefined" && "Notification" in window && window.Notification.permission === "granted") {
              if ("serviceWorker" in navigator) {
                navigator.serviceWorker.ready.then((reg) => {
                  reg.showNotification(newestUnread.title, {
                    body: newestUnread.message,
                    icon: "/logo-pascal-01.png",
                    badge: "/logo-pascal-01.png",
                    vibrate: [300, 100, 300, 100, 300],
                    data: { url: newestUnread.link || "/dashboard/evaluations" }
                  } as any);
                });
              } else {
                try {
                  new window.Notification(newestUnread.title, {
                    body: newestUnread.message,
                    icon: "/logo-pascal-01.png"
                  });
                } catch (e) {
                  console.error("Native notification error:", e);
                }
              }
            }
          }
        }
        return unread;
      });
    });

    return () => unsubscribe();
  }, [profile]);

  // Initial set of unreadCount to -1 so first load doesn't trigger toast
  useEffect(() => {
    setUnreadCount(-1);
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, "notifications", id), {
        read: true
      });
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = () => {
    notifications.forEach(n => {
      if (!n.read) markAsRead(n.id);
    });
    setIsOpen(false);
  };

  const requestPushPermission = async () => {
    if (typeof window !== "undefined" && "Notification" in window) {
      const perm = await window.Notification.requestPermission();
      if (perm === "granted") {
        try {
          if ("serviceWorker" in navigator) {
            const reg = await navigator.serviceWorker.ready;
            
            // 1. Phát thử 1 thông báo Test nổi trên màn hình ngay lập tức
            reg.showNotification("🎉 Đã bật Push App thành công!", {
              body: "Từ giờ bạn sẽ nhận được thông báo thi đua & KPI trực tiếp kể cả khi đã tắt App.",
              icon: "/logo-pascal-01.png",
              badge: "/logo-pascal-01.png",
              sound: "/sounds/notification.wav",
              vibrate: [500, 200, 500, 200, 500],
              tag: "pem-test-notification",
              renotify: true
            } as any);

            // 2. Đăng ký FCM Device Token chính thức với Google Push Server cho điện thoại (dành cho lúc TẮT APP)
            const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "BJIAdA_hDMLR2dBCmSXonTtJWq8wJ7wIexkObcbnFYKsSm0mFzahj_DRBqQRrhbmb4iXTn1pdESIF_sMvW6ZPVA";
            
            try {
              const messaging = getMessaging(app);
              const fcmToken = await getToken(messaging, {
                serviceWorkerRegistration: reg,
                vapidKey: publicVapidKey
              });

              if (fcmToken && profile) {
                const userRef = doc(db, "users", profile.id);
                await updateDoc(userRef, {
                  fcmTokens: arrayUnion(fcmToken)
                });
                console.log("FCM Device Token registered successfully:", fcmToken);
              }
            } catch (fcmErr) {
              console.error("FCM Token Registration Error:", fcmErr);
            }
          }
          toast.success("Đã bật thông báo đẩy trực tiếp về điện thoại!");
        } catch (e) {
          console.error("Push Registration Error:", e);
          toast.success("Đã bật quyền nhận thông báo!");
        }
      } else {
        toast.error("Bạn đã từ chối quyền bật thông báo đẩy.");
      }
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-500 hover:bg-slate-100 rounded-full transition"
      >
        <Bell size={24} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-800">Thông báo</h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={requestPushPermission}
                  className="text-xs text-emerald-600 font-semibold hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 transition"
                  title="Bật thông báo nổi trên điện thoại"
                >
                  Bật Push App
                </button>
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 font-medium hover:text-blue-700 flex items-center transition"
                  >
                    <Check size={14} className="mr-1" />
                    Đọc hết
                  </button>
                )}
              </div>
            </div>
            
            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-500 flex flex-col items-center">
                  <Bell size={32} className="text-slate-300 mb-2 opacity-50" />
                  <p className="text-sm">Bạn không có thông báo nào</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {notifications.map((notif) => (
                    <div 
                      key={notif.id} 
                      className={`p-4 hover:bg-slate-50 transition cursor-pointer flex gap-3 ${!notif.read ? 'bg-blue-50/30' : ''}`}
                      onClick={() => {
                        if (!notif.read) markAsRead(notif.id);
                        if (notif.link) {
                          window.location.href = notif.link;
                        }
                      }}
                    >
                      <div className="mt-1">
                        {!notif.read ? (
                          <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
                        ) : (
                          <div className="w-2 h-2 bg-transparent rounded-full mt-1.5" />
                        )}
                      </div>
                      <div className="flex-1">
                        <p className={`text-sm ${!notif.read ? 'font-bold text-slate-800' : 'font-medium text-slate-600'}`}>
                          {notif.title}
                        </p>
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                          {notif.message}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-2 font-medium">
                          {new Date(notif.createdAt).toLocaleString('vi-VN')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-3 border-t border-slate-100 bg-slate-50 text-center">
              <Link href="/dashboard" className="text-xs font-semibold text-slate-500 hover:text-slate-800">
                Xem tất cả
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

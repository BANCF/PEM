"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/firebase/client";
import { collection, query, where, onSnapshot, orderBy, updateDoc, doc, limit } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { Bell, Check, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import Link from "next/link";

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
      let hasNewUnread = false;

      snapshot.forEach((doc) => {
        const data = doc.data() as Omit<Notification, "id">;
        notifs.push({ id: doc.id, ...data });
        if (!data.read) {
          unread++;
        }
      });

      setNotifications(notifs);
      
      // Check if there are new unread notifications that we haven't seen yet to show toast
      // We compare with previous unread count (only if it increased, it means a new one arrived)
      setUnreadCount((prevCount) => {
        if (unread > prevCount && prevCount !== -1) {
          // Find the newest unread one
          const newestUnread = notifs.find(n => !n.read);
          if (newestUnread) {
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
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-xs text-blue-600 font-medium hover:text-blue-700 flex items-center transition"
                >
                  <Check size={14} className="mr-1" />
                  Đánh dấu đã đọc
                </button>
              )}
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

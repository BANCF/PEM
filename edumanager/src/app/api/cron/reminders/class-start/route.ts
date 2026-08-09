import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getMessaging } from 'firebase-admin/messaging';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'my-super-secret-cron-key';
    
    // Check Vercel Cron authentication
    if (authHeader !== `Bearer ${cronSecret}` && request.headers.get('x-vercel-cron') !== '1') {
      const { searchParams } = new URL(request.url);
      if (searchParams.get('secret') !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
    }

    // Get current time in Vietnam (UTC+7)
    const now = new Date();
    const vnTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh" }));
    
    // Target time is 5 minutes from now
    const targetTime = new Date(vnTime.getTime() + 5 * 60000);
    const targetHours = targetTime.getHours().toString().padStart(2, '0');
    const targetMinutes = targetTime.getMinutes().toString().padStart(2, '0');
    const targetTimeString = `${targetHours}:${targetMinutes}`;

    // Get Vietnam day of week (0=Sunday, 1=Monday... 6=Saturday)
    let vnDay = vnTime.getDay();
    // Chuyển sang định dạng của hệ thống: Thứ 2 -> "2", Thứ 3 -> "3"... Chủ nhật -> "8"
    const scheduleDay = vnDay === 0 ? "8" : (vnDay + 1).toString();

    const scheduleDoc = await adminDb.collection('schedules').doc('current').get();
    if (!scheduleDoc.exists) {
      return NextResponse.json({ success: true, message: 'No schedule found' });
    }

    const scheduleData = scheduleDoc.data();
    if (!scheduleData || !scheduleData.teachers) {
      return NextResponse.json({ success: true, message: 'No teachers schedule found' });
    }

    const teachersSchedule = scheduleData.teachers;
    const teachersToNotify: { teacherName: string, className: string, subject: string }[] = [];

    const targetH = targetTime.getHours();
    const targetM = targetTime.getMinutes();

    // Lặp qua lịch của tất cả giáo viên
    for (const [teacherName, teacherDays] of Object.entries(teachersSchedule)) {
      const todayClasses: any[] = (teacherDays as any)[scheduleDay] || [];
      
      for (const cls of todayClasses) {
        if (!cls.time) continue;
        // time format typically "7h45 - 8h20" or "8h25' - 8h55'" or "08:00 - 08:45"
        const startTimeStr = cls.time.split('-')[0].trim();
        
        const match = startTimeStr.match(/(\d{1,2})[h:](\d{1,2})?/);
        if (match) {
          const h = parseInt(match[1]);
          const m = match[2] ? parseInt(match[2]) : 0;
          
          if (h === targetH && m === targetM) {
            teachersToNotify.push({
              teacherName,
              className: cls.className,
              subject: cls.subject
            });
          }
        }
      }
    }

    if (teachersToNotify.length === 0) {
      return NextResponse.json({ success: true, message: `No classes starting at ${targetHours}:${targetMinutes}` });
    }

    // Map users by scheduleName or fullName to get FCM tokens efficiently
    const usersSnapshot = await adminDb.collection('users').get();
    const userTokensMap: Record<string, string[]> = {};
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      const fcmTokens = data.fcmTokens || [];
      if (fcmTokens.length > 0) {
        if (data.scheduleName) {
          userTokensMap[data.scheduleName] = fcmTokens;
        } else if (data.fullName) {
          userTokensMap[data.fullName] = fcmTokens;
        }
      }
    });

    const messaging = getMessaging();
    let successCount = 0;
    let failureCount = 0;
    const notifiedList: string[] = [];

    // Send notifications to these teachers
    for (const notificationInfo of teachersToNotify) {
      const fcmTokens = userTokensMap[notificationInfo.teacherName];
      
      if (fcmTokens && fcmTokens.length > 0) {
        const message = {
          notification: {
            title: `🔔 Nhắc nhở vào tiết: Lớp ${notificationInfo.className}`,
            body: `Còn 5 phút nữa là bắt đầu tiết ${notificationInfo.subject} ở lớp ${notificationInfo.className}. Mời thầy/cô chuẩn bị vào lớp!`
          },
          data: {
            url: '/dashboard/schedule',
            type: 'class_start_reminder'
          },
          android: {
            priority: 'high' as const,
            notification: {
              sound: 'default',
            },
          },
          apns: {
            payload: {
              aps: {
                sound: 'default',
                badge: 1,
              }
            }
          },
          tokens: fcmTokens,
        };

        const response = await messaging.sendEachForMulticast(message);
        successCount += response.successCount;
        failureCount += response.failureCount;
        notifiedList.push(notificationInfo.teacherName);
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Sent reminders for classes at ${targetHours}:${targetMinutes}`, 
      notifiedTeachers: teachersToNotify.length,
      notifiedList,
      successCount,
      failureCount
    });

  } catch (error: any) {
    console.error('Class start reminder cron error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

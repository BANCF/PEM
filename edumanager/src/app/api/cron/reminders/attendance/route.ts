import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getMessaging } from 'firebase-admin/messaging';

export async function GET(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'my-super-secret-cron-key';
    
    // Check Vercel Cron authentication
    if (authHeader !== `Bearer ${cronSecret}` && request.headers.get('x-vercel-cron') !== '1') {
      // Cho phép test local nếu truyền url param ?secret=...
      const { searchParams } = new URL(request.url);
      if (searchParams.get('secret') !== cronSecret) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
    }

    const messaging = getMessaging();
    
    // Fetch all users who might have fcmTokens
    const usersSnapshot = await adminDb.collection('users').get();
    
    const allTokens: string[] = [];
    
    usersSnapshot.forEach((doc: any) => {
      const data = doc.data();
      if (data.fcmTokens && Array.isArray(data.fcmTokens)) {
        allTokens.push(...data.fcmTokens);
      }
    });
    
    if (allTokens.length === 0) {
      return NextResponse.json({ success: true, message: 'No devices found to notify.' });
    }
    
    // Remove duplicates
    const uniqueTokens = [...new Set(allTokens)];
    
    // Split tokens into chunks of 500 (Firebase limit)
    const chunkSize = 500;
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < uniqueTokens.length; i += chunkSize) {
      const chunk = uniqueTokens.slice(i, i + chunkSize);
      
      const message = {
        notification: {
          title: '⏰ Đã đến giờ điểm danh!',
          body: 'Đã 16:15, nhắc nhở các thầy cô vào điểm danh (hoặc dùng Auto Điểm Danh) cho lớp của mình.'
        },
        data: {
          url: '/dashboard/classes',
          type: 'attendance_reminder'
        },
        tokens: chunk,
      };

      const response = await messaging.sendEachForMulticast(message);
      successCount += response.successCount;
      failureCount += response.failureCount;
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Attendance reminder sent', 
      successCount,
      failureCount 
    });

  } catch (error: any) {
    console.error('Attendance reminder cron error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

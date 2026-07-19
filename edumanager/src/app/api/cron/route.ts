import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    // Basic security check (Replace 'my-super-secret-cron-key' with an env variable in production)
    const validSecret = process.env.CRON_SECRET || 'my-super-secret-cron-key';
    if (secret !== validSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
    }

    // Lấy thời điểm cách đây 48 giờ
    const fortyEightHoursAgo = new Date();
    fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48);

    // Tìm các phiếu đánh giá trạng thái PENDING_APPEAL
    const evalRef = adminDb.collection('evaluations');
    const snapshot = await evalRef.where('status', '==', 'PENDING_APPEAL').get();

    if (snapshot.empty) {
      return NextResponse.json({ success: true, message: 'No evaluations to auto-approve', count: 0 });
    }

    const batch = adminDb.batch();
    let count = 0;

    snapshot.forEach((doc: any) => {
      const data = doc.data();
      const createdAt = new Date(data.createdAt);
      
      // Nếu phiếu đã tạo quá 48h
      if (createdAt < fortyEightHoursAgo) {
        batch.update(doc.ref, { 
          status: 'APPROVED',
          note: (data.note || '') + '\n[Hệ thống tự động duyệt sau 48h]'
        });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
    }

    return NextResponse.json({ success: true, message: 'Auto-approval complete', count });

  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import nodemailer from 'nodemailer';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const secret = searchParams.get('secret');

    // Basic security check
    const validSecret = process.env.CRON_SECRET || 'my-super-secret-cron-key';
    if (secret !== validSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
    }

    // Determine previous month and year
    const now = new Date();
    // For testing you can uncomment below to test current month:
    // const prevMonth = now.getMonth(); 
    // const prevYear = now.getFullYear();
    const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
    const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
    const monthStr = `${prevMonth + 1}`.padStart(2, '0'); // e.g. "08"

    // Set boundaries for the previous month
    const startOfPrevMonth = new Date(prevYear, prevMonth, 1);
    const endOfPrevMonth = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999);

    // Fetch all evaluations created in the previous month
    const evalSnapshot = await adminDb.collection('evaluations')
      .where('createdAt', '>=', startOfPrevMonth.toISOString())
      .where('createdAt', '<=', endOfPrevMonth.toISOString())
      .get();

    // Fetch all teachers
    const usersSnapshot = await adminDb.collection('users')
      .where('role', 'in', ['TEACHER', 'TTCM', 'TPCM'])
      .get();

    const teachers: Record<string, any> = {};
    usersSnapshot.forEach(doc => {
      const data = doc.data();
      teachers[doc.id] = {
        teacherId: doc.id,
        fullName: data.fullName,
        email: data.email,
        department: data.department || "Chưa phân tổ",
        baseScore: 1000,
        kudosScore: 0,
        penaltyScore: 0,
        finalScore: 1000,
        evalCount: 0
      };
    });

    // Calculate scores
    evalSnapshot.forEach((doc: any) => {
      const ev = doc.data();
      if (ev.status === "APPROVED" || ev.status === "PENDING_APPEAL" || ev.status === "APPEALED") {
        const tid = ev.teacherId;
        if (teachers[tid]) {
          teachers[tid].evalCount++;
          if (ev.type === "KUDOS") {
            teachers[tid].kudosScore += ev.ruleScore;
            teachers[tid].finalScore += ev.ruleScore;
          } else if (ev.type === "PENALTY") {
            teachers[tid].penaltyScore += ev.ruleScore; // penalty rulescore is negative
            teachers[tid].finalScore += ev.ruleScore;
          }
        }
      }
    });

    // Generate snapshots
    const batch = adminDb.batch();
    const snapshotCollection = adminDb.collection('monthly_kpi_snapshots');

    const teacherStats = Object.values(teachers);

    teacherStats.forEach((t: any) => {
      const docId = `${t.teacherId}_${prevYear}_${monthStr}`;
      const docRef = snapshotCollection.doc(docId);
      batch.set(docRef, {
        teacherId: t.teacherId,
        fullName: t.fullName,
        department: t.department,
        month: monthStr,
        year: prevYear,
        baseScore: t.baseScore,
        kudosScore: t.kudosScore,
        penaltyScore: t.penaltyScore,
        finalScore: t.finalScore,
        evalCount: t.evalCount,
        createdAt: new Date().toISOString()
      }, { merge: true });
    });

    await batch.commit();

    // Setup Email Transport
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const isEmailConfigured = !!process.env.SMTP_USER && !!process.env.SMTP_PASS;
    let emailsSent = 0;

    if (isEmailConfigured) {
      // 1. Send Individual Emails to Teachers
      for (const t of teacherStats) {
        if (!t.email) continue;
        
        const htmlContent = `
          <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #3b82f6; padding: 20px; text-align: center; color: white;">
              <h2 style="margin: 0;">Báo cáo KPI Tháng ${monthStr}/${prevYear}</h2>
            </div>
            <div style="padding: 20px; color: #333;">
              <p>Xin chào thầy/cô <strong>${t.fullName}</strong>,</p>
              <p>Hệ thống EduManager xin gửi báo cáo điểm thi đua KPI tháng ${monthStr}/${prevYear} của thầy/cô như sau:</p>
              <table style="width: 100%; border-collapse: collapse; margin-top: 15px;">
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">Điểm gốc:</td><td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; font-weight: bold;">${t.baseScore}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">Điểm thưởng:</td><td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; color: #10b981; font-weight: bold;">+${t.kudosScore}</td></tr>
                <tr><td style="padding: 8px; border-bottom: 1px solid #eee;">Điểm phạt:</td><td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right; color: #ef4444; font-weight: bold;">${t.penaltyScore}</td></tr>
                <tr><td style="padding: 12px 8px; border-bottom: 1px solid #eee; font-size: 18px;"><strong>Tổng kết KPI:</strong></td><td style="padding: 12px 8px; border-bottom: 1px solid #eee; text-align: right; font-size: 18px; color: #2563eb;"><strong>${t.finalScore}</strong></td></tr>
              </table>
              <p style="margin-top: 20px; font-size: 14px; color: #64748b;">(Mẫu nhận xét chi tiết sẽ được tự động điền tại đây theo cấu hình của trường)</p>
              <br/>
              <p>Chúc thầy/cô một tháng làm việc mới tràn đầy năng lượng!</p>
            </div>
            <div style="background-color: #f8fafc; padding: 15px; text-align: center; font-size: 12px; color: #94a3b8;">
              Email được gửi tự động từ Hệ thống EduManager. Vui lòng không trả lời email này.
            </div>
          </div>
        `;

        try {
          await transporter.sendMail({
            from: `"EduManager" <${process.env.SMTP_USER}>`,
            to: t.email,
            subject: `Báo cáo KPI Tháng ${monthStr}/${prevYear} - ${t.fullName}`,
            html: htmlContent,
          });
          emailsSent++;
        } catch (e) {
          console.error(`Failed to send email to ${t.email}`, e);
        }
      }

      // 2. Send Summary Email to BGH
      const bghSnapshot = await adminDb.collection('users').where('role', '==', 'BGH').get();
      const bghEmails: string[] = [];
      bghSnapshot.forEach(doc => {
        if (doc.data().email) bghEmails.push(doc.data().email);
      });

      if (bghEmails.length > 0) {
        // Sort and group by department
        teacherStats.sort((a, b) => b.finalScore - a.finalScore);
        
        const top5 = teacherStats.slice(0, 5);
        const bottom5 = [...teacherStats].reverse().slice(0, 5);
        
        const bghHtmlContent = `
          <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
            <div style="background-color: #1e293b; padding: 20px; text-align: center; color: white;">
              <h2 style="margin: 0;">Tổng hợp KPI Toàn trường Tháng ${monthStr}/${prevYear}</h2>
            </div>
            <div style="padding: 20px; color: #333;">
              <p>Kính gửi Ban Giám Hiệu,</p>
              <p>Hệ thống đã chốt sổ và tổng hợp điểm KPI tháng ${monthStr}/${prevYear}. Dưới đây là báo cáo tóm tắt:</p>
              
              <h3 style="color: #10b981; border-bottom: 1px solid #10b981; padding-bottom: 5px;">Top 5 Giáo viên điểm cao nhất</h3>
              <ol>
                ${top5.map((t: any) => `<li style="margin-bottom: 8px;"><strong>${t.fullName}</strong> (${t.department}): <span style="color:#2563eb; font-weight:bold">${t.finalScore}</span></li>`).join('')}
              </ol>

              <h3 style="color: #ef4444; border-bottom: 1px solid #ef4444; padding-bottom: 5px; margin-top: 25px;">Top 5 Giáo viên điểm thấp nhất</h3>
              <ol>
                ${bottom5.map((t: any) => `<li style="margin-bottom: 8px;"><strong>${t.fullName}</strong> (${t.department}): <span style="color:#2563eb; font-weight:bold">${t.finalScore}</span></li>`).join('')}
              </ol>
              
              <p style="margin-top: 20px;">Để xem chi tiết điểm số từng tổ bộ môn, vui lòng truy cập hệ thống <a href="https://yourdomain.com/dashboard">EduManager</a> và xuất file Excel.</p>
            </div>
          </div>
        `;

        try {
          await transporter.sendMail({
            from: `"EduManager" <${process.env.SMTP_USER}>`,
            to: bghEmails.join(','),
            subject: `Báo cáo Tổng hợp KPI Tháng ${monthStr}/${prevYear}`,
            html: bghHtmlContent,
          });
          emailsSent++;
        } catch (e) {
          console.error(`Failed to send BGH email`, e);
        }
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Monthly KPI processed successfully', 
      processedTeachers: teacherStats.length,
      emailsSent,
      isEmailConfigured
    });

  } catch (error: any) {
    console.error('Monthly KPI Cron Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}

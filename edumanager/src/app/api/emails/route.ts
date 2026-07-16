import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// Định dạng request gửi lên
interface EmailRequest {
  to: string;
  subject: string;
  html: string;
}

export async function POST(request: Request) {
  try {
    const body: EmailRequest = await request.json();

    // Nếu chưa cấu hình biến môi trường, hệ thống sẽ in ra console thay vì lỗi sập app
    if (!process.env.SMTP_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      console.warn("⚠️ [MOCK EMAIL] Email được giả lập vì chưa cấu hình biến môi trường:");
      console.warn(`Gửi tới: ${body.to}`);
      console.warn(`Chủ đề: ${body.subject}`);
      console.warn(`Nội dung: ${body.html}`);
      return NextResponse.json({ success: true, mock: true, message: 'Email logged to console (Mock mode)' });
    }

    // Khởi tạo transporter (Cấu hình dùng Gmail, Outlook, hoặc AWS SES tùy env)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // Mật khẩu ứng dụng (App Password)
      },
    });

    // Gửi email
    const info = await transporter.sendMail({
      from: `"PEM Hệ thống Đánh giá KPI" <${process.env.EMAIL_USER}>`,
      to: body.to,
      subject: body.subject,
      html: body.html,
    });

    return NextResponse.json({ success: true, messageId: info.messageId });
  } catch (error: any) {
    console.error("❌ Lỗi gửi email:", error);
    return NextResponse.json({ error: 'Failed to send email', details: error.message }, { status: 500 });
  }
}

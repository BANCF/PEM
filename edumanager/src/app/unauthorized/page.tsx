import Link from "next/link";
import { ShieldAlert, ArrowLeft } from "lucide-react";

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center max-w-md w-full">
        <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="w-10 h-10 text-red-500" />
        </div>
        
        <h1 className="text-2xl font-bold text-slate-800 mb-3">Truy cập bị từ chối</h1>
        <p className="text-slate-600 mb-8 leading-relaxed">
          Tài khoản của bạn không có quyền (role) phù hợp để truy cập vào trang này. Vui lòng liên hệ Admin hệ thống nếu bạn cho rằng đây là lỗi.
        </p>
        
        <Link 
          href="/dashboard"
          className="inline-flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-xl transition-colors w-full"
        >
          <ArrowLeft size={18} />
          <span>Quay lại Trang chủ</span>
        </Link>
      </div>
    </div>
  );
}

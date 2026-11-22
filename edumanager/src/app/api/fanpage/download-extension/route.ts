// GET /api/fanpage/download-extension — tải bộ cài Extension kèm script cài nhanh Windows
import fs from "fs";
import path from "path";
import { authenticate, errorResponse } from "@/lib/fanpage/server";
import { createZipBuffer, ZipEntry } from "@/lib/fanpage/zip";

const INSTALLER_BAT = `@echo off
chcp 65001 >nul
setlocal
set "TARGET=%LOCALAPPDATA%\\PASFanpageHelper"
echo ============================================================
echo   CAI DAT NHANH - PAS FANPAGE HELPER
echo ============================================================
echo.
if not exist "%~dp0fanpage-extension\\manifest.json" (
  echo [LOI] Khong tim thay thu muc fanpage-extension ben canh file nay!
  echo Vui long giai nen toan bo file ZIP truoc khi chay.
  pause
  exit /b 1
)
if exist "%TARGET%" rmdir /s /q "%TARGET%"
xcopy /E /I /Y "%~dp0fanpage-extension" "%TARGET%" >nul
echo %TARGET%| clip
echo [1/2] Da chep extension vao: %TARGET%
echo       (Da tu dong COPY duong dan nay vao bo nho tam!)
echo.
echo [2/2] Dang mo Chrome -^> Trang quan ly Extension...
start "" chrome "chrome://extensions"
echo.
echo HUONG DAN 3 GIAY TREN CHROME:
echo   1. Bat "Che do danh cho nha phat trien" (goc phai tren)
echo   2. Bam "Tai tien ich da giai nen" (Load unpacked)
echo   3. Bam Ctrl+V vao o chon thu muc roi bam Enter!
echo   4. Quay lai trang PEM bam "Ket noi tu dong".
echo.
pause
`;

export async function GET(req: Request) {
  try {
    await authenticate(req);

    // 1. Ưu tiên đọc trực tiếp từ thư mục ../fanpage-extension (khi chạy local/monorepo)
    const extDir = path.resolve(process.cwd(), "../fanpage-extension");
    if (fs.existsSync(path.join(extDir, "manifest.json"))) {
      const entries: ZipEntry[] = fs
        .readdirSync(extDir, { withFileTypes: true })
        .filter((d) => d.isFile())
        .map((d) => ({
          name: `pas-fanpage-helper/fanpage-extension/${d.name}`,
          data: fs.readFileSync(path.join(extDir, d.name)),
        }));
      entries.push({
        name: "pas-fanpage-helper/CAI_DAT_NHANH.bat",
        data: Buffer.from(INSTALLER_BAT.replace(/\n/g, "\r\n"), "utf8"),
      });

      const zipBuf = createZipBuffer(entries);
      return new Response(new Uint8Array(zipBuf), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": 'attachment; filename="pas-fanpage-helper.zip"',
          "Cache-Control": "no-store",
        },
      });
    }

    // 2. Fallback cho môi trường Vercel (đọc từ public/pas-fanpage-helper.zip)
    const staticZip = path.resolve(process.cwd(), "public/pas-fanpage-helper.zip");
    if (fs.existsSync(staticZip)) {
      const zipBuf = fs.readFileSync(staticZip);
      return new Response(new Uint8Array(zipBuf), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": 'attachment; filename="pas-fanpage-helper.zip"',
          "Cache-Control": "no-store",
        },
      });
    }

    return Response.json({ success: false, message: "Không tìm thấy gói cài đặt extension" }, { status: 404 });
  } catch (e) {
    return errorResponse(e);
  }
}

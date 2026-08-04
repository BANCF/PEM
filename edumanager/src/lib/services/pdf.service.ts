import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { ScheduleClassInfo } from './schedule.service';

export async function generateClassTimetablePdf(
  classSched: Record<string, ScheduleClassInfo[]>,
  className: string,
  teacherName: string,
  applicationDate: string
): Promise<Blob> {
  try {
    // Fetch the PDF template and font
    const [pdfBytesRes, fontBytesRes] = await Promise.all([
      fetch('/CLASS_TIMETABLE.pdf'),
      fetch('/fonts/times.ttf')
    ]);

    const pdfBytes = await pdfBytesRes.arrayBuffer();
    const fontBytes = await fontBytesRes.arrayBuffer();

    const pdfDoc = await PDFDocument.load(pdfBytes);
    pdfDoc.registerFontkit(fontkit);
    
    // Check if times font exists, fallback to standard if not found (but we know it's there)
    let customFont;
    try {
      customFont = await pdfDoc.embedFont(fontBytes);
    } catch (e) {
      console.warn("Could not load custom font, using standard font", e);
      customFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
    }

    const pages = pdfDoc.getPages();
    const page = pages[0];
    const { width, height } = page.getSize(); // Should be ~842 x 595

    // Helper to draw text
    const drawText = (text: string, x: number, y: number, size: number, color = rgb(0, 0, 0), isBold = false) => {
      page.drawText(text || '', {
        x,
        y,
        size,
        font: customFont,
        color,
      });
      if (isBold) {
        // Draw multiple times slightly shifted to simulate a medium bold font
        page.drawText(text || '', { x: x + 0.3, y, size, font: customFont, color });
        page.drawText(text || '', { x: x + 0.6, y, size, font: customFont, color });
      }
    };

    // 1. Cover up old text (Title, Date, GVCN) with white rectangles
    // Title area
    page.drawRectangle({
      x: 270,
      y: 535,
      width: 320,
      height: 30,
      color: rgb(1, 1, 1),
    });
    
    // Date area
    page.drawRectangle({
      x: 320,
      y: 515,
      width: 200,
      height: 20,
      color: rgb(1, 1, 1),
    });

    // GVCN area
    page.drawRectangle({
      x: 50,
      y: 490,
      width: 200,
      height: 20,
      color: rgb(1, 1, 1),
    });

    // 2. Draw new header text
    drawText(`CLASS ${className} TIMETABLE / THỜI KHÓA BIỂU LỚP ${className}`, 275, 545, 14, rgb(0, 0.4, 0.8), true); // Blue-ish title and bold
    
    // Parse applicationDate from filename if needed, or use as is
    let cleanDate = applicationDate;
    if (cleanDate.includes('_')) {
      const match = cleanDate.match(/\d{2}-\d{2}-\d{4}|\d{2}-\d{2}/);
      if (match) cleanDate = match[0];
    }
    drawText(`Applied from/ Áp dụng từ ${cleanDate}`, 328, 522, 11);
    
    drawText(`GVCN: ${teacherName}`, 56, 498, 11, rgb(0, 0, 0), true);

    // 3. Draw schedule grid
    const days = ["2", "3", "4", "5", "6"];
    const colCenters = [270, 384, 499, 613, 728]; // Exact X centers matching the header text in the PDF
    const rowYs: Record<string, number> = {
      "1": 421,
      "2": 378,
      "3": 335,
      "4": 292,
      "5": 249,
      "6": 191,
      "7": 148,
      "8": 105,
      "9": 62
    };

    // Draw subjects
    days.forEach((day, dayIndex) => {
      const colCenter = colCenters[dayIndex];
      const dayData = classSched[day] || [];
      
      Object.keys(rowYs).forEach(period => {
        const y = rowYs[period];
        const cellData = dayData.find(item => item.period.toString() === period);
        
        if (cellData && cellData.subject) {
          const fontSize = 13.5;
          const textWidth = customFont.widthOfTextAtSize(cellData.subject, fontSize);
          const textX = colCenter - (textWidth / 2);
          
          drawText(cellData.subject, textX, y, fontSize, rgb(0.1, 0.1, 0.1));
        }
      });
    });

    const pdfOutputBytes = await pdfDoc.save();
    return new Blob([pdfOutputBytes], { type: 'application/pdf' });

  } catch (error) {
    console.error("Error generating PDF:", error);
    throw error;
  }
}

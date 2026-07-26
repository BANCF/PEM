import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { CertificateTemplate, StudentAwardSelection } from "@/types/certificate";

function hexToPdfRgb(hex: string) {
  let cleanHex = hex.replace("#", "");
  if (cleanHex.length === 3) {
    cleanHex = cleanHex.split("").map(c => c + c).join("");
  }
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;
  return rgb(r || 0, g || 0, b || 0);
}

export async function generateSingleCertificateBlobUrl({
  template,
  selection,
  className,
  issueDate,
  printMode = "full_color"
}: {
  template: CertificateTemplate;
  selection: StudentAwardSelection;
  className: string;
  issueDate: string;
  printMode?: "full_color" | "text_only";
}): Promise<string> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  // Load custom font with full subsetting support
  const fontRes = await fetch("/certi/UTM ViceroyJF.ttf");
  const fontBytes = await fontRes.arrayBuffer();
  const customFont = await pdfDoc.embedFont(fontBytes, { subset: false });

  const page = pdfDoc.addPage([template.width, template.height]);

  // Draw background image in full color mode
  if (printMode === "full_color") {
    const imgRes = await fetch(template.bgUrl);
    const imgBytes = await imgRes.arrayBuffer();
    let bgImage;
    try {
      bgImage = await pdfDoc.embedPng(imgBytes);
    } catch {
      bgImage = await pdfDoc.embedJpg(imgBytes);
    }
    page.drawImage(bgImage, {
      x: 0,
      y: 0,
      width: template.width,
      height: template.height
    });
  }

  // Render text fields
  for (const field of template.fields) {
    let textContent = "";
    if (field.id === "student_name") textContent = selection.customStudentName || selection.studentName;
    else if (field.id === "class_name") textContent = selection.customClassName || selection.className;
    else if (field.id === "award_title") textContent = selection.customAwardTitle || selection.customNote || "";
    else continue;

    if (!textContent) continue;

    const scaleFactor = (selection.customFontSizeScale || 100) / 100;
    let fontSize = field.fontSize * scaleFactor;

    let textWidth = customFont.widthOfTextAtSize(textContent, fontSize);
    if (field.maxWidth && textWidth > field.maxWidth) {
      fontSize = fontSize * (field.maxWidth / textWidth);
      textWidth = customFont.widthOfTextAtSize(textContent, fontSize);
    }

    let x = field.x;
    if (field.textAlign === "center") {
      x = field.x - (textWidth / 2);
    } else if (field.textAlign === "right") {
      x = field.x - textWidth;
    }

    const y = template.height - field.y - (fontSize * 0.28);
    const color = hexToPdfRgb(field.color || "#000000");

    page.drawText(textContent, {
      x,
      y,
      size: fontSize,
      font: customFont,
      color
    });
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([new Uint8Array(pdfBytes) as unknown as BlobPart], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

export async function generateClassPreviewPdfBlobUrl(
  templates: CertificateTemplate[],
  selections: StudentAwardSelection[],
  className: string,
  issueDate: string,
  printMode: "full_color" | "text_only" = "full_color"
): Promise<string> {
  const fontRes = await fetch("/certi/UTM ViceroyJF.ttf");
  const fontBytes = await fontRes.arrayBuffer();

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const customFont = await pdfDoc.embedFont(fontBytes);

  const awardedSelections = selections.filter((s) => s.templateId && s.templateId !== "none");

  for (const sel of awardedSelections) {
    const template = templates.find((t) => t.id === sel.templateId);
    if (!template) continue;

    const page = pdfDoc.addPage([template.width, template.height]);

    if (printMode === "full_color") {
      const imgRes = await fetch(template.bgUrl);
      const imgBytes = await imgRes.arrayBuffer();
      let bgImage;
      try {
        bgImage = await pdfDoc.embedPng(imgBytes);
      } catch {
        bgImage = await pdfDoc.embedJpg(imgBytes);
      }
      page.drawImage(bgImage, {
        x: 0,
        y: 0,
        width: template.width,
        height: template.height
      });
    }

    for (const field of template.fields) {
      let textContent = "";
      if (field.id === "student_name") textContent = sel.customStudentName || sel.studentName;
      else if (field.id === "class_name") textContent = sel.customClassName || sel.className;
      else if (field.id === "award_title") textContent = sel.customAwardTitle || sel.customNote || "";
      else continue;

      if (!textContent) continue;

      const scaleFactor = (sel.customFontSizeScale || 100) / 100;
      let fontSize = field.fontSize * scaleFactor;

      let textWidth = customFont.widthOfTextAtSize(textContent, fontSize);
      if (field.maxWidth && textWidth > field.maxWidth) {
        fontSize = fontSize * (field.maxWidth / textWidth);
        textWidth = customFont.widthOfTextAtSize(textContent, fontSize);
      }

      let x = field.x;
      if (field.textAlign === "center") {
        x = field.x - (textWidth / 2);
      } else if (field.textAlign === "right") {
        x = field.x - textWidth;
      }

      const y = template.height - field.y - (fontSize * 0.28);
      const color = hexToPdfRgb(field.color || "#000000");

      page.drawText(textContent, {
        x,
        y,
        size: fontSize,
        font: customFont,
        color
      });
    }
  }

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([new Uint8Array(pdfBytes) as unknown as BlobPart], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}


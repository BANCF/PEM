import { db } from "./client";
import { collection, doc, getDocs, setDoc, deleteDoc } from "firebase/firestore";
import { CertificateTemplate, CertificatePreset } from "@/types/certificate";

export const DEFAULT_TEMPLATES: CertificateTemplate[] = [
  {
    id: "hsg",
    name: "Học sinh Giỏi",
    bgUrl: "/certi/HSG.PNG",
    width: 841.89,
    height: 595.28,
    isDefault: true,
    fields: [
      { id: "student_name", label: "Tên học sinh", x: 275, y: 314, fontSize: 30, fontFamily: "UTM ViceroyJF", color: "#B22222", textAlign: "left", maxWidth: 250 },
      { id: "class_name", label: "Lớp", x: 625, y: 312, fontSize: 22, fontFamily: "UTM ViceroyJF", color: "#000000", textAlign: "left", maxWidth: 95 }
    ]
  },
  {
    id: "hsxs",
    name: "Học sinh Xuất sắc",
    bgUrl: "/certi/HSXS.PNG",
    width: 841.89,
    height: 595.28,
    isDefault: true,
    fields: [
      { id: "student_name", label: "Tên học sinh", x: 275, y: 314, fontSize: 32, fontFamily: "UTM ViceroyJF", color: "#B22222", textAlign: "left", maxWidth: 250 },
      { id: "class_name", label: "Lớp", x: 625, y: 312, fontSize: 22, fontFamily: "UTM ViceroyJF", color: "#000000", textAlign: "left", maxWidth: 95 }
    ]
  },
  {
    id: "hstb",
    name: "Học sinh Tiêu biểu",
    bgUrl: "/certi/HS tiêu biểu.PNG",
    width: 841.89,
    height: 595.28,
    isDefault: true,
    fields: [
      { id: "student_name", label: "Tên học sinh", x: 275, y: 314, fontSize: 30, fontFamily: "UTM ViceroyJF", color: "#B22222", textAlign: "left", maxWidth: 250 },
      { id: "class_name", label: "Lớp", x: 625, y: 312, fontSize: 22, fontFamily: "UTM ViceroyJF", color: "#000000", textAlign: "left", maxWidth: 95 }
    ]
  },
  {
    id: "hs_tienbo",
    name: "Học sinh Tiến bộ",
    bgUrl: "/certi/HS tiến bộ.PNG",
    width: 841.89,
    height: 595.28,
    isDefault: true,
    fields: [
      { id: "student_name", label: "Tên học sinh", x: 275, y: 314, fontSize: 30, fontFamily: "UTM ViceroyJF", color: "#0D47A1", textAlign: "left", maxWidth: 250 },
      { id: "class_name", label: "Lớp", x: 625, y: 312, fontSize: 22, fontFamily: "UTM ViceroyJF", color: "#000000", textAlign: "left", maxWidth: 95 }
    ]
  },
  {
    id: "hs_toandien",
    name: "Học sinh Toàn diện",
    bgUrl: "/certi/HS toàn diện.PNG",
    width: 841.89,
    height: 595.28,
    isDefault: true,
    fields: [
      { id: "student_name", label: "Tên học sinh", x: 275, y: 314, fontSize: 30, fontFamily: "UTM ViceroyJF", color: "#B22222", textAlign: "left", maxWidth: 250 },
      { id: "class_name", label: "Lớp", x: 625, y: 312, fontSize: 22, fontFamily: "UTM ViceroyJF", color: "#000000", textAlign: "left", maxWidth: 95 }
    ]
  },
  {
    id: "vt_mon",
    name: "Vượt trội Môn",
    bgUrl: "/certi/Vượt trội môn.PNG",
    width: 841.89,
    height: 595.28,
    isDefault: true,
    fields: [
      { id: "student_name", label: "Tên học sinh", x: 275, y: 314, fontSize: 30, fontFamily: "UTM ViceroyJF", color: "#B22222", textAlign: "left", maxWidth: 250 },
      { id: "class_name", label: "Lớp", x: 625, y: 312, fontSize: 22, fontFamily: "UTM ViceroyJF", color: "#000000", textAlign: "left", maxWidth: 95 }
    ]
  },
  {
    id: "vt_khxh",
    name: "Vượt trội Khoa học Xã hội",
    bgUrl: "/certi/Vượt trội KHXH.PNG",
    width: 841.89,
    height: 595.28,
    isDefault: true,
    fields: [
      { id: "student_name", label: "Tên học sinh", x: 275, y: 314, fontSize: 30, fontFamily: "UTM ViceroyJF", color: "#B22222", textAlign: "left", maxWidth: 250 },
      { id: "class_name", label: "Lớp", x: 625, y: 312, fontSize: 22, fontFamily: "UTM ViceroyJF", color: "#000000", textAlign: "left", maxWidth: 95 }
    ]
  },
  {
    id: "hoa_chamngoan",
    name: "Hoa Chăm Ngoan",
    bgUrl: "/certi/Hoa chăm ngoan.png",
    width: 841.89,
    height: 595.28,
    isDefault: true,
    fields: [
      { id: "student_name", label: "Tên học sinh", x: 245, y: 314, fontSize: 30, fontFamily: "UTM ViceroyJF", color: "#B22222", textAlign: "left", maxWidth: 240 },
      { id: "class_name", label: "Lớp", x: 665, y: 312, fontSize: 22, fontFamily: "UTM ViceroyJF", color: "#000000", textAlign: "left", maxWidth: 90 }
    ]
  },
  {
    id: "hoa_diemtot",
    name: "Hoa Điểm Tốt",
    bgUrl: "/certi/Hoa điểm tốt.png",
    width: 841.89,
    height: 595.28,
    isDefault: true,
    fields: [
      { id: "student_name", label: "Tên học sinh", x: 245, y: 314, fontSize: 30, fontFamily: "UTM ViceroyJF", color: "#B22222", textAlign: "left", maxWidth: 240 },
      { id: "class_name", label: "Lớp", x: 665, y: 312, fontSize: 22, fontFamily: "UTM ViceroyJF", color: "#000000", textAlign: "left", maxWidth: 90 }
    ]
  }
];

const COLLECTION_NAME = "certificate_templates";

function normalizeTemplateFields(tmpl: CertificateTemplate): { template: CertificateTemplate; changed: boolean } {
  let changed = false;
  const isHoa = tmpl.id === "hoa_chamngoan" || tmpl.id === "hoa_diemtot";
  const targetNameX = isHoa ? 245 : 275;
  const targetNameY = 314;
  const targetClassX = isHoa ? 665 : 625;
  const targetClassY = 312;

  const updatedFields = tmpl.fields.map(field => {
    if (field.id === "student_name") {
      if (field.x !== targetNameX || field.y !== targetNameY || field.textAlign !== "left") {
        changed = true;
        return {
          ...field,
          x: targetNameX,
          y: targetNameY,
          textAlign: "left" as const
        };
      }
    } else if (field.id === "class_name") {
      if (field.x !== targetClassX || field.y !== targetClassY || field.textAlign !== "left") {
        changed = true;
        return {
          ...field,
          x: targetClassX,
          y: targetClassY,
          textAlign: "left" as const
        };
      }
    } else {
      if (field.textAlign === "center" || !field.textAlign) {
        changed = true;
        return {
          ...field,
          textAlign: "left" as const
        };
      }
    }
    return field;
  });

  if (!changed) return { template: tmpl, changed: false };
  return { template: { ...tmpl, fields: updatedFields }, changed: true };
}

export async function getTemplates(): Promise<CertificateTemplate[]> {
  try {
    const querySnapshot = await getDocs(collection(db, COLLECTION_NAME));
    const templates: CertificateTemplate[] = [];
    querySnapshot.forEach((docSnap) => {
      templates.push({ id: docSnap.id, ...docSnap.data() } as CertificateTemplate);
    });

    if (templates.length === 0) {
      for (const tmpl of DEFAULT_TEMPLATES) {
        await setDoc(doc(db, COLLECTION_NAME, tmpl.id), {
          ...tmpl,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      return DEFAULT_TEMPLATES;
    }

    // Đảm bảo không bị thiếu các phôi mặc định nếu Firestore có ít mẫu
    const templateIds = new Set(templates.map(t => t.id));
    const missingDefaults = DEFAULT_TEMPLATES.filter(t => !templateIds.has(t.id));
    if (missingDefaults.length > 0) {
      for (const tmpl of missingDefaults) {
        await setDoc(doc(db, COLLECTION_NAME, tmpl.id), {
          ...tmpl,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        templates.push(tmpl);
      }
    }

    // Tự động chuẩn hóa và nâng cấp tọa độ nếu bị lệch hoặc center
    const normalizedTemplates = templates.map(tmpl => {
      const { template, changed } = normalizeTemplateFields(tmpl);
      if (changed) {
        setDoc(doc(db, COLLECTION_NAME, tmpl.id), { ...template, updatedAt: new Date().toISOString() }, { merge: true }).catch(console.error);
      }
      return template;
    });

    return normalizedTemplates;
  } catch (error) {
    console.error("Error fetching certificate templates, falling back to defaults:", error);
    return DEFAULT_TEMPLATES;
  }
}

export async function saveTemplate(template: CertificateTemplate): Promise<void> {
  const docRef = doc(db, COLLECTION_NAME, template.id);
  await setDoc(docRef, {
    ...template,
    isCustomized: true,
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

export async function deleteTemplate(id: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION_NAME, id));
}

export async function resetToDefaultTemplates(): Promise<CertificateTemplate[]> {
  for (const tmpl of DEFAULT_TEMPLATES) {
    await setDoc(doc(db, COLLECTION_NAME, tmpl.id), {
      ...tmpl,
      isCustomized: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  return DEFAULT_TEMPLATES;
}

const PRESETS_COLLECTION = "certificate_presets";

export async function getPresets(): Promise<CertificatePreset[]> {
  try {
    const querySnapshot = await getDocs(collection(db, PRESETS_COLLECTION));
    const presets: CertificatePreset[] = [];
    querySnapshot.forEach((docSnap) => {
      presets.push({ id: docSnap.id, ...docSnap.data() } as CertificatePreset);
    });

    if (presets.length === 0) {
      const v1Preset: CertificatePreset = {
        id: "mau_v1",
        name: "Mẫu_v1",
        templates: DEFAULT_TEMPLATES,
        isDefault: false,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const defaultPreset: CertificatePreset = {
        id: "default_system",
        name: "Cấu hình Mặc định Hệ thống",
        templates: DEFAULT_TEMPLATES,
        isDefault: true,
        isActive: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, PRESETS_COLLECTION, v1Preset.id), v1Preset);
      await setDoc(doc(db, PRESETS_COLLECTION, defaultPreset.id), defaultPreset);
      return [v1Preset, defaultPreset];
    }

    // Tự động chuẩn hóa tọa độ cho toàn bộ các preset (đặc biệt là Mẫu_v1 bị lưu từ lúc còn lỗi)
    const normalizedPresets = presets.map(preset => {
      if (!preset.templates || preset.templates.length === 0) return preset;
      let presetChanged = false;
      const normTemplates = preset.templates.map(tmpl => {
        const { template, changed } = normalizeTemplateFields(tmpl);
        if (changed) presetChanged = true;
        return template;
      });
      if (presetChanged) {
        const updated = { ...preset, templates: normTemplates, updatedAt: new Date().toISOString() };
        setDoc(doc(db, PRESETS_COLLECTION, preset.id), updated, { merge: true }).catch(console.error);
        return updated;
      }
      return preset;
    });

    return normalizedPresets.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  } catch (error) {
    console.error("Error fetching presets:", error);
    return [
      {
        id: "mau_v1",
        name: "Mẫu_v1",
        templates: DEFAULT_TEMPLATES,
        isActive: true
      }
    ];
  }
}

export async function savePreset(name: string, templates: CertificateTemplate[]): Promise<CertificatePreset> {
  const querySnapshot = await getDocs(collection(db, PRESETS_COLLECTION));
  let existingPresetId: string | null = null;
  let existingIsDefault = false;

  querySnapshot.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.name && data.name.trim().toLowerCase() === name.trim().toLowerCase()) {
      existingPresetId = docSnap.id;
      existingIsDefault = !!data.isDefault;
    }
    if (data.isActive) {
      setDoc(doc(db, PRESETS_COLLECTION, docSnap.id), { isActive: false }, { merge: true });
    }
  });

  const id = existingPresetId || ("preset_" + Date.now());
  const newPreset: CertificatePreset = {
    id,
    name: name.trim(),
    templates,
    isDefault: existingIsDefault || id === "default_system",
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  await setDoc(doc(db, PRESETS_COLLECTION, id), newPreset);

  for (const tmpl of templates) {
    await saveTemplate(tmpl);
  }

  return newPreset;
}

export async function updatePreset(presetId: string, name: string, templates: CertificateTemplate[]): Promise<void> {
  const docRef = doc(db, PRESETS_COLLECTION, presetId);
  await setDoc(docRef, {
    name,
    templates,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  for (const tmpl of templates) {
    await saveTemplate(tmpl);
  }
}

export async function deletePreset(presetId: string): Promise<void> {
  if (presetId === "default_system") {
    throw new Error("Không thể xóa bộ phôi cấu hình mặc định của hệ thống.");
  }
  const docRef = doc(db, PRESETS_COLLECTION, presetId);
  await deleteDoc(docRef);
}

export async function renamePreset(presetId: string, newName: string): Promise<void> {
  const docRef = doc(db, PRESETS_COLLECTION, presetId);
  await setDoc(docRef, {
    name: newName.trim(),
    updatedAt: new Date().toISOString()
  }, { merge: true });
}

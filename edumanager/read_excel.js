const XLSX = require('xlsx');
const path = require('path');

const filePath = path.resolve('..\\filemau_xuat_diem_c23_tt58_sua_doi.xlsx');
try {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  // Convert to JSON and print first 15 rows
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  console.log("Sheet Name:", sheetName);
  console.log("Number of rows:", data.length);
  console.log("First 15 rows:");
  for (let i = 0; i < Math.min(15, data.length); i++) {
    console.log(`Row ${i}:`, data[i]);
  }
} catch (e) {
  console.error("Error reading file:", e);
}

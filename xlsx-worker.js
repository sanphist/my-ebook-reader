importScripts("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js");

let workbook = null;
let workbookType = "";

function normalizeCell(value) {
  if (value == null) return "";
  return String(value).trim();
}

function prepareRows(rows) {
  const safeRows = Array.isArray(rows) ? rows.filter(row => Array.isArray(row)) : [];
  const width = safeRows.reduce((max, row) => Math.max(max, row.length), 0);
  if (!width || !safeRows.length) return { headers: [], rows: [] };
  const normalizedRows = safeRows.map(row => Array.from({ length: width }, (_, idx) => normalizeCell(row[idx])));
  const headers = normalizedRows[0].map((value, idx) => value || `列${idx + 1}`);
  const bodyRows = normalizedRows.slice(1).filter(row => row.some(cell => cell !== ""));
  return { headers, rows: bodyRows };
}

function readWorkbook(payload, fileType) {
  if (fileType === "csv-text") {
    workbookType = "csv";
    workbook = XLSX.read(payload, { type: "string", raw: false });
    return;
  }
  workbookType = "xlsx";
  workbook = XLSX.read(payload, { type: "array", raw: false, cellDates: true });
}

function getSheetData(sheetName) {
  if (!workbook) throw new Error("工作簿尚未加载");
  const safeSheetName = sheetName || workbook.SheetNames[0];
  const sheet = workbook.Sheets[safeSheetName];
  if (!sheet) throw new Error(`未找到工作表：${safeSheetName}`);
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false
  });
  return { sheetName: safeSheetName, ...prepareRows(rows) };
}

self.onmessage = event => {
  const message = event.data || {};
  try {
    if (message.type === "loadWorkbook") {
      readWorkbook(message.payload, message.fileType);
      const firstSheetName = workbook.SheetNames[0] || "";
      const sheetData = getSheetData(firstSheetName);
      self.postMessage({
        type: "workbookLoaded",
        workbookType,
        sheetNames: workbook.SheetNames || [],
        ...sheetData
      });
      return;
    }
    if (message.type === "loadSheet") {
      const sheetData = getSheetData(message.sheetName);
      self.postMessage({
        type: "sheetLoaded",
        workbookType,
        ...sheetData
      });
      return;
    }
    if (message.type === "clearWorkbook") {
      workbook = null;
      workbookType = "";
    }
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error && error.message ? error.message : "解析工作簿失败"
    });
  }
};

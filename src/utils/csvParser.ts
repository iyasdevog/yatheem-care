import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import type { ColumnSchema, Dataset, RowData } from '../types/data';
import { generateColumnSchemas } from './typeInference';

export interface ParseResult {
  headers: string[];
  rows: RowData[];
}

/**
 * Parse raw CSV or TSV string into structured headers and rows
 */
export function parseCSVOrTSVText(text: string): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, any>>(text, {
      header: true,
      skipEmptyLines: 'greedy',
      dynamicTyping: true,
      complete: (results) => {
        if (!results.data || results.data.length === 0) {
          resolve({ headers: [], rows: [] });
          return;
        }
        const headers = results.meta.fields || Object.keys(results.data[0]);
        const rows: RowData[] = results.data.map((row, idx) => {
          const rowObj: RowData = { _id: `row_${Date.now()}_${idx}` };
          headers.forEach(h => {
            rowObj[h] = row[h] ?? null;
          });
          return rowObj;
        });
        resolve({ headers, rows });
      },
      error: (error: Error) => reject(error),
    });
  });
}

/**
 * Parse Excel file (.xlsx, .xls) buffer into headers and rows
 */
export function parseExcelBuffer(arrayBuffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const jsonData: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: null });

  if (jsonData.length === 0) return { headers: [], rows: [] };

  const headers = Object.keys(jsonData[0]);
  const rows: RowData[] = jsonData.map((row, idx) => {
    const rowObj: RowData = { _id: `row_${Date.now()}_${idx}` };
    headers.forEach(h => {
      rowObj[h] = row[h] ?? null;
    });
    return rowObj;
  });

  return { headers, rows };
}

/**
 * Convert rows and column schemas into a full Dataset object
 */
export function createDatasetFromRaw(
  name: string,
  headers: string[],
  rows: RowData[],
  sourceType: Dataset['sourceType'] = 'google_form'
): Dataset {
  const columns = generateColumnSchemas(headers, rows);
  const now = new Date().toISOString();

  return {
    id: `dataset_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    name,
    columns,
    rows,
    createdAt: now,
    updatedAt: now,
    sourceType,
  };
}

/**
 * Export rows to CSV file download
 */
export function exportToCSV(filename: string, columns: ColumnSchema[], rows: RowData[]) {
  const visibleCols = columns.filter(c => c.visible).sort((a, b) => a.order - b.order);
  const headers = visibleCols.map(c => c.id);

  const exportData = rows.map(row => {
    const obj: Record<string, any> = {};
    headers.forEach(h => {
      obj[h] = row[h] ?? '';
    });
    return obj;
  });

  const csvString = Papa.unparse(exportData, { quotes: true });
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

/**
 * Copy TSV data to Clipboard formatted to paste cleanly into Google Sheets
 */
export function copyToGoogleSheetsFormat(columns: ColumnSchema[], rows: RowData[]): string {
  const visibleCols = columns.filter(c => c.visible).sort((a, b) => a.order - b.order);
  const headerLine = visibleCols.map(c => c.label).join('\t');

  const rowLines = rows.map(row => {
    return visibleCols.map(c => {
      const val = row[c.id];
      if (val === null || val === undefined) return '';
      // Replace newlines or tabs inside values to avoid messing up Google Sheets cell pasting
      return String(val).replace(/[\t\n\r]+/g, ' ');
    }).join('\t');
  });

  return [headerLine, ...rowLines].join('\n');
}

/**
 * Export rows to Excel (.xlsx) file
 */
export function exportToExcel(filename: string, columns: ColumnSchema[], rows: RowData[]) {
  const visibleCols = columns.filter(c => c.visible).sort((a, b) => a.order - b.order);

  const exportData = rows.map(row => {
    const obj: Record<string, any> = {};
    visibleCols.forEach(c => {
      obj[c.label] = row[c.id] ?? '';
    });
    return obj;
  });

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Form Data');
  XLSX.writeFile(workbook, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

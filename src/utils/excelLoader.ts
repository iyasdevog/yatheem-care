import * as XLSX from 'xlsx';
import type { Dataset, RowData } from '../types/data';
import { createDatasetFromRaw } from './csvParser';

export interface YatheemWorkbook {
  transactionDataset: Dataset;
}

/**
 * Loads and parses public/Sponsors (Responses).xlsx from server.
 * Only Sheet 1 (Form Responses 1) is used — Sheet 2 is a Hifz report template
 * and contains no donor payment data.
 */
export async function loadYatheemExcelWorkbook(): Promise<YatheemWorkbook | null> {
  try {
    const response = await fetch('/Sponsors (Responses).xlsx');
    if (!response.ok) {
      console.warn('Could not fetch /Sponsors (Responses).xlsx');
      return null;
    }
    const arrayBuffer = await response.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });

    // Parse Sheet 1: Form Responses 1 (the only real data source)
    const sheet1Name =
      workbook.SheetNames.find(n =>
        n.toLowerCase().includes('form responses') || n.toLowerCase().includes('sheet1')
      ) || workbook.SheetNames[0];

    const sheet1 = workbook.Sheets[sheet1Name];
    const s1Json: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet1, { defval: null });

    const s1Headers = s1Json.length > 0 ? Object.keys(s1Json[0]) : [];
    const s1Rows: RowData[] = s1Json.map((row, idx) => {
      const rowObj: RowData = { _id: `f1_row_${idx}` };
      s1Headers.forEach(h => {
        rowObj[h] = row[h] ?? null;
      });
      return rowObj;
    });

    const transactionDataset = createDatasetFromRaw(
      'Yatheem Donation Transactions (Form Responses 1)',
      s1Headers,
      s1Rows,
      'google_form'
    );
    transactionDataset.id = 'yatheem_transactions';

    console.log(`Loaded ${s1Rows.length} transactions from "${sheet1Name}". Sheet 2 (template) ignored.`);

    return { transactionDataset };
  } catch (err) {
    console.error('Failed to parse Yatheem Excel workbook', err);
    return null;
  }
}

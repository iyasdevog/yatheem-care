import type { ColumnSchema, ColumnType, RowData } from '../types/data';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/;
const CURRENCY_REGEX = /^[\$\€\£\₹]\s?\d+(?:,\d{3})*(?:\.\d{2})?$/;

/**
 * Infer the best matching column type based on sample row values
 */
export function inferColumnType(values: any[]): ColumnType {
  const nonNullValues = values.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
  if (nonNullValues.length === 0) return 'text';

  let isNum = true;
  let isBool = true;
  let isEmail = true;
  let isDate = true;
  let isCurrency = true;
  let isRating = true;

  const uniqueStrings = new Set<string>();

  for (const raw of nonNullValues) {
    const str = String(raw).trim();
    uniqueStrings.add(str.toLowerCase());

    // Number check
    if (isNaN(Number(str))) {
      isNum = false;
    }

    // Boolean check
    if (!['true', 'false', 'yes', 'no', '1', '0', 'y', 'n'].includes(str.toLowerCase())) {
      isBool = false;
    }

    // Email check
    if (!EMAIL_REGEX.test(str)) {
      isEmail = false;
    }

    // Date check
    if (isNaN(Date.parse(str)) && !DATE_REGEX.test(str)) {
      isDate = false;
    }

    // Currency check
    if (!CURRENCY_REGEX.test(str)) {
      isCurrency = false;
    }

    // Rating check (e.g. 1-5, 1/5, ★★★)
    const numVal = Number(str);
    if (isNaN(numVal) || numVal < 1 || numVal > 10 || !Number.isInteger(numVal)) {
      if (!str.includes('★') && !str.includes('/5')) {
        isRating = false;
      }
    }
  }

  if (isEmail) return 'email';
  if (isRating && nonNullValues.length > 0) return 'rating';
  if (isCurrency) return 'currency';
  if (isNum) return 'number';
  if (isDate) return 'date';
  if (isBool) return 'boolean';

  // If unique values are small relative to total rows, consider it a 'status' / categorical dropdown
  if (uniqueStrings.size <= 8 && nonNullValues.length >= 3) {
    return 'status';
  }

  return 'text';
}

/**
 * Generate ColumnSchema array from raw data headers and row samples
 */
export function generateColumnSchemas(headers: string[], rows: RowData[]): ColumnSchema[] {
  return headers.map((header, index) => {
    const sampleValues = rows.slice(0, 50).map(r => r[header]);
    const inferredType = inferColumnType(sampleValues);

    let options: string[] | undefined = undefined;
    if (inferredType === 'status') {
      const optionSet = new Set<string>();
      rows.forEach(r => {
        const val = r[header];
        if (val !== null && val !== undefined && String(val).trim() !== '') {
          optionSet.add(String(val).trim());
        }
      });
      options = Array.from(optionSet);
    }

    return {
      id: header,
      label: header,
      type: inferredType,
      visible: true,
      order: index,
      options,
    };
  });
}

/**
 * Format a cell value for display
 */
export function formatCellValue(value: any, type: ColumnType): string {
  if (value === null || value === undefined || value === '') return '—';

  switch (type) {
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : String(value);
    case 'currency':
      return typeof value === 'number'
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value)
        : String(value);
    case 'date':
      try {
        const d = new Date(value);
        return isNaN(d.getTime()) ? String(value) : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
      } catch {
        return String(value);
      }
    case 'boolean':
      return ['true', 'yes', '1', true].includes(String(value).toLowerCase()) ? 'Yes' : 'No';
    default:
      return String(value);
  }
}

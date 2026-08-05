import * as XLSX from 'xlsx';

/**
 * Parses an Excel serial date number (e.g. 46074) or date string into a Date object.
 */
export function parseFlexibleDate(rawDate: any): Date | null {
  if (rawDate === null || rawDate === undefined || rawDate === '') return null;

  // Handle JS Date object
  if (rawDate instanceof Date) {
    return isNaN(rawDate.getTime()) ? null : rawDate;
  }

  // Handle Excel Serial Number (e.g. 45963 or 46074)
  if (typeof rawDate === 'number' || (!isNaN(Number(rawDate)) && !String(rawDate).includes('-') && !String(rawDate).includes('/'))) {
    const num = Number(rawDate);
    if (num > 30000 && num < 100000) {
      try {
        const parsedObj = XLSX.SSF.parse_date_code(num);
        if (parsedObj) {
          return new Date(parsedObj.y, parsedObj.m - 1, parsedObj.d);
        }
      } catch (e) {
        // Fallback calculation for Excel epoch (1899-12-30)
        const date = new Date((num - 25569) * 86400 * 1000);
        return isNaN(date.getTime()) ? null : date;
      }
    }
  }

  // Handle standard date strings (YYYY-MM-DD, DD/MM/YYYY, etc.)
  const str = String(rawDate).trim();
  
  // Try DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
    const parts = str.split(/[\/\s]/);
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const year = parseInt(parts[2], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * Format a Date object or raw value as "MMM DD, YYYY" or "YYYY-MM-DD"
 */
export function formatDateDisplay(rawDate: any, format: 'short' | 'long' = 'short'): string {
  const d = parseFlexibleDate(rawDate);
  if (!d) return 'N/A';

  if (format === 'long') {
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Calculates the ending date exactly 1 year (365 days / +12 months) from start date.
 */
export function calculateOneYearEndDate(startDate: Date): Date {
  const endDate = new Date(startDate);
  endDate.setFullYear(endDate.getFullYear() + 1);
  return endDate;
}

/**
 * Calculates remaining days until 1-year completion date.
 */
export function getDaysRemaining(endDate: Date): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(endDate);
  target.setHours(0, 0, 0, 0);

  const diffTime = target.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Returns status badge metadata for a sponsorship record.
 */
export interface SponsorshipStatusInfo {
  label: string;
  badgeClass: string;
  isStarted: boolean;
  isFullyPaid: boolean;
  isExpiringSoon: boolean;
}

export function evaluateSponsorshipStatus(
  totalPaid: number,
  totalCommitted: number,
  startDate: Date | null
): SponsorshipStatusInfo {
  const isStarted = totalPaid > 0;
  const isFullyPaid = totalCommitted > 0 && totalPaid >= totalCommitted;

  if (!isStarted || !startDate) {
    return {
      label: 'Not Started Yet',
      badgeClass: 'badge-warning',
      isStarted: false,
      isFullyPaid: false,
      isExpiringSoon: false,
    };
  }

  if (isFullyPaid) {
    return {
      label: 'Fully Paid',
      badgeClass: 'badge-success',
      isStarted: true,
      isFullyPaid: true,
      isExpiringSoon: false,
    };
  }

  const endDate = calculateOneYearEndDate(startDate);
  const daysLeft = getDaysRemaining(endDate);
  const isExpiringSoon = daysLeft >= 0 && daysLeft <= 30;

  if (isExpiringSoon) {
    return {
      label: 'Expiring Soon (1-Year)',
      badgeClass: 'badge-urgent',
      isStarted: true,
      isFullyPaid: false,
      isExpiringSoon: true,
    };
  }

  return {
    label: 'Donation Started',
    badgeClass: 'badge-info',
    isStarted: true,
    isFullyPaid: false,
    isExpiringSoon: false,
  };
}

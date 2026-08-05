import type { RowData } from '../types/data';
import {
  parseFlexibleDate,
  formatDateDisplay,
  calculateOneYearEndDate,
  evaluateSponsorshipStatus,
  type SponsorshipStatusInfo,
} from './dateUtils';
import {
  type SlabAssignment,
  type DonationSlab,
  getSlabForDonor,
} from './slabManager';

export interface TransactionEntry {
  id: string;
  date: string;
  rawDate: any;
  dateObj: Date | null;
  mode: string;
  name: string;
  careOf: string;
  contact1: string;
  contact2: string;
  voucherNo: string;
  amount: number;
}

export interface DonorRecord {
  id: string;
  phoneNumber: string;
  rawPhone: string;
  donorName: string;
  careOf: string;
  address: string;
  sponsorshipCategory: string;
  totalCommitted: number;
  totalPaid: number;
  balanceRemaining: number;
  transactionCount: number;
  startDate: Date | null;
  startDateFormatted: string;
  endDate: Date | null;
  endDateFormatted: string;
  statusInfo: SponsorshipStatusInfo;
  transactions: TransactionEntry[];
  remarks: string;
  // Slab assignment
  slabId: string | null;
  slabLabel: string | null;
  slabTarget: number;   // total target from slab × units (0 if unassigned)
  slabUnits: number;    // number of students/units
  isSlabAssigned: boolean;
}

export interface CareOfSummary {
  careOfName: string;
  donorCount: number;
  totalCollected: number;
  totalCommitted: number;
  balanceRemaining: number;
  progressPercent: number;
  donors: DonorRecord[];
}

export interface DonationReportData {
  summary: {
    totalCollected: number;
    totalCommitted: number;
    totalBalance: number;
    totalDonors: number;
    startedDonorsCount: number;
    notStartedCount: number;
    fullyPaidCount: number;
    totalTransactions: number;
    uniqueCareOfCount: number;
  };
  donorsByPhone: DonorRecord[];
  careOfSummaries: CareOfSummary[];
}

/**
 * Normalizes phone number strings to a standard format (retaining digits, matching last 10 digits)
 */
export function normalizePhoneNumber(phone: any): string {
  if (phone === null || phone === undefined || phone === '') return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits;
}

export interface DateRangeFilter {
  from?: string; // YYYY-MM-DD
  to?: string;   // YYYY-MM-DD
}

/**
 * Parses raw transaction rows (from Form Responses 1) into clean TransactionEntry objects,
 * sorted chronologically (newest first).
 */
export function parseTransactions(rows: RowData[]): TransactionEntry[] {
  const parsed = rows.map((r, idx) => {
    // Support both English and Hindi Google Form column headers
    const rawDate =
      r['Date'] ?? r['DATE'] ?? r['Timestamp'] ??
      r['टाइमस्टैम्प'] ?? r['तारीख'] ?? null;

    const dateObj = parseFlexibleDate(rawDate);

    const amountVal = Number(
      r['Amount '] ?? r['Amount'] ?? r['AMOUNT'] ??
      r['राशि'] ?? r['रकम'] ?? 0
    );
    const amt = isNaN(amountVal) ? 0 : amountVal;

    // Name — English or Hindi header
    const name = String(
      r['Name'] || r['NAME'] || r['नाम'] || r['Donor Name'] || 'Unknown'
    ).trim();

    // Care Of — English or Hindi header
    const careOf = String(
      r['C/O'] || r['Care Of'] || r['CARE OF'] ||
      r['की देखभाल'] || r['Care of'] || ''
    ).trim() || 'Direct';

    // Contact — English or Hindi header
    const contact1 = String(
      r['Contact 1'] || r['Contact1'] || r['PHONE NUMBER'] ||
      r['Phone Number'] || r['संपर्क नंबर'] || r['फ़ोन नंबर'] ||
      r['मोबाइल नंबर'] || r['Contact No'] || ''
    ).trim();

    const contact2 = String(
      r['Contact 2'] || r['Contact2'] || r['संपर्क नंबर 2'] || ''
    ).trim();

    // Mode — English or Hindi
    const mode = String(
      r['MODE'] || r['Mode'] || r['भुगतान मोड'] || r['Payment Mode'] || 'N/A'
    ).trim();

    // Voucher No
    const voucherNo = String(
      r['Voucher no'] || r['Voucher No'] || r['VOUCHER NO'] ||
      r['वाउचर नंबर'] || 'N/A'
    ).trim();

    return {
      id: String(r['_id'] || `tx_${idx}`),
      date: formatDateDisplay(rawDate, 'long'),
      rawDate,
      dateObj,
      mode,
      name,
      careOf,
      contact1,
      contact2,
      voucherNo,
      amount: amt,
    };
  });

  // Sort chronologically (newest date first)
  return parsed.sort((a, b) => (b.dateObj?.getTime() ?? 0) - (a.dateObj?.getTime() ?? 0));
}

/**
 * Categorize sponsorship based on committed amount or template fields
 */
export function inferSponsorshipCategory(row: RowData, committedAmount: number): string {
  if (row['Sponsership'] || row['Sponsorship']) {
    return String(row['Sponsership'] || row['Sponsorship']).trim();
  }

  // Infer from amount
  if (committedAmount >= 50000) return 'Education (Full - ₹50,000)';
  if (committedAmount >= 30000) return 'Food (Full - ₹30,000)';
  if (committedAmount >= 25000) return 'Education (Half - ₹25,000)';
  if (committedAmount >= 15000) return 'Food (Half - ₹15,000)';
  if (committedAmount >= 12500) return 'Education (Quarter - ₹12,500)';
  if (committedAmount >= 7500) return 'Food (Quarter - ₹7,500)';
  if (committedAmount > 0) return `Custom Sponsorship (₹${committedAmount.toLocaleString()})`;
  return 'General Donation';
}

/**
 * Builds the complete Donation & Sponsorship Report data purely from
 * Form Responses (transactionRows). masterRows is no longer used —
 * the template sheet contains Hifz data, not donor data.
 *
 * slabAssignments: admin-assigned slabs per donor (by phone number)
 * slabs: the slab definitions for lookup
 * dateRange: optional date range filter (from - to)
 */
export function aggregateDonationData(
  transactionRows: RowData[],
  _masterRows: RowData[] = [],           // kept for API compat, ignored
  slabAssignments: SlabAssignment[] = [],
  slabs: DonationSlab[] = [],
  dateRange?: DateRangeFilter
): DonationReportData {
  let transactions = parseTransactions(transactionRows);

  // Apply Date Range Filter if provided
  if (dateRange?.from || dateRange?.to) {
    const fromTime = dateRange.from ? new Date(dateRange.from).getTime() : 0;
    const toTime = dateRange.to ? new Date(dateRange.to + 'T23:59:59').getTime() : Infinity;

    transactions = transactions.filter(t => {
      if (!t.dateObj) return true;
      const time = t.dateObj.getTime();
      return time >= fromTime && time <= toTime;
    });
  }

  // Group transactions by normalized phone number
  // Fallback key: use name when phone is missing
  const donorMap = new Map<string, DonorRecord>();

  transactions.forEach((tx, idx) => {
    const phoneNorm = normalizePhoneNumber(tx.contact1)
      || normalizePhoneNumber(tx.contact2)
      || `name_${tx.name.toLowerCase().replace(/\s+/g, '_')}_${idx}`;

    if (!donorMap.has(phoneNorm)) {
      // First time seeing this donor — create record
      const startDate = tx.dateObj;
      const endDate = startDate ? calculateOneYearEndDate(startDate) : null;

      // Get slab assignment if exists
      const slabMatch = getSlabForDonor(phoneNorm, slabAssignments, slabs);
      const slabTarget = slabMatch?.targetAmount ?? 0;

      const statusInfo = evaluateSponsorshipStatus(tx.amount, slabTarget || tx.amount, startDate);

      donorMap.set(phoneNorm, {
        id: `donor_${phoneNorm}`,
        phoneNumber: tx.contact1 || tx.contact2 || 'N/A',
        rawPhone: phoneNorm,
        donorName: tx.name !== 'Unknown' ? tx.name : '',
        careOf: tx.careOf || 'Direct',
        address: '',
        sponsorshipCategory: slabMatch?.displayLabel ?? 'Unassigned',
        totalCommitted: slabTarget || tx.amount,
        totalPaid: tx.amount,
        balanceRemaining: Math.max(0, (slabTarget || tx.amount) - tx.amount),
        transactionCount: 1,
        startDate,
        startDateFormatted: startDate ? formatDateDisplay(startDate, 'long') : 'N/A',
        endDate,
        endDateFormatted: endDate ? formatDateDisplay(endDate, 'long') : 'N/A',
        statusInfo,
        transactions: [tx],
        remarks: '',
        slabId: slabMatch?.slab.id ?? null,
        slabLabel: slabMatch?.displayLabel ?? null,
        slabTarget,
        slabUnits: slabMatch?.units ?? 1,
        isSlabAssigned: !!slabMatch,
      });
    } else {
      // Merge this transaction into existing donor record
      const existing = donorMap.get(phoneNorm)!;

      // Update name if we now have a better one
      if (!existing.donorName && tx.name !== 'Unknown') {
        existing.donorName = tx.name;
      }
      // Update careOf if still default
      if (existing.careOf === 'Direct' && tx.careOf && tx.careOf !== 'Direct') {
        existing.careOf = tx.careOf;
      }

      existing.transactions.push(tx);
      existing.transactionCount = existing.transactions.length;
      existing.totalPaid += tx.amount;

      // Re-evaluate start date & end date from all transactions
      const dates = existing.transactions
        .map(t => t.dateObj)
        .filter((d): d is Date => d !== null)
        .sort((a, b) => a.getTime() - b.getTime());

      if (dates.length > 0) {
        existing.startDate = dates[0];
        existing.startDateFormatted = formatDateDisplay(dates[0], 'long');
        existing.endDate = calculateOneYearEndDate(dates[0]);
        existing.endDateFormatted = formatDateDisplay(existing.endDate, 'long');
      }

      // Re-fetch slab in case assignment was updated
      const slabMatch = getSlabForDonor(phoneNorm, slabAssignments, slabs);
      const slabTarget = slabMatch?.targetAmount ?? 0;
      existing.slabId = slabMatch?.slab.id ?? null;
      existing.slabLabel = slabMatch?.displayLabel ?? null;
      existing.slabTarget = slabTarget;
      existing.slabUnits = slabMatch?.units ?? 1;
      existing.isSlabAssigned = !!slabMatch;
      existing.sponsorshipCategory = slabMatch?.displayLabel ?? 'Unassigned';
      existing.totalCommitted = slabTarget || existing.totalPaid;
      existing.balanceRemaining = Math.max(0, existing.totalCommitted - existing.totalPaid);

      existing.statusInfo = evaluateSponsorshipStatus(
        existing.totalPaid,
        existing.totalCommitted,
        existing.startDate
      );
    }
  });


  const donorsByPhone = Array.from(donorMap.values());

  // Aggregate by Care Of (C/O)
  const careOfMap = new Map<string, CareOfSummary>();

  donorsByPhone.forEach(d => {
    const cName = d.careOf ? d.careOf.trim().toUpperCase() : 'DIRECT / UNASSIGNED';
    if (!careOfMap.has(cName)) {
      careOfMap.set(cName, {
        careOfName: cName,
        donorCount: 0,
        totalCollected: 0,
        totalCommitted: 0,
        balanceRemaining: 0,
        progressPercent: 0,
        donors: [],
      });
    }

    const co = careOfMap.get(cName)!;
    co.donorCount += 1;
    co.totalCollected += d.totalPaid;
    co.totalCommitted += d.totalCommitted;
    co.balanceRemaining += d.balanceRemaining;
    co.donors.push(d);
  });

  const careOfSummaries = Array.from(careOfMap.values()).map(co => {
    const pct = co.totalCommitted > 0 ? (co.totalCollected / co.totalCommitted) * 100 : 100;
    return {
      ...co,
      progressPercent: Math.min(100, Math.round(pct)),
    };
  }).sort((a, b) => b.totalCollected - a.totalCollected);

  // Overall Summary Metrics
  const totalCollected = donorsByPhone.reduce((sum, d) => sum + d.totalPaid, 0);
  const totalCommitted = donorsByPhone.reduce((sum, d) => sum + d.totalCommitted, 0);
  const totalBalance = donorsByPhone.reduce((sum, d) => sum + d.balanceRemaining, 0);
  const startedDonorsCount = donorsByPhone.filter(d => d.statusInfo.isStarted).length;
  const notStartedCount = donorsByPhone.filter(d => !d.statusInfo.isStarted).length;
  const fullyPaidCount = donorsByPhone.filter(d => d.statusInfo.isFullyPaid).length;

  return {
    summary: {
      totalCollected,
      totalCommitted,
      totalBalance,
      totalDonors: donorsByPhone.length,
      startedDonorsCount,
      notStartedCount,
      fullyPaidCount,
      totalTransactions: transactions.length,
      uniqueCareOfCount: careOfSummaries.length,
    },
    donorsByPhone,
    careOfSummaries,
  };
}

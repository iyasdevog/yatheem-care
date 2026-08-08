/**
 * Core typed entity interfaces for YatheemCare.
 *
 * These replace the generic RowData approach and give each real-world entity
 * its own strongly-typed shape, ready for Firebase subcollections.
 *
 * Firebase collection paths:
 *   /donors/{phoneNumber}
 *   /donors/{phoneNumber}/transactions/{transactionId}
 *   /slabs/{slabId}
 *   /slabAssignments/{phoneNumber}
 *   /students/{studentId}
 */

// ─── DONOR ────────────────────────────────────────────────────────────────────

export interface Donor {
  /** Normalized 10-digit phone number used as the primary key */
  phoneNumber: string;
  rawPhone: string;
  name: string;
  careOf: string;          // e.g. "Al-Manar Trust" or "Direct"
  address?: string;
  remarks?: string;

  // Sponsorship slab snapshot (denormalized for fast dashboard reads)
  slabId?: string;
  slabUnits?: number;

  // Lifecycle
  startDate?: string;      // ISO date string
  createdAt: string;
  updatedAt: string;
}

// ─── TRANSACTION ──────────────────────────────────────────────────────────────

export interface Transaction {
  id: string;              // unique ID e.g. `tx_${Date.now()}`
  donorPhone: string;      // FK → Donor.phoneNumber

  date: string;            // raw date string from form/sheet
  amount: number;
  mode: string;            // "Cash" | "Cheque" | "Online" | "Pending"
  voucherNo: string;
  remarks?: string;

  createdAt: string;
  updatedAt: string;
}

// ─── SLAB ─────────────────────────────────────────────────────────────────────

export interface Slab {
  id: string;
  category: string;        // "Education" | "Food" | custom
  label: string;           // "Full" | "Half" | "Quarter" | custom
  amount: number;          // target amount per unit (e.g. 50000)
  unit: string;            // "student" | "child" | custom
  color: string;           // hex color for UI
  isDefault: boolean;

  createdAt: string;
  updatedAt: string;
}

// ─── SLAB ASSIGNMENT ──────────────────────────────────────────────────────────

export interface SlabAssignment {
  phoneNumber: string;     // FK → Donor.phoneNumber (also the document ID)
  slabId: string;          // FK → Slab.id
  units: number;           // how many units (e.g. 3 × ₹50,000 = ₹1,50,000)
  note?: string;

  assignedAt: string;
  updatedAt: string;
}

// ─── STUDENT ──────────────────────────────────────────────────────────────────

export interface Student {
  id: string;              // unique student ID
  name: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  schoolName?: string;
  className?: string;
  address?: string;
  guardianName?: string;
  guardianPhone?: string;

  /** Phone number of the sponsoring donor (FK → Donor.phoneNumber) */
  sponsoredByPhone?: string;
  /** Which slab category this student falls under */
  sponsorshipCategory?: string;
  sponsorshipStatus?: 'active' | 'pending' | 'completed' | 'unsponsored';

  enrolledAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── SHARED UTILITIES ─────────────────────────────────────────────────────────

/** Minimal shape returned by real-time listeners before full data loads */
export interface EntityMeta {
  id: string;
  updatedAt: string;
}

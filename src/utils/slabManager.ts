// ── Slab & Assignment Types ────────────────────────────────────────────────
import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../firebase';
import { sanitizeForFirebase } from './firebaseSync';


export interface DonationSlab {
  id: string;
  category: string;     // "Education" | "Food" | custom
  label: string;        // "Full" | "Half" | "Quarter" | custom
  amount: number;       // target amount per unit (e.g. 50000)
  unit: string;         // "student" | "child" | custom
  color: string;        // hex color for UI
  isDefault: boolean;
}

export interface SlabAssignment {
  phoneNumber: string;  // normalized 10-digit donor identifier
  slabId: string;
  units: number;        // how many units (students) e.g. 3 → 3 × ₹50,000 = ₹1,50,000
  assignedAt: string;   // ISO date
  updatedAt: string;    // ISO date
  note?: string;
}

export interface SlabMatchResult {
  slab: DonationSlab;
  units: number;
  targetAmount: number;  // units × slab.amount
  displayLabel: string;  // e.g. "Education Full × 3 students"
}

// ── Default Slabs ─────────────────────────────────────────────────────────

export const DEFAULT_SLABS: DonationSlab[] = [
  { id: 'edu_full',     category: 'Education', label: 'Full',    amount: 50000, unit: 'student', color: '#6366f1', isDefault: true },
  { id: 'edu_half',     category: 'Education', label: 'Half',    amount: 25000, unit: 'student', color: '#8b5cf6', isDefault: true },
  { id: 'edu_quarter',  category: 'Education', label: 'Quarter', amount: 12500, unit: 'student', color: '#a78bfa', isDefault: true },
  { id: 'food_full',    category: 'Food',      label: 'Full',    amount: 30000, unit: 'student', color: '#10b981', isDefault: true },
  { id: 'food_half',    category: 'Food',      label: 'Half',    amount: 15000, unit: 'student', color: '#34d399', isDefault: true },
  { id: 'food_quarter', category: 'Food',      label: 'Quarter', amount: 7500,  unit: 'student', color: '#6ee7b7', isDefault: true },
];

const SLABS_KEY       = 'yatheem_slabs_v1';
const ASSIGNMENTS_KEY = 'yatheem_slab_assignments_v1';

// ── Slab Persistence ──────────────────────────────────────────────────────

export function loadSlabs(): DonationSlab[] {
  try {
    const raw = localStorage.getItem(SLABS_KEY);
    if (raw) {
      const parsed: DonationSlab[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch { /* ignore */ }
  return [...DEFAULT_SLABS];
}

export function saveSlabs(slabs: DonationSlab[]): void {
  localStorage.setItem(SLABS_KEY, JSON.stringify(slabs));
}

export function addSlab(slabs: DonationSlab[], newSlab: Omit<DonationSlab, 'id' | 'isDefault'>): DonationSlab[] {
  const slab: DonationSlab = {
    ...newSlab,
    id: `custom_${Date.now()}`,
    isDefault: false,
  };
  const updated = [...slabs, slab];
  saveSlabs(updated);
  return updated;
}

export function updateSlab(slabs: DonationSlab[], updatedSlab: DonationSlab): DonationSlab[] {
  const updated = slabs.map(s => (s.id === updatedSlab.id ? updatedSlab : s));
  saveSlabs(updated);
  return updated;
}

export function deleteSlab(slabs: DonationSlab[], slabId: string): DonationSlab[] {
  const filtered = slabs.filter(s => s.id !== slabId);
  saveSlabs(filtered);
  return filtered;
}

// ── Assignment Persistence ────────────────────────────────────────────────

export function loadSlabAssignments(): SlabAssignment[] {
  try {
    const raw = localStorage.getItem(ASSIGNMENTS_KEY);
    if (raw) {
      const parsed: SlabAssignment[] = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch { /* ignore */ }
  return [];
}

export function saveSlabAssignments(assignments: SlabAssignment[]): void {
  localStorage.setItem(ASSIGNMENTS_KEY, JSON.stringify(assignments));
}

export function assignDonorToSlab(
  assignments: SlabAssignment[],
  phoneNumber: string,
  slabId: string,
  units: number,
  note?: string
): SlabAssignment[] {
  const filtered = assignments.filter(a => a.phoneNumber !== phoneNumber);
  const now = new Date().toISOString();
  const newAssignment: SlabAssignment = {
    phoneNumber,
    slabId,
    units: Math.max(1, units),
    assignedAt: now,
    updatedAt: now,
    note,
  };
  const updated = [...filtered, newAssignment];
  saveSlabAssignments(updated);
  return updated;
}

export function removeDonorAssignment(
  assignments: SlabAssignment[],
  phoneNumber: string
): SlabAssignment[] {
  const updated = assignments.filter(a => a.phoneNumber !== phoneNumber);
  saveSlabAssignments(updated);
  return updated;
}

// ── Slab Matching ─────────────────────────────────────────────────────────

/**
 * Gets the slab info for a donor from their explicit assignment.
 */
export function getSlabForDonor(
  phoneNumber: string,
  assignments: SlabAssignment[],
  slabs: DonationSlab[]
): SlabMatchResult | null {
  const assignment = assignments.find(a => a.phoneNumber === phoneNumber);
  if (!assignment) return null;

  const slab = slabs.find(s => s.id === assignment.slabId);
  if (!slab) return null;

  const units = assignment.units ?? 1;
  const targetAmount = slab.amount * units;
  const displayLabel = units > 1
    ? `${slab.category} ${slab.label} × ${units} ${slab.unit}s`
    : `${slab.category} ${slab.label}`;

  return { slab, units, targetAmount, displayLabel };
}

/**
 * Auto-suggest the best matching slab based on total payment amount.
 * Checks for exact match first, then best N-unit multiple.
 */
export function suggestSlab(
  totalPaid: number,
  slabs: DonationSlab[]
): { slabId: string; units: number } | null {
  if (totalPaid <= 0) return null;

  // Check exact match first
  for (const slab of slabs) {
    if (slab.amount === totalPaid) return { slabId: slab.id, units: 1 };
  }

  // Check N-unit multiples (up to 10 units), prefer smallest remainder
  let best: { slabId: string; units: number; remainder: number } | null = null;
  for (const slab of slabs) {
    for (let n = 1; n <= 10; n++) {
      const target = slab.amount * n;
      const remainder = Math.abs(totalPaid - target);
      const tolerance = target * 0.08; // 8% tolerance
      if (remainder <= tolerance) {
        if (!best || remainder < best.remainder) {
          best = { slabId: slab.id, units: n, remainder };
        }
      }
    }
  }
  return best ? { slabId: best.slabId, units: best.units } : null;
}

// ── Category Colors ───────────────────────────────────────────────────────

export const CATEGORY_COLORS: Record<string, string> = {
  'Education': '#6366f1',
  'Food': '#10b981',
};

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? '#f59e0b';
}

// ── Firebase Sync (Slabs & Assignments) ───────────────────────────────────

const SLABS_COLLECTION = 'slabs';
const ASSIGNMENTS_COLLECTION = 'slabAssignments';

/**
 * Syncs all slabs to Firebase /slabs collection.
 * Each slab is its own document (ID = slab.id).
 */
export async function saveSlabsToFirebase(slabs: DonationSlab[]): Promise<void> {
  if (slabs.length === 0) return;
  try {
    const batch = writeBatch(db);
    const now = new Date().toISOString();
    slabs.forEach(slab => {
      const clean = sanitizeForFirebase({ ...slab, updatedAt: now, lastSyncedAt: serverTimestamp() });
      batch.set(doc(db, SLABS_COLLECTION, slab.id), clean, { merge: true });
    });
    await batch.commit();
  } catch (err) {
    console.error('Failed to save slabs to Firebase:', err);
  }
}

/**
 * Saves a single slab assignment to Firebase.
 * Document ID = phoneNumber (one active assignment per donor).
 */
export async function saveAssignmentToFirebase(assignment: SlabAssignment): Promise<void> {
  try {
    const clean = sanitizeForFirebase({ ...assignment, lastSyncedAt: serverTimestamp() });
    await setDoc(doc(db, ASSIGNMENTS_COLLECTION, assignment.phoneNumber), clean, { merge: true });
  } catch (err) {
    console.error('Failed to save assignment to Firebase:', err);
  }
}

/**
 * Real-time listener for slab configuration.
 */
export function subscribeToSlabs(
  onUpdate: (slabs: DonationSlab[]) => void,
  onError?: (err: Error) => void
): () => void {
  return onSnapshot(
    collection(db, SLABS_COLLECTION),
    (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) return;
      const slabs: DonationSlab[] = [];
      snapshot.forEach(d => slabs.push(d.data() as DonationSlab));
      if (slabs.length > 0) onUpdate(slabs);
    },
    (err) => {
      console.warn('Realtime slabs sync error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Real-time listener for all slab assignments.
 */
export function subscribeToAssignments(
  onUpdate: (assignments: SlabAssignment[]) => void,
  onError?: (err: Error) => void
): () => void {
  return onSnapshot(
    collection(db, ASSIGNMENTS_COLLECTION),
    (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) return;
      const assignments: SlabAssignment[] = [];
      snapshot.forEach(d => assignments.push(d.data() as SlabAssignment));
      onUpdate(assignments);
    },
    (err) => {
      console.warn('Realtime assignments sync error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * donorSync.ts
 *
 * Firebase CRUD and real-time listeners for Donor & Transaction entities.
 *
 * Collection structure:
 *   /donors/{phoneNumber}                   — Donor profile
 *   /donors/{phoneNumber}/transactions/{id} — Individual transactions
 */

import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Donor, Transaction } from '../types/entities';
import { sanitizeForFirebase } from './firebaseSync';

const DONORS_COLLECTION = 'donors';
const TRANSACTIONS_SUB = 'transactions';

// ─── DONOR CRUD ───────────────────────────────────────────────────────────────

/**
 * Create or update a donor profile document.
 * Document ID = normalized phoneNumber.
 */
export async function saveDonorToFirebase(donor: Donor): Promise<void> {
  try {
    const clean = sanitizeForFirebase({ ...donor, lastSyncedAt: serverTimestamp() });
    const ref = doc(db, DONORS_COLLECTION, donor.phoneNumber);
    await setDoc(ref, clean, { merge: true });
  } catch (err) {
    console.error('Failed to save donor:', err);
    throw err;
  }
}

/**
 * Delete a donor profile (does NOT cascade-delete subcollections in client SDK).
 */
export async function deleteDonorFromFirebase(phoneNumber: string): Promise<void> {
  try {
    await deleteDoc(doc(db, DONORS_COLLECTION, phoneNumber));
  } catch (err) {
    console.error('Failed to delete donor:', err);
    throw err;
  }
}

/**
 * Real-time listener for the entire donors collection.
 */
export function subscribeToDonors(
  onUpdate: (donors: Donor[]) => void,
  onError?: (err: Error) => void
): () => void {
  const ref = collection(db, DONORS_COLLECTION);
  return onSnapshot(
    ref,
    (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) return;
      const donors: Donor[] = [];
      snapshot.forEach(d => donors.push(d.data() as Donor));
      onUpdate(donors);
    },
    (err) => {
      console.warn('Realtime donors sync error:', err);
      if (onError) onError(err);
    }
  );
}

// ─── TRANSACTION CRUD ─────────────────────────────────────────────────────────

/**
 * Save a single transaction under a donor's subcollection.
 */
export async function saveTransactionToFirebase(
  phoneNumber: string,
  transaction: Transaction
): Promise<void> {
  try {
    const clean = sanitizeForFirebase({ ...transaction, lastSyncedAt: serverTimestamp() });
    const ref = doc(db, DONORS_COLLECTION, phoneNumber, TRANSACTIONS_SUB, transaction.id);
    await setDoc(ref, clean, { merge: true });
  } catch (err) {
    console.error('Failed to save transaction:', err);
    throw err;
  }
}

/**
 * Delete a single transaction from a donor's subcollection.
 */
export async function deleteTransactionFromFirebase(
  phoneNumber: string,
  transactionId: string
): Promise<void> {
  try {
    await deleteDoc(doc(db, DONORS_COLLECTION, phoneNumber, TRANSACTIONS_SUB, transactionId));
  } catch (err) {
    console.error('Failed to delete transaction:', err);
    throw err;
  }
}

/**
 * Batch-save multiple transactions for a donor (e.g. during initial import).
 * Uses Firestore write batches (max 500 per batch).
 */
export async function saveBatchTransactionsToFirebase(
  phoneNumber: string,
  transactions: Transaction[]
): Promise<void> {
  if (!transactions || transactions.length === 0) return;

  const BATCH_SIZE = 500;
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = transactions.slice(i, i + BATCH_SIZE);
    chunk.forEach(tx => {
      const clean = sanitizeForFirebase({ ...tx, lastSyncedAt: serverTimestamp() });
      const ref = doc(db, DONORS_COLLECTION, phoneNumber, TRANSACTIONS_SUB, tx.id);
      batch.set(ref, clean, { merge: true });
    });
    await batch.commit();
  }
}

/**
 * Real-time listener for all transactions of a specific donor.
 * Returns an unsubscribe function.
 */
export function subscribeToDonorTransactions(
  phoneNumber: string,
  onUpdate: (transactions: Transaction[]) => void,
  onError?: (err: Error) => void
): () => void {
  const ref = query(
    collection(db, DONORS_COLLECTION, phoneNumber, TRANSACTIONS_SUB),
    orderBy('date', 'desc')
  );
  return onSnapshot(
    ref,
    (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) return;
      const txs: Transaction[] = [];
      snapshot.forEach(d => txs.push(d.data() as Transaction));
      onUpdate(txs);
    },
    (err) => {
      console.warn(`Realtime transactions sync error for ${phoneNumber}:`, err);
      if (onError) onError(err);
    }
  );
}

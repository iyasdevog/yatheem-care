/**
 * studentSync.ts
 *
 * Firebase CRUD and real-time listeners for the Student entity.
 *
 * Collection structure:
 *   /students/{studentId}  — Student profile
 *
 * This is scaffolded and ready for UI integration when the Student
 * management module is built.
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
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Student } from '../types/entities';
import { sanitizeForFirebase } from './firebaseSync';

const STUDENTS_COLLECTION = 'students';

// ─── STUDENT CRUD ─────────────────────────────────────────────────────────────

/**
 * Create or update a student profile.
 * Document ID = student.id
 */
export async function saveStudentToFirebase(student: Student): Promise<void> {
  try {
    const clean = sanitizeForFirebase({ ...student, lastSyncedAt: serverTimestamp() });
    const ref = doc(db, STUDENTS_COLLECTION, student.id);
    await setDoc(ref, clean, { merge: true });
  } catch (err) {
    console.error('Failed to save student:', err);
    throw err;
  }
}

/**
 * Delete a student record.
 */
export async function deleteStudentFromFirebase(studentId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, STUDENTS_COLLECTION, studentId));
  } catch (err) {
    console.error('Failed to delete student:', err);
    throw err;
  }
}

/**
 * Batch-save multiple students (e.g. on initial import from Excel/CSV).
 */
export async function saveBatchStudentsToFirebase(students: Student[]): Promise<void> {
  if (!students || students.length === 0) return;

  const BATCH_SIZE = 500;
  for (let i = 0; i < students.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const chunk = students.slice(i, i + BATCH_SIZE);
    chunk.forEach(student => {
      const clean = sanitizeForFirebase({ ...student, lastSyncedAt: serverTimestamp() });
      const ref = doc(db, STUDENTS_COLLECTION, student.id);
      batch.set(ref, clean, { merge: true });
    });
    await batch.commit();
  }
}

/**
 * Real-time listener for all students.
 */
export function subscribeToStudents(
  onUpdate: (students: Student[]) => void,
  onError?: (err: Error) => void
): () => void {
  const ref = collection(db, STUDENTS_COLLECTION);
  return onSnapshot(
    ref,
    (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) return;
      const students: Student[] = [];
      snapshot.forEach(d => students.push(d.data() as Student));
      onUpdate(students);
    },
    (err) => {
      console.warn('Realtime students sync error:', err);
      if (onError) onError(err);
    }
  );
}

/**
 * Real-time listener for students sponsored by a specific donor.
 */
export function subscribeToStudentsByDonor(
  donorPhone: string,
  onUpdate: (students: Student[]) => void,
  onError?: (err: Error) => void
): () => void {
  const ref = query(
    collection(db, STUDENTS_COLLECTION),
    where('sponsoredByPhone', '==', donorPhone)
  );
  return onSnapshot(
    ref,
    (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) return;
      const students: Student[] = [];
      snapshot.forEach(d => students.push(d.data() as Student));
      onUpdate(students);
    },
    (err) => {
      console.warn(`Realtime students sync error for donor ${donorPhone}:`, err);
      if (onError) onError(err);
    }
  );
}

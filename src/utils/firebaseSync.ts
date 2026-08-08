import {
  collection,
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  deleteDoc,
  deleteField,
  updateDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Dataset, RowData } from '../types/data';

const DATASETS_COLLECTION = 'datasets';
const ROWS_SUBCOLLECTION = 'rows';

/**
 * Recursively removes undefined values from an object or array,
 * replacing undefined with null or omitting undefined keys.
 */
export function sanitizeForFirebase<T>(val: T): T {
  if (val === undefined) return null as unknown as T;
  if (val === null || typeof val !== 'object') return val;
  if (val instanceof Date) return val.toISOString() as unknown as T;
  if (Array.isArray(val)) return val.map(item => sanitizeForFirebase(item)) as unknown as T;

  const cleanObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(val)) {
    if (value !== undefined) cleanObj[key] = sanitizeForFirebase(value);
  }
  return cleanObj as T;
}

// ----------------------------------------------------------------------------
// METADATA CRUD
// ----------------------------------------------------------------------------

/**
 * Saves only the dataset metadata to the root document.
 * (Strips out the rows array so we don't blow up the 1MB document limit).
 */
export async function saveDatasetMetadataToFirebase(dataset: Dataset): Promise<void> {
  try {
    const { rows, ...metadata } = dataset;
    const cleanData = sanitizeForFirebase(metadata);
    const docRef = doc(db, DATASETS_COLLECTION, cleanData.id);
    await setDoc(docRef, {
      ...cleanData,
      lastSyncedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('Failed to save dataset metadata:', error);
    throw error;
  }
}

/**
 * Listens for real-time changes to dataset metadata.
 */
export function subscribeToDatasetMetadata(
  onUpdate: (metadataList: Omit<Dataset, 'rows'>[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, DATASETS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) return;

      const datasets: Omit<Dataset, 'rows'>[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Omit<Dataset, 'rows'>;
        datasets.push(data);
      });
      if (datasets.length > 0) {
        onUpdate(datasets);
      }
    },
    (err) => {
      console.warn('Realtime metadata sync error:', err);
      if (onError) onError(err);
    }
  );
}

// ----------------------------------------------------------------------------
// ROW CRUD (SUBCOLLECTION)
// ----------------------------------------------------------------------------

/**
 * Saves a single row into the dataset's rows subcollection.
 */
export async function saveRowToFirebase(datasetId: string, row: RowData): Promise<void> {
  try {
    const cleanRow = sanitizeForFirebase(row);
    const rowId = String(cleanRow._id);
    if (!rowId) throw new Error("Row must have an _id to be saved.");

    const rowRef = doc(db, DATASETS_COLLECTION, datasetId, ROWS_SUBCOLLECTION, rowId);
    await setDoc(rowRef, {
      ...cleanRow,
      lastSyncedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    console.error('Failed to save row:', error);
    throw error;
  }
}

/**
 * Deletes a single row from the subcollection.
 */
export async function deleteRowFromFirebase(datasetId: string, rowId: string): Promise<void> {
  try {
    const rowRef = doc(db, DATASETS_COLLECTION, datasetId, ROWS_SUBCOLLECTION, rowId);
    await deleteDoc(rowRef);
  } catch (error) {
    console.error('Failed to delete row:', error);
    throw error;
  }
}

/**
 * Saves multiple rows efficiently using Firestore write batches.
 * Handles chunks of up to 500 rows per batch (Firestore limit).
 */
export async function saveMultipleRowsToFirebase(datasetId: string, rows: RowData[]): Promise<void> {
  if (!rows || rows.length === 0) return;

  const BATCH_SIZE = 500;
  try {
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = writeBatch(db);
      const chunk = rows.slice(i, i + BATCH_SIZE);

      chunk.forEach(row => {
        const cleanRow = sanitizeForFirebase(row);
        const rowId = String(cleanRow._id);
        if (rowId) {
          const rowRef = doc(db, DATASETS_COLLECTION, datasetId, ROWS_SUBCOLLECTION, rowId);
          batch.set(rowRef, { ...cleanRow, lastSyncedAt: serverTimestamp() }, { merge: true });
        }
      });
      await batch.commit();
    }
  } catch (error) {
    console.error('Failed to batch save rows:', error);
    throw error;
  }
}

/**
 * Listens for real-time changes to the rows subcollection of a specific dataset.
 */
export function subscribeToDatasetRows(
  datasetId: string,
  onUpdate: (rows: RowData[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, DATASETS_COLLECTION, datasetId, ROWS_SUBCOLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) return;

      const rows: RowData[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as RowData;
        rows.push(data);
      });
      onUpdate(rows); // Send updates even if empty, to reflect deletions
    },
    (err) => {
      console.warn(`Realtime rows sync error for ${datasetId}:`, err);
      if (onError) onError(err);
    }
  );
}

// ----------------------------------------------------------------------------
// MIGRATION HELPER
// ----------------------------------------------------------------------------

/**
 * Checks if the dataset document still contains the giant 'rows' array.
 * If it does, we extract it, write the rows to the subcollection, and delete the array.
 */
export async function migrateDatasetRowsIfNeeded(datasetId: string): Promise<void> {
  try {
    const docRef = doc(db, DATASETS_COLLECTION, datasetId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      // If the giant rows array exists inside the document root
      if (data && Array.isArray(data.rows) && data.rows.length > 0) {
        console.log(`Migrating ${data.rows.length} rows for dataset ${datasetId}...`);
        
        // 1. Batch save to subcollection
        await saveMultipleRowsToFirebase(datasetId, data.rows);
        
        // 2. Delete the massive field from root document
        await updateDoc(docRef, {
          rows: deleteField()
        });
        
        console.log(`Migration for ${datasetId} complete.`);
      }
    }
  } catch (error) {
    console.error(`Failed to migrate dataset ${datasetId}:`, error);
  }
}

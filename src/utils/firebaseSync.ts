import {
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Dataset } from '../types/data';

const DATASETS_COLLECTION = 'datasets';

/**
 * Recursively removes undefined values from an object or array,
 * replacing undefined with null or omitting undefined keys,
 * so that Firebase Firestore setDoc/updateDoc never throws "Unsupported field value: undefined".
 */
export function sanitizeForFirebase<T>(val: T): T {
  if (val === undefined) {
    return null as unknown as T;
  }
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (val instanceof Date) {
    return val.toISOString() as unknown as T;
  }
  if (Array.isArray(val)) {
    return val.map(item => sanitizeForFirebase(item)) as unknown as T;
  }

  const cleanObj: Record<string, any> = {};
  for (const [key, value] of Object.entries(val)) {
    if (value !== undefined) {
      cleanObj[key] = sanitizeForFirebase(value);
    }
  }
  return cleanObj as T;
}

/**
 * Saves or updates a dataset in Firebase Firestore
 */
export async function saveDatasetToFirebase(dataset: Dataset): Promise<void> {
  try {
    const cleanData = sanitizeForFirebase(dataset);
    const docRef = doc(db, DATASETS_COLLECTION, cleanData.id);
    await setDoc(docRef, {
      ...cleanData,
      lastSyncedAt: serverTimestamp(),
    }, { merge: true });
    console.log(`Dataset ${cleanData.name} (${cleanData.id}) saved to Firebase.`);
  } catch (error) {
    console.error('Failed to save dataset to Firebase:', error);
    throw error;
  }
}

/**
 * Syncs multiple datasets to Firebase
 */
export async function syncAllDatasetsToFirebase(datasets: Dataset[]): Promise<void> {
  const promises = datasets.map(d => saveDatasetToFirebase(d));
  await Promise.all(promises);
}

/**
 * Fetches all datasets stored in Firebase Firestore
 */
export async function fetchDatasetsFromFirebase(): Promise<Dataset[]> {
  try {
    const querySnapshot = await getDocs(collection(db, DATASETS_COLLECTION));
    const datasets: Dataset[] = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data() as Dataset;
      datasets.push(data);
    });
    return datasets;
  } catch (error) {
    console.error('Failed to fetch datasets from Firebase:', error);
    return [];
  }
}

/**
 * Listens for real-time changes to datasets in Firebase Firestore
 */
export function subscribeToFirebaseDatasets(
  onUpdate: (datasets: Dataset[]) => void,
  onError?: (err: Error) => void
) {
  const colRef = collection(db, DATASETS_COLLECTION);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const datasets: Dataset[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data() as Dataset;
        datasets.push(data);
      });
      if (datasets.length > 0) {
        onUpdate(datasets);
      }
    },
    (err) => {
      console.warn('Realtime Firebase sync error:', err);
      if (onError) onError(err);
    }
  );
}

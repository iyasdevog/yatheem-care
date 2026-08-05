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
 * Saves or updates a dataset in Firebase Firestore
 */
export async function saveDatasetToFirebase(dataset: Dataset): Promise<void> {
  try {
    const docRef = doc(db, DATASETS_COLLECTION, dataset.id);
    await setDoc(docRef, {
      ...dataset,
      lastSyncedAt: serverTimestamp(),
    }, { merge: true });
    console.log(`Dataset ${dataset.name} (${dataset.id}) saved to Firebase.`);
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

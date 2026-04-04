import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage';
import { storage } from '@/config/firebase';

/**
 * Upload a processed label blob to Firebase Storage.
 * Returns the public download URL.
 */
export async function uploadLabel(
  userId: string,
  recipeId: string,
  blob: Blob,
): Promise<string> {
  const storageRef = ref(storage, `labels/${userId}/${recipeId}`);
  await uploadBytes(storageRef, blob, {
    contentType: blob.type,
    cacheControl: 'public, max-age=31536000', // immutable — URL changes on re-upload
  });
  return getDownloadURL(storageRef);
}

/**
 * Delete a label from Firebase Storage.
 * Silently succeeds if the file doesn't exist.
 */
export async function deleteLabel(
  userId: string,
  recipeId: string,
): Promise<void> {
  const storageRef = ref(storage, `labels/${userId}/${recipeId}`);
  try {
    await deleteObject(storageRef);
  } catch (e: unknown) {
    // Ignore "object not found" — file may already be gone
    if (e instanceof Error && 'code' in e && (e as { code: string }).code === 'storage/object-not-found') {
      return;
    }
    throw e;
  }
}

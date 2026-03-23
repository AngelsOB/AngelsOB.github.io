import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth, adminStorage } from '@/config/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export async function POST(req: NextRequest) {
  try {
    // Verify auth
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.slice(7);
    const decoded = await adminAuth.verifyIdToken(token);

    const { recipeId } = await req.json();
    if (!recipeId || typeof recipeId !== 'string') {
      return NextResponse.json({ error: 'Missing recipeId' }, { status: 400 });
    }

    // Verify ownership and delete
    const recipeRef = adminDb.collection('recipes').doc(recipeId);
    const recipeSnap = await recipeRef.get();
    if (recipeSnap.exists) {
      if (recipeSnap.data()?.ownerId !== decoded.uid) {
        return NextResponse.json({ error: 'Not your recipe' }, { status: 403 });
      }

      // Batch: delete recipe + decrement user's recipeCount atomically
      const batch = adminDb.batch();
      batch.delete(recipeRef);
      const userRef = adminDb.collection('users').doc(decoded.uid);
      batch.update(userRef, { recipeCount: FieldValue.increment(-1) });

      // Also delete from publicRecipeIndex if it exists
      const indexRef = adminDb.collection('publicRecipeIndex').doc(recipeId);
      const indexSnap = await indexRef.get();
      if (indexSnap.exists) {
        batch.delete(indexRef);
      }

      await batch.commit();

      // Clean up label image from Storage (best-effort)
      try {
        await adminStorage.bucket().file(`labels/${decoded.uid}/${recipeId}`).delete();
      } catch { /* file may not exist */ }
    } else {
      // Recipe already gone — still clean up index if present
      const indexRef = adminDb.collection('publicRecipeIndex').doc(recipeId);
      const indexSnap = await indexRef.get();
      if (indexSnap.exists) {
        await indexRef.delete();
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[API] Delete recipe error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

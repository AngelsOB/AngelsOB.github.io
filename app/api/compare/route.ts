import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/config/firebase-admin';
import { findSeedRecipe } from '@/data/seed-recipes';
import type { Recipe } from '@/modules/recipe/models/Recipe';

export async function GET(req: NextRequest) {
  try {
    const idsParam = req.nextUrl.searchParams.get('ids');
    if (!idsParam) {
      return NextResponse.json({ error: 'Missing ids parameter' }, { status: 400 });
    }

    const ids = idsParam.split(',').filter(Boolean);
    if (ids.length < 2 || ids.length > 8) {
      return NextResponse.json({ error: 'Provide 2–8 recipe IDs' }, { status: 400 });
    }

    const recipes: Recipe[] = [];

    // Separate seed IDs from Firestore IDs
    const seedIds = ids.filter((id) => id.startsWith('seed-'));
    const firestoreIds = ids.filter((id) => !id.startsWith('seed-'));

    // Look up seed recipes
    for (const id of seedIds) {
      const recipe = findSeedRecipe(id);
      if (recipe) recipes.push(recipe);
    }

    // Batch fetch Firestore recipes
    if (firestoreIds.length > 0) {
      const refs = firestoreIds.map((id) => adminDb.collection('recipes').doc(id));
      const snapshots = await adminDb.getAll(...refs);

      for (const snap of snapshots) {
        if (!snap.exists) continue;
        const data = snap.data() as Record<string, unknown>;
        // Only include public recipes
        if (!data.isPublic) continue;
        // Strip ownerId for privacy
        const { ownerId: _, ...safeData } = data;
        recipes.push({ id: snap.id, ...safeData } as unknown as Recipe);
      }
    }

    if (recipes.length < 2) {
      return NextResponse.json(
        { error: 'Not enough valid recipes found (need at least 2)' },
        { status: 400 },
      );
    }

    return NextResponse.json({ recipes });
  } catch (err) {
    console.error('[api/compare] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

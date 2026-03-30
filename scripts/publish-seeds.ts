/**
 * One-time script to publish seed recipes to Firestore with clean slugs.
 *
 * Run: npx tsx scripts/publish-seeds.ts
 *
 * Requires FIREBASE_ADMIN_KEY env var (or .env.local loaded).
 */

import { readFileSync } from 'fs';

// Load .env.local manually (avoid dotenv dependency)
try {
  const envFile = readFileSync('.env.local', 'utf-8');
  for (const line of envFile.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1].trim()]) {
      process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
    }
  }
} catch { /* env vars must already be set */ }

import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SEED_RECIPES } from '../src/data/seed-recipes';
import { RecipeCalculationService } from '../src/modules/beta-builder/domain/services/RecipeCalculationService';

const SLUG_MAP: Record<string, string> = {
  'seed-american-ipa': 'west-coast-ipa',
  'seed-saison': 'farmhouse-saison',
  'seed-irish-stout': 'irish-stout',
};

const serviceAccount = process.env.FIREBASE_ADMIN_KEY;
if (!serviceAccount) {
  console.error('FIREBASE_ADMIN_KEY not set');
  process.exit(1);
}

const app = initializeApp({
  credential: cert(JSON.parse(serviceAccount) as ServiceAccount),
});
const db = getFirestore(app);
const calc = new RecipeCalculationService();

async function publishSeeds() {
  for (const recipe of SEED_RECIPES) {
    const slug = SLUG_MAP[recipe.id];
    if (!slug) {
      console.warn(`No slug mapping for ${recipe.id}, skipping`);
      continue;
    }

    const stats = calc.calculate(recipe);
    const now = new Date().toISOString();
    const hopNames = [...new Set(recipe.hops.map((h) => h.name))];

    // Write recipe doc
    const recipeData = JSON.parse(JSON.stringify({
      ...recipe,
      isPublic: true,
      shareSlug: slug,
      publishedAt: now,
      ownerId: 'system',
    }));
    await db.collection('recipes').doc(recipe.id).set(recipeData);
    console.log(`  recipes/${recipe.id} ✓`);

    // Write public index
    const indexData = {
      name: recipe.name,
      style: recipe.style || '',
      ownerName: 'The Brewing.It Team',
      ownerId: 'system',
      shareSlug: slug,
      stats: {
        og: Math.round(stats.og * 1000) / 1000,
        fg: Math.round(stats.fg * 1000) / 1000,
        ibu: Math.round(stats.ibu),
        srm: Math.round(stats.srm * 10) / 10,
        abv: Math.round(stats.abv * 10) / 10,
      },
      tags: recipe.tags || [],
      labelUrl: null,
      hopNames,
      createdAt: recipe.createdAt,
      publishedAt: now,
      forkCount: 0,
      ratingSum: 0,
      ratingCount: 0,
    };
    await db.collection('publicRecipeIndex').doc(recipe.id).set(indexData);
    console.log(`  publicRecipeIndex/${recipe.id} ✓`);

    console.log(`Published: ${recipe.name} → /r/${slug}`);
  }

  console.log('\nDone! All seed recipes published.');
}

publishSeeds().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});

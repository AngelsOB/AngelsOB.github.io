import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/config/firebase-admin";
import { RecipeCalculationService } from "@/modules/beta-builder/domain/services/RecipeCalculationService";
import { generateShareSlug } from "@/modules/sharing/slugUtils";
import type { Recipe } from "@/modules/beta-builder/domain/models/Recipe";

export async function POST(req: NextRequest) {
  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let userId: string;
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      userId = decoded.uid;
    } catch {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    // Parse body
    const body = await req.json();
    const { recipeId } = body as { recipeId: string };
    if (!recipeId) {
      return NextResponse.json({ error: "recipeId is required" }, { status: 400 });
    }

    // Fetch recipe and verify ownership
    const recipeRef = adminDb.collection("recipes").doc(recipeId);
    const recipeSnap = await recipeRef.get();
    if (!recipeSnap.exists) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    const recipeData = recipeSnap.data() as Record<string, unknown>;
    if (recipeData.ownerId !== userId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Reuse existing slug or generate a new one
    let slug = recipeData.shareSlug as string | undefined;
    if (!slug) {
      slug = generateShareSlug(recipeData.name as string);
      const existingSlug = await adminDb
        .collection("recipes")
        .where("shareSlug", "==", slug)
        .limit(1)
        .get();
      if (!existingSlug.empty) {
        slug = generateShareSlug(recipeData.name as string);
      }
    }

    const now = new Date().toISOString();

    // Compute stats for the public recipe index
    const recipe = { id: recipeId, ...recipeData } as Recipe;
    const calcService = new RecipeCalculationService();
    const calc = calcService.calculate(recipe);

    // Get owner display name from Firebase Auth
    let ownerName = "Anonymous Brewer";
    try {
      const userRecord = await adminAuth.getUser(userId);
      ownerName = userRecord.displayName || ownerName;
    } catch {
      // Fallback to default
    }

    // Update recipe document
    await recipeRef.update({
      isPublic: true,
      shareSlug: slug,
      publishedAt: recipeData.publishedAt || now,
    });

    // Upsert publicRecipeIndex
    const hopNames = Array.isArray(recipe.hops)
      ? [...new Set(recipe.hops.map((h) => h.name))]
      : [];

    const indexRef = adminDb.collection("publicRecipeIndex").doc(recipeId);
    const indexSnap = await indexRef.get();
    const forkCount = indexSnap.exists ? (indexSnap.data()?.forkCount ?? 0) : 0;

    await indexRef.set({
      name: recipe.name,
      style: recipe.style || "",
      ownerName,
      ownerId: userId,
      shareSlug: slug,
      stats: {
        og: Math.round(calc.og * 1000) / 1000,
        fg: Math.round(calc.fg * 1000) / 1000,
        ibu: Math.round(calc.ibu),
        srm: Math.round(calc.srm * 10) / 10,
        abv: Math.round(calc.abv * 10) / 10,
      },
      tags: recipe.tags || [],
      hopNames,
      createdAt: recipe.createdAt,
      publishedAt: recipeData.publishedAt || now,
      forkCount,
    });

    return NextResponse.json({ slug, url: `/r/${slug}` });
  } catch (err) {
    console.error("[publish] Unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

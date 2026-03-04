import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/config/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
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

    const body = await req.json();
    const { recipeId } = body as { recipeId: string };
    if (!recipeId) {
      return NextResponse.json({ error: "recipeId is required" }, { status: 400 });
    }

    // Fetch the public recipe
    const recipeRef = adminDb.collection("recipes").doc(recipeId);
    const recipeSnap = await recipeRef.get();
    if (!recipeSnap.exists) {
      return NextResponse.json({ error: "Recipe not found" }, { status: 404 });
    }

    const recipeData = recipeSnap.data() as Record<string, unknown>;
    if (!recipeData.isPublic) {
      return NextResponse.json({ error: "Recipe is not public" }, { status: 403 });
    }

    // Create the forked recipe
    const now = new Date().toISOString();
    const newId = crypto.randomUUID();
    const originalRecipe = { id: recipeId, ...recipeData } as Recipe;

    // Get original owner name for attribution
    let parentOwnerName = "Anonymous Brewer";
    try {
      const ownerRecord = await adminAuth.getUser(recipeData.ownerId as string);
      parentOwnerName = ownerRecord.displayName || parentOwnerName;
    } catch {
      // Fallback
    }

    // Copy recipe data, stripping sharing fields
    const {
      isPublic: _isPublic,
      shareSlug: _shareSlug,
      publishedAt: _publishedAt,
      ...recipeFields
    } = recipeData;

    // Strip undefined via JSON round-trip (Firestore rejects undefined)
    const forkedData = JSON.parse(JSON.stringify({
      ...recipeFields,
      ownerId: userId,
      name: `${originalRecipe.name} (Fork)`,
      isPublic: false,
      currentVersion: 1,
      parentRecipeId: recipeId,
      parentVersionNumber: originalRecipe.currentVersion || 1,
      parentRecipeName: originalRecipe.name,
      parentRecipeOwnerName: parentOwnerName,
      createdAt: now,
      updatedAt: now,
    }));

    await adminDb.collection("recipes").doc(newId).set(forkedData);

    // Increment fork count on the public index
    const indexRef = adminDb.collection("publicRecipeIndex").doc(recipeId);
    const indexSnap = await indexRef.get();
    if (indexSnap.exists) {
      await indexRef.update({ forkCount: FieldValue.increment(1) });
    }

    return NextResponse.json({ recipeId: newId });
  } catch (err) {
    console.error("[fork] Unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

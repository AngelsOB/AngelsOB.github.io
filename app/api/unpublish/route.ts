import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/config/firebase-admin";

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

    // Update recipe document
    await recipeRef.update({
      isPublic: false,
      shareSlug: null,
      publishedAt: null,
    });

    // Delete from publicRecipeIndex
    await adminDb.collection("publicRecipeIndex").doc(recipeId).delete();

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[unpublish] Unhandled error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

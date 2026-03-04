import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/config/firebase-admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const limit = Math.min(Number(searchParams.get("limit")) || 24, 100);
    const after = searchParams.get("after") || null;
    const sort = searchParams.get("sort") || "newest";

    const orderField = sort === "popular" ? "forkCount" : "publishedAt";

    let q = adminDb
      .collection("publicRecipeIndex")
      .orderBy(orderField, "desc")
      .limit(limit + 1); // fetch one extra to detect if there's a next page

    if (after) {
      const afterDoc = await adminDb
        .collection("publicRecipeIndex")
        .doc(after)
        .get();
      if (afterDoc.exists) {
        q = q.startAfter(afterDoc);
      }
    }

    const snapshot = await q.get();
    const docs = snapshot.docs;

    const hasMore = docs.length > limit;
    const resultDocs = hasMore ? docs.slice(0, limit) : docs;

    const recipes = resultDocs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        name: data.name || "",
        style: data.style || "",
        ownerName: data.ownerName || "Anonymous Brewer",
        shareSlug: data.shareSlug || "",
        stats: data.stats || {},
        tags: data.tags || [],
        hopNames: data.hopNames || [],
        publishedAt: data.publishedAt || "",
        forkCount: data.forkCount || 0,
      };
    });

    const nextCursor = hasMore ? resultDocs[resultDocs.length - 1].id : null;

    return NextResponse.json({ recipes, nextCursor });
  } catch (err) {
    console.error("[browse] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

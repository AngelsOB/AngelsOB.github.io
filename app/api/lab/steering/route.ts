import { NextRequest, NextResponse } from "next/server";
import { loadCloud } from "@/modules/corpus-lab/steering/loadCloud";
import {
  RecipeSteeringService,
  type SteeringQuery,
} from "@/modules/corpus-lab/steering/RecipeSteeringService";
import type { Recipe } from "@/modules/recipe/models/Recipe";

/**
 * Dev-only steering-engine playground endpoint.
 *
 * DELIBERATE, ISOLATED exception to "the app imports nothing from corpus-lab"
 * (docs/corpus-lab-build.md) — this is the ONLY file in the app that imports
 * from the lab module. Delete this file + app/lab/steering-playground/ and the
 * exception is gone. Reads the gitignored local cloud.ndjson (never deployed,
 * see docs/corpus-lab-build.md §8 to regenerate it) — 404s outside development
 * on purpose rather than ever attempting this in a deployed environment.
 *
 * Bodies:
 *   { style, target?, … }              → steer(query)     (generate)
 *   { mode: "reflect", recipe, style? } → reflect(recipe)  (PRD-009 Phase 0)
 */

let cachedService: RecipeSteeringService | null = null;

// Loading + vectorizing the ~149k-record cloud is the expensive part
// (seconds); cache it across requests within this server process so only the
// first "Calculate" click pays that cost.
function getService(): RecipeSteeringService {
  if (!cachedService) {
    cachedService = new RecipeSteeringService(loadCloud());
  }
  return cachedService;
}

type ReflectBody = {
  mode: "reflect";
  recipe: Recipe;
  style?: string;
};

function isReflectBody(body: unknown): body is ReflectBody {
  if (!body || typeof body !== "object") return false;
  const b = body as Record<string, unknown>;
  return b.mode === "reflect" && !!b.recipe && typeof b.recipe === "object";
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const body = (await req.json().catch(() => null)) as unknown;
    if (isReflectBody(body)) {
      if (!Array.isArray(body.recipe.fermentables)) {
        return NextResponse.json({ error: "recipe.fermentables is required" }, { status: 400 });
      }
      const result = getService().reflect(body.recipe, { style: body.style });
      return NextResponse.json(result);
    }

    const query = body as SteeringQuery | null;
    if (!query?.style?.trim()) {
      return NextResponse.json({ error: "A style is required" }, { status: 400 });
    }
    const result = getService().steer(query);
    return NextResponse.json(result);
  } catch (err) {
    console.error("steering playground failed", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

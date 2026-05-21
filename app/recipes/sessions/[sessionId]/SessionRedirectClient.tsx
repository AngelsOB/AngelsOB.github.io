"use client";

/**
 * SessionRedirectClient — HS Brew Mode bridge (Phase 2.5b)
 *
 * Legacy entry points (RecipeListPage, RecipeSessionsBar, VersionHistoryModal)
 * push to /recipes/sessions/[sessionId]. This client component loads the session,
 * resolves its recipeId, and redirects to the new HS Brew Mode URL pattern:
 *   /recipes/[recipeId]?tab=brewsheet&session=[sessionId]
 *
 * Brief "Resuming brew session…" flash on first paint is acceptable — this URL
 * is only hit from old in-app links, never bookmarked or shared.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { useBrewSessionStore } from "@/modules/beta-builder/presentation/stores/brewSessionStore";
import { useAuthStore } from "@/modules/auth/authStore";
import { hsTokens } from "@/modules/hopskip/tokens";

interface Props {
  sessionId: string;
}

export default function SessionRedirectClient({ sessionId }: Props) {
  const router = useRouter();
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const currentSession = useBrewSessionStore((s) => s.currentSession);
  const loadSession = useBrewSessionStore((s) => s.loadSession);

  useEffect(() => {
    if (isAuthLoading) return;
    if (sessionId) loadSession(sessionId);
  }, [sessionId, isAuthLoading, loadSession]);

  useEffect(() => {
    if (
      currentSession &&
      currentSession.id === sessionId &&
      currentSession.recipeId
    ) {
      router.replace(
        `/recipes/${currentSession.recipeId}?tab=brewsheet&session=${sessionId}`
      );
    }
  }, [currentSession, sessionId, router]);

  return (
    <div
      style={{
        padding: "80px 24px",
        textAlign: "center",
        fontFamily: hsTokens.body,
        fontSize: 16,
        color: hsTokens.muted,
      }}
    >
      <div
        style={{
          fontFamily: hsTokens.script,
          fontSize: 22,
          color: hsTokens.water,
          marginBottom: 6,
        }}
      >
        resuming brew session ✦
      </div>
      <div>One moment…</div>
    </div>
  );
}

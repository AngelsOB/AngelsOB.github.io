/**
 * Last-used source water preference.
 *
 * One running value per brewer: the source water they last picked on any
 * recipe. localStorage is the synchronous read path (instant, works
 * signed-out); signed-in picks also mirror to
 * users/{uid}.lastUsedSourceWater so the pref follows the account.
 *
 * Cross-device sync rides the user-doc snapshot AuthProvider already
 * subscribes to: on every snapshot, hydrate() compares timestamps and
 * adopts the server copy when it's newer than what this device has.
 */

import { doc, setDoc } from "firebase/firestore";

import { db } from "@/config/firebase";
import { useAuthStore } from "@/modules/auth/authStore";
import type { WaterProfile } from "@/modules/recipe/services/WaterChemistryService";

const LAST_SOURCE_KEY = "hs-last-source-water";

export type StoredSource = {
  name: string;
  profile: WaterProfile;
  /** Epoch ms of the pick — used to resolve local-vs-server freshness. */
  at?: number;
};

export function readLastUsedSource(): StoredSource | null {
  try {
    const raw = window.localStorage.getItem(LAST_SOURCE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredSource;
    return parsed?.name && parsed?.profile ? parsed : null;
  } catch {
    return null;
  }
}

export function persistLastUsedSource(name: string, profile: WaterProfile) {
  const entry: StoredSource = { name, profile, at: Date.now() };
  try {
    window.localStorage.setItem(LAST_SOURCE_KEY, JSON.stringify(entry));
  } catch {
    // Best-effort; the intro just won't prefill on this device.
  }
  const uid = useAuthStore.getState().user?.uid;
  if (!uid) return;
  setDoc(
    doc(db, "users", uid),
    { lastUsedSourceWater: entry },
    { merge: true }
  ).catch(() => {
    // Account mirror is best-effort; localStorage already has it.
  });
}

/**
 * Called from AuthProvider's users/{uid} snapshot: adopt the account copy
 * when it's fresher than this device's (e.g. the user picked a source on
 * another machine). Entries without a timestamp (pre-timestamp writes)
 * only fill an empty device — they never clobber a local pick.
 */
export function hydrateLastUsedSource(userDocData: Record<string, unknown>) {
  const server = userDocData.lastUsedSourceWater as StoredSource | undefined;
  if (!server?.name || !server?.profile) return;
  const local = readLastUsedSource();
  if (local && (local.at ?? 0) >= (server.at ?? 1)) return;
  try {
    window.localStorage.setItem(LAST_SOURCE_KEY, JSON.stringify(server));
  } catch {
    // Storage unavailable — nothing to hydrate into.
  }
}

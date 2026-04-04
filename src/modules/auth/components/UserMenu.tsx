"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "../authStore";
import { usePreferencesStore } from "../preferencesStore";
import { useUserTier } from "../useUserTier";
import { toast } from "../../../stores/toastStore";
import TierBadge from "./TierBadge";

export default function UserMenu() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const defaultRecipePublic = usePreferencesStore((s) => s.defaultRecipePublic);
  const setDefaultRecipePublic = usePreferencesStore((s) => s.setDefaultRecipePublic);
  const attenuationModel = usePreferencesStore((s) => s.attenuationModel);
  const setAttenuationModel = usePreferencesStore((s) => s.setAttenuationModel);
  const loadPreferences = usePreferencesStore((s) => s.loadPreferences);
  const isLoaded = usePreferencesStore((s) => s.isLoaded);
  const { userState } = useUserTier();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Load preferences when user signs in
  useEffect(() => {
    if (user && !isLoaded) {
      loadPreferences(user.uid);
    }
  }, [user, isLoaded, loadPreferences]);

  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg p-1 transition-colors
          hover:bg-[color-mix(in_oklch,var(--fg-strong)_8%,transparent)] cursor-pointer"
        aria-expanded={open}
        aria-haspopup="true"
      >
        {user.photoURL ? (
          <img
            src={user.photoURL}
            alt=""
            className="h-7 w-7 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="h-7 w-7 rounded-full bg-[var(--coral-600)] text-white flex items-center justify-center text-xs font-medium">
            {(user.displayName ?? user.email ?? "?")[0].toUpperCase()}
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-lg border border-[rgb(var(--border))] bg-[var(--surface)] shadow-lg z-50">
          <div className="px-4 py-3 border-b border-[rgb(var(--border))]">
            <p className="text-sm font-medium text-[var(--fg-strong)] truncate">
              {user.displayName}
            </p>
            <p className="text-xs text-[var(--fg-muted)] truncate">
              {user.email}
            </p>
            <TierBadge />
          </div>

          {/* Preferences */}
          <div className="px-4 py-2.5 border-b border-[rgb(var(--border))] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--fg-muted)]">New recipes</span>
              <button
                onClick={() => {
                  const newValue = !defaultRecipePublic;
                  setDefaultRecipePublic(newValue, user.uid);
                  toast.success(
                    newValue
                      ? 'New recipes will be public by default'
                      : 'New recipes will be private by default'
                  );
                }}
                className="text-xs font-medium px-2 py-0.5 rounded-md transition-colors cursor-pointer
                  hover:bg-[color-mix(in_oklch,var(--fg-strong)_6%,transparent)]"
                style={{ color: 'var(--brew-accent-600)' }}
              >
                {defaultRecipePublic ? 'Public' : 'Private'}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--fg-muted)]">FG model</span>
              <button
                onClick={() => {
                  const cycle = { linear: 'enzyme_kinetics', enzyme_kinetics: 'brandam_ode', brandam_ode: 'linear' } as const;
                  const newValue = cycle[attenuationModel] ?? 'linear';
                  setAttenuationModel(newValue, user.uid);
                  const labels = { linear: 'Using linear FG model', enzyme_kinetics: 'Using enzyme kinetics FG model', brandam_ode: 'Using ODE kinetics FG model' } as const;
                  toast.success(labels[newValue]);
                }}
                className="text-xs font-medium px-2 py-0.5 rounded-md transition-colors cursor-pointer
                  hover:bg-[color-mix(in_oklch,var(--fg-strong)_6%,transparent)]"
                style={{ color: 'var(--brew-accent-600)' }}
              >
                {attenuationModel === 'enzyme_kinetics' ? 'Enzyme' : attenuationModel === 'brandam_ode' ? 'ODE' : 'Linear'}
              </button>
            </div>
          </div>

          <div className="py-1">
            <button
              onClick={() => {
                setOpen(false);
                router.push('/account');
              }}
              className="w-full text-left px-4 py-2 text-sm text-[var(--fg-muted)]
                hover:text-[var(--fg-strong)]
                hover:bg-[color-mix(in_oklch,var(--fg-strong)_6%,transparent)]
                transition-colors cursor-pointer"
            >
              {userState === 'premium' ? 'Manage Subscription' : 'Upgrade to Premium'}
            </button>
            <button
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className="w-full text-left px-4 py-2 text-sm text-[var(--fg-muted)]
                hover:text-[var(--fg-strong)]
                hover:bg-[color-mix(in_oklch,var(--fg-strong)_6%,transparent)]
                transition-colors cursor-pointer"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

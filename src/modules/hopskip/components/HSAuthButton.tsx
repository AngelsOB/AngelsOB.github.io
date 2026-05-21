"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";

import { hsTokens } from "../tokens";
import { useAuthStore } from "@/modules/auth/authStore";
import { useUserTier } from "@/modules/auth/useUserTier";
import { toast } from "@/stores/toastStore";

export default function HSAuthButton() {
  const user = useAuthStore((s) => s.user);
  const isAuthLoading = useAuthStore((s) => s.isLoading);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);
  const signOut = useAuthStore((s) => s.signOut);
  const { userState } = useUserTier();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (!rootRef.current) return;
      if (rootRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (isAuthLoading) {
    return (
      <div
        aria-hidden
        style={{
          width: 40,
          height: 40,
          borderRadius: 999,
          background: hsTokens.paper,
          border: `2px solid ${hsTokens.ink}`,
          boxShadow: hsTokens.sh1,
          opacity: 0.5,
        }}
      />
    );
  }

  if (!user) {
    return (
      <button
        type="button"
        onClick={async () => {
          try {
            await signInWithGoogle();
          } catch (err) {
            const code = (err as { code?: string } | null)?.code;
            const message =
              code === "auth/unauthorized-domain"
                ? "This domain isn't authorized in Firebase. Add it under Authentication → Settings → Authorized domains."
                : code === "auth/network-request-failed"
                ? "Network error during sign-in. Check your connection."
                : `Sign-in failed${code ? ` (${code})` : ""}`;
            toast.error(message);
          }
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 16px",
          background: hsTokens.paper,
          color: hsTokens.ink,
          border: `2px solid ${hsTokens.ink}`,
          borderRadius: 999,
          boxShadow: hsTokens.sh2,
          fontFamily: hsTokens.body,
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: "0.02em",
          textTransform: "uppercase",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
        title="Sign in with Google"
      >
        <svg width={14} height={14} viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        Sign in
      </button>
    );
  }

  const initial = (user.displayName ?? user.email ?? "?")[0].toUpperCase();

  const panelStyle: CSSProperties = {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    width: 240,
    background: hsTokens.paper,
    border: `2px solid ${hsTokens.ink}`,
    borderRadius: 12,
    boxShadow: hsTokens.sh3,
    zIndex: 40,
    overflow: "hidden",
    fontFamily: hsTokens.body,
  };

  const itemStyle: CSSProperties = {
    display: "block",
    width: "100%",
    textAlign: "left",
    padding: "10px 16px",
    fontFamily: hsTokens.body,
    fontSize: 13,
    fontWeight: 600,
    background: "transparent",
    color: hsTokens.ink,
    border: "none",
    cursor: "pointer",
  };

  return (
    <div ref={rootRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        title={user.displayName ?? user.email ?? "Account"}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: 40,
          height: 40,
          padding: 0,
          background: hsTokens.paper,
          border: `2px solid ${hsTokens.ink}`,
          borderRadius: 999,
          boxShadow: hsTokens.sh2,
          cursor: "pointer",
          overflow: "hidden",
        }}
      >
        {user.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.photoURL}
            alt=""
            referrerPolicy="no-referrer"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <span
            aria-hidden
            style={{
              fontFamily: hsTokens.display,
              fontSize: 16,
              fontWeight: 900,
              color: hsTokens.ink,
              background: hsTokens.malt,
              width: "100%",
              height: "100%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {initial}
          </span>
        )}
      </button>

      {open ? (
        <div role="menu" style={panelStyle}>
          <div
            style={{
              padding: "12px 16px",
              borderBottom: `2px solid ${hsTokens.ink}`,
              background: hsTokens.cream2,
            }}
          >
            <div
              style={{
                fontFamily: hsTokens.display,
                fontSize: 13,
                color: hsTokens.ink,
                fontWeight: 900,
                letterSpacing: "0.01em",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user.displayName ?? "Brewer"}
            </div>
            <div
              style={{
                fontFamily: hsTokens.mono,
                fontSize: 11,
                color: hsTokens.muted,
                marginTop: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {user.email}
            </div>
            <div
              style={{
                marginTop: 8,
                display: "inline-block",
                padding: "2px 8px",
                background: userState === "premium" ? hsTokens.honey : hsTokens.paper,
                border: `1.5px solid ${hsTokens.ink}`,
                borderRadius: 999,
                fontFamily: hsTokens.body,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: hsTokens.ink,
              }}
            >
              {userState === "premium" ? "Premium" : "Free"}
            </div>
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              router.push("/account");
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = hsTokens.cream2;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
            style={itemStyle}
          >
            {userState === "premium" ? "Manage subscription" : "Upgrade to Premium"}
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = hsTokens.cream2;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
            style={{
              ...itemStyle,
              borderTop: `1px solid ${hsTokens.cream2}`,
              color: hsTokens.roast,
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}

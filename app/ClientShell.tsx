'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";

import NavBar from "../src/components/NavBar";
import Footer from "../src/components/Footer";
import Toaster from "../src/components/Toaster";
import AuthProvider from "../src/modules/auth/components/AuthProvider";
import { useSrmTheme } from "../src/hooks/useSrmTheme";
import GrainOverlay, { GRAIN_DEFAULTS } from "../src/components/GrainOverlay";
import HSThemeWrapper from "../src/modules/hopskip/components/HSThemeWrapper";

export default function ClientShell({
  children,
}: {
  children: React.ReactNode;
}) {
  useSrmTheme();
  const pathname = usePathname() ?? "";
  // Only the explicit /betabuilder/* tree renders classic chrome.
  // /r/, /browse, /u/ now get HS chrome; their inner content may still be
  // classic until Phase 1 of the HopSkip migration ships HS replacements.
  const isClassic =
    pathname === "/betabuilder" ||
    pathname.startsWith("/betabuilder/");

  if (isClassic) {
    // Classic /betabuilder/* routes — keep the original NavBar + Footer chrome.
    return (
      <AuthProvider>
        <div id="app-shell" className="min-h-dvh text-[rgb(var(--text))] transition-colors">
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[rgb(var(--accent))] focus:text-white focus:rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--coral-600)]"
          >
            Skip to main content
          </a>
          <div
            style={{
              background: "var(--hs-ink, #1a1a1a)",
              color: "var(--hs-cream, #f5e9d5)",
              padding: 8,
              textAlign: "center",
              fontSize: 12,
            }}
          >
            You&rsquo;re viewing the classic UI. The new UI is at{" "}
            <Link href="/" style={{ textDecoration: "underline", color: "inherit" }}>
              brewing.it/
            </Link>
            .
          </div>
          <NavBar />
          <main
            id="main-content"
            className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6"
          >
            {children}
          </main>
          <Footer />
          <Toaster />
          <GrainOverlay {...GRAIN_DEFAULTS} />
        </div>
      </AuthProvider>
    );
  }

  // Hop & Skip is now the default for every other route.
  return (
    <AuthProvider>
      <HSThemeWrapper>{children}</HSThemeWrapper>
      <Toaster />
    </AuthProvider>
  );
}

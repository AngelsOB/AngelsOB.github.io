'use client';

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
  // /betabuilder/* are the explicit classic routes. /r/* (public recipe
  // viewer), /browse (community), and /u/* (user profile) wrap the classic
  // viewer components which depend on classic chrome — treat them as
  // classic for now until HS-native equivalents are built.
  const isClassic =
    pathname === "/betabuilder" ||
    pathname.startsWith("/betabuilder/") ||
    pathname.startsWith("/r/") ||
    pathname === "/browse" ||
    pathname.startsWith("/browse/") ||
    pathname.startsWith("/u/");

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

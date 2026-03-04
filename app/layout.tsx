'use client';

import "../src/index.css";
import NavBar from "../src/components/NavBar";
import Footer from "../src/components/Footer";
import Toaster from "../src/components/Toaster";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Google Fonts: Caveat + Rock Salt (handwritten) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@400;500;600;700&family=Shadows+Into+Light&family=Rock+Salt&display=swap"
          rel="stylesheet"
        />

        {/* Favicon and Icons */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="apple-touch-icon" href="/favicon.svg" />

        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#F5A623" />
        <meta
          name="apple-mobile-web-app-capable"
          content="yes"
        />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="BeerApp" />
      </head>
      <body>
        <div className="min-h-dvh text-[rgb(var(--text))] transition-colors">
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
        </div>
      </body>
    </html>
  );
}

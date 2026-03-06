import type { Metadata } from "next";
import "../src/index.css";
import ClientShell from "./ClientShell";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || "https://brewing.it.com"
  ),
  alternates: {
    canonical: "./",
  },
  title: {
    default: "BeerApp - Homebrewing Recipe Builder & Calculator",
    template: "%s | BeerApp",
  },
  description:
    "Design homebrewing recipes with precision. Calculate ABV, IBU, SRM, water chemistry, mash pH, and more. Free brewing calculator for all-grain and extract brewers.",
  keywords: [
    "homebrewing",
    "beer recipe",
    "brewing calculator",
    "ABV calculator",
    "IBU calculator",
    "water chemistry",
    "mash pH",
    "BJCP styles",
    "craft beer",
  ],
  authors: [{ name: "BeerApp" }],
  openGraph: {
    type: "website",
    title: "BeerApp - Homebrewing Recipe Builder & Calculator",
    description:
      "Design homebrewing recipes with precision. Calculate ABV, IBU, SRM, water chemistry, mash pH, and more.",
    siteName: "BeerApp",
  },
  twitter: {
    card: "summary_large_image",
    title: "BeerApp - Homebrewing Recipe Builder & Calculator",
    description:
      "Design homebrewing recipes with precision. Calculate ABV, IBU, SRM, water chemistry, mash pH, and more.",
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
    "apple-mobile-web-app-title": "BeerApp",
    "theme-color": "#F5A623",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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
      </head>
      <body>
        <ClientShell>{children}</ClientShell>
      </body>
    </html>
  );
}

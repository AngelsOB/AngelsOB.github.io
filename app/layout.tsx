import type { Metadata } from "next";
import Script from "next/script";
// Bitter, Shadows Into Light, and Rock Salt were dropped here on purpose:
// inline styles that referenced them were always remapped to the HS fonts by
// .hs-theme overrides, so they downloaded but never rendered.
import {
  Archivo_Black,
  Caveat,
  IBM_Plex_Mono,
  Space_Grotesk,
} from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "../src/index.css";
import ClientShell from "./ClientShell";

// Self-hosted via next/font: same Google fonts, zero render-blocking
// requests, size-matched fallbacks. Consumers reference the CSS variables
// (tokens.ts / tokens.css / index.css) — never the family names directly,
// since next/font rewrites them.
const archivoBlack = Archivo_Black({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-archivo-black",
  display: "swap",
});
const caveat = Caveat({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-caveat",
  display: "swap",
});
const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});
const spaceGrotesk = Space_Grotesk({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const fontVariables = [
  archivoBlack.variable,
  caveat.variable,
  ibmPlexMono.variable,
  spaceGrotesk.variable,
].join(" ");

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || "https://brewing.it.com"
  ),
  alternates: {
    canonical: "./",
  },
  title: {
    default: "Brewing.It - Homebrewing Recipe Builder & Calculator",
    template: "%s | Brewing.It",
  },
  description:
    "Design homebrewing recipes with precision. Calculate ABV, IBU, SRM, water chemistry, mash pH, and more. Free brewing calculator for all-grain and extract brewers.",
  authors: [{ name: "Brewing.It" }],
  openGraph: {
    type: "website",
    url: "/",
    title: "Brewing.It - Homebrewing Recipe Builder & Calculator",
    description:
      "Design homebrewing recipes with precision. Calculate ABV, IBU, SRM, water chemistry, mash pH, and more.",
    siteName: "Brewing.It",
  },
  twitter: {
    card: "summary_large_image",
    title: "Brewing.It - Homebrewing Recipe Builder & Calculator",
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
    "apple-mobile-web-app-title": "Brewing.It",
    "theme-color": "#F5A623",
  },
};

const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://brewing.it.com";

// Site-level entity schema: who we are (Organization) and what this site is
// (WebSite). Page-level schemas (Recipe, Article, FAQPage, BreadcrumbList)
// live on their own routes.
const siteJsonLd = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "Brewing.It",
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: "Brewing.It",
    url: SITE_URL,
    publisher: { "@id": `${SITE_URL}/#organization` },
  },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={fontVariables}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
      </head>
      <body>
        <ClientShell>{children}</ClientShell>
        <Analytics />
        {process.env.NODE_ENV === "production" && (
          <Script id="ms-clarity" strategy="afterInteractive">
            {`
              (function(c,l,a,r,i,t,y){
                  c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                  t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                  y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
              })(window, document, "clarity", "script", "x3yd1njxlt");
            `}
          </Script>
        )}
      </body>
    </html>
  );
}

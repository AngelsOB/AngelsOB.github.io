import type { Metadata } from "next";
import Script from "next/script";
import { Analytics } from "@vercel/analytics/next";
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
    default: "Brewing.It - Homebrewing Recipe Builder & Calculator",
    template: "%s | Brewing.It",
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
          href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Bitter:ital,wght@0,400;0,600;0,700;0,800;1,400&family=Caveat:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&family=Rock+Salt&family=Shadows+Into+Light&family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
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
